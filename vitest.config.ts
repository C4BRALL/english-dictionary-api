import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@english-dictionary/application': fileURLToPath(
        new URL('./packages/application/src/index.ts', import.meta.url),
      ),
      '@english-dictionary/contracts': fileURLToPath(
        new URL('./packages/contracts/src/index.ts', import.meta.url),
      ),
      '@english-dictionary/domain': fileURLToPath(
        new URL('./packages/domain/src/index.ts', import.meta.url),
      ),
      '@english-dictionary/infrastructure': fileURLToPath(
        new URL('./packages/infrastructure/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    passWithNoTests: true,
  },
});
