import type { ElectronApplication } from "playwright";
import { _electron as electron } from "playwright";
import { test as base } from "@playwright/test";
import { globSync } from "glob";
import { platform, arch } from "node:process";
import { existsSync } from "node:fs";
import electronPath from "electron";

process.env.PLAYWRIGHT_TEST = "true";

/**
 * E2E Test Fixtures for aurswift POS System
 *
 * This file contains the shared test fixtures that can be imported by all E2E test files.
 * Playwright doesn't allow test files to import other test files, so fixtures are
 * extracted into this separate non-test file.
 */

// Declare the types of your fixtures.
export type TestFixtures = {
  electronApp: ElectronApplication;
  electronVersions: NodeJS.ProcessVersions;
};

export const test = base.extend<TestFixtures>({
  electronApp: [
    async ({}, use) => {
      /**
       * Improved executable path detection for different environments
       */
      let executablePath: string | undefined;
      let mainEntry: string | undefined;
      const isCI = process.env.CI === "true";

      // Try multiple possible locations and patterns based on electron-builder output
      const possiblePaths = [
        // Windows-specific patterns (prioritized since we're Windows-only now)
        "dist/win-unpacked/aurswift.exe",
        "dist/win-unpacked/aurswift.exe",
        "dist/win-unpacked/*.exe",
        "dist/*.exe",
        "dist/**/*.exe",
        "dist/win-unpacked/**/*.exe",

        // Electron-builder Windows output patterns (common locations)
        "dist/**/aurswift.exe",
        "dist/**/aurswift.exe",
        "dist/**/aura-swift.exe",
        "dist/aurswift*.exe",
        "dist/aurswift*.exe",
        "dist/aura-swift*.exe",

        // Generic executable patterns
        "dist/**/*.exe",
        "out/**/*.exe",
        "release/**/*.exe",

        // Development mode fallbacks (if no built executable found)
        "dist/main.js",
        "out/main.js",
      ].filter(Boolean) as string[];

      // Also check if we're in a packaged app scenario
      const appPaths = globSync(possiblePaths, { nodir: true });

      if (appPaths.length > 0) {
        executablePath = appPaths[0];
      } else {
        // If no built app found, try running from source (development mode)

        // Check for the entry point file
        if (existsSync("packages/entry-point.mjs")) {
          // Use Electron directly with the entry point
          executablePath = electronPath as unknown as string;
          mainEntry = "packages/entry-point.mjs";
        } else {
          // Look for other main entry points
          const mainEntries = [
            "dist-electron/main.js",
            "out/main.js",
            "dist/main.js",
            "build/main.js",
            "src/main.js",
            "packages/main/dist/index.js",
          ].filter(existsSync);

          if (mainEntries.length > 0) {
            // Use Electron directly with the main entry point
            executablePath = electronPath as unknown as string;
            mainEntry = mainEntries[0];
          } else {
            // Debug information for troubleshooting
            const allFiles = globSync("**/*", { nodir: true }).slice(0, 50); // Limit output
            throw new Error(
              `App Executable path not found. Checked patterns: ${possiblePaths.join(
                ", "
              )}\n` +
                `Current working directory: ${process.cwd()}\n` +
                `First 50 files found: ${allFiles.join(", ")}\n` +
                `Platform: ${platform}, Arch: ${arch}, CI: ${isCI}`
            );
          }
        }
      }

      const launchArgs = mainEntry
        ? [mainEntry, "--no-sandbox", "--disable-gpu"]
        : ["--no-sandbox", "--disable-gpu"];

      // Add more args for Windows CI environment
      if (isCI && platform === "win32") {
        launchArgs.push("--disable-dev-shm-usage", "--disable-extensions");
      }

      let electronApp;
      try {
        electronApp = await electron.launch({
          executablePath: executablePath,
          args: launchArgs,
          timeout: 30000, // Reduced from 60000ms for faster startup
          env: {
            ...process.env,
            NODE_ENV: "test",
            ELECTRON_DISABLE_GPU: "1",
            ELECTRON_NO_SANDBOX: "1",
            ELECTRON_ENABLE_LOGGING: "1",
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[Test Setup] Failed to launch Electron: ${errorMessage}`
        );
        console.error(`[Test Setup] Executable path: ${executablePath}`);
        console.error(`[Test Setup] Launch args: ${launchArgs.join(" ")}`);

        // If we're using a built executable and it fails, try development mode
        if (!mainEntry && executablePath && executablePath.endsWith(".exe")) {
          // Use the imported electronPath (it's the path to electron executable)
          const electronBinary = electronPath as unknown as string;
          const devMainEntry = "packages/entry-point.mjs";

          if (existsSync(devMainEntry)) {
            electronApp = await electron.launch({
              executablePath: electronBinary,
              args: [devMainEntry, ...launchArgs],
              timeout: 30000, // Reduced from 60000ms for faster startup
              env: {
                ...process.env,
                NODE_ENV: "test",
                ELECTRON_DISABLE_GPU: "1",
                ELECTRON_NO_SANDBOX: "1",
                ELECTRON_ENABLE_LOGGING: "1",
              },
            });
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      electronApp.on("console", (msg) => {
        if (msg.type() === "error") {
          console.error(`[electron][${msg.type()}] ${msg.text()}`);
        }
      });

      electronApp.on("window", (page) => {
        page.on("pageerror", (error) => {
          console.error(`[page error] ${error.message}`);
        });
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            console.error(`[renderer][${msg.type()}] ${msg.text()}`);
          }
        });
      });

      // Ensure the first window is shown and ready
      const firstWindow = await electronApp.firstWindow();
      const browserWindow = await electronApp.browserWindow(firstWindow);

      // Show the window if it's hidden and wait for it to be ready
      await browserWindow.evaluate((mainWindow) => {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
      });

      // Wait for window to be ready (with timeout)
      try {
        await browserWindow.evaluate((mainWindow) => {
          return new Promise<void>((resolve) => {
            if (mainWindow.isReady()) {
              resolve();
              return;
            }
            const timeout = setTimeout(() => resolve(), 10000);
            mainWindow.once("ready-to-show", () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        });
      } catch (error) {
        // If ready-to-show fails, continue anyway after a short delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Wait for the page to be ready
      await firstWindow.waitForLoadState("domcontentloaded");

      // Wait for basic DOM structure (body and root) to be visible
      try {
        await firstWindow.waitForSelector("body", {
          timeout: 10000,
          state: "visible",
        });
        await firstWindow.waitForSelector("#root", {
          timeout: 10000,
          state: "visible",
        });
      } catch (error) {
        // Log but don't fail - some tests might handle this differently
        console.warn(
          "[Test Setup] Body or root not visible immediately, tests will handle this"
        );
      }

      await use(electronApp);

      // This code runs after all the tests in the worker process.
      await electronApp.close();
    },
    { scope: "worker", auto: true } as any,
  ],

  electronVersions: async ({ electronApp }, use) => {
    await use(await electronApp.evaluate(() => process.versions));
  },
});
