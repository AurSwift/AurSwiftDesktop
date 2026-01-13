/**
 * Data Export Service
 *
 * Handles exporting user data from the desktop application's local database
 * for GDPR compliance and user convenience.
 *
 * Features:
 * - Export all local database tables to JSON
 * - Create SQLite database backup
 * - Prompt user to export data when receiving cancellation event
 * - Schedule automatic backups
 *
 * GDPR Article 20: Right to Data Portability
 */

import { app, dialog } from "electron";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("dataExportService");

export interface ExportOptions {
  format: "json" | "sqlite" | "both";
  destination?: string;
  includeTables?: string[];
  excludeTables?: string[];
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  filePaths?: string[];
  error?: string;
  exportedTables?: string[];
  recordCount?: number;
}

/**
 * Export local database data to JSON and/or SQLite backup
 */
export async function exportLocalData(
  db: Database.Database,
  options: ExportOptions = { format: "both" }
): Promise<ExportResult> {
  try {
    const exportDate = new Date().toISOString().split("T")[0];
    const exportTime = new Date().toISOString().replace(/[:.]/g, "-");

    // Default export location: user's Documents folder
    const defaultPath =
      options.destination ||
      path.join(app.getPath("documents"), "AuraSwift EPOS Exports");

    // Ensure export directory exists
    await fs.mkdir(defaultPath, { recursive: true });

    const exportedFiles: string[] = [];
    const exportedTables: string[] = [];
    let totalRecords = 0;

    // ========================================================================
    // 1. Get all table names from database
    // ========================================================================
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all() as Array<{ name: string }>;

    logger.info(`Found ${tables.length} tables to export`);

    // Filter tables based on options
    const tablesToExport = tables
      .map((t) => t.name)
      .filter((name) => {
        if (options.includeTables && !options.includeTables.includes(name)) {
          return false;
        }
        if (options.excludeTables && options.excludeTables.includes(name)) {
          return false;
        }
        return true;
      });

    // ========================================================================
    // 2. Export to JSON if requested
    // ========================================================================
    if (options.format === "json" || options.format === "both") {
      const jsonData: Record<string, unknown[]> = {
        exportInfo: [
          {
            exportDate: new Date().toISOString(),
            appVersion: app.getVersion(),
            platform: process.platform,
            tableCount: tablesToExport.length,
          },
        ],
      };

      // Export each table
      for (const tableName of tablesToExport) {
        try {
          const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
          jsonData[tableName] = rows;
          exportedTables.push(tableName);
          totalRecords += rows.length;

          logger.debug(`Exported ${rows.length} rows from ${tableName}`);
        } catch (error) {
          logger.error(`Failed to export table ${tableName}:`, error);
        }
      }

      // Write JSON file
      const jsonPath = path.join(
        defaultPath,
        `auraswift-data-export-${exportDate}-${exportTime}.json`
      );

      await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), "utf-8");
      exportedFiles.push(jsonPath);

      logger.info(`JSON export saved to: ${jsonPath}`);
    }

    // ========================================================================
    // 3. Export to SQLite backup if requested
    // ========================================================================
    if (options.format === "sqlite" || options.format === "both") {
      const backupPath = path.join(
        defaultPath,
        `auraswift-database-backup-${exportDate}-${exportTime}.db`
      );

      // Use SQLite backup API for safe backup
      await backupDatabase(db, backupPath);
      exportedFiles.push(backupPath);

      logger.info(`SQLite backup saved to: ${backupPath}`);
    }

    return {
      success: true,
      filePaths: exportedFiles,
      filePath: exportedFiles[0],
      exportedTables,
      recordCount: totalRecords,
    };
  } catch (error) {
    logger.error("Export failed:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Backup database using SQLite backup API
 */
async function backupDatabase(
  sourceDb: Database.Database,
  destinationPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create backup using better-sqlite3's backup feature
      const backup = sourceDb.backup(destinationPath);

      // Wait for backup to complete
      backup
        .then(() => {
          logger.info(`Database backup completed: ${destinationPath}`);
          resolve();
        })
        .catch((error: Error) => {
          logger.error("Database backup failed:", error);
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Show export dialog to user
 */
export async function showExportDialog(
  db: Database.Database,
  reason?: "cancellation" | "manual" | "scheduled"
): Promise<ExportResult> {
  try {
    // Show dialog to user
    const result = await dialog.showMessageBox({
      type: reason === "cancellation" ? "warning" : "info",
      title: "Export Your Data",
      message:
        reason === "cancellation"
          ? "Your subscription has been cancelled. Would you like to export your data before losing access?"
          : "Export your local transaction data and database.",
      detail:
        "This will create a backup of all your transactions, products, customers, and settings. You can import this data later if you reactivate your subscription.",
      buttons: [
        "Export Data",
        reason === "cancellation" ? "Export Later" : "Cancel",
      ],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      // User chose to export
      const exportResult = await exportLocalData(db, {
        format: "both",
      });

      if (exportResult.success) {
        // Show success message
        await dialog
          .showMessageBox({
            type: "info",
            title: "Export Successful",
            message: "Your data has been exported successfully!",
            detail: `Files saved to:\n${exportResult.filePaths?.join("\n")}`,
            buttons: ["Open Folder", "OK"],
          })
          .then(async (response) => {
            if (response.response === 0 && exportResult.filePath) {
              // Open export folder
              const { shell } = require("electron");
              await shell.showItemInFolder(exportResult.filePath);
            }
          });
      } else {
        // Show error message
        await dialog.showMessageBox({
          type: "error",
          title: "Export Failed",
          message: "Failed to export your data",
          detail: exportResult.error || "Unknown error occurred",
        });
      }

      return exportResult;
    } else {
      // User cancelled
      return {
        success: false,
        error: "User cancelled export",
      };
    }
  } catch (error) {
    logger.error("Export dialog failed:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Auto-export on specific events
 */
export async function autoExportOnEvent(
  db: Database.Database,
  event: "subscription_cancelled" | "license_revoked" | "grace_period_ending"
): Promise<void> {
  logger.info(`Auto-export triggered by event: ${event}`);

  try {
    // Show dialog based on event
    let reason: "cancellation" | "manual" | "scheduled" = "manual";

    if (event === "subscription_cancelled" || event === "license_revoked") {
      reason = "cancellation";
    }

    await showExportDialog(db, reason);
  } catch (error) {
    logger.error(`Auto-export failed for event ${event}:`, error);
  }
}

/**
 * Schedule automatic daily backups
 */
export function scheduleAutomaticBackups(
  db: Database.Database,
  intervalHours: number = 24
): NodeJS.Timeout {
  logger.info(`Scheduling automatic backups every ${intervalHours} hours`);

  const intervalMs = intervalHours * 60 * 60 * 1000;

  const backupInterval = setInterval(async () => {
    try {
      const result = await exportLocalData(db, {
        format: "sqlite",
        destination: path.join(app.getPath("userData"), "backups"),
      });

      if (result.success) {
        logger.info(`Automatic backup completed: ${result.filePath}`);
      } else {
        logger.error("Automatic backup failed:", result.error);
      }
    } catch (error) {
      logger.error("Automatic backup error:", error);
    }
  }, intervalMs);

  // Run first backup immediately
  exportLocalData(db, {
    format: "sqlite",
    destination: path.join(app.getPath("userData"), "backups"),
  }).catch((error) => {
    logger.error("Initial backup failed:", error);
  });

  return backupInterval;
}

/**
 * Cleanup old backup files (keep last N backups)
 */
export async function cleanupOldBackups(
  backupDirectory: string,
  keepCount: number = 30
): Promise<void> {
  try {
    const files = await fs.readdir(backupDirectory);

    // Filter for backup files
    const backupFiles = files
      .filter((file) => file.startsWith("auraswift-database-backup-"))
      .map((file) => ({
        name: file,
        path: path.join(backupDirectory, file),
      }));

    // Sort by modification time (newest first)
    const filesWithStats = await Promise.all(
      backupFiles.map(async (file) => ({
        ...file,
        stats: await fs.stat(file.path),
      }))
    );

    filesWithStats.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    // Delete old backups
    const filesToDelete = filesWithStats.slice(keepCount);

    for (const file of filesToDelete) {
      await fs.unlink(file.path);
      logger.debug(`Deleted old backup: ${file.name}`);
    }

    logger.info(
      `Cleanup complete. Kept ${Math.min(
        filesWithStats.length,
        keepCount
      )} backups, deleted ${filesToDelete.length}`
    );
  } catch (error) {
    logger.error("Backup cleanup failed:", error);
  }
}
