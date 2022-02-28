/** @type {import('@ts-jest/dist/types').InitialOptionsTsJest} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.tsx?$',
  setupFiles: ['jest-canvas-mock'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
}

module.exports = config
