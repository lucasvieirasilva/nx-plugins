module.exports = {
  displayName: 'nx-python',
  preset: '../../jest.preset.js',
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        outputPath: './reports/packages/nx-python/html/index.html',
        includeConsoleLog: true,
        includeFailureMsg: true,
        includeSuiteFailure: true,
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './reports/packages/nx-python',
        outputName: 'junit.xml',
        reportTestSuiteErrors: true,
      },
    ],
  ],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/packages/nx-python',
  collectCoverage: true,
  collectCoverageFrom: [
    './src/**/*.ts',
    '!./src/types.ts'
  ],
  coverageReporters: ['text', 'html', 'cobertura', 'clover'],
};
