/** @type {import('ts-jest').JestConfigWithTsJest} */
const jestConfig = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  verbose: true,
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
  testMatch: ['<rootDir>/src/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^modules/(.*)$': '<rootDir>/src/modules/$1',
    '^server/(.*)$': '<rootDir>/src/server/$1',
    '^client/(.*)$': '<rootDir>/src/client/$1',
    '^pages/(.*)$': '<rootDir>/src/pages/$1',
    '^tests/(.*)$': '<rootDir>/src/tests/$1',
  },
  transformIgnorePatterns: ['node_modules/(?!(@47ng/chakra-next)/)'],
}

export default jestConfig
