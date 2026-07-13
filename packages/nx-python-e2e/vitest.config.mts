import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/nx-python-e2e',
  test: {
    name: 'nx-python-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // e2e spins up a local registry, publishes the plugin and scaffolds a
    // real workspace, so it must run serially with generous timeouts.
    globalSetup: ['../../tools/scripts/start-local-registry.ts'],
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 600_000,
    reporters: ['default'],
  },
}));
