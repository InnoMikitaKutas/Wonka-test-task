/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.spec.ts'],
  // Tests run against package sources, so they do not need a build first.
  moduleNameMapper: {
    '^@ats/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
    '^@ats/engine$': '<rootDir>/../../packages/engine/src/index.ts',
  },
};
