import "../scripts/setup-wgpu-polyfill";
import { test, expect } from "bun:test";
import { installPolyfill, GPUTextureUsage, GPUBufferUsage, GPUMapMode } from "wgpu-polyfill";
import { Font, buildAtlas, atlasToRGBA, PixelMode } from "../reference/text-shaper/src/index.ts";
import { GLYPH_SHADER_NEAREST } from "../src/renderer/shaders/glyph-wgsl.ts";

const FONT_PATH = "playground/public/fonts/SymbolsNerdFont-Regular.ttf";
const CP = 0xf011b;

async function loadFont() {
  const buffer = await Bun.file(FONT_PATH).arrayBuffer();
  return Font.loadAsync(buffer);
}

function alignBytesPerRow(bytesPerRow: number) {
  return Math.ceil(bytesPerRow / 256) * 256;
}

function copyRegionFromRGBA(
  rgba: Uint8Array,
  atlasWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const out = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const srcStart = ((y + row) * atlasWidth + x) * 4;
    const srcEnd = srcStart + width * 4;
    const dstStart = row * width * 4;
    out.set(rgba.subarray(srcStart, srcEnd), dstStart);
  }
  return out;
}

async function readTextureRegion(
  device: GPUDevice,
  texture: GPUTexture,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const bytesPerRow = width * 4;
  const aligned = alignBytesPerRow(bytesPerRow);
  const buffer = device.createBuffer({
    size: aligned * height,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer(
    { texture, origin: { x, y } },
    { buffer, bytesPerRow: aligned, rowsPerImage: height },
    { width, height, depthOrArrayLayers: 1 },
  );
  device.queue.submit([encoder.finish()]);
  await buffer.mapAsync(GPUMapMode.READ);
  const mapped = new Uint8Array(buffer.getMappedRange());
  const out = new Uint8Array(bytesPerRow * height);
  for (let row = 0; row < height; row += 1) {
    const srcStart = row * aligned;
    const srcEnd = srcStart + bytesPerRow;
    const dstStart = row * bytesPerRow;
    out.set(mapped.subarray(srcStart, srcEnd), dstStart);
  }
  buffer.unmap();
  return out;
}

function expectBytesEqual(a: Uint8Array, b: Uint8Array, label: string) {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      throw new Error(`${label}: mismatch at ${i} (${a[i]} != ${b[i]})`);
    }
  }
}

async function renderSanity(device: GPUDevice) {
  const target = device.createTexture({
    size: [4, 4, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });
  const module = device.createShaderModule({
    code: `
      struct VSOut { @builtin(position) position: vec4f };
      @vertex fn vsMain(@location(0) pos: vec2f) -> VSOut {
        var out: VSOut;
        out.position = vec4f(pos, 0.0, 1.0);
        return out;
      }
      @fragment fn fsMain() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `,
  });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vsMain",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: "fsMain",
      targets: [{ format: "rgba8unorm" }],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });
  const quad = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
  ]);
  const quadBuffer = device.createBuffer({
    size: quad.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(quadBuffer.getMappedRange()).set(quad);
  quadBuffer.unmap();

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: target.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, quadBuffer);
  pass.draw(6, 1, 0, 0);
  pass.end();
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();

  const out = await readTextureRegion(device, target, 0, 0, 4, 4);
  let max = 0;
  for (const v of out) {
    if (v > max) max = v;
  }
  return max > 0;
}

