// Load environment variables from .env file
try {
  await import("dotenv/config");
} catch (error) {
  // Ignore dotenv import errors in production builds where it might not be available
  console.log("Dotenv not available, continuing without .env file loading");
}

import { initApp } from "@app/main";
import { fileURLToPath } from "node:url";
import { app, Menu } from "electron";

// Disable hardware acceleration before app is ready
// This must be called before any other app initialization
app.disableHardwareAcceleration();

// Prevent Electron from building the default menu; WindowManager sets a custom menu after ready
Menu.setApplicationMenu(null);

if (
  process.env.NODE_ENV === "development" ||
  process.env.PLAYWRIGHT_TEST === "true" ||
  !!process.env.CI
) {
  function showAndExit(...args) {
    console.error(...args);
    process.exit(1);
  }

  process.on("uncaughtException", showAndExit);
  process.on("unhandledRejection", showAndExit);
}

// noinspection JSIgnoredPromiseFromCall
/**
 * We resolve '@app/renderer' and '@app/preload'
 * here and not in '@app/main'
 * to observe good practices of modular design.
 * This allows fewer dependencies and better separation of concerns in '@app/main'.
 * Thus,
 * the main module remains simplistic and efficient
 * as it receives initialization instructions rather than direct module imports.
 */
initApp({
  renderer:
    process.env.MODE === "development" && !!process.env.VITE_DEV_SERVER_URL
      ? new URL(process.env.VITE_DEV_SERVER_URL)
      : {
          path: fileURLToPath(import.meta.resolve("@app/renderer")),
        },

  preload: {
    path: fileURLToPath(import.meta.resolve("@app/preload/exposed.mjs")),
  },
});
