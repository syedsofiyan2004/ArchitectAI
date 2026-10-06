import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'tests/**/*.test.ts', 'apps/**/*.test.ts'],
    testTimeout: 45000,
    hookTimeout: 45000,
  },
});
