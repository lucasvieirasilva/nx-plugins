import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/util',
  test: {
    name: 'util',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
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
      reportsDirectory: '../../coverage/packages/util',
      provider: 'v8' as const,
    },
  },
}));
