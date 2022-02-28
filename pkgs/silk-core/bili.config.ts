import { Config } from 'bili'
import typescript from 'rollup-plugin-typescript2'
import image from '@rollup/plugin-image'
import glslify from 'rollup-plugin-glslify'

export default {
  input: 'src/index.ts',
  plugins: {
    typescript2: typescript(),
    glslify: glslify(),
    '@rollup/plugin-image': image(),
    terser: {
      compress: {
        arrows: true,
        arguments: true,
        ecma: 2015,
      },
      output: {
        beautify: true,
      },
    },
  },
  babel: { asyncToPromises: false },
  bundleNodeModules: ['tslib'],
  output: {
    format: ['cjs', 'esm'],
  },
} as Config
