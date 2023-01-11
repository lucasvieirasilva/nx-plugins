/* eslint-disable */
export default {
  displayName: 'nx-python',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/nx-python',
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts', '!./src/types.ts'],
  coverageReporters: ['text', 'html', 'cobertura', 'clover', 'json', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
