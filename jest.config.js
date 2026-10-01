/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  setupFiles: ["<rootDir>/tests/setup-env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  globalSetup: "<rootDir>/tests/global-setup.js",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        isolatedModules: true,
        diagnostics: false,
      },
    ],
  },
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/prisma/"],
  verbose: true,
};
