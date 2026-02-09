# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript library code.
- Major modules under `src/`: `app/` (public API + pane orchestration), `renderer/`, `input/`, `pty/`, `fonts/`, `theme/`, `wasm/`, and `selection/`.
- `tests/` contains Bun tests (`*.test.ts`).
- `scripts/` contains build/dev helpers (library build, theme generation, playground bootstrapping).
- `playground/` hosts the local demo app and static assets (`playground/public/`).
- `wasm/` contains Zig sources/build config for the terminal core.
- `docs/` holds usage and internals documentation. `reference/` is upstream/reference material; avoid routine edits there.

## Build, Test, and Development Commands
Use Bun `>=1.2.0`.

- `bun install`: install dependencies.
- `bun run build`: generate themes, build JS bundle, and emit type declarations into `dist/`.
- `bun run lint`: run `oxlint` across `src`, `playground`, `scripts`, and `tests`.
- `bun run format:check`: check formatting with `oxfmt`.
- `bun run format`: apply formatting fixes.
- `bun run test`: run full test suite.
- `bun run test:ci`: CI-safe suite (excludes `webgpu-glyph.test.ts`).
- `bun run playground`: start local playground workflow (PTY + dev server).
- `bun run pty`: start PTY websocket server only.

## Coding Style & Naming Conventions
- TypeScript ESM with 2-space indentation, semicolons, trailing commas, and double quotes (see `.oxfmtrc.json`).
- File names use kebab-case (example: `pane-app-manager.ts`).
- Use `PascalCase` for exported types/classes and `camelCase` for functions/variables.
- Keep public exports intentional in `src/index.ts`.
- Do not manually edit generated `src/theme/builtin-themes.ts`; run `bun run build:themes` instead.

## Testing Guidelines
- Framework: `bun:test`.
- Place tests in `tests/` and name files `<feature>.test.ts`.
- Write behavior-driven test names (for example, `mapKeyForPty normalizes ...`).
- Add regression tests for any renderer/input/theme/font behavior change.
- Run focused checks with `bun test tests/input-keymap.test.ts` before the full suite.

## Commit & Pull Request Guidelines
- Preferred commit format follows existing history: `feat:`, `fix(scope):`, `docs:`, `test:`, `chore:`.
- Keep commits scoped to one logical change.
- PRs should include:
  - a short impact summary,
  - linked issue(s),
  - validation commands run (`bun run lint`, `bun run format:check`, relevant tests),
  - screenshots/GIFs for playground or rendering-visible changes.
