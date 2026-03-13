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
  swcMinify: true,
  reactStrictMode: false,
})

module.exports = config
