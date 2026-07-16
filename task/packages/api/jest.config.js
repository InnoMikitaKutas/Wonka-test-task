/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.spec.ts'],
  // Tests run against contracts/engine source, so they do not need a build first.
  moduleNameMapper: {
    '^@ats/contracts$': '<rootDir>/../contracts/src/index.ts',
    '^@ats/engine$': '<rootDir>/../engine/src/index.ts',
    '^@ats/persistence$': '<rootDir>/../persistence/src/index.ts',
  },
};
