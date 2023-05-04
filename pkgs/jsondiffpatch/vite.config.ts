import type {} from 'vitest/config'

import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    minify: false,
    emptyOutDir: false,
    lib: {
      entry: 'src/index.ts',
      name: 'JSONDiffPatch',
      formats: ['es', 'umd'],
      fileName: 'index',
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
  plugins: [
    dts({
      rollupTypes: false,
    }),
  ],
  test: {
    globals: true,
    includeSource: ['test/**/*{.spec.ts}'],
  },
})
