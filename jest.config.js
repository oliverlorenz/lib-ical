/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['ts-jest', {}],
  },
  rootDir: './src',
  coverageThreshold: {
    global: {
      branches: 89,
      functions: 98,
      lines: 90,
      statements: 90,
    },
  },
  coverageDirectory: '../coverage',
};
