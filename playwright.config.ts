import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for aurswift Electron E2E Tests
 *
 * This configuration is optimized for Electron applications which:
 * - Cannot run tests in parallel (single Electron instance)
 * - Require longer timeouts for native module initialization
 * - Need special handling for window management
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory - all E2E tests are now in tests/e2e
  testDir: "./tests/e2e",

  // Test file patterns - match .spec.ts files in e2e directory
  testMatch: /.*\.spec\.ts/,

  // Timeout for each test (30 seconds - reduced from 60)
  timeout: 30000,

  // Expect timeout (5 seconds - reduced from 10)
  expect: {
    timeout: 5000,
  },

  // Run tests sequentially (Electron limitation)
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Single worker for Electron tests (cannot run multiple instances)
  workers: 1,

  // Reporter configuration
  reporter: [
    // Console output
    ["list"],

    // HTML report (interactive)
    ["html", { outputFolder: "test-results/html", open: "never" }],

    // JUnit XML for CI integration
    ["junit", { outputFile: "test-results/junit.xml" }],

    // JSON report for programmatic analysis
    ["json", { outputFile: "test-results/results.json" }],
  ],

  // Shared settings for all tests
  use: {
    // Collect trace on failure for debugging
    trace: "retain-on-failure",

    // Take screenshot only on failure
    screenshot: "only-on-failure",

    // Record video only on failure
    video: "retain-on-failure",

    // Maximum time each action such as `click()` can take
    actionTimeout: 5000,
  },

  // Test projects
  projects: [
    {
      name: "electron",
      testMatch: /.*\.spec\.ts/,
      use: {
        // Electron-specific settings can go here
      },
    },

    // Separate project for hardware integration tests (slower)
    {
      name: "hardware",
      testMatch: /hardware.*\.spec\.ts/,
      timeout: 120000, // Longer timeout for hardware tests
      retries: 0, // Don't retry hardware tests
    },
  ],

  // Output directory for test results
  outputDir: "test-results/artifacts",

  // Global setup/teardown
  // globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  // globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
});
