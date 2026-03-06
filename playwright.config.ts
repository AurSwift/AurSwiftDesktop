import { defineConfig } from '@playwright/test'

const isCI = !!process.env.CI

/**
 * Playwright Configuration for aurswift Electron E2E Tests
 *
 * Optimized for Electron applications:
 * - single-worker execution
 * - deterministic startup checks
 * - CI-focused failure and timeout guardrails
 */
export default defineConfig({
  // Test directory - all E2E specs live under tests/e2e/specs
  testDir: './tests/e2e/specs',

  // Test file patterns - match *.e2e.spec.ts files
  testMatch: /.*\.e2e\.spec\.ts/,

  // Timeout for each test
  timeout: 30_000,

  // Bound total CI runtime to avoid hung pipelines
  globalTimeout: isCI ? 45 * 60 * 1000 : undefined,

  // Expect timeout
  expect: {
    timeout: 5_000,
  },

  // Run tests sequentially (Electron limitation)
  fullyParallel: false,

  // Fail the build on CI if test.only is committed
  forbidOnly: isCI,

  // Retry failed tests in CI
  retries: isCI ? 2 : 0,

  // Stop early in CI after repeated failures
  maxFailures: isCI ? 5 : undefined,

  // Track slowest tests to keep suite healthy
  reportSlowTests: {
    max: 10,
    threshold: 30_000,
  },

  // Single worker for Electron tests
  workers: 1,

  // Reporter configuration
  reporter: isCI
    ? [
        ['dot'],
        ['junit', { outputFile: 'test-outputs/e2e/junit.xml' }],
        ['json', { outputFile: 'test-outputs/e2e/results.json' }],
        ['html', { outputFolder: 'test-outputs/e2e/html', open: 'never' }],
      ]
    : [['list'], ['html', { outputFolder: 'test-outputs/e2e/html', open: 'never' }]],

  // Shared settings for all tests
  use: {
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
  },

  // Test projects
  projects: [
    {
      name: 'electron',
      testMatch: /.*\.e2e\.spec\.ts/,
      testIgnore: /.*hardware\.e2e\.spec\.ts/,
      use: {
        // Electron-specific overrides can go here.
      },
    },
    {
      name: 'hardware',
      testMatch: /.*hardware\.e2e\.spec\.ts/,
      timeout: 120_000,
      retries: 0,
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-outputs/e2e/artifacts',

  // Global setup/teardown lifecycle
  globalSetup: './tests/e2e/support/global-setup.ts',
  globalTeardown: './tests/e2e/support/global-teardown.ts',
})
