# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript library code and package entrypoints (`src/index.ts`, `src/internal.ts`, `src/xterm.ts`).
- Core modules under `src/`:
- `surface/`: public `Restty` API, pane orchestration, plugin runtime/dispatch.
- `runtime/`: terminal runtime (`create-runtime`), render loop/ticks, interaction lifecycle, atlas helpers.
- `renderer/`: shaders, glyph/shape drawing, WebGPU/WebGL setup.
- `input/` and `pty/`: ANSI/input mapping, PTY integration, Kitty protocol/media helpers.
- `fonts/` and `theme/`: font source/picker logic and theme catalog/builtin theme integration.
- `wasm/`: embedded wasm bridge and runtime ABI helpers.
- `selection/`, `ime/`, `grid/`, `unicode/`, `utils/`, and `xterm/`: supporting subsystems and compatibility layers.
- `tests/` contains Bun tests (`*.test.ts`).
- `scripts/` contains build/dev helpers (`build-lib`, `build-wasm`, `generate-builtin-themes`, `playground-dev`, `setup-wgpu-polyfill`).
- `playground/` hosts the local demo app and static assets (`playground/public/`).
- `assets/themes/` (with `assets/themes/manifest.json`) is the source for generated builtin themes.
- `wasm/` contains Zig sources/build config for the terminal core.
- `docs/` holds usage and internals documentation.
- `reference/` is upstream/reference material (including Ghostty source and text-shaper source code); check there when you need to inspect them, and avoid routine edits.

## Build, Test, and Development Commands
Use Bun `>=1.2.0`.

- `bun install`: install dependencies.
- `bun run setup:wgpu-polyfill`: bootstrap local `wgpu-polyfill` artifacts when missing.
- `bun run clean:dist`: reset `dist/`.
- `bun run build:themes`: regenerate `src/theme/builtin-themes.ts` from `assets/themes/manifest.json`.
- `bun run build:wasm`: build Zig wasm module and regenerate `src/wasm/embedded.ts`.
- `bun run build:lib`: bundle ESM library entrypoints into `dist/`.
- `bun run build:types`: emit declaration files with `tsc`.
- `bun run build`: generate themes, build JS bundle, and emit type declarations into `dist/`.
- `bun run build:playground-app`: bundle playground application assets.
- `bun run build:assets`: alias for playground app build.
- `bun run check:themes`: verify generated themes are up to date.
- `bun run lint`: run `oxlint` across `src`, `playground`, `scripts`, and `tests`.
- `bun run format:check`: check formatting with `oxfmt`.
- `bun run format`: apply formatting fixes.
- `bun run test`: run full test suite.
- `bun run test:ci`: CI-safe suite (excludes `webgpu-glyph.test.ts`).
- `bun run playground`: start local playground workflow (PTY + dev server).
- `bun run pty`: start PTY websocket server only.
- `bun run playground:static`: serve static playground files.

## Coding Style & Naming Conventions
- TypeScript ESM with 2-space indentation, semicolons, trailing commas, and double quotes (see `.oxfmtrc.json`).
- File names use kebab-case (example: `pane-app-manager.ts`).
- Use `PascalCase` for exported types/classes and `camelCase` for functions/variables.
- Keep public exports intentional in `src/index.ts`.
- Do not manually edit generated `src/theme/builtin-themes.ts`; run `bun run build:themes` instead.
- Do not manually edit generated `src/wasm/embedded.ts`; run `bun run build:wasm` instead.

## Testing Guidelines
- Framework: `bun:test`.
- Place tests in `tests/` and name files `<feature>.test.ts`.
- Write behavior-driven test names (for example, `mapKeyForPty normalizes ...`).
- Add regression tests for any renderer/input/theme/font behavior change.
- Run focused checks with `bun test tests/input-keymap.test.ts` (or another target file) before the full suite.

## Commit & Pull Request Guidelines
- Preferred commit format follows existing history: `feat:`, `fix(scope):`, `docs:`, `test:`, `chore:`.
- Keep commits scoped to one logical change.
- PRs should include:
  - a short impact summary,
  - linked issue(s),
  - validation commands run (`bun run lint`, `bun run format:check`, relevant tests),
  - screenshots/GIFs for playground or rendering-visible changes.
