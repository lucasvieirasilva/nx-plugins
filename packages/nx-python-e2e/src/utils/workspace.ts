import { execSync, ExecSyncOptions } from 'child_process';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

// Must match the port of the `local-registry` target (see root package.json).
const LOCAL_REGISTRY = 'http://localhost:4873';

/** The active interpreter's `major.minor`, e.g. "3.12". */
function detectPythonVersion(): string {
  const output = execSync('python --version', { encoding: 'utf-8' });
  const match = output.match(/(\d+\.\d+)/);
  if (!match) {
    throw new Error(`Unable to detect Python version from: "${output.trim()}"`);
  }
  return match[1];
}

// The generators default the Python range to `>=3.9,<3.11`, which cannot resolve
// against the interpreter used to run the e2e (and would break the CI matrix
// that varies the Python version). Pin the generated project to the ACTIVE
// interpreter so Poetry/uv can install and build regardless of which version
// the matrix provides.
export const PY_VERSION_ARGS = `--pyprojectPythonDependency=">=3.9,<4" --pyenvPythonVersion=${detectPythonVersion()}`;

export interface PluginRegistration {
  packageManager?: 'poetry' | 'uv';
  inferDependencies?: boolean;
}

export interface TestWorkspace {
  /** Absolute path to the scratch workspace root. */
  readonly dir: string;
  /** Run an arbitrary shell command in the workspace root. Returns stdout. */
  run(command: string, options?: ExecSyncOptions): string;
  /** Run `nx <args>` in the workspace. Returns stdout. */
  nx(args: string, options?: ExecSyncOptions): string;
  /** Run an `@nxlv/python` generator. */
  generate(generator: string, args?: string): string;
  /** Read a file relative to the workspace root. */
  readFile(relativePath: string): string;
  /** Read + parse a JSON file relative to the workspace root. */
  readJson<T = Record<string, unknown>>(relativePath: string): T;
  /** Write a file relative to the workspace root. */
  writeFile(relativePath: string, content: string): void;
  /** Serialize + write a JSON file relative to the workspace root. */
  writeJson(relativePath: string, content: unknown): void;
  /** Whether a path (relative to the workspace root) exists. */
  exists(relativePath: string): boolean;
  /** Remove the scratch workspace from disk. */
  cleanup(): void;
}

/**
 * Creates a throwaway Nx workspace OUTSIDE this repo, installs the locally
 * published `@nxlv/python@e2e`, and registers the plugin in `nx.json`.
 *
 * The scratch workspace lives under `os.tmpdir()` so pnpm/nx operations don't
 * leak into this repo's workspace, and a project-level `.npmrc` points the
 * `@nxlv` scope at the local registry (the scope is otherwise pinned to real
 * npm in the developer's ~/.npmrc).
 */
export function createTestWorkspace(
  name: string,
  plugin: PluginRegistration = {},
): TestWorkspace {
  const dir = join(tmpdir(), 'nx-python-e2e', name);

  // The e2e itself runs under `nx run nx-python-e2e:e2e`, which exports
  // NX_WORKSPACE_ROOT_PATH (and other NX_* task vars) pointing at THIS repo.
  // Left in place, the scratch workspace's nx picks them up and operates on
  // this repo instead of the scratch (loading the plugin's source, resetting
  // cwd, failing prerequisite checks). Strip all NX_* vars so the scratch nx
  // resolves its own workspace and the installed `@nxlv/python` dist.
  const scratchEnv: NodeJS.ProcessEnv = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('NX_')),
    ),
    // Disable the Nx daemon in the scratch: it is unnecessary for a
    // short-lived e2e workspace and its background process is flaky under the
    // repeated serial invocations here ("Unable to connect to the daemon").
    NX_DAEMON: 'false',
  };

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dirname(dir), { recursive: true });

  execSync(
    `pnpm dlx create-nx-workspace@latest ${name} --preset apps --nxCloud=skip --no-interactive`,
    { cwd: dirname(dir), stdio: 'inherit', env: scratchEnv },
  );

  writeFileSync(
    join(dir, '.npmrc'),
    `@nxlv:registry=${LOCAL_REGISTRY}\n//localhost:4873/:_authToken=e2e-fake-token\n`,
  );

  const workspaceFlag = existsSync(join(dir, 'pnpm-workspace.yaml')) ? 'w' : '';
  execSync(`pnpm add -D${workspaceFlag} @nxlv/python@e2e`, {
    cwd: dir,
    stdio: 'inherit',
    env: scratchEnv,
  });

  // Register the plugin (needed for inferDependencies and to pin the package
  // manager for uv workspaces).
  const nxJsonPath = join(dir, 'nx.json');
  const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf-8'));
  nxJson.plugins = nxJson.plugins ?? [];
  const options: PluginRegistration = {};
  if (plugin.packageManager) options.packageManager = plugin.packageManager;
  if (plugin.inferDependencies) options.inferDependencies = true;
  nxJson.plugins.push(
    Object.keys(options).length > 0
      ? { plugin: '@nxlv/python', options }
      : { plugin: '@nxlv/python' },
  );
  writeFileSync(nxJsonPath, JSON.stringify(nxJson, null, 2));

  const exec = (command: string, options?: ExecSyncOptions): string =>
    execSync(command, {
      cwd: dir,
      env: scratchEnv,
      encoding: 'utf-8',
      stdio: 'pipe',
      ...options,
    }).toString();

  return {
    dir,
    run: exec,
    nx: (args, options) => exec(`pnpm nx ${args}`, options),
    generate: (generator, args = '') =>
      exec(`pnpm nx g @nxlv/python:${generator} ${args}`),
    readFile: (relativePath) => readFileSync(join(dir, relativePath), 'utf-8'),
    readJson: <T = Record<string, unknown>>(relativePath: string): T =>
      JSON.parse(readFileSync(join(dir, relativePath), 'utf-8')) as T,
    writeFile: (relativePath, content) =>
      writeFileSync(join(dir, relativePath), content),
    writeJson: (relativePath, content) =>
      writeFileSync(join(dir, relativePath), JSON.stringify(content, null, 2)),
    exists: (relativePath) => existsSync(join(dir, relativePath)),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** `unzip -l` listing of the built wheel for a project (relative dir). */
export function wheelFileList(ws: TestWorkspace, projectDir: string): string {
  return ws.run(`unzip -l ${projectDir}/dist/*.whl`);
}

/** The wheel's `METADATA` (name, version, `Requires-Dist`, …). */
export function wheelMetadata(ws: TestWorkspace, projectDir: string): string {
  return ws.run(`unzip -p ${projectDir}/dist/*.whl '*/METADATA'`);
}

/**
 * The version constraint the built wheel declares for a dependency, e.g.
 * "==1.17.0" (locked/pinned) or ">=1.17.0,<2.0.0" (range). Reads the matching
 * `Requires-Dist` line and drops the `Requires-Dist:` prefix, the package name,
 * and any environment marker (the part after `;`, which can itself contain
 * operators like `>=` in `python_version >= "3.9"`).
 */
export function wheelRequirement(
  ws: TestWorkspace,
  projectDir: string,
  packageName: string,
): string {
  const line = wheelMetadata(ws, projectDir)
    .split('\n')
    .find((l) => l.startsWith('Requires-Dist:') && l.includes(packageName));
  return (line ?? '')
    .replace('Requires-Dist:', '')
    .split(';')[0]
    .replace(packageName, '')
    .trim();
}
