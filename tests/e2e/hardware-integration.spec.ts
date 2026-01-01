/**
 * Hardware Integration Tests for aurswift POS System
 * Tests hardware API exposure and native module loading
 */

import { test, expect } from "@playwright/test";
import type { ElectronApplication } from "playwright";
import { _electron as electron } from "playwright";
import { existsSync } from "node:fs";
import electronPath from "electron";
import { platform } from "node:process";

process.env.HARDWARE_SIMULATION_MODE = "true";
process.env.PLAYWRIGHT_TEST = "true";
process.env.CI = process.env.CI || "false";

test.describe("Hardware Integration Tests", () => {
  let electronApp: ElectronApplication;

  test.beforeAll(async () => {
    const isCI = process.env.CI === "true";

    // Use Electron directly with the entry point (development/test mode)
    const executablePath = electronPath as unknown as string;
    const mainEntry = "packages/entry-point.mjs";

    if (!existsSync(mainEntry)) {
      throw new Error(
        `Entry point not found: ${mainEntry}\n` +
          `Current working directory: ${process.cwd()}`
      );
    }

    const launchArgs = [mainEntry, "--no-sandbox", "--disable-gpu"];

    // Add more args for Windows CI environment
    if (isCI && platform === "win32") {
      launchArgs.push("--disable-dev-shm-usage", "--disable-extensions");
    }

    try {
      electronApp = await electron.launch({
        executablePath: executablePath,
        args: launchArgs,
        timeout: 60000, // Increase timeout for CI with native modules
        env: {
          ...process.env,
          NODE_ENV: "test",
          HARDWARE_SIMULATION_MODE: "true",
          ELECTRON_DISABLE_GPU: "1",
          ELECTRON_NO_SANDBOX: "1",
          ELECTRON_ENABLE_LOGGING: "1",
          PLAYWRIGHT_TEST: "true",
          CI: isCI ? "true" : "false",
        },
      });

      // Set up error logging
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[Test Setup] Failed to launch Electron: ${errorMessage}`);
      console.error(`[Test Setup] Executable path: ${executablePath}`);
      console.error(`[Test Setup] Launch args: ${launchArgs.join(" ")}`);
      throw error;
    }
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test("Native modules are available through main process", async () => {
    const page = await electronApp.firstWindow();

    // Wait for the app to fully initialize (database, services, etc.)
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(4000); // Give time for database initialization and service setup

    // Test if database API is working (better-sqlite3 integration)
    const databaseAPI = await page.evaluate(() => {
      return typeof (window as any).databaseAPI === "object";
    });

    // Test if hardware APIs that depend on native modules are available
    const hardwareAPIs = await page.evaluate(() => {
      return {
        printerAPI: typeof (window as any).printerAPI === "object",
        paymentAPI: typeof (window as any).paymentAPI === "object",
        databaseAPI: typeof (window as any).databaseAPI === "object",
      };
    });

    // All APIs should be available (indicating native modules loaded successfully in main process)
    expect(hardwareAPIs.databaseAPI).toBe(true);
    expect(hardwareAPIs.printerAPI).toBe(true);
    expect(hardwareAPIs.paymentAPI).toBe(true);
  });

  test("Hardware APIs are exposed", async () => {
    const page = await electronApp.firstWindow();

    // Wait for the app to fully initialize
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(4000); // Give time for database initialization and service setup

    const hardwareAPIs = await page.evaluate(() => {
      return {
        printerAPI: typeof (window as any).printerAPI === "object",
        paymentAPI: typeof (window as any).paymentAPI === "object",
      };
    });

    expect(hardwareAPIs.printerAPI).toBe(true);
    expect(hardwareAPIs.paymentAPI).toBe(true);
  });

  test("Printer API methods are available", async () => {
    const page = await electronApp.firstWindow();

    // Wait for the app to fully initialize
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(4000); // Give time for database initialization and service setup

    const printerMethods = await page.evaluate(() => {
      const api = (window as any).printerAPI;
      return api ? Object.keys(api) : [];
    });

    expect(printerMethods).toContain("getStatus");
    expect(printerMethods).toContain("connect");
    expect(printerMethods).toContain("printReceipt");
  });

  test("Payment API methods are available", async () => {
    const page = await electronApp.firstWindow();

    // Wait for the app to fully initialize
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(4000); // Give time for database initialization and service setup

    const paymentMethods = await page.evaluate(() => {
      const api = (window as any).paymentAPI;
      return api ? Object.keys(api) : [];
    });

    expect(paymentMethods).toContain("initializeReader");
    expect(paymentMethods).toContain("getReaderStatus");
    expect(paymentMethods).toContain("processCardPayment");
  });
});
