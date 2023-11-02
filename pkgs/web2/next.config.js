const injectWDYR = require('./lib/why-did-you-render')
const withMDX = require('@next/mdx')()

/** @type {import('next').NextConfig} */
const config = withMDX({
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'mdx'],
  experimental: {
    mdxRx: true,
  },
  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
    localeDetection: true,
  },
  compiler: {
    styledComponents: true,
  },
  swcMinify: true,
  reactStrictMode: false,
  webpack: (config, context) => {
    injectWDYR(config, context)
    return config
  },
})

module.exports = config
