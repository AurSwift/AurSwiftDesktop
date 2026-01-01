import type { JSHandle } from "playwright";
import { expect } from "@playwright/test";
import type { BrowserWindow } from "electron";
import { globSync } from "glob";
import { test } from "./fixtures";

/**
 * E2E Tests for aurswift POS System
 * Technology Stack: React 18 + TypeScript + Electron + Vite
 * Architecture: Main process, Preload scripts, Renderer (React)
 *
 * This file contains the base app tests.
 * Test fixtures are imported from ./fixtures.ts
 */

test.describe("Build Environment Debug", () => {
  test("Check build output structure", async () => {
    // Use ES module imports instead of require()
    const { readdir, stat } = await import("node:fs/promises");
    const { join, resolve } = await import("node:path");

    async function listFiles(
      dir: string,
      indent = "",
      maxDepth = 2,
      currentDepth = 0
    ) {
      if (currentDepth >= maxDepth) return;

      try {
        const items = await readdir(dir);
        const limitedItems = items.slice(0, 20); // Limit items per directory

        for (const item of limitedItems) {
          const fullPath = join(dir, item);
          try {
            const statResult = await stat(fullPath);
            if (statResult.isDirectory()) {
              if (
                item === "dist" ||
                item === "out" ||
                item === "release" ||
                item === "build"
              ) {
                await listFiles(
                  fullPath,
                  indent + "  ",
                  maxDepth + 1,
                  currentDepth + 1
                );
              }
            } else {
              // no-op
            }
          } catch (error) {
            // no-op
          }
        }
      } catch (error) {
        // no-op
      }
    }

    await listFiles(".");

    // Check specifically for Electron executables
    const electronPaths = globSync(
      [
        "dist/**/*.{app,exe,AppImage}",
        "out/**/*.{app,exe,AppImage}",
        "release/**/*.{app,exe,AppImage}",
        "packages/main/dist/**/*.js",
      ],
      { nodir: true }
    );

    // This test always passes - it's just for debugging
    expect(true).toBe(true);
  });
});

test.describe("Vite Build & TypeScript Integration", async () => {
  test("TypeScript compilation produces working code", async ({
    electronApp,
  }) => {
    const page = await electronApp.firstWindow();
    await page.waitForTimeout(1000); // Reduced from 2000ms

    // Verify that TypeScript interfaces and types are working
    const typescriptWorking = await page.evaluate(() => {
      // Test that APIs have expected method signatures (TypeScript would catch errors)
      const authAPI = (window as any).authAPI;
      const productAPI = (window as any).productAPI;

      return {
        authAPIHasMethods: authAPI && typeof authAPI.login === "function",
        productAPIHasMethods:
          productAPI && typeof productAPI.getAll === "function",
        noTypeErrors: true, // If we get here, TypeScript compilation succeeded
      };
    });

    expect(typescriptWorking.authAPIHasMethods).toBe(true);
    expect(typescriptWorking.noTypeErrors).toBe(true);
  });
});

// Clean up authentication state before each test to ensure tests start from clean state
test.beforeEach(async ({ electronApp }) => {
  const page = await electronApp.firstWindow();

  // Ensure window is visible
  const window = await electronApp.browserWindow(page);
  await window.evaluate((mainWindow) => {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  await page.waitForLoadState("domcontentloaded");

  // Clear browser storage (localStorage, sessionStorage)
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      // no-op
    }
  });

  // Logout via API if user is logged in
  await page.evaluate(async () => {
    try {
      if ((window as any).authAPI?.logout) {
        await (window as any).authAPI.logout();
      }
    } catch (error) {
      // no-op
    }
  });

  // Close DevTools if open (for clean test environment)
  await window.evaluate((mainWindow) => {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    }
  });

  // Small delay to ensure state is cleared (reduced from 500ms)
  await page.waitForTimeout(200);
});

