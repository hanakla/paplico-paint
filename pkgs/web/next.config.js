/** @type {import('webpack')} */
const webpack = require('webpack')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const withPWA = require('next-pwa')
const runtimeCaching = require('next-pwa/cache')
const path = require('path')
const withTranspileModules = require('next-transpile-modules')([
  '@paplico/core',
  // '@paplico/ui',
])
const { i18n } = require('./next-i18next.config')

/** @type {import('next').NextConfig} */
const config = {
  i18n,
  compiler: {
    styledComponents: true,
  },
  pwa: {
    dest: 'public',
    mode: 'production',
    runtimeCaching,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, context) => {
    config.experiments.asyncWebAssembly = true

    config.module.rules.push({
      test: /zstd\.wasm/,
      type: 'asset/resource',
    })

    config.module.rules.push({
      test: /\.(mp3)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/chunks/[hash][ext]',
      },
    })

    config.module.rules.push({
      test: /\.ts$/,
      parser: {
        url: true,
        javascript: {
          worker: ['AudioWorklet from audio-worklet', '...'],
        },
      },
    })

    config.resolve.alias = {
      ...config.resolve.alias,
      '@paplico/core': path.join(__dirname, '../paplicore/src/index.ts'),
      // '@paplico/ui': 'paplico-ui/src/index.ts',
      '🙌': path.join(__dirname, './src'),
      'audio-worklet': path.resolve(__dirname, 'src/utils/audio-worklet'),
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
            zlib: false,
          }),
    }

    // config.plugins.push(new webpack.DefinePlugin({
    //   COMMIT_HASH
    // }))

    // if (context.dev) {
    //   config.plugins.push(new ForkTsCheckerWebpackPlugin())
    // }

    return config
  },
}

module.exports = withTranspileModules(withPWA(config))
