import type { Config } from 'jest'

const transform = {
  '^.+\\.tsx?$': [
    'ts-jest',
    {
      useESM: true,
      tsconfig: 'tsconfig.spec.json',
    },
  ],
}

const moduleNameMapper = {
  '^(\\.{1,2}/.*)\\.js$': '$1',
}

const config: Config = {
  extensionsToTreatAsEsm: ['.ts'],
  transform,
  moduleNameMapper,
  setupFiles: ['<rootDir>/test/setup/inject-jest-globals.cjs'],

  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      extensionsToTreatAsEsm: ['.ts'],
      transform,
      moduleNameMapper,
      setupFiles: ['<rootDir>/test/setup/inject-jest-globals.cjs'],
      globalSetup: '<rootDir>/test/setup/unit.setup.ts',
      testTimeout: 30_000,
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
      extensionsToTreatAsEsm: ['.ts'],
      transform,
      moduleNameMapper,
      setupFiles: ['<rootDir>/test/setup/inject-jest-globals.cjs'],
      globalSetup: '<rootDir>/test/setup/e2e.setup.ts',
      testTimeout: 60_000,
    },
  ],
}

export default config
