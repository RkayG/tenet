module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],

    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/server.ts',
        '!src/test-routes.ts',
        '!src/startup-example.ts',
    ],

    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },

    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

    // Module resolution
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },

    // Transform configuration
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },

    // Test timeout
    testTimeout: 10000,

    // Verbose output
    verbose: true,

    // Clear mocks between tests
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};
