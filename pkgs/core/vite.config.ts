import type {} from 'vitest/config'

import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  define: {
    'import.meta.vitest': false,
  },
  resolve: {
    alias: {
      crypto: 'crypto-js',
      '@/': `${__dirname}/src/`,
    },
  },
  build: {
    minify: false,
    emptyOutDir: false,
    lib: {
      entry: 'src/index.ts',
      name: 'PapCore',
      formats: ['es', 'umd'],
      fileName: 'index',
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
  plugins: [dts({ rollupTypes: false })],
  test: {
    globals: true,
    includeSource: ['src/**/*{.spec.ts,.ts}'],
  },
})
