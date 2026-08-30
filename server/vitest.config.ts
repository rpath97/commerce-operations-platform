import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      DATABASE_URL:
        'postgresql://postgres:password@localhost:5432/commerceops?schema=public',
    },
  },
})
