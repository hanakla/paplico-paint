import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.tsx?$',
  // setupFiles: ['jest-canvas-mock'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
}

export default config
