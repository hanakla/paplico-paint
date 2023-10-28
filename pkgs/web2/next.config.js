const injectWDYR = require('./lib/why-did-you-render')

/** @type {import('next').NextConfig} */
const config = {
  compiler: {
    styledComponents: true,
  },
  reactStrictMode: false,
  webpack: (config, context) => {
    injectWDYR(config, context)
    return config
  },
}

module.exports = config
