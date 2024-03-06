import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/**/*/vite.config.ts',
  {
    plugins: [nxViteTsPaths()],
    test: {
      globals: true,
    },
  },
  'e2e/**/*/vite.config.ts',
  {
    plugins: [nxViteTsPaths()],
    test: {
      globals: true,
    },
  },
]);
