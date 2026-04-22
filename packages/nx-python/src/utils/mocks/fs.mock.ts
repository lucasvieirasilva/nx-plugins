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

vi.mock('fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  return {
    default: memfs.fs,
    ...memfs.fs,
    cpSync: copyRecursiveSync,
  };
});

vi.mock('node:fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return {
    default: memfs.fs,
    ...memfs.fs,
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
