/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^lib/(.*)$': '<rootDir>/src/lib/$1',
    '^pages/(.*)$': '<rootDir>/src/pages/$1',
    '^workers/(.*)$': '<rootDir>/src/workers/$1',
  },
  transformIgnorePatterns: ['node_modules/(?!(@47ng/chakra-next)/)'],
}
