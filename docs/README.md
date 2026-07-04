# restty documentation

The canonical public documentation lives in `../playground/content/docs/` and is published at
`https://restty.pages.dev/docs`.

This `docs/` folder is for legacy repository notes, internal architecture references, and
development specs. Prefer the hosted docs for user-facing integration guidance.

Live demo: `https://restty.pages.dev/`

## Start Here

If you are integrating restty into an app, read in this order:
1. [`../README.md`](../README.md) for the npm package entrypoint.
2. [`../playground/content/docs/getting-started.mdx`](../playground/content/docs/getting-started.mdx) for canonical setup docs.
3. [`usage.md`](./usage.md) for legacy integration notes.
4. [`how-it-works.md`](./how-it-works.md) for runtime mental model.

## User-Facing Docs

- [`goals.md`](./goals.md): scope and project intent.
- [`usage.md`](./usage.md): API-first integration guide.
- [`xterm-compat.md`](./xterm-compat.md): xterm-style compatibility layer.
- [`plugins.md`](./plugins.md): plugin authoring, manifest loading, and shader render stages.
- [`how-it-works.md`](./how-it-works.md): PTY/input/render data flow.

## Internal Docs

- [`internals/overview.md`](./internals/overview.md)
- [`internals/api.md`](./internals/api.md)
- [`internals/decisions.md`](./internals/decisions.md)
- [`internals/fonts.md`](./internals/fonts.md)
- [`internals/rendering.md`](./internals/rendering.md)
- [`internals/shaping.md`](./internals/shaping.md)
- [`internals/wasm-core.md`](./internals/wasm-core.md)
- [`internals/wasm-abi.md`](./internals/wasm-abi.md)

## Development Docs

- [`development/runtime-surface-refactor-spec.md`](./development/runtime-surface-refactor-spec.md)
- [`development/playground.md`](./development/playground.md)
- [`development/roadmap.md`](./development/roadmap.md)
- [`development/search.md`](./development/search.md)
