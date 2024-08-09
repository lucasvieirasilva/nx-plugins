/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/data-migration',

  plugins: [nxViteTsPaths()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  test: {
    name: 'data-migration',
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['../../tests/setup.ts'],
    reporters: ['default'],
    hookTimeout: 20000,
    coverage: {
      enabled: true,
      reporter: [
        'text',
        'html',
        'cobertura',
        'clover',
        'json',
        'json-summary',
        'lcov',
      ],
      reportsDirectory: '../../coverage/packages/data-migration',
      provider: 'v8',
    },
  },
});
