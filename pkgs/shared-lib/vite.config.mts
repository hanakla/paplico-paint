import type {} from 'vitest/config'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { externals } from 'rollup-plugin-node-externals'

export default defineConfig({
  define: {
    'import.meta.vitest': false,
  },
  resolve: {
    alias: {
      '@/': `${__dirname}/src/`,
    },
  },
  build: {
    minify: process.env.BUILD_TARGET_ENV === 'production',
    emptyOutDir: process.env.BUILD_TARGET_ENV === 'production',
    lib: {
      entry: {
        index: 'src/index.ts',
        react: 'src/react.ts',
      },
      name: 'PapCore',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'mjs' : 'js'}`,
    },
    rollupOptions: {
      output: {
        exports: 'auto',
      },
    },
  },
  plugins: [
    {
      enforce: 'pre',
      ...externals({
        builtins: false,
      }),
    } as any,
    dts({
      rollupTypes: false,
    }),
  ],
  test: {
    globals: true,
    includeSource: ['src/**/*{.spec.ts,.ts}'],
  },
})
