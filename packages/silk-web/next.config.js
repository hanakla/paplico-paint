const withPWA = require('next-pwa')
const runtimeCaching = require('next-pwa/cache')
const withTranspileModules = require('next-transpile-modules')([
  "silk-core"
])

module.exports = withTranspileModules(withPWA({
  pwa: {
    dest: 'public',
    runtimeCaching,
  },
}))
