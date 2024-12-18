import chalk from 'chalk';
import { SpawnSyncOptions } from 'child_process';
import commandExists from 'command-exists';
import spawn from 'cross-spawn';
import { UVLockfile } from './types';
import toml from '@iarna/toml';
import { readFileSync } from 'fs-extra';
import { Tree } from '@nx/devkit';
import { existsSync } from 'fs';

export const UV_EXECUTABLE = 'uv';

export async function checkUvExecutable() {
  try {
    await commandExists(UV_EXECUTABLE);
  } catch (e) {
    throw new Error(
      'UV is not installed. Please install UV before running this command.',
    );
  }
}

export type RunUvOptions = {
  log?: boolean;
  error?: boolean;
} & SpawnSyncOptions;

export function runUv(args: string[], options: RunUvOptions = {}): void {
  const log = options.log ?? true;
  const error = options.error ?? true;
  delete options.log;
  delete options.error;

  const commandStr = `${UV_EXECUTABLE} ${args.join(' ')}`;

  if (log) {
    console.log(
      chalk`{bold Running command}: ${commandStr} ${
        options.cwd && options.cwd !== '.'
          ? chalk`at {bold ${options.cwd}} folder`
          : ''
      }\n`,
    );
  }

  const result = spawn.sync(UV_EXECUTABLE, args, {
    ...options,
    shell: options.shell ?? false,
    stdio: 'inherit',
  });

  if (error && result.status !== 0) {
    throw new Error(
      chalk`{bold ${commandStr}} command failed with exit code {bold ${result.status}}`,
    );
  }
}

export function getUvLockfile(
  lockfilePath: string,
  tree?: Tree,
): UVLockfile | null {
  if (tree && !tree.exists(lockfilePath)) {
    return null;
  }
  if (!tree && !existsSync(lockfilePath)) {
    return null;
  }

  const data = toml.parse(
    tree
      ? tree.read(lockfilePath, 'utf-8')
      : readFileSync(lockfilePath, 'utf-8'),
  );

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    package: (data.package as any[]).reduce(
      (acc, pkg) => {
        acc[pkg.name] = {
          ...pkg,
          metadata: {
            ...(pkg.metadata ?? {}),
            'requires-dist': (pkg.metadata?.['requires-dist'] ?? []).reduce(
              (acc, req) => {
                acc[req.name] = req;
                return acc;
              },
              {},
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'requires-dev': Object.entries<any>(
              pkg.metadata?.['requires-dev'] ?? {},
            ).reduce((acc, [key, values]) => {
              acc[key] = values.reduce((acc, req) => {
                acc[req.name] = req;
                return acc;
              }, {});
              return acc;
            }, {}),
          },
        };
        return acc;
      },
      {} as UVLockfile['package'],
    ),
  };
}
