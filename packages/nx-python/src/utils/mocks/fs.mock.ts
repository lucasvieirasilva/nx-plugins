import { vi } from 'vitest';
import { fs } from 'memfs';
import path from 'path';

/**
 * This function is used because memfs currently does not support recursive copy
 */
const copyRecursiveSync = (
  src: string,
  dest: string,
  options?: { recursive: boolean },
) => {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(function (childItemName) {
      if (options === undefined || options?.recursive) {
        copyRecursiveSync(
          path.join(src, childItemName),
          path.join(dest, childItemName),
        );
      }
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

vi.mock('fs', async () => {
  const memfs = (await vi.importActual('memfs')) as typeof import('memfs');

  return {
    default: memfs.fs,
    ...memfs.fs,
    cpSync: copyRecursiveSync,
  };
});

vi.mock('fs-extra', async () => {
  const memfs = (await vi.importActual('memfs')) as typeof import('memfs');

  return {
    default: memfs.fs,
    ...memfs.fs,
    cpSync: copyRecursiveSync,
    copySync: copyRecursiveSync,
    removeSync: (dir) => memfs.fs.rmSync(dir, { recursive: true, force: true }),
    mkdirsSync: (dir) => {
      try {
        memfs.fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        // ignore
      }
    },
  };
});
