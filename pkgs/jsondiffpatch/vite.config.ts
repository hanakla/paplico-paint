import type {} from 'vitest/config'

import { defineConfig } from 'vite'
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
    commonjsOptions: {
      defaultIsModuleExports: true,
    },
    rollupOptions: {
      external: ['diff-match-patch'],
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
