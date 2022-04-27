const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const withPWA = require('next-pwa')
const runtimeCaching = require('next-pwa/cache')
const path = require('path')
const withTranspileModules = require('next-transpile-modules')([
  'silk-core',
  'silk-ui',
])
const { i18n } = require('./next-i18next.config')

/** @type {import('next').NextConfig} */
const config = {
  i18n,
  experimental: {
    // reactRoot: true,
    // reactMode: 'concurrent',
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

    config.resolve.alias = {
      ...config.resolve.alias,
      'silk-core': 'silk-core/src/index.ts',
      'silk-ui': 'silk-ui/src/index.ts',
      '🙌': path.join(__dirname, './src'),
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
            crypto: false,
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

    // if (context.dev) {
    //   config.plugins.push(new ForkTsCheckerWebpackPlugin())
    // }

    return config
  },
}

module.exports = withTranspileModules(withPWA(config))
