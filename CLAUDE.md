# CLAUDE.md

Nx monorepo (pnpm + Nx 22) that publishes **@nxlv/python** (`packages/nx-python`), plus `@nxlv/data-migration` and the `@nxlv/util` library. TypeScript, tested with Vitest.

## Documentation index

- [docs/WORKSPACE_STRUCTURE.md](docs/WORKSPACE_STRUCTURE.md) — repo layout, packages, tooling, release flow.
- [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md) — how `@nxlv/python` works (providers, executors, generators, plugin).
- [docs/CODE_STYLE.md](docs/CODE_STYLE.md) — formatting (Prettier), linting (ESLint flat config), TypeScript conventions, commits.
- [docs/UNIT_TEST.md](docs/UNIT_TEST.md) — Vitest setup, memfs/cross-spawn mocks, Tree + snapshot testing.
- [CONTRIBUTING.md](CONTRIBUTING.md) — contributor workflow (build, test, local linking).
- [README.md](README.md) — project overview and published plugins.

## Quick commands

- Build all: `pnpm nx run-many --target=build --all`
- Test one project: `pnpm nx test nx-python`
- Test affected: `pnpm nx affected -t lint test build`
- Format: `pnpm nx format:write` (check with `pnpm nx format:check`)
- Commit: `git add` then `pnpm commit` (Commitizen / Conventional Commits).
