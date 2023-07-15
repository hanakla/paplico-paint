/** @type {import('webpack')} */
const webpack = require('webpack')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const withPWA = require('next-pwa')({ dest: 'public', disableDevLogs: true })
const runtimeCaching = require('next-pwa/cache')
const path = require('path')
const { i18n } = require('./next-i18next.config')

const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './src/theme.config.jsx'
})

/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    externalDir: true
  },
  i18n,
  transpilePackages: ['@paplico/core-new'],
  compiler: {
    styledComponents: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  webpack: (/** @type {import('webpack').Configuration} */ config, context) => {
    config.experiments.asyncWebAssembly = true
    config.watchOptions.followSymlinks = true

    // config.optimization.splitChunks = {
    //   cacheGroups: {
    //     paplicoNew: {
    //       name: 'paplico-new',
    //       test: /[\\/]node_modules[\\/]@paplico[\\/]core-new[\\/]/,
    //     },
    //   },
    // }

    config.module.rules.push({
      test: /zstd\.wasm/,
      type: 'asset/resource'
    })

    config.module.rules.push({
      test: /\.(mp3)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/chunks/[hash][ext]'
      }
    })

    config.module.rules.push({
      test: /\.ts$/,
      parser: {
        url: true,
        javascript: {
          worker: ['AudioWorklet from audio-worklet', '...']
        }
      }
    })

    config.resolve.alias = {
      ...config.resolve.alias,
      // '@paplico/core': path.join(__dirname, '../paplicore/src/index.ts'),
      // '@paplico/core-new': path.join(__dirname, '../core/dist/index.mjs'),
      // '@paplico/ui': 'paplico-ui/src/index.ts',
      '🙌': path.join(__dirname, './src'),
      'audio-worklet': path.resolve(__dirname, 'src/utils/audio-worklet')
    }

    config.resolve.fallback = {
      ...config.resolve.fallback,
      ...(context.isServer
        ? {}
        : {
            // assert: false,
            // buffer: false,
            console: false,
            constants: false,
            // crypto: false,
            child_process: false,
            domain: false,
            // events: false,
            fs: false,
            http: false,
            https: false,
            os: false,
            // path: false,
            net: false,
            punycode: false,
            // process: true,
            querystring: false,
            // stream: false,
            string_decoder: false,
            sys: false,
            timers: false,
            tty: false,
            tls: false,
            url: false,
            // util: false,
            vm: false,
            zlib: false
          })
    }

    // config.plugins.push(new webpack.DefinePlugin({
    //   COMMIT_HASH
    // }))

    // if (context.dev) {
    //   config.plugins.push(new ForkTsCheckerWebpackPlugin())
    // }

    return config
  }
}

module.exports = withPWA(withNextra(config))
