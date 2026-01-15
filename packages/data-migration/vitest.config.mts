import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/data-migration',
  test: {
    name: 'data-migration',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['../../tests/setup.ts'],
    reporters: ['default'],
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
      provider: 'v8' as const,
    },
  },
}));
