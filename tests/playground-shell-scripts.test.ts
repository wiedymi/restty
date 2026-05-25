import { expect, test } from "bun:test";
import { PLAYGROUND_SHELL_SCRIPTS } from "../playground/app/lib/pty/playground-shell-scripts.ts";
import { loadResttyWasm } from "../src/wasm/runtime/restty-wasm";

function scriptByTarget(target: string): string {
  const script = PLAYGROUND_SHELL_SCRIPTS.find((candidate) => candidate.target === target);
  expect(script).toBeDefined();
  return script!.fallback;
}

function extractSingleQuotedEchoPayload(script: string, needle: string): string {
  const line = script.split("\n").find((candidate) => candidate.includes(needle));
  expect(line).toBeDefined();
  expect(line!.startsWith("echo '")).toBe(true);
  expect(line!.endsWith("'")).toBe(true);
  return line!.slice("echo '".length, -1);
}

test("playground shell scripts stay jsh-compatible while emitting real terminal controls", () => {
  for (const script of PLAYGROUND_SHELL_SCRIPTS) {
    expect(script.fallback.startsWith("#!/usr/bin/env sh\n")).toBe(true);
    expect(script.fallback).not.toMatch(/\b(?:for|while|printf|node)\b/);

    for (const line of script.fallback.trimEnd().split("\n").slice(1)) {
      expect(line.startsWith("echo '")).toBe(true);
    }
  }

  expect(scriptByTarget("colors.sh")).toContain("\x1b[48;5;196m");
  expect(scriptByTarget("colors.sh")).toContain("\x1b[38;2;255;100;0mOrange");
  expect(scriptByTarget("test.sh")).toContain("\x1b[1mBold");
  expect(scriptByTarget("ansi-art.sh")).toContain("\x1b[1;38;5;81m");
  expect(scriptByTarget("animation.sh")).toContain("\x1b[38;5;46m");
});

test("playground kitty shell script emits a valid direct-medium image packet", async () => {
  const packet = extractSingleQuotedEchoPayload(scriptByTarget("kitty.sh"), "\x1b_Ga=T");
  const wasm = await loadResttyWasm();
  const handle = wasm.create(100, 40, 1000);
  expect(handle).toBeGreaterThan(0);

  wasm.setPixelSize(handle, 1000, 800);
  wasm.write(handle, packet);
  wasm.renderUpdate(handle);

  const placements = wasm.getKittyPlacements(handle);
  wasm.destroy(handle);

  expect(placements.length).toBeGreaterThan(0);
  expect(placements[0]!.imageFormat).toBe(3);
  expect(placements[0]!.imageWidth).toBe(32);
  expect(placements[0]!.imageHeight).toBe(18);
});
