# Workspace Structure

This is an [Nx](https://nx.dev) monorepo managed with **pnpm workspaces** (`pnpm-workspace.yaml` points at `packages/*`). Nx version is pinned to `22.3.3`. Its primary purpose is to develop and publish the **`@nxlv/python`** Nx plugin.

## Top-level layout

```
.
├── packages/                 # all publishable projects + libraries (libsDir)
│   ├── nx-python/            # @nxlv/python  — the main plugin
│   ├── data-migration/       # @nxlv/data-migration — DynamoDB-style data migration plugin
│   ├── util/                 # @nxlv/util — shared string utilities library
│   └── data-migration-example/  # non-published example app (excluded from TS project refs/typecheck)
├── e2e/                      # appsDir per nx.json workspaceLayout (end-to-end projects)
├── tools/                    # workspace tooling/scripts
├── tests/setup.ts            # global Vitest setup (registers aws-sdk-client-mock matchers)
├── types/                    # ambient type declarations
├── nx.json                   # Nx config: targetDefaults, plugins, release config
├── tsconfig.base.json        # shared compilerOptions + project references
├── eslint.config.mjs         # root ESLint flat config
├── vitest.workspace.ts       # Vitest workspace aggregator
└── release.base.config.js    # shared release config (sharedGlobals input)
```

`nx.json` sets `workspaceLayout` to `{ appsDir: "e2e", libsDir: "packages" }`.

## Packages

| Package                           | npm name               | Type      | Notes                                                                        |
| --------------------------------- | ---------------------- | --------- | ---------------------------------------------------------------------------- |
| `packages/nx-python`              | `@nxlv/python`         | Nx plugin | Executors, generators, migrations, inference plugin. The focus of this repo. |
| `packages/data-migration`         | `@nxlv/data-migration` | Nx plugin | Migration executors/generators + a `migrator` runtime.                       |
| `packages/util`                   | `@nxlv/util`           | library   | Small pure string helpers (kebab-case, chunks, etc.).                        |
| `packages/data-migration-example` | (private)              | example   | Demonstrates `@nxlv/data-migration`; not released.                           |

Each package contains: `package.json`, `project.json` (Nx targets), `tsconfig.json` / `tsconfig.lib.json` / `tsconfig.spec.json`, `eslint.config.mjs`, `src/`, `README.md`, and (for plugins) `executors.json` / `generators.json` / `migrations.json`.

## Nx targets & caching

Targets are inferred by Nx plugins (`@nx/js/typescript` for `build`/`typecheck`, `@nx/eslint/plugin` for `lint`) plus explicit `test` (`@nx/vitest:test`) in each `project.json`. `targetDefaults` in `nx.json` enables caching for `build`, `lint`, `test` and declares `dependsOn: ["^build"]` for builds. The `production` named input excludes spec/mock/test-setup files.

## Tooling

- **Package manager:** pnpm (lockfile `pnpm-lock.yaml`).
- **Build:** `@nx/js:tsc` → emits to `packages/<pkg>/dist`, copying non-TS assets and the `*.json` plugin manifests.
- **Husky** git hooks + **lint-staged** (`lint-staged.config.js`): runs affected lint `--fix` and `nx format:write` on staged files.
- **Commitlint** (`commitlint.config.js`) + **Commitizen** (`.cz-config.js`) enforce Conventional Commits; commit with `pnpm commit`.
- **EditorConfig** (`.editorconfig`): 2-space indent, UTF-8, final newline, trim trailing whitespace (off for Markdown).

## Release

Configured under `nx.json` `release`:

- **Independent** project versioning (`projectsRelationship: "independent"`).
- Versions derived from **Conventional Commits**.
- Released projects: `nx-python`, `data-migration`, `util`.
- Per-project GitHub changelogs/releases; tag pattern `{projectName}-v{version}`.
- Release commit message: `chore: release [skip ci]`.
- CI runs on push/PR to `main` (`.github/workflows/ci.yml`): format check → `nx affected -t lint test build` → coverage merge/upload. Publishing is a separate `manual-publish.yml` (`workflow_dispatch` → `nx release publish`).
