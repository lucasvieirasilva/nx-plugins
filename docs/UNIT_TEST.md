# Unit Testing

Tests use **Vitest** and run through the Nx `@nx/vitest:test` executor. There are ~45 spec files, co-located with the code they test (`*.spec.ts` next to `*.ts`). The two dominant styles are **executor/provider tests** (mock the filesystem + child processes) and **generator tests** (drive an in-memory Nx `Tree`, assert with snapshots).

## Running tests

```bash
pnpm nx test nx-python            # one project
pnpm nx test util                 # another project
pnpm nx affected --target=test    # only what changed (used in CI)
```

CI (`.github/workflows/ci.yml`) runs `pnpm nx affected -t lint test build`, then merges and uploads coverage. Coverage is on by default (v8 provider).

## Configuration

- **Root workspace:** `vitest.workspace.ts` aggregates every `packages/**/vite.config.ts`, sets `globals: true`, and loads the global setup file `tests/setup.ts`.
- **Per package:** `packages/<pkg>/vitest.config.mts` defines `name`, `environment: 'node'`, `globals: true`, `watch: false`, the include glob `{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`, and coverage reporters (`text`, `html`, `cobertura`, `clover`, `json`, `json-summary`, `lcov`) written to `coverage/packages/<pkg>`.
- **Global setup** (`tests/setup.ts`): registers the `aws-sdk-client-mock-vitest` custom matchers (`toHaveReceivedCommandWith`, etc.) used by data-migration's AWS tests.
- `globals: true` means `describe`/`it`/`expect`/`beforeEach`/`vi` are available without imports (though specs usually still `import { vi } from 'vitest'`).
- TypeScript for tests is configured by each package's `tsconfig.spec.json`.

## Mocks (`packages/nx-python/src/utils/mocks/`)

Reusable `vi.mock` modules — import them for their **side effects** at the top of a spec:

```ts
import '../../utils/mocks/cross-spawn.mock';
import '../../utils/mocks/fs.mock';
```

- **`fs.mock.ts`** — replaces `fs`, `node:fs`, `fs/promises`, `node:fs/promises`, and `fs-extra` with **memfs** (an in-memory filesystem). It also polyfills recursive `cpSync`/`copySync`, `removeSync`, and `mkdirsSync`, which memfs lacks. Tests then seed files with `vol.fromJSON(...)` and reset with `vol.reset()`. Reads of `.wasm` files fall through to the **real** filesystem so the tree-sitter grammar (loaded by the dependency-inference plugin from `node_modules`) can be read even though the rest of the filesystem is in-memory.
- **`cross-spawn.mock.ts`** — mocks `cross-spawn` so `spawn.sync` is a `vi.fn()`. Tests control external commands (`poetry`, `uv`, `python`) by setting the return value / implementation.
- **`uuid.mock.ts`** — deterministic UUIDs.

## Pattern A — executor / provider tests

Example shape (`executors/add/executor.spec.ts`):

```ts
import { vi, MockInstance } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/cross-spawn.mock';
import '../../utils/mocks/fs.mock';
import * as poetryUtils from '../../provider/poetry/utils';
import { PoetryProvider } from '../../provider/poetry/provider';
import executor from './executor';
import spawn from 'cross-spawn';

describe('Add Executor', () => {
  afterEach(() => {
    vol.reset(); // wipe the in-memory FS
    vi.resetAllMocks();
  });

  describe('poetry', () => {
    beforeEach(() => {
      vi.spyOn(poetryUtils, 'checkPoetryExecutable').mockResolvedValue(undefined);
      vi.spyOn(poetryUtils, 'getPoetryVersion').mockResolvedValue('1.8.2');
      vi.spyOn(PoetryProvider.prototype, 'activateVenv').mockResolvedValue(undefined);
      vi.mocked(spawn.sync).mockReturnValue({ status: 0, output: [''], pid: 0, signal: null, stderr: null, stdout: null });
      vi.spyOn(process, 'chdir').mockReturnValue(undefined);
    });
    // ... it('should ...') assertions on result.success and on what spawn.sync was called with
  });
});
```

Conventions:

- Suites are split into `describe('poetry', ...)` and `describe('uv', ...)` since both providers share the executor.
- `vi.spyOn(...Utils, 'check<Pm>Executable')` is mocked so tests don't need a real binary.
- `process.chdir` is stubbed (executors `chdir` into the workspace root).
- Assert behavior by inspecting `spawn.sync` calls (the actual `poetry`/`uv` command) and the resulting `pyproject.toml` content read back from memfs.
- `dedent` (`string-dedent`) and `@iarna/toml` (`parse`/`stringify`) are used to build/compare TOML fixtures inline.

## Pattern B — generator tests (Tree + snapshots)

Example shape (`generators/uv-project/generator.spec.ts`):

```ts
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration, readNxJson } from '@nx/devkit';
import generator from './generator';

let appTree: Tree;
beforeEach(() => {
  vi.resetAllMocks();
  appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  vi.spyOn(uvUtils, 'checkUvExecutable').mockResolvedValue(undefined);
  // spawn.sync stubbed to fake `python --version`, etc.
});

it('scaffolds the project', async () => {
  await generator(appTree, options);
  expect(readProjectConfiguration(appTree, 'test')).toMatchSnapshot();
  expect(appTree.read('test/pyproject.toml', 'utf-8')).toMatchSnapshot();
});
```

Conventions:

- Use `createTreeWithEmptyWorkspace({ layout: 'apps-libs' })` for an in-memory Nx workspace — no real FS writes.
- Read results with devkit helpers (`readProjectConfiguration`, `readNxJson`, `tree.read(path, 'utf-8')`, `tree.exists(path)`).
- Generated files/config are verified with **`toMatchSnapshot()`**; snapshots live in `__snapshots__/` next to the spec (run `vitest -u` / `nx test <pkg> -- -u` to update them intentionally). Some generators keep additional fixtures under `__test__/` (e.g. `custom-template`).

## Conventions checklist

- Import the `vi.mock` side-effect modules **first**, before importing the unit under test.
- Reset between tests: `vol.reset()` (FS) and `vi.resetAllMocks()` in `afterEach`/`beforeEach`.
- Never hit a real `poetry`/`uv`/`python` binary or the real filesystem — mock the executable check and `cross-spawn`, use memfs or the Nx `Tree`.
- Keep one spec per source file, co-located, named `*.spec.ts`.
- `passWithNoTests` is enabled, so projects without tests don't fail the target.
