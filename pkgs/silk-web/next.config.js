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
    runtimeCaching,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, context) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'silk-core': 'silk-core/src/index.ts',
      'silk-ui': 'silk-ui/src/index.ts',
      '🙌': path.join(__dirname, './'),
    }

    // if (context.dev) {
    //   config.plugins.push(new ForkTsCheckerWebpackPlugin())
    // }

    return config
  },
}

module.exports = withTranspileModules(withPWA(config))
