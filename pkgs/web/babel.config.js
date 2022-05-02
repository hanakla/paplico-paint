module.exports = function (api) {
  const isServer = api.caller((caller) => caller?.isServer)
  const isCallerDevelopment = api.caller((caller) => caller?.isDev)

  return {
    presets: [
      [
        'next/babel',
        {
          'preset-react': {
            runtime: 'automatic',
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
