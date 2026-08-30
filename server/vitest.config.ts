import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-placeholder-secret-min-32-chars-long',
    },
  },
})
