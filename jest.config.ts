import type { Config } from "jest";

const config: Config = {
    // Use ts-jest in ESM mode — required for "type": "module" + NodeNext
    preset: "ts-jest/presets/default-esm",

    testEnvironment: "node",

    // Point at our test-specific tsconfig (relaxes verbatimModuleSyntax)
    globals: {
        "ts-jest": {
            tsconfig: "./tsconfig.test.json",
            useESM: true,
        },
    },

    // Resolve @/ path alias inside tests
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        // Strip .js extensions from imports so Jest can find .ts files
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },

    // Where to find tests
    testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],

    // Don't try to transform node_modules (except packages that ship ESM)
    transformIgnorePatterns: ["node_modules/(?!(bullmq|ioredis)/)"],

    // Run global mock setup before each suite
    setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],

    // Show individual test names
    verbose: true,

    // Coverage (optional — run with --coverage flag)
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/__tests__/**",
        "!src/generated/**",
        "!src/server.ts",
        "!src/docs/**",
    ],

    coverageThreshold: {
        global: {
            branches: 60,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
};

export default config;
