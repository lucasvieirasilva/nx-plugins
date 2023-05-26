/* eslint-disable */
export default {
  displayName: 'data-migration',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/data-migration',
  collectCoverage: true,
  // collectCoverageFrom: [
  //   './src/**/*.ts',
  //   '!./src/**/*.d.ts',
  //   '!./src/**/*.type.ts',
  //   '!./src/**/index.ts',
  // ],
  coverageReporters: ['text', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
