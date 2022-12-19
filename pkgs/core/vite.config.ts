import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import ts from '@rollup/plugin-typescript'
import { resolve } from 'path'

export default defineConfig({
  define: {
    'import.meta.vitest': false,
  },
  resolve: {
    alias: {
      crypto: 'crypto-js',
    },
  },
  build: {
    minify: false,
    lib: {
      entry: 'src/index.ts',
      name: 'PapCore',
      formats: ['es', 'umd'],
      fileName: 'index',
    },
    rollupOptions: {
      plugins: [
        // @ts-expect-error
        ts({
          rootDir: resolve(__dirname, 'src'),
          declaration: true,
          declarationDir: 'dist',
          exclude: ['node_modules'],
        }),
      ],
    },
  },
  plugins: [tsConfigPaths()],
  test: {
    globals: true,
    includeSource: ['src/**/*{.spec.ts,.ts}'],
  },
})
