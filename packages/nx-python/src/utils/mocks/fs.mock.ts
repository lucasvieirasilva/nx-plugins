import { vi } from 'vitest';
import { fs } from 'memfs';
import path from 'path';

/**
 * This function is used because memfs currently does not support recursive copy
 */
const copyRecursiveSync = (
  src: string,
  dest: string,
  options?: {
    recursive?: boolean;
    filter?: (src: string, dest: string) => boolean;
  },
) => {
  if (options?.filter && !options.filter(src, dest)) {
    return;
  }
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(function (childItemName) {
      if (options === undefined || options?.recursive !== false) {
        copyRecursiveSync(
          path.join(src, childItemName),
          path.join(dest, childItemName),
          options,
        );
      }
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

/**
 * tree-sitter grammars are loaded from `.wasm` files that live on the real
 * filesystem (inside `node_modules`), not from the in-memory project layout the
 * tests build with memfs. These helpers let `.wasm` reads fall through to the
 * real `fs` while every other read keeps hitting memfs.
 */
const isWasmPath = (p: unknown): boolean => String(p).endsWith('.wasm');

/**
 * Build a wrapper that forwards `.wasm` reads to `realFn` (the real `fs`) and
 * everything else to `memfsFn` (memfs). The wrapper declares its own rest
 * parameter so the arguments can be spread into the overloaded `fs` methods.
 */
const passthrough =
  (
    realFn: (...args: unknown[]) => unknown,
    memfsFn: (...args: unknown[]) => unknown,
  ) =>
  (path: unknown, ...args: unknown[]) =>
    isWasmPath(path) ? realFn(path, ...args) : memfsFn(path, ...args);

const withWasmPassthrough = (
  memfsFs: typeof import('memfs').fs,
  realFs: typeof import('node:fs'),
) => ({
  readFileSync: passthrough(
    realFs.readFileSync as never,
    memfsFs.readFileSync as never,
  ),
  readFile: passthrough(realFs.readFile as never, memfsFs.readFile as never),
  existsSync: passthrough(
    realFs.existsSync as never,
    memfsFs.existsSync as never,
  ),
});

vi.mock('fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  const realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  const overrides = withWasmPassthrough(memfs.fs, realFs);

  return {
    default: { ...memfs.fs, ...overrides, cpSync: copyRecursiveSync },
    ...memfs.fs,
    ...overrides,
    cpSync: copyRecursiveSync,
  };
});

vi.mock('node:fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  const realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  const overrides = withWasmPassthrough(memfs.fs, realFs);

  return {
    default: { ...memfs.fs, ...overrides, cpSync: copyRecursiveSync },
    ...memfs.fs,
    ...overrides,
    cpSync: copyRecursiveSync,
  };
});

vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return {
    default: memfs.fs.promises,
    ...memfs.fs.promises,
  };
});

vi.mock('node:fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return {
    default: memfs.fs.promises,
    ...memfs.fs.promises,
  };
});

vi.mock('fs-extra', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  return {
    default: memfs.fs,
    ...memfs.fs,
    cpSync: copyRecursiveSync,
    copySync: copyRecursiveSync,
    removeSync: (dir) => memfs.fs.rmSync(dir, { recursive: true, force: true }),
    mkdirsSync: (dir) => {
      try {
        memfs.fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
    },
  };
});