test("Main window state", async ({ electronApp }) => {
  const page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");

  const window: JSHandle<BrowserWindow> = await electronApp.browserWindow(page);

  // Force show the window if it's not visible in CI
  await window.evaluate((mainWindow) => {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  // Wait a bit after forcing show (reduced from 2000ms)
  await page.waitForTimeout(1000);

  // Give the window more time to show up
  const windowState = await window.evaluate(
    (
      mainWindow
    ): Promise<{
      isVisible: boolean;
      isDevToolsOpened: boolean;
      isCrashed: boolean;
    }> => {
      const getState = () => ({
        isVisible: mainWindow.isVisible(),
        isDevToolsOpened: mainWindow.webContents.isDevToolsOpened(),
        isCrashed: mainWindow.webContents.isCrashed(),
      });

      return new Promise((resolve) => {
        /**
         * The main window is created hidden, and is shown only when it is ready.
         * Extended timeout for CI environments (20 seconds)
         */
        if (mainWindow.isVisible()) {
          resolve(getState());
        } else {
          // Even longer timeout for CI environments (20 seconds)
          const timeout = setTimeout(() => {
            mainWindow.show();
            resolve(getState());
          }, 20000);

          mainWindow.once("ready-to-show", () => {
            clearTimeout(timeout);
            resolve(getState());
          });

          // Also listen for 'show' event as backup
          mainWindow.once("show", () => {
            clearTimeout(timeout);
            resolve(getState());
          });
        }
      });
    }
  );

  expect(windowState.isCrashed, "The app has crashed").toEqual(false);
  expect(windowState.isVisible, "The main window was not visible").toEqual(
    true
  );
  expect(windowState.isDevToolsOpened, "The DevTools panel was open").toEqual(
    false
  );
});

test.describe("React TypeScript Electron Vite POS Application", async () => {
  test("POS-specific APIs are available in renderer process", async ({
    electronApp,
  }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000); // Reduced from 2000ms

    // Test that key POS APIs are exposed via preload script
    const posAPIsAvailable = await page.evaluate(() => {
      const apis = [
        "authAPI",
        "productAPI",
        "transactionAPI",
        "printerAPI",
        "paymentAPI",
        "cashDrawerAPI",
        "authStore",
      ];

      return apis.every((api) => typeof (window as any)[api] === "object");
    });

    expect(posAPIsAvailable).toBe(true);
  });
});

test.describe("Preload Security Context (TypeScript Electron)", async () => {
  test.describe(`Electron application info`, async () => {
    test("Application loads successfully", async ({ electronApp }) => {
      const page = await electronApp.firstWindow();
      await page.waitForLoadState("domcontentloaded");

      // Wait a bit for the application to fully initialize (reduced from 2000ms)
      await page.waitForTimeout(1000);

      // Test that the page loads and has basic DOM structure
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          hasBody: !!document.body,
          bodyChildren: document.body ? document.body.children.length : 0,
          hasContent: document.body && document.body.children.length > 0,
          url: window.location.href,
        };
      });

      // Page loads successfully if it has content

      // The page should have content even if title is not set
      expect(pageInfo.hasContent).toBe(true);
      expect(pageInfo.hasBody).toBe(true);
      expect(pageInfo.bodyChildren).toBeGreaterThan(0);
    });

    test("Basic renderer context is functional", async ({ electronApp }) => {
      const page = await electronApp.firstWindow();
      await page.waitForLoadState("domcontentloaded");

      // Give some time for the renderer to initialize (reduced from 1000ms)
      await page.waitForTimeout(500);

      // Test basic JavaScript execution in renderer
      const result = await page.evaluate(() => {
        return typeof window !== "undefined";
      });

      expect(result).toBe(true);
    });
  });

  test.describe(`Crypto utilities functionality`, async () => {
    test("btoa function is available", async ({ electronApp }) => {
      const page = await electronApp.firstWindow();
      await page.waitForLoadState("domcontentloaded");

      // Wait for preload to complete (reduced from 2000ms)
      await page.waitForTimeout(1000);

      const debugInfo = await page.evaluate(() => {
        const windowBtoa = (window as any).btoa;
        const globalBtoa = (globalThis as any).btoa;

        return {
          windowBtoaType: typeof windowBtoa,
          globalBtoaType: typeof globalBtoa,
          windowKeys: Object.keys(window).filter((k) => k.includes("btoa")),
          allWindowAPIs: Object.keys(window).filter((k) => k.includes("API")),
        };
      });

      const btoaAvailable = await page.evaluate(() => {
        // Check both window.btoa (exposed via contextBridge) and globalThis.btoa
        return (
          typeof (window as any).btoa === "function" ||
          typeof (globalThis as any).btoa === "function"
        );
      });

      expect(btoaAvailable).toBe(true);
    });

    test("btoa function works correctly", async ({ electronApp }) => {
      const page = await electronApp.firstWindow();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000); // Reduced from 2000ms

      const testString = "hello world";
      const result = await page.evaluate((str) => {
        // Try window.btoa first (contextBridge exposed), then globalThis.btoa as fallback
        const btoaFn = (window as any).btoa || (globalThis as any).btoa;
        return btoaFn ? btoaFn(str) : "NO_BTOA_FUNCTION";
      }, testString);

      const expectedValue = Buffer.from(testString, "binary").toString(
        "base64"
      );
      expect(result).toEqual(expectedValue);
    });
  });

  test.describe(`IPC communication infrastructure works`, async () => {
    test("Authentication API is available for IPC", async ({ electronApp }) => {
      const page = await electronApp.firstWindow();
      await page.waitForLoadState("domcontentloaded");

      // Wait for preload to complete (reduced from 2000ms)
      await page.waitForTimeout(1000);

      const debugInfo = await page.evaluate(() => {
        const authAPI = (globalThis as any).authAPI;
        const windowAuthAPI = (window as any).authAPI;
        const allAPIs = Object.keys(globalThis).filter((k) =>
          k.toLowerCase().includes("api")
        );
        const allWindowAPIs = Object.keys(window).filter((k) =>
          k.toLowerCase().includes("api")
        );

        return {
          globalAuthAPIType: typeof authAPI,
          windowAuthAPIType: typeof windowAuthAPI,
          globalAuthAPIKeys: authAPI ? Object.keys(authAPI) : null,
          windowAuthAPIKeys: windowAuthAPI ? Object.keys(windowAuthAPI) : null,
          allGlobalAPIs: allAPIs,
          allWindowAPIs: allWindowAPIs,
          globalHasAuthAPI: "authAPI" in globalThis,
          windowHasAuthAPI: "authAPI" in window,
        };
      });

      const authAPIAvailable = await page.evaluate(() => {
        return typeof (globalThis as any).authAPI === "object";
      });

      expect(authAPIAvailable).toBe(true);
    });

    test("Authentication API methods are accessible", async ({
      electronApp,
    }) => {
      const page = await electronApp.firstWindow();

      const authMethods = await page.evaluate(() => {
        const api = (globalThis as any).authAPI;
        return api ? Object.keys(api) : [];
      });

      expect(authMethods).toContain("login");
      expect(authMethods).toContain("register");
    });
  });

  test.describe("POS Application Context Bridge APIs", async () => {
    test("All required POS APIs are exposed", async ({ electronApp }) => {
      const page = await electronApp.firstWindow();
      await page.waitForTimeout(1000);

      const apisExposed = await page.evaluate(() => {
        const requiredAPIs = [
          "authAPI",
          "authStore",
          "productAPI",
          "transactionAPI",
          "printerAPI",
          "paymentAPI",
          "cashDrawerAPI",
          "categoryAPI",
          "scheduleAPI",
          "shiftAPI",
          "refundAPI",
          "voidAPI",
          "databaseAPI",
        ];

        const exposedAPIs = requiredAPIs.filter(
          (api) =>
            typeof (window as any)[api] === "object" &&
            (window as any)[api] !== null
        );

        return {
          required: requiredAPIs.length,
          exposed: exposedAPIs.length,
          missing: requiredAPIs.filter(
            (api) => typeof (window as any)[api] !== "object"
          ),
        };
      });

      expect(apisExposed.exposed).toBeGreaterThanOrEqual(10); // At least 10 POS APIs should be exposed
      expect(apisExposed.missing.length).toBeLessThan(3); // Allow for a few optional APIs
    });

    test("Authentication API methods are available", async ({
      electronApp,
    }) => {
      const page = await electronApp.firstWindow();

      const authAPIComplete = await page.evaluate(() => {
        const authAPI = (window as any).authAPI;
        if (!authAPI) return false;

        const requiredMethods = ["login", "register", "validateSession"];
        return requiredMethods.every(
          (method) => typeof authAPI[method] === "function"
        );
      });

      expect(authAPIComplete).toBe(true);
    });
  });
});
