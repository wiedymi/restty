# Plugin Authoring

This guide covers authoring native `restty` plugins.

## Plugin contract

```ts
import type {
  ResttyPlugin,
  ResttyPluginContext,
  RESTTY_PLUGIN_API_VERSION,
} from "restty";

export const examplePlugin: ResttyPlugin = {
  id: "acme/example",
  version: "1.0.0",
  apiVersion: RESTTY_PLUGIN_API_VERSION,
  requires: {
    pluginApi: { min: RESTTY_PLUGIN_API_VERSION, max: RESTTY_PLUGIN_API_VERSION },
  },
  activate(ctx: ResttyPluginContext) {
    const paneCreated = ctx.on("pane:created", ({ paneId }) => {
      console.log("pane created", paneId);
    });

    const inputFilter = ctx.addInputInterceptor(({ text }) => text);
    const outputFilter = ctx.addOutputInterceptor(({ text }) => text);
    const lifecycle = ctx.addLifecycleHook(({ phase, action }) => {
      console.log(phase, action);
    });
    const render = ctx.addRenderHook(({ phase, paneId }) => {
      console.log(phase, paneId);
    });
    const tintStage = ctx.addRenderStage({
      id: "acme/tint",
      mode: "after-main",
      uniforms: [0.08],
      shader: {
        wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  return vec4f(min(vec3f(1.0), color.rgb + vec3f(params0.x, 0.0, 0.0)), color.a);
}
`,
      },
    });

    return () => {
      paneCreated.dispose();
      inputFilter.dispose();
      outputFilter.dispose();
      lifecycle.dispose();
      render.dispose();
      tintStage.dispose();
    };
  },
};
```

## Metadata and compatibility

- `id`: required stable identifier (`namespace/name` recommended).
- `version`: plugin version string for diagnostics.
- `apiVersion`: exact plugin API version expected by the plugin.
- `requires.pluginApi`: exact value or `{ min, max }` range.

If compatibility checks fail, `restty.use(plugin)` throws and the failure appears in `restty.pluginInfo(...)`.

## Runtime API

- `await restty.use(plugin, options?)`: activate plugin once (plugin receives `ctx.options` and second `activate` arg).
- `await restty.loadPlugins(manifest, registry)`: load declarative manifest entries from a plugin registry.
- `restty.unuse(pluginId)`: deactivate plugin and run cleanup.
- `restty.plugins()`: active plugin IDs.
- `restty.pluginInfo(pluginId?)`: diagnostics snapshot (active state, errors, listener/interceptor/hook counts).
- `pluginInfo(...).renderStages`: number of active shader stages owned by a plugin.

Manifest/registry:

- Manifest entry: `{ id, enabled?, options? }`.
- Registry entry: plugin object or async loader function.
- `loadPlugins` returns per-entry status: `loaded | skipped | missing | failed`.

## Interceptors

- `addInputInterceptor`: intercepts program/key input before terminal write.
- `addOutputInterceptor`: intercepts PTY output before render queue.
- Return behavior:
- `string`: replace payload text.
- `null`: drop payload.
- `void`: pass through.

Ordering:

- Lower `priority` runs first.
- Same `priority` uses registration order.

## Lifecycle and render hooks

- `addLifecycleHook`: observe high-level API lifecycle around pane operations (`create-initial-pane`, `split-*`, `close-pane`, `set-active-pane`, `mark-pane-focused`, `connect-pty`, `disconnect-pty`, `resize`, `focus`, `blur`).
- `addRenderHook`: observe render pipeline phases around PTY output (`before`/`after`) with `dropped` state.
- Hooks are observation points; use interceptors when you need to mutate/drop text.

## Render stages (shader plugins)

- `addRenderStage(stage)`: register a GPU frame stage owned by the plugin.
- Returns `ResttyRenderStageHandle` with:
- `setUniforms(number[])`: update stage uniforms (`params0`/`params1`, max 8 values).
- `setEnabled(boolean)`: enable/disable without removing the stage.
- `dispose()`: remove the stage.

Stage notes:

- `id` should be stable for updates.
- `mode`: `before-main` | `after-main` | `replace-main`.
- `backend`: `webgpu` | `webgl2` | `both`.
- Provide `shader.wgsl`, `shader.glsl`, or both.
- Use `onError(message)` to capture compile/runtime failures.

## Safety expectations

- Interceptors and event listeners are isolated; thrown errors are logged and processing continues.
- Cleanup must be idempotent.
- Keep hooks fast; these run on hot paths.

## Recommended practices

- Keep plugin state local to `activate`.
- Always hold disposers and release them in cleanup.
- Avoid mutating global state or DOM directly unless necessary.
- Use deterministic IDs and semantic versions.
