const createNextJest = require('next/jest')

const createJestConfig = createNextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'services/**/*.ts',
    'lib/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/e2e/',
  ],
  // Handle ES modules from node_modules (jose is ESM-only).
  // Separate patterns for POSIX and Windows path separators.
  transformIgnorePatterns: [
    'node_modules/(?!jose/)',
    'node_modules\\\\(?!jose\\\\)',
  ],
}

module.exports = createJestConfig(customJestConfig)