test("webgpu atlas upload matches CPU atlas data", async () => {
  installPolyfill();
  const adapter = await navigator.gpu.requestAdapter();
  expect(adapter).toBeTruthy();
  const device = await adapter!.requestDevice();

  const font = await loadFont();
  const glyphId = font.glyphIdForChar(String.fromCodePoint(CP));
  expect(glyphId).toBeTruthy();

  const atlas = buildAtlas(font, [glyphId], {
    fontSize: 22,
    sizeMode: "height",
    padding: 10,
    pixelMode: PixelMode.Gray,
  });
  const rgba = atlasToRGBA(atlas);
  const metrics = atlas.glyphs.get(glyphId)!;

  const texture = device.createTexture({
    size: [atlas.bitmap.width, atlas.bitmap.rows, 1],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const bytesPerRow = atlas.bitmap.width * 4;
  const aligned = alignBytesPerRow(bytesPerRow);
  let upload = rgba;
  if (aligned !== bytesPerRow) {
    const padded = new Uint8Array(aligned * atlas.bitmap.rows);
    for (let row = 0; row < atlas.bitmap.rows; row += 1) {
      const srcStart = row * bytesPerRow;
      const srcEnd = srcStart + bytesPerRow;
      const dstStart = row * aligned;
      padded.set(rgba.subarray(srcStart, srcEnd), dstStart);
    }
    upload = padded;
  }

  device.queue.writeTexture(
    { texture },
    upload,
    { bytesPerRow: aligned, rowsPerImage: atlas.bitmap.rows },
    { width: atlas.bitmap.width, height: atlas.bitmap.rows, depthOrArrayLayers: 1 },
  );

  const gpuRegion = await readTextureRegion(
    device,
    texture,
    metrics.atlasX,
    metrics.atlasY,
    metrics.width,
    metrics.height,
  );
  const cpuRegion = copyRegionFromRGBA(
    rgba,
    atlas.bitmap.width,
    metrics.atlasX,
    metrics.atlasY,
    metrics.width,
    metrics.height,
  );
  expectBytesEqual(gpuRegion, cpuRegion, "atlas region");
});

test("webgpu glyph render matches CPU sampling (nearest)", async () => {
  installPolyfill();
  const adapter = await navigator.gpu.requestAdapter();
  expect(adapter).toBeTruthy();
  const device = await adapter!.requestDevice();

  const renderOk = await renderSanity(device);
  if (!renderOk) {
    console.warn("wgpu-polyfill render path returned zeros; skipping render parity test");
    return;
  }

  const font = await loadFont();
  const glyphId = font.glyphIdForChar(String.fromCodePoint(CP));
  expect(glyphId).toBeTruthy();

  const atlas = buildAtlas(font, [glyphId], {
    fontSize: 22,
    sizeMode: "height",
    padding: 10,
    pixelMode: PixelMode.Gray,
  });
  const rgba = atlasToRGBA(atlas);
  const metrics = atlas.glyphs.get(glyphId)!;

  const texture = device.createTexture({
    size: [atlas.bitmap.width, atlas.bitmap.rows, 1],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const bytesPerRow = atlas.bitmap.width * 4;
  const aligned = alignBytesPerRow(bytesPerRow);
  let upload = rgba;
  if (aligned !== bytesPerRow) {
    const padded = new Uint8Array(aligned * atlas.bitmap.rows);
    for (let row = 0; row < atlas.bitmap.rows; row += 1) {
      const srcStart = row * bytesPerRow;
      const srcEnd = srcStart + bytesPerRow;
      const dstStart = row * aligned;
      padded.set(rgba.subarray(srcStart, srcEnd), dstStart);
    }
    upload = padded;
  }
  device.queue.writeTexture(
    { texture },
    upload,
    { bytesPerRow: aligned, rowsPerImage: atlas.bitmap.rows },
    { width: atlas.bitmap.width, height: atlas.bitmap.rows, depthOrArrayLayers: 1 },
  );

  const outputW = metrics.width;
  const outputH = metrics.height;
  const renderTarget = device.createTexture({
    size: [outputW, outputH, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const uniformBuffer = device.createBuffer({
    size: 8 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const uniforms = new Float32Array([outputW, outputH, 0, 0, 0, 0, 0, 0]);
  device.queue.writeBuffer(uniformBuffer, 0, uniforms);

  const quadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
  const quadBuffer = device.createBuffer({
    size: quadVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(quadBuffer.getMappedRange()).set(quadVertices);
  quadBuffer.unmap();

  const instance = new Float32Array([
    0, 0, // pos
    outputW, outputH, // size
    metrics.atlasX / atlas.bitmap.width,
    metrics.atlasY / atlas.bitmap.rows,
    (metrics.atlasX + metrics.width) / atlas.bitmap.width,
    (metrics.atlasY + metrics.height) / atlas.bitmap.rows,
    1, 1, 1, 1, // fg
    0, 0, 0, 1, // bg
  ]);
  const instanceBuffer = device.createBuffer({
    size: instance.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(instanceBuffer.getMappedRange()).set(instance);
  instanceBuffer.unmap();

  const module = device.createShaderModule({ code: GLYPH_SHADER_NEAREST });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vsMain",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
        {
          arrayStride: 64,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x2" },
            { shaderLocation: 2, offset: 8, format: "float32x2" },
            { shaderLocation: 3, offset: 16, format: "float32x2" },
            { shaderLocation: 4, offset: 24, format: "float32x2" },
            { shaderLocation: 5, offset: 32, format: "float32x4" },
            { shaderLocation: 6, offset: 48, format: "float32x4" },
          ],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: "fsMain",
      targets: [
        {
          format: "rgba8unorm",
          blend: {
            color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      {
        binding: 1,
        resource: device.createSampler({
          magFilter: "nearest",
          minFilter: "nearest",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
        }),
      },
      { binding: 2, resource: texture.createView() },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: renderTarget.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, quadBuffer);
  pass.setVertexBuffer(1, instanceBuffer);
  pass.draw(6, 1, 0, 0);
  pass.end();
  device.queue.submit([encoder.finish()]);

  const gpuOut = await readTextureRegion(device, renderTarget, 0, 0, outputW, outputH);
  const expected = new Uint8Array(outputW * outputH * 4);
  const atlasW = atlas.bitmap.width;
  const atlasH = atlas.bitmap.rows;
  for (let y = 0; y < outputH; y += 1) {
    for (let x = 0; x < outputW; x += 1) {
      const u =
        metrics.atlasX / atlasW +
        ((metrics.width / atlasW) * (x + 0.5)) / outputW;
      const v =
        metrics.atlasY / atlasH +
        ((metrics.height / atlasH) * (y + 0.5)) / outputH;
      const sx = Math.min(atlasW - 1, Math.max(0, Math.floor(u * atlasW)));
      const sy = Math.min(atlasH - 1, Math.max(0, Math.floor(v * atlasH)));
      const srcIdx = (sy * atlasW + sx) * 4 + 3;
      const alpha = rgba[srcIdx] ?? 0;
      const dstIdx = (y * outputW + x) * 4;
      expected[dstIdx] = alpha;
      expected[dstIdx + 1] = alpha;
      expected[dstIdx + 2] = alpha;
      expected[dstIdx + 3] = alpha;
    }
  }
  expectBytesEqual(gpuOut, expected, "render output");
});
