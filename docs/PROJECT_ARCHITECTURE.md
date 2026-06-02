# Project Architecture — `@nxlv/python`

`@nxlv/python` (`packages/nx-python`) is an Nx plugin that brings Python projects into an Nx workspace. It supports two Python package managers — **Poetry** and **uv** — behind a single abstraction, and exposes them to Nx through **executors**, **generators**, **migrations**, and a **dependency-inference plugin**. The package public surface is `src/index.ts`, which re-exports `./plugins/plugin`; `package.json` also exports `./release/version-actions`.

## High-level layers

```
Nx (CLI / graph / release)
        │
        ▼
executors.json / generators.json / migrations.json   ← manifests (point at ./dist/...)
        │
        ▼
src/executors/*   src/generators/*   src/migrations/*   src/plugins/plugin.ts   src/release/*
        │
        └──────────────► src/provider (getProvider) ──────────► Poetry | uv implementations
```

Executors and generators almost never talk to Poetry/uv directly. They resolve a **provider** and call methods on it, so package-manager differences stay in one place.

## Provider abstraction (`src/provider/`)

- **`base.ts`** — `abstract class BaseProvider<TPyprojectToml>`. Defines the contract every provider implements: `checkPrerequisites`, `add`, `update`, `remove`, `install`, `build`, `lock`, `sync`, dependency/metadata reads, `getPyprojectToml`, `fileExists`, `getModulesFolders`, etc. It also defines shared domain types (`Dependency`, `PackageDependency`, `ProjectMetadata`, `SyncGeneratorResult`, …). The provider can operate on the real filesystem **or** on an Nx `Tree` (passed optionally to the constructor) — this is how the same logic serves both executors (runtime, real FS) and generators (virtual Tree).
- **`resolver.ts`** — `getProvider(workspaceRoot, logger?, tree?, context?, options?)`. This is the single entry point used everywhere. Resolution order:
  1. If a `Tree` is provided, `workspaceRoot` is normalized to `'.'` (relative paths in generators).
  2. If the plugin option `packageManager` is set (`'poetry'` | `'uv'`), use that explicitly.
  3. Otherwise auto-detect: inspect the project's `pyproject.toml` (via `context`) and/or the presence of `uv.lock` vs `poetry.lock`. Both lockfiles present → throws (ambiguous).
  4. Defaults to Poetry when nothing else matches.
- **`poetry/`** and **`uv/`** — each has `provider.ts` (the `BaseProvider` implementation), `types.ts` (`PoetryPyprojectToml` / `UVPyprojectToml`), `utils.ts` (e.g. `checkPoetryExecutable`, `checkUvExecutable`, version probing, TOML parsing), and `build/` for packaging.
- **`utils.ts`** — shared TOML helpers: `getPyprojectData` (real FS) and `readPyprojectToml` (Tree-based).

### Build sub-system (`provider/<pm>/build/`)

`build/builder.ts` plus `build/resolvers/` (`project.ts`, `locked.ts`, `utils.ts`) handle assembling a buildable/publishable artifact — resolving dependencies either from the project definition or from the lockfile (locked versions), and optionally bundling local dependencies.

## Executors (`src/executors/`, manifest `executors.json`)

Thin async functions of the shape `executor(options, context) => { success }`. Each lives in its own folder with `executor.ts`, `schema.ts` (TS type), `schema.json` (Nx option schema), and a `executor.spec.ts`. The typical body: `process.chdir(context.root)`, `getProvider(...)`, call the matching provider method, catch errors and print with `chalk`.

Available executors include: `add`, `remove`, `update`, `install`, `lock`, `sync`, `build`, `publish`, `flake8`, `ruff-check`, `ruff-format`, `tox`, `run-commands`, `sls-package`, `sls-deploy`, `package-project`, `package-dependencies`. Shared helpers live in `executors/utils/` (e.g. `Logger`).

## Generators (`src/generators/`, manifest `generators.json`)

Operate on the Nx `Tree`. Each folder has `generator.ts`, `schema.ts`/`schema.json`, a `files/` template directory, and tests in `generator.spec.ts` / `__test__/` with `__snapshots__/`. Key generators:

- `poetry-project` / `uv-project` — scaffold a Python project for the respective manager (templates under `files/`: `base`, `pytest`, `flake8`, `standard`, `src-dir`).
- `project` — legacy combined generator.
- `migrate-to-shared-venv` — convert isolated venvs to a single shared venv.
- `enable-releases` (hidden) — wire a Python project into Nx release.
- `pkg-sync` — keep `pyproject.toml` dependencies in sync.

## Dependency-inference plugin (`src/plugins/plugin.ts`)

Implements Nx's `createDependencies` (and `createNodes`-style inference). When the plugin option `inferDependencies` is enabled, it scans each project's Python modules, builds module↔project maps, and parses `import`/`from` statements to add implicit/static/dynamic dependencies to the Nx project graph. Results are cached (`cachedScannedFiles`, `hashFile`). Plugin options are typed in `src/types.ts` (`PluginOptions = { packageManager?, inferDependencies? }`).

Imports are parsed with **tree-sitter** (`extractImportedModules`) rather than a regular expression, so aliases (`import a as b`), multi-imports (`import a, b`) and relative imports are handled correctly and `import`-looking text inside comments/strings is ignored. The parser is loaded lazily and cached (`getPythonParser`) from the prebuilt WebAssembly grammar:

- [`web-tree-sitter`](https://www.npmjs.com/package/web-tree-sitter) provides the WASM runtime.
- [`tree-sitter-wasms`](https://www.npmjs.com/package/tree-sitter-wasms) ships the prebuilt `out/tree-sitter-python.wasm` grammar, resolved at runtime via `require.resolve`.

We deliberately use the WASM runtime instead of the native `tree-sitter` Node bindings: the native addon does not build on Node.js 24 (see [tree-sitter/node-tree-sitter#268](https://github.com/tree-sitter/node-tree-sitter/issues/268)), whereas the WASM build needs no native compilation and works on every platform/Node version. The two versions must stay ABI-compatible — `tree-sitter-wasms` grammars are built with an older `tree-sitter-cli`, so `web-tree-sitter` is pinned to the matching `0.20.x` line.

## Migrations (`src/migrations/`, manifest `migrations.json`)

Nx migration generators (e.g. `update-16-1-0`) that run on `nx migrate` to update consuming workspaces between versions of the plugin.

## Release integration (`src/release/version-actions.ts`)

Exported via `@nxlv/python/release/version-actions`, this plugs Python projects into Nx's release/versioning pipeline so `pyproject.toml` versions are bumped alongside the JS packages.

## Other packages (brief)

- **`@nxlv/data-migration`** (`packages/data-migration`) — executors/generators plus a `migrator/` runtime for running data migrations (uses AWS SDK clients; decorators enabled).
- **`@nxlv/util`** (`packages/util`) — small pure string helpers (`to-kebab-case`, `chunks`, `camel-case-to-title`, …), consumed by the other packages.

See [WORKSPACE_STRUCTURE.md](WORKSPACE_STRUCTURE.md) for repo layout and [UNIT_TEST.md](UNIT_TEST.md) for how all of this is tested.
