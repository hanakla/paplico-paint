module.exports = function (api) {
  const isServer = api.caller((caller) => caller?.isServer)
  const isCallerDevelopment = api.caller((caller) => caller?.isDev)

  return {
    presets: [
      [
        'next/babel',
        {
          'preset-react': {
            importSource:
              !isServer && isCallerDevelopment
                ? '@welldone-software/why-did-you-render'
                : 'react',
          },
        },
      ],
    ],
    plugins: [
      [
        'babel-plugin-styled-components',
        {
          ssr: true,
          displayName: true,
        },
      ],
    ],
  }
}
