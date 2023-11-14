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
      crypto: 'crypto-js',
      '@/': `${__dirname}/src/`,
    },
  },
  build: {
    minify: false,
    emptyOutDir: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        'ext-brush': 'src/index-ext-brush.ts',
        'ext-ink': 'src/index-ext-ink.ts',
        'ext-filter': 'src/index-ext-filter.ts',
        'math-utils': 'src/index-math-utils.ts',
        extras: 'src/index-extras.ts',
      },
      name: 'PapCore',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        console.log(entryName)
        return `${entryName}.${format === 'es' ? 'mjs' : 'js'}`
      },
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
        exclude: [
          'mitt',
          'three',
          'abs-svg-path',
          'is-ios',
          'fast-random',
          '@paplico/shared-lib',
        ],
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
