// Doesn't work
const config: import('@jest/types').Config.InitialOptions = {
  preset: 'ts-jest/presets/js-with-babel',

  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'https://paplico.test',
  },
  testRegex: '.*\\.spec\\.[tj]sx?$',

  transformIgnorePatterns: ['node_modules/(?!(p-defer)/)'],
  // transform: {
  //   '^.+\\.[t|j]sx?$': 'babel-jest',
  //   // '^.+\\.(t|j|mj)sx?$': [
  //   //   '@swc/jest',
  //   //   {
  //   //     jsc: {
  //   //       parser: {
  //   //         syntax: 'typescript',
  //   //         exportNamespaceFrom: true,
  //   //         exportDefaultFrom: true,
  //   //       },
  //   //       target: 'es2015',
  //   //       transform: {
  //   //         react: {
  //   //           runtime: 'automatic',
  //   //         },
  //   //       },
  //   //     },
  //   //     module: {
  //   //       type: 'commonjs',
  //   //     },
  //   //   },
  //   // ],
  // },

  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@paplico/core/(.*)$': '<rootDir>/../core/$1',
  },
}

export default config
