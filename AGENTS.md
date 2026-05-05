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
- `playground/` hosts the React Router playground and Fumadocs MDX docs:
  - `playground/app/`: React Router source.
  - `playground/content/docs/`: Fumadocs MDX pages.
  - `playground/public/`: authored static demo/font assets.
  - `playground/dist/`: generated build output (ignored).
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
- `bun run playground:build`: build the standalone playground into `playground/dist/`.
- `bun run check:themes`: verify generated themes are up to date.
- `bun run lint`: run `oxlint` across `src`, `playground`, `scripts`, and `tests`.
- `bun run format:check`: check formatting with `oxfmt`.
- `bun run format`: apply formatting fixes.
- `bun run test`: run full test suite.
- `bun run test:ci`: CI-safe suite (excludes `webgpu-glyph.test.ts`).
- `bun run playground`: start local playground workflow (PTY + Vite dev server at `/`).
- `bun run playground:pty`: start PTY websocket server only.
- `bun run playground:preview`: serve the built playground from `playground/dist/`.

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
- Mark breaking public API commits with `!` or a `BREAKING CHANGE:` footer.
- Keep commits scoped to one logical change.
- PRs should include:
  - a short impact summary,
  - linked issue(s),
  - validation commands run (`bun run lint`, `bun run format:check`, relevant tests),
  - screenshots/GIFs for playground or rendering-visible changes.

## Release Flow

- Releases are tag-driven. Do not publish from an arbitrary workflow dispatch.
- A release commit on `main` must update `package.json` and `CHANGELOG.md` before tagging.
- The tag must be annotated and match the package version exactly: `v0.2.0` for `"version": "0.2.0"`.
- The publish workflow validates the tag, package version, changelog section, generated themes, formatting, lint, package build, playground build, and `test:ci` before publishing.
- The publish workflow then publishes to npm and creates a GitHub Release from the matching `CHANGELOG.md` section.
- Do not edit `package.json` from the publish workflow; the repository commit is the source of truth.
- Release command shape:

```sh
git checkout main
git pull --ff-only
# prepare package.json + CHANGELOG.md in a release PR/commit first
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

## Changelog Guidelines

- Keep an `[Unreleased]` section at the top of `CHANGELOG.md`.
- For a release, move relevant entries from `[Unreleased]` into a version heading like `## [0.2.0] - 2026-05-04`.
- Use only these categories when they apply: `Breaking Changes`, `Migration`, `Features`, `Fixes`, `Internal`, `Playground`, `Docs`.
- Put user-facing API breaks under `Breaking Changes` and include concrete `before -> after` migration notes under `Migration`.
- Keep internal refactors under `Internal`; do not present them as user-facing features unless they change public behavior.
- Before tagging, verify release notes can be extracted:

```sh
bun run scripts/extract-changelog-release-notes.ts 0.2.0 /tmp/release-notes.md
```
