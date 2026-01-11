import type { AppModule } from "../AppModule.js";
import { ModuleContext } from "../ModuleContext.js";
import {
  BrowserWindow,
  Menu,
  shell,
  app as electronApp,
  screen,
  dialog,
} from "electron";
import type { AppInitConfig } from "../AppInitConfig.js";
import type { UpdateCheckResult } from "electron-updater";
import electronUpdater from "electron-updater";
import { getAutoUpdaterInstance } from "../index.js";

const { autoUpdater } = electronUpdater;
import { join } from "node:path";

import { getLogger } from "../utils/logger.js";
const logger = getLogger("WindowManager");

class WindowManager implements AppModule {
  readonly #preload: { path: string };
  readonly #renderer: { path: string } | URL;
  readonly #openDevTools;

  constructor({
    initConfig,
    openDevTools = false,
  }: {
    initConfig: AppInitConfig;
    openDevTools?: boolean;
  }) {
    this.#preload = initConfig.preload;
    this.#renderer = initConfig.renderer;
    this.#openDevTools = openDevTools;
  }

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();

    // Create minimal application menu with update checking
    this.createApplicationMenu();

    await this.restoreOrCreateWindow(true);
    app.on("second-instance", () => this.restoreOrCreateWindow(true));
    app.on("activate", () => this.restoreOrCreateWindow(true));
  }

  private createApplicationMenu(): void {
    const isMac = process.platform === "darwin";

    const template: Electron.MenuItemConstructorOptions[] = [
      // App menu (macOS only)
      ...(isMac
        ? [
            {
              label: electronApp.name,
              submenu: [
                { role: "about" as const },
                { type: "separator" as const },
                { role: "hide" as const },
                { role: "hideOthers" as const },
                { role: "unhide" as const },
                { type: "separator" as const },
                { role: "quit" as const },
              ],
            },
          ]
        : []),

      // Help menu
      {
        label: "Help",
        submenu: [
          {
            label: "View Release Notes",
            click: () => {
              shell.openExternal(
                "https://github.com/AurSwift/AurSwift/releases"
              );
            },
          },
          { type: "separator" as const },
          {
            label: "About aurswift",
            click: () => {
              const { dialog } = require("electron");
              dialog
                .showMessageBox({
                  type: "info",
                  title: "About aurswift",
                  message: `aurswift POS System`,
                  detail: `Version: ${electronApp.getVersion()}\n\nA modern point-of-sale system for retail businesses.\n\n© 2025 Sameer Shahi\n\nGitHub: github.com/Sam231221/aurswift`,
                  buttons: ["OK", "Visit GitHub"],
                })
                .then((result: { response: number }) => {
                  if (result.response === 1) {
                    shell.openExternal("https://github.com/Sam231221/aurswift");
                  }
                });
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  async createWindow(): Promise<BrowserWindow> {
    // Get the icon path - use .icns for macOS, .png for others
    const iconPath =
      process.platform === "darwin"
        ? join(process.cwd(), "buildResources", "icon.icns")
        : join(process.cwd(), "buildResources", "icon.ico");

    // Get primary display dimensions for responsive window sizing
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } =
      primaryDisplay.workAreaSize;

    // Calculate default window size (90% of screen for better UX)
    const defaultWidth = Math.floor(screenWidth * 0.9);
    const defaultHeight = Math.floor(screenHeight * 0.9);

    // Set minimum window size to ensure usability
    const minWidth = 800;
    const minHeight = 600;

    const browserWindow = new BrowserWindow({
      width: defaultWidth,
      height: defaultHeight,
      minWidth,
      minHeight,
      show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
      icon: iconPath, // Set the window icon
      title: "", // Set the window title
      frame: false, // Remove the title bar (minimize, maximize, close buttons)
      autoHideMenuBar: true, // Hide menu bar on Windows/Linux
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
        webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
        preload: this.#preload.path,
        devTools: process.env.NODE_ENV === "development", // Only enable DevTools in development
      },
    });

    // Hide the menu bar completely
    browserWindow.setMenuBarVisibility(false);

    // Disable DevTools completely in production
    if (process.env.NODE_ENV === "production") {
      // Prevent opening DevTools with keyboard shortcuts
      browserWindow.webContents.on("before-input-event", (event, input) => {
        // Block F12 and Ctrl+Shift+I (Cmd+Option+I on Mac)
        if (
          input.key === "F12" ||
          (input.control && input.shift && input.key === "I") ||
          (input.meta && input.alt && input.key === "I")
        ) {
          event.preventDefault();
        }
      });

      // Disable right-click context menu (prevents "Inspect Element")
      browserWindow.webContents.on("context-menu", (event) => {
        event.preventDefault();
      });

      // Block any programmatic attempts to open DevTools
      browserWindow.webContents.on("devtools-opened", () => {
        browserWindow.webContents.closeDevTools();
      });
    }

    // Ensure window shows when ready to prevent "main window not visible" test failures
    browserWindow.once("ready-to-show", () => {
      browserWindow.maximize(); // Maximize window to full size by default
      browserWindow.show();
    });

    if (this.#renderer instanceof URL) {
      // In development, check if dev server is running before trying to load
      if (process.env.NODE_ENV === "development") {
        let devServerReady = false;
        const maxRetries = 5;
        const retryDelay = 1000; // 1 second between retries

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(this.#renderer.href, {
              method: "HEAD",
              signal: AbortSignal.timeout(3000), // 3 second timeout per attempt
            });
            if (response.ok) {
              devServerReady = true;
              break;
            }
          } catch (error) {
            if (attempt < maxRetries) {
              logger.warn(
                `⚠️  Dev server check failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`
              );
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              continue;
            }
          }
        }

        if (!devServerReady) {
          logger.error("\n❌ Frontend dev server is not running!");
          logger.error(`   Cannot load: ${this.#renderer.href}`);
          logger.error("\n💡 To start the frontend dev server, run:");
          logger.error("   npm run dev --workspace @app/renderer");
          logger.error("\n   Or start both frontend and backend together:");
          logger.error("   npm run dev (in root directory)\n");

          // Show error dialog to user
          await dialog.showErrorBox(
            "Development Server Not Running",
            `The frontend development server is not running.\n\n` +
              `Please start it with:\n` +
              `npm run dev --workspace @app/renderer\n\n` +
              `Then restart the app.`
          );

          electronApp.quit();
          return browserWindow;
        }
      }

      await browserWindow.loadURL(this.#renderer.href);
    } else {
      await browserWindow.loadFile(this.#renderer.path);
    }

    return browserWindow;
  }

  async restoreOrCreateWindow(show = false) {
    let window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

    if (window === undefined) {
      window = await this.createWindow();
    }

    if (!show) {
      return window;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    window?.show();

    // Only auto-open DevTools in development mode
    if (this.#openDevTools && process.env.NODE_ENV === "development") {
      window?.webContents.openDevTools();
    }

    window.focus();

    return window;
  }
}

export function createWindowManagerModule(
  ...args: ConstructorParameters<typeof WindowManager>
) {
  return new WindowManager(...args);
}
