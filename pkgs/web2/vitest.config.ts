import { join } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '🙌': join(__dirname, './src/'),
      '@paplico/core': join(__dirname, '../paplicore/dist/index.esm.js'),
    },
  },
  test: {
    deps: {
      // fallbackCJS: true,
      interopDefault: true,
    },
    globals: true,
  },
})
