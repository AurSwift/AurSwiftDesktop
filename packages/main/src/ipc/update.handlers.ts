/**
 * IPC handlers for update functionality
 * Handles update actions from renderer process
 */

import { ipcMain, BrowserWindow } from "electron";
import type { UpdateCheckResult } from "electron-updater";
import { getAutoUpdaterInstance } from "../index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("update-handlers");

/**
 * Register IPC handlers for update functionality
 */
export function registerUpdateHandlers(): void {
  /**
   * Signal that the renderer is ready to receive update events
   * This is the Cursor-style approach to avoid race conditions:
   * 1. Renderer mounts and sets up IPC listeners
   * 2. Renderer calls signalRendererReady
   * 3. Main process re-broadcasts any pending update OR starts checking
   */
  ipcMain.handle("update:renderer-ready", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        logger.warn("[renderer-ready] Auto-updater not available");
        return { success: false, pendingUpdate: null };
      }

      logger.info("[renderer-ready] Renderer signaled ready for update events");

      const pendingUpdate = updaterInstance.getPendingUpdateInfo();
      const isDownloaded = updaterInstance.isUpdateDownloaded();

      if (pendingUpdate) {
        logger.info(
          `[renderer-ready] Re-broadcasting pending update: v${pendingUpdate.version}`,
        );
        // Re-broadcast the pending update to all windows
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach((window) => {
          if (window && !window.isDestroyed()) {
            if (isDownloaded) {
              window.webContents.send("update:downloaded", pendingUpdate);
            } else {
              window.webContents.send("update:available", pendingUpdate);
            }
          }
        });
      } else {
        logger.info("[renderer-ready] No pending update, triggering check");
        // No pending update - trigger a check now that renderer is ready
        updaterInstance.runAutoUpdater().catch((err: Error) => {
          logger.error("[renderer-ready] Error running auto-updater:", err);
        });
      }

      return {
        success: true,
        pendingUpdate,
        isDownloaded,
      };
    } catch (error) {
      logger.error("[renderer-ready] Error:", error);
      return { success: false, pendingUpdate: null };
    }
  });

  /**
   * Get pending update info (for renderer mount sync)
   * This allows the renderer to check if there's a pending update
   * when it mounts (in case the update:available event was missed)
   */
  ipcMain.handle("update:get-pending-update", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        return { success: false, updateInfo: null };
      }

      const pendingUpdate = updaterInstance.getPendingUpdateInfo();
      const isDownloaded = updaterInstance.isUpdateDownloaded();

      return {
        success: true,
        updateInfo: pendingUpdate,
        isDownloaded,
      };
    } catch (error) {
      logger.error("Error getting pending update:", error);
      return { success: false, updateInfo: null };
    }
  });

  /**
   * Handle manual update check request
   */
  ipcMain.handle("update:check", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        return { hasUpdate: false, error: "Auto-updater not available" };
      }

      const result =
        (await updaterInstance.runAutoUpdater()) as UpdateCheckResult | null;

      if (result?.updateInfo) {
        // Update is available
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach((window) => {
          if (window && !window.isDestroyed()) {
            window.webContents.send(
              "update:check-complete",
              true,
              result.updateInfo.version,
            );
          }
        });
        return { hasUpdate: true, version: result.updateInfo.version };
      } else {
        // No update available
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach((window) => {
          if (window && !window.isDestroyed()) {
            window.webContents.send("update:check-complete", false);
          }
        });
        return { hasUpdate: false };
      }
    } catch (error) {
      logger.error("Error checking for updates:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Send error to renderer
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        if (window && !window.isDestroyed()) {
          window.webContents.send("update:error", {
            message: errorMessage,
            type: "check",
            timestamp: new Date(),
          });
        }
      });

      return { hasUpdate: false, error: errorMessage };
    }
  });

  /**
   * Handle download update request
   */
  ipcMain.handle("update:download", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        throw new Error("Auto-updater not available");
      }

      // Check if already downloaded
      if (updaterInstance.isUpdateDownloaded()) {
        return { success: true, message: "Update already downloaded" };
      }

      // Use pending update info if available (avoids redundant check)
      let updateInfo = updaterInstance.getPendingUpdateInfo();

      // Only check if no pending update info
      if (!updateInfo) {
        const checkResult =
          (await updaterInstance.runAutoUpdater()) as UpdateCheckResult | null;

        if (!checkResult?.updateInfo) {
          throw new Error("No update available to download");
        }
        updateInfo = checkResult.updateInfo;
      }

      const updater = updaterInstance.getAutoUpdater();

      // Start download
      updaterInstance.setDownloading(true);
      updater.downloadUpdate();

      return { success: true };
    } catch (error) {
      logger.error("Error downloading update:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Send error to renderer
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        if (window && !window.isDestroyed()) {
          window.webContents.send("update:error", {
            message: errorMessage,
            type: "download",
            timestamp: new Date(),
          });
        }
      });

      throw error;
    }
  });

  /**
   * Handle install update request (Cursor-style: immediate quit + silent install)
   */
  ipcMain.handle("update:install", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        throw new Error("Auto-updater not available");
      }

      const updater = updaterInstance.getAutoUpdater();

      // Check if update is downloaded
      if (!updaterInstance.isUpdateDownloaded()) {
        throw new Error("Update not downloaded yet");
      }

      logger.info("Starting silent installation (Cursor-style)...");

      // Cursor-style: Immediate quit with silent install
      // quitAndInstall(isSilent, isForceRunAfter)
      // - isSilent = true: No installer UI shown
      // - isForceRunAfter = true: Auto-restart app after install
      updater.quitAndInstall(true, true);

      // Note: This will trigger app.quit() immediately
      // The installation happens after app closes
      return { success: true };
    } catch (error) {
      logger.error("Error installing update:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Send error to renderer
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        if (window && !window.isDestroyed()) {
          window.webContents.send("update:error", {
            message: errorMessage,
            type: "install",
            timestamp: new Date(),
          });
        }
      });

      throw error;
    }
  });

  /**
   * Handle postpone update request
   */
  ipcMain.handle("update:postpone", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        return { success: false, error: "Auto-updater not available" };
      }

      // Get current update info if available
      const updateInfo = updaterInstance.getPendingUpdateInfo();

      if (updateInfo) {
        updaterInstance.postponeUpdate(updateInfo);
        return { success: true };
      }

      return { success: false, error: "No update to postpone" };
    } catch (error) {
      logger.error("Error postponing update:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Handle dismiss error request
   */
  ipcMain.handle("update:dismiss-error", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (updaterInstance) {
        updaterInstance.clearLastError();
      }
      return { success: true };
    } catch (error) {
      logger.error("Error dismissing update error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get postpone count (for renderer sync)
   */
  ipcMain.handle("update:get-postpone-count", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        return { success: false, postponeCount: 0 };
      }
      return {
        success: true,
        postponeCount: updaterInstance.getPostponeCount(),
      };
    } catch (error) {
      logger.error("Error getting postpone count:", error);
      return {
        success: false,
        postponeCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Handle cancel download request
   */
  ipcMain.handle("update:cancel-download", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        return { success: false, error: "Auto-updater not available" };
      }

      const cancelled = updaterInstance.cancelDownload();

      if (cancelled) {
        logger.info("Download cancelled successfully");
        return { success: true };
      } else {
        return {
          success: false,
          error: "No download in progress to cancel",
        };
      }
    } catch (error) {
      logger.error("Error cancelling download:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Handle pause download request
   */
  ipcMain.handle("update:pause-download", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        return { success: false, error: "Auto-updater not available" };
      }

      const paused = updaterInstance.pauseDownload();

      if (paused) {
        logger.info("Download paused successfully");
        return { success: true };
      } else {
        return {
          success: false,
          error: "No download in progress to pause or already paused",
        };
      }
    } catch (error) {
      logger.error("Error pausing download:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Handle resume download request
   */
  ipcMain.handle("update:resume-download", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        return { success: false, error: "Auto-updater not available" };
      }

      const resumed = updaterInstance.resumeDownload();

      if (resumed) {
        logger.info("Download resumed successfully");
        return { success: true };
      } else {
        return {
          success: false,
          error: "No paused download to resume",
        };
      }
    } catch (error) {
      logger.error("Error resuming download:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get download state including progress and paused status
   */
  ipcMain.handle("update:get-download-state", async () => {
    try {
      const updaterInstance = getAutoUpdaterInstance();
      if (!updaterInstance) {
        return { success: false };
      }

      const isDownloading = updaterInstance.getIsDownloading();
      const isPaused = updaterInstance.isDownloadPaused();
      const progress = updaterInstance.getDownloadProgress();

      return {
        success: true,
        isDownloading,
        isPaused,
        progress,
      };
    } catch (error) {
      logger.error("Error getting download state:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  logger.info("Update IPC handlers registered");
}
