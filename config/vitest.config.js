import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    pool: 'forks',
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,ts}'],
      exclude: ['**/node_modules/**', '**/test/**', '**/mock-server/**'],
      thresholds: {
        lines: 85,
        statements: 85,
        branches: 68,
        functions: 69,
      },
    },
  },
})
