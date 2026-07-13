import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/**/*/vite.config.ts',
      {
        plugins: [nxViteTsPaths()],
        test: {
          globals: true,
          setupFiles: ['./tests/setup.ts'],
        },
      },
    ],
  },
});
