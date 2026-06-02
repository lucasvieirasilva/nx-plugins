# Code Style

Conventions for this workspace. Most of it is enforced automatically — run `pnpm nx format:write` and the affected `lint` target before committing.

## Formatting (Prettier)

- Config: `.prettierrc` — the only override is **`singleQuote: true`**. Everything else is Prettier defaults (2-space indent, semicolons, trailing commas `all`, ~80 col width for code). Prose in Markdown is not wrapped (`proseWrap` is left at its default `preserve`).
- Run via Nx, not Prettier directly: `pnpm nx format:write` (apply) / `pnpm nx format:check` (CI).
- Ignored from formatting (`.prettierignore`): `dist`, `coverage`, `.nx/cache`, `.nx/workspace-data`, `pnpm-lock.yaml`, `CHANGELOG.md`.
- `.editorconfig` mirrors this: UTF-8, 2-space indent, final newline, trim trailing whitespace (trailing-whitespace trim is **off** for `*.md`, and `max_line_length` is off for Markdown).

## Linting (ESLint flat config)

- Root config: `eslint.config.mjs`; each package extends/has its own `eslint.config.mjs`.
- Built on `@nx/eslint-plugin` presets: `flat/base`, `flat/typescript`, `flat/javascript`.
- `**/dist` is ignored.
- Key rules:
  - **`@nx/enforce-module-boundaries`** — module-boundary constraints (currently any tag may depend on any tag, but cross-project imports must go through package entry points; `enforceBuildableLibDependency: true`).
  - **`@nx/dependency-checks`** (on `*.json`, parsed with `jsonc-eslint-parser`) — keeps each package's `package.json` dependencies in sync with what the code imports. Ignores `nx` and spec/mock/config files.
- Run: `pnpm nx lint <project>` or `pnpm nx affected -t lint`. lint-staged runs `lint --fix` on staged files automatically.

## TypeScript

Shared `compilerOptions` live in `tsconfig.base.json`; each package has `tsconfig.lib.json` (build) and `tsconfig.spec.json` (tests). Notable settings:

- `target`/`lib`: **ES2022**; `module`: `commonjs`; `moduleResolution`: `node`.
- **Strict-ish safety flags on:** `noImplicitOverride`, `noImplicitReturns`, `noUnusedLocals`, `noFallthroughCasesInSwitch`, `noEmitOnError`, `isolatedModules`.
- **Project references** + `composite: true` with `emitDeclarationOnly` / `declarationMap` (build is driven by `@nx/js:tsc`).
- `experimentalDecorators` + `emitDecoratorMetadata` enabled (used by data-migration).
- `importHelpers: true` (tslib) — keep `tslib` as a dependency in packages that emit helpers.

### Code conventions observed in the codebase

- Single quotes, semicolons, trailing commas — let Prettier handle it.
- Prefer named exports; `src/index.ts` is the package public surface (re-exports only).
- Import Node built-ins with the **`node:` prefix** for new code (e.g. `import { join } from 'node:path'`) — see recent commits; older files use bare `path`/`fs`.
- Use `@nx/devkit` helpers (`joinPathFragments`, `Tree`, `ExecutorContext`, `logger`) rather than hand-rolling path/IO logic where a devkit equivalent exists.
- Executors return `{ success: boolean }` and catch errors, printing them with `chalk`.
- Keep provider-specific logic behind the `BaseProvider` abstraction (see [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md)); don't branch on package manager in executors/generators.
- Define option/schema types next to each executor/generator (`schema.ts` / `schema.json`).

## Commits

- **Conventional Commits**, enforced by commitlint (`commitlint.config.js`, `@commitlint/config-conventional`; `body-max-line-length` disabled).
- This is a Commitizen-friendly repo — `git add` then run `pnpm commit` (or `git commit` and follow the prompts). Scopes are usually the package name, e.g. `fix(nx-python): ...`.
- Versioning and changelogs are derived from these commits at release time.
