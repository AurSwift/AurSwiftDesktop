/**
 * Data Export IPC Handlers
 *
 * Electron IPC handlers for data export functionality
 */

import { ipcMain } from "electron";
import Database from "better-sqlite3";
import {
  exportLocalData,
  showExportDialog,
  autoExportOnEvent,
  ExportOptions,
} from "../services/dataExportService.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("dataExportIPC");

/**
 * Register data export IPC handlers
 */
export function registerDataExportHandlers(db: Database.Database): void {
  logger.info("Registering data export IPC handlers");

  // Export data programmatically
  ipcMain.handle(
    "data-export:export",
    async (_event, options: ExportOptions = { format: "both" }) => {
      try {
        logger.info("Manual data export requested", options);
        const result = await exportLocalData(db, options);
        return result;
      } catch (error) {
        logger.error("Data export failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Show export dialog to user
  ipcMain.handle("data-export:show-dialog", async () => {
    try {
      logger.info("Export dialog requested");
      const result = await showExportDialog(db, "manual");
      return result;
    } catch (error) {
      logger.error("Export dialog failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Trigger auto-export based on subscription event
  ipcMain.handle(
    "data-export:auto-export",
    async (_event,
      eventType:
        | "subscription_cancelled"
        | "license_revoked"
        | "grace_period_ending"
    ) => {
      try {
        logger.info(`Auto-export triggered by: ${eventType}`);
        await autoExportOnEvent(db, eventType);
        return { success: true };
      } catch (error) {
        logger.error("Auto-export failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  logger.info("Data export IPC handlers registered successfully");
}
