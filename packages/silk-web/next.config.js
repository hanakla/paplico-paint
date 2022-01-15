const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const withPWA = require('next-pwa')
const runtimeCaching = require('next-pwa/cache')
const withTranspileModules = require('next-transpile-modules')([
  "silk-core",
  "silk-ui"
])
const { i18n } = require('./next-i18next.config')

module.exports = withTranspileModules(withPWA({
  i18n,
  pwa: {
    dest: 'public',
    runtimeCaching,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'silk-core': 'silk-core/src/index.ts',
      'silk-ui': 'silk-ui/src/index.ts'
    }
    config.plugins.push(new ForkTsCheckerWebpackPlugin())

    return config
  }
}))
