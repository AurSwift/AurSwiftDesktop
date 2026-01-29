// Database IPC Handlers
import { ipcMain, dialog, BrowserWindow, app as electronApp } from "electron";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";
import { getDatabase, closeDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import {
  cleanupAllBackups,
  getBackupStorageInfo,
} from "../database/utils/backup-cleanup.js";
import { isDevelopmentMode } from "../database/utils/environment.js";

const logger = getLogger("dbHandlers");

// ============================================================================
// LICENSE DATA PRESERVATION HELPERS
// ============================================================================

interface LicenseBackupData {
  licenseActivation: any | null;
  licenseValidationLogs: any[];
  receiptEmailSettings: Array<{ key: string; value: string }> | null;
}

/**
 * Extract license data from a database file before import/replacement
 * This ensures license data persists across database operations
 */
function extractLicenseData(dbPath: string): LicenseBackupData | null {
  try {
    const db = new Database(dbPath, { readonly: true });

    // Check if license tables exist
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('license_activation', 'license_validation_log')",
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    let licenseActivation = null;
    let licenseValidationLogs: any[] = [];
    let receiptEmailSettings: Array<{ key: string; value: string }> | null =
      null;

    // Extract license activation (only active one)
    if (tableNames.includes("license_activation")) {
      try {
        licenseActivation = db
          .prepare(
            "SELECT * FROM license_activation WHERE is_active = 1 LIMIT 1",
          )
          .get();

        if (licenseActivation) {
          logger.info(
            `Extracted license activation for key: ${(
              licenseActivation as any
            ).license_key?.substring(0, 15)}...`,
          );
        }
      } catch (err) {
        logger.warn("Could not extract license activation:", err);
      }
    }

    // Extract recent validation logs (last 100 for audit trail)
    if (tableNames.includes("license_validation_log")) {
      try {
        licenseValidationLogs = db
          .prepare(
            "SELECT * FROM license_validation_log ORDER BY timestamp DESC LIMIT 100",
          )
          .all();

        logger.info(
          `Extracted ${licenseValidationLogs.length} license validation logs`,
        );
      } catch (err) {
        logger.warn("Could not extract license validation logs:", err);
      }
    }

    // Extract receipt email settings (if present) so they survive imports.
    if (tableNames.includes("app_settings")) {
      try {
        const rows = db
          .prepare(
            "SELECT key, value FROM app_settings WHERE key LIKE 'receipt_email:%' ORDER BY key ASC",
          )
          .all() as Array<{ key: string; value: string }>;
        receiptEmailSettings = rows.length > 0 ? rows : null;
        if (receiptEmailSettings) {
          logger.info(
            `Extracted ${receiptEmailSettings.length} receipt email setting(s) from app_settings`,
          );
        }
      } catch (err) {
        logger.warn("Could not extract receipt email settings:", err);
      }
    }

    db.close();

    if (
      !licenseActivation &&
      licenseValidationLogs.length === 0 &&
      !receiptEmailSettings
    ) {
      return null;
    }

    return { licenseActivation, licenseValidationLogs, receiptEmailSettings };
  } catch (error) {
    logger.error("Failed to extract license data:", error);
    return null;
  }
}

/**
 * Restore license data to a database after import/replacement
 */
function restoreLicenseData(
  dbPath: string,
  backupData: LicenseBackupData,
): boolean {
  try {
    const db = new Database(dbPath);

    // Start transaction for atomic operation
    const transaction = db.transaction(() => {
      // Restore license activation if we have one
      if (backupData.licenseActivation) {
        const activation = backupData.licenseActivation;

        // First, deactivate any existing activations in the imported database
        try {
          db.prepare(
            "UPDATE license_activation SET is_active = 0 WHERE is_active = 1",
          ).run();
        } catch (err) {
          // Table might not exist - will be created by upsert
        }

        // Check if license_activation table exists, create if not
        const tableExists = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='license_activation'",
          )
          .get();

        if (!tableExists) {
          logger.warn(
            "license_activation table doesn't exist in imported database - skipping restoration",
          );
          logger.info("License will need to be re-activated after import");
        } else {
          // Check if this license key already exists
          const existing = db
            .prepare("SELECT id FROM license_activation WHERE license_key = ?")
            .get(activation.license_key);

          if (existing) {
            // Update existing record
            db.prepare(
              `
              UPDATE license_activation SET
                machine_id_hash = ?,
                terminal_name = ?,
                activation_id = ?,
                plan_id = ?,
                plan_name = ?,
                max_terminals = ?,
                features = ?,
                business_name = ?,
                is_active = 1,
                subscription_status = ?,
                expires_at = ?,
                trial_end = ?,
                activated_at = ?,
                last_heartbeat = ?,
                last_validated_at = ?,
                updated_at = ?
              WHERE license_key = ?
            `,
            ).run(
              activation.machine_id_hash,
              activation.terminal_name,
              activation.activation_id,
              activation.plan_id,
              activation.plan_name,
              activation.max_terminals,
              activation.features,
              activation.business_name,
              activation.subscription_status,
              activation.expires_at,
              activation.trial_end,
              activation.activated_at,
              activation.last_heartbeat,
              activation.last_validated_at,
              Date.now(),
              activation.license_key,
            );
          } else {
            // Insert new record
            db.prepare(
              `
              INSERT INTO license_activation (
                license_key, machine_id_hash, terminal_name, activation_id,
                plan_id, plan_name, max_terminals, features, business_name,
                is_active, subscription_status, expires_at, trial_end,
                activated_at, last_heartbeat, last_validated_at, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            ).run(
              activation.license_key,
              activation.machine_id_hash,
              activation.terminal_name,
              activation.activation_id,
              activation.plan_id,
              activation.plan_name,
              activation.max_terminals,
              activation.features,
              activation.business_name,
              activation.subscription_status,
              activation.expires_at,
              activation.trial_end,
              activation.activated_at,
              activation.last_heartbeat,
              activation.last_validated_at,
              activation.created_at || Date.now(),
              Date.now(),
            );
          }

          logger.info(
            `Restored license activation for key: ${activation.license_key?.substring(
              0,
              15,
            )}...`,
          );
        }
      }

      // Restore recent validation logs (for audit trail)
      if (backupData.licenseValidationLogs.length > 0) {
        const logTableExists = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='license_validation_log'",
          )
          .get();

        if (logTableExists) {
          const insertLog = db.prepare(`
            INSERT OR IGNORE INTO license_validation_log (
              action, status, license_key, machine_id_hash, error_message, server_response, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

          for (const log of backupData.licenseValidationLogs) {
            try {
              insertLog.run(
                log.action,
                log.status,
                log.license_key,
                log.machine_id_hash,
                log.error_message,
                log.server_response,
                log.timestamp,
              );
            } catch (err) {
              // Ignore duplicate entries
            }
          }

          logger.info(
            `Restored ${backupData.licenseValidationLogs.length} validation log entries`,
          );
        }
      }

      // Restore receipt email settings (if available)
      if (
        backupData.receiptEmailSettings &&
        backupData.receiptEmailSettings.length > 0
      ) {
        const appSettingsExists = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'",
          )
          .get();

        if (appSettingsExists) {
          const now = Date.now();
          const upsert = db.prepare(
            "INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)",
          );

          for (const row of backupData.receiptEmailSettings) {
            try {
              upsert.run(row.key, row.value, now, now);
            } catch (err) {
              logger.warn(
                `Failed to restore app_settings key ${row.key}:`,
                err,
              );
            }
          }

          logger.info(
            `Restored ${backupData.receiptEmailSettings.length} receipt email setting(s) to app_settings`,
          );
        }
      }
    });

    transaction();
    db.close();

    return true;
  } catch (error) {
    logger.error("Failed to restore license data:", error);
    return false;
  }
}

export function registerDbHandlers() {
  ipcMain.handle("database:getInfo", async () => {
    try {
      const db = await getDatabase();
      const info = db.getDatabaseInfo();

      return {
        success: true,
        data: info,
      };
    } catch (error) {
      logger.error("Get database info IPC error:", error);
      return {
        success: false,
        message: "Failed to get database information",
      };
    }
  });

  // Database Backup IPC Handler - Save database to user-selected location
  ipcMain.handle("database:backup", async (event) => {
    try {
      const db = await getDatabase();
      const info = db.getDatabaseInfo();

      // Generate default filename with timestamp: YYYYMMDD-HHMMSS format
      const now = new Date();
      const timestamp =
        [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("") +
        "-" +
        [
          String(now.getHours()).padStart(2, "0"),
          String(now.getMinutes()).padStart(2, "0"),
          String(now.getSeconds()).padStart(2, "0"),
        ].join("");
      const defaultFilename = `aurswift-backup-${timestamp}.db`;

      // Show save dialog
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(focusedWindow!, {
        title: "Save Database Backup",
        defaultPath: defaultFilename,
        filters: [
          { name: "Database Files", extensions: ["db"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          message: "Backup cancelled by user",
          cancelled: true,
        };
      }

      // Copy database file to selected location
      await fs.copyFile(info.path, result.filePath);

      // Get file stats for confirmation
      const stats = await fs.stat(result.filePath);

      return {
        success: true,
        data: {
          path: result.filePath,
          size: stats.size,
          timestamp: new Date().toISOString(),
        },
        message: "Database backed up successfully",
      };
    } catch (error) {
      logger.error("Database backup error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to backup database",
      };
    }
  });

  // Database Empty IPC Handler - Delete all data from all tables (keep structure)
  ipcMain.handle("database:empty", async (event) => {
    try {
      const db = await getDatabase();
      const info = db.getDatabaseInfo();

      // Preserve receipt email settings across empty operations
      const preservedReceiptEmailSettings =
        db.settings.getSettingsByPrefix("receipt_email:");

      // Create automatic backup before emptying
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .split("T")[0];
      const timeStr = new Date()
        .toTimeString()
        .split(" ")[0]
        .replace(/:/g, "-");
      const backupPath = info.path.replace(
        ".db",
        `-backup-before-empty-${timestamp}-${timeStr}.db`,
      );

      // Create backup
      await fs.copyFile(info.path, backupPath);
      logger.info(`Backup created before emptying: ${backupPath}`);

      // Get backup file stats
      const backupStats = await fs.stat(backupPath);
      const backupSize = backupStats.size;

      // Cleanup old empty operation backups (keep last 3)
      try {
        cleanupAllBackups(
          info.path,
          { emptyOperation: 3 },
          !isDevelopmentMode(),
        );
      } catch (cleanupError) {
        logger.warn(
          "Failed to cleanup old empty operation backups:",
          cleanupError,
        );
      }

      // Empty all tables using the public method
      const result = await db.emptyAllTables();

      if (!result || !result.success) {
        return {
          success: false,
          message: "Failed to empty database",
        };
      }

      // Reseed database with default data after emptying
      try {
        await db.reseedDatabase();
        logger.info("✅ Database reseeded after emptying");

        // Restore preserved receipt email settings after reseed
        if (preservedReceiptEmailSettings.length > 0) {
          for (const s of preservedReceiptEmailSettings) {
            try {
              db.settings.setSetting(s.key, s.value);
            } catch (err) {
              logger.warn(
                `Failed to restore preserved email setting ${s.key}:`,
                err,
              );
            }
          }
          logger.info(
            `✅ Restored ${preservedReceiptEmailSettings.length} receipt email setting(s) after empty`,
          );
        }
      } catch (seedError) {
        logger.error(
          "⚠️  Failed to reseed database after emptying:",
          seedError,
        );
        // Don't fail the entire operation if reseeding fails
        // The database is empty and will be reseeded on next app start
      }

      return {
        success: true,
        data: {
          backupPath,
          backupSize,
          tablesEmptied: result.tablesEmptied.length,
          totalRowsDeleted: result.rowsDeleted,
          tableList: result.tablesEmptied,
        },
        message: "Database emptied and reseeded successfully",
      };
    } catch (error) {
      logger.error("Database empty error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to empty database",
      };
    }
  });

  // Database Import IPC Handler - Import database from a file
  ipcMain.handle("database:import", async (event) => {
    // Helper to send progress updates to renderer
    const sendProgress = (stage: string, percent: number, message: string) => {
      event.sender.send("database:import:progress", {
        stage,
        percent,
        message,
      });
    };

    try {
      // Show open file dialog to select database file
      const result = await dialog.showOpenDialog({
        title: "Select Database File to Import",
        buttonLabel: "Import",
        filters: [
          { name: "Database Files", extensions: ["db", "sqlite", "sqlite3"] },
          { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
      });

      // Check if user cancelled
      if (
        result.canceled ||
        !result.filePaths ||
        result.filePaths.length === 0
      ) {
        return {
          success: false,
          cancelled: true,
          message: "Import cancelled by user",
        };
      }

      const importPath = result.filePaths[0];
      logger.info("Importing database from:", importPath);

      // Stage 1: Validating file
      sendProgress("validating", 5, "Checking file accessibility...");

      // Verify the file exists and is readable
      try {
        await fs.access(importPath);
      } catch (error) {
        sendProgress("error", 0, "File not accessible");
        return {
          success: false,
          message: "Selected file does not exist or is not accessible",
        };
      }

      // Get file stats
      const importStats = await fs.stat(importPath);
      const importSize = importStats.size;

      // Check file size limit (e.g., 500MB)
      const MAX_DB_SIZE = 500 * 1024 * 1024;
      if (importSize > MAX_DB_SIZE) {
        return {
          success: false,
          message: `Database file too large (${(
            importSize /
            1024 /
            1024
          ).toFixed(2)}MB). Maximum allowed: ${MAX_DB_SIZE / 1024 / 1024}MB`,
        };
      }

      // Validate database file structure
      sendProgress("validating", 15, "Validating database structure...");
      logger.info("Validating database structure...");
      try {
        const testDb = new Database(importPath, { readonly: true });

        // Check if it's a valid SQLite database
        const tables = testDb
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all();

        if (tables.length === 0) {
          testDb.close();
          return {
            success: false,
            message: "Invalid database file: No tables found",
          };
        }

        // Validate aurswift schema - check for required tables
        const tableNames = tables.map((t: any) => t.name);
        // Core business tables required for a valid aurswift database
        const requiredTables = [
          "users",
          "businesses",
          "products",
          "categories",
          "transactions",
          "sessions",
        ];

        // License tables are NOT required in imported databases
        // They will be created by migrations and re-activation will restore license
        // This allows importing older backups that pre-date the license system

        const missingTables = requiredTables.filter(
          (table) => !tableNames.includes(table),
        );

        if (missingTables.length > 0) {
          testDb.close();
          logger.warn(
            `Database missing required tables: ${missingTables.join(", ")}`,
          );
          return {
            success: false,
            message: `Invalid aurswift database: Missing required tables (${missingTables.join(
              ", ",
            )}). This may not be an aurswift database or it may be corrupted.`,
          };
        }

        // Check if users table has any data
        try {
          const userCount = testDb
            .prepare("SELECT COUNT(*) as count FROM users")
            .get() as { count: number };
          logger.info(`Database has ${userCount.count} users`);

          if (userCount.count === 0) {
            testDb.close();
            sendProgress("error", 0, "Cannot import empty database");
            return {
              success: false,
              message:
                "Cannot import an empty database (no users found). An AuraSwift database must contain at least one user account to be imported. If you want to start fresh, use the 'Empty Database' feature instead which will reset your current database while preserving the default admin account.",
            };
          }
        } catch (userCheckError) {
          testDb.close();
          sendProgress("error", 0, "Database validation failed");
          logger.error("Failed to check users table:", userCheckError);
          return {
            success: false,
            message:
              "Database users table appears to be corrupted or incompatible.",
          };
        }

        testDb.close();

        logger.info(
          `Database validation passed. Found ${tables.length} tables with ${requiredTables.length} required tables present.`,
        );
      } catch (validationError) {
        logger.error("Database validation failed:", validationError);
        return {
          success: false,
          message: `Invalid database file: ${
            validationError instanceof Error
              ? validationError.message
              : "Unknown error"
          }`,
        };
      }

      // Get current database info (before closing)
      const db = await getDatabase();
      const info = db.getDatabaseInfo();

      // Create backup of current database before importing
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .split("T")[0];
      const timeStr = new Date()
        .toTimeString()
        .split(" ")[0]
        .replace(/:/g, "-");
      const backupPath = info.path.replace(
        ".db",
        `-backup-before-import-${timestamp}-${timeStr}.db`,
      );

      // Backup current database
      let backupCreated = false;
      let licenseBackup: LicenseBackupData | null = null;

      if (info.exists) {
        sendProgress(
          "backing-up",
          35,
          "Creating backup of current database...",
        );
        try {
          await fs.copyFile(info.path, backupPath);
          logger.info(`Current database backed up to: ${backupPath}`);
          backupCreated = true;

          // Cleanup old import operation backups (keep last 3)
          try {
            cleanupAllBackups(
              info.path,
              { importOperation: 3 },
              !isDevelopmentMode(),
            );
          } catch (cleanupError) {
            logger.warn(
              "Failed to cleanup old import operation backups:",
              cleanupError,
            );
          }

          // 🔐 CRITICAL: Extract license data BEFORE replacing database
          // This ensures license persists across database imports
          sendProgress("backing-up", 45, "Extracting license data...");
          logger.info("Extracting license data from current database...");
          licenseBackup = extractLicenseData(info.path);
          if (licenseBackup?.licenseActivation) {
            logger.info(
              "✅ License data extracted - will be restored after import",
            );
          } else {
            logger.info("No active license found in current database");
          }
          if (licenseBackup?.receiptEmailSettings?.length) {
            logger.info(
              "✅ Receipt email settings extracted - will be restored after import",
            );
          }
        } catch (backupError) {
          logger.error("Failed to create backup:", backupError);
          return {
            success: false,
            message: `Failed to create backup: ${
              backupError instanceof Error
                ? backupError.message
                : "Unknown error"
            }`,
          };
        }
      }

      // Close current database connection
      sendProgress("copying", 55, "Closing current database connection...");
      closeDatabase();
      logger.info("Database connection closed");

      // Wait for database to fully close - retry mechanism instead of fixed delay
      let retries = 10;
      while (retries > 0) {
        try {
          // Try to get exclusive access
          const testDb = new Database(info.path, { readonly: false });
          testDb.close();
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            // Restore backup if we have one
            if (backupCreated) {
              try {
                await fs.copyFile(backupPath, info.path);
                logger.info("Restored backup after failed import");
              } catch (restoreError) {
                logger.error("Failed to restore backup:", restoreError);
              }
            }
            return {
              success: false,
              message:
                "Failed to close database connection. Please close the app and try again.",
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // Copy imported file to database location
      sendProgress("copying", 65, "Copying database file...");
      try {
        await fs.copyFile(importPath, info.path);
        logger.info(`Database imported from: ${importPath}`);
      } catch (copyError) {
        // Restore backup on failure
        if (backupCreated) {
          try {
            await fs.copyFile(backupPath, info.path);
            logger.info("Restored backup after failed copy");
          } catch (restoreError) {
            logger.error("Failed to restore backup:", restoreError);
          }
        }
        throw copyError;
      }

      // Get stats of imported database
      const newStats = await fs.stat(info.path);

      // Verify the imported database can be opened and is valid
      // This ensures the file is not corrupted and will work when the window reloads
      sendProgress("reinitializing", 75, "Verifying imported database...");
      logger.info("Verifying imported database can be opened...");
      try {
        const testDb = new Database(info.path, { readonly: true });

        // Quick validation: check if we can query users table
        const userCount = testDb
          .prepare("SELECT COUNT(*) as count FROM users")
          .get() as { count: number };
        testDb.close();

        logger.info(
          `✅ Imported database verified: ${userCount.count} users found`,
        );

        if (userCount.count === 0) {
          throw new Error("Imported database has no users");
        }
      } catch (verifyError) {
        logger.error("❌ Imported database verification failed:", verifyError);

        // Restore backup
        if (backupCreated) {
          try {
            await fs.copyFile(backupPath, info.path);
            logger.info("Restored backup after verification failure");
          } catch (restoreError) {
            logger.error("Failed to restore backup:", restoreError);
          }
        }

        return {
          success: false,
          message: `Imported database verification failed: ${
            verifyError instanceof Error ? verifyError.message : "Unknown error"
          }. Your original database has been restored.`,
        };
      }

      logger.info(
        "Database file imported and verified successfully. Reinitializing connection...",
      );

      // CRITICAL: Reinitialize the database immediately so it's ready for API calls
      // The renderer will make auth/settings calls before the reload happens
      // We need a fresh connection to the new database file RIGHT NOW
      sendProgress(
        "reinitializing",
        85,
        "Reinitializing database connection...",
      );
      try {
        await getDatabase();
        logger.info(
          "✅ Database reinitialized successfully with imported file",
        );

        // 🔐 CRITICAL: Restore license data AFTER database is reinitialized
        // This ensures user doesn't need to re-enter license key after import
        if (licenseBackup?.licenseActivation) {
          sendProgress("restoring-license", 92, "Restoring license data...");
          logger.info("Restoring license data to imported database...");
          const restored = restoreLicenseData(info.path, licenseBackup);
          if (restored) {
            logger.info("✅ License data restored successfully");
          } else {
            logger.warn(
              "⚠️ License restoration failed - user may need to re-activate",
            );
          }
        } else if (licenseBackup?.receiptEmailSettings?.length) {
          // Even if there is no license, we may still want to restore receipt email settings.
          logger.info(
            "Restoring receipt email settings to imported database...",
          );
          const restored = restoreLicenseData(info.path, licenseBackup);
          if (restored) {
            logger.info("✅ Receipt email settings restored successfully");
          } else {
            logger.warn("⚠️ Receipt email settings restoration failed");
          }
        }
      } catch (reinitError) {
        logger.error(
          "❌ Failed to reinitialize database after import:",
          reinitError,
        );

        // Restore backup on failure
        if (backupCreated) {
          try {
            await fs.copyFile(backupPath, info.path);
            logger.info("Restored backup after failed reinitialization");
            // Try to reinitialize with the backup
            await getDatabase();
          } catch (restoreError) {
            logger.error(
              "Failed to restore and reinitialize backup:",
              restoreError,
            );
          }
        }

        return {
          success: false,
          message: `Database imported but failed to initialize: ${
            reinitError instanceof Error ? reinitError.message : "Unknown error"
          }. Your original database has been restored.`,
        };
      }

      // Send complete progress and ready signal
      sendProgress("complete", 100, "Database import complete!");

      // Notify renderer that database is fully ready for reload
      event.sender.send("database:import:ready");

      // Return success (window will reload from renderer side to refresh UI)
      return {
        success: true,
        data: {
          importedFrom: importPath,
          importSize,
          backupPath: info.exists ? backupPath : undefined,
          newSize: newStats.size,
          licensePreserved: !!licenseBackup?.licenseActivation,
        },
        message: licenseBackup?.licenseActivation
          ? "Database imported successfully. Your license has been preserved."
          : "Database imported successfully",
      };
    } catch (error) {
      logger.error("Database import error:", error);

      // Try to reinitialize database if import failed
      try {
        await getDatabase();
      } catch (reinitError) {
        logger.error(
          "Failed to reinitialize database after error:",
          reinitError,
        );
      }

      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to import database",
      };
    }
  });

  // App Version IPC Handler - Get application version
  ipcMain.handle("app:getVersion", async () => {
    try {
      return { success: true, version: electronApp.getVersion() };
    } catch (error) {
      logger.error("Error getting app version:", error);
      return {
        success: false,
        version: "unknown",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Manual Backup Cleanup IPC Handler - Clean up old backup files
  ipcMain.handle(
    "database:cleanup-backups",
    async (
      event,
      options?: {
        customPolicy?: Record<string, number>;
        dryRun?: boolean;
      },
    ) => {
      try {
        const db = await getDatabase();
        const info = db.getDatabaseInfo();
        const isProduction = !isDevelopmentMode();

        logger.info("🧹 Manual backup cleanup requested");

        if (options?.dryRun) {
          logger.info("   Running in dry-run mode (no files will be deleted)");
        }

        // If dry run, just get storage info
        if (options?.dryRun) {
          const storageInfo = getBackupStorageInfo(info.path, 500);

          return {
            success: true,
            dryRun: true,
            storageInfo: {
              totalSize: storageInfo.totalBackupSize,
              totalCount: storageInfo.totalBackupCount,
              backupsByType: Object.fromEntries(storageInfo.backupsByType),
              warnings: storageInfo.warnings,
              exceedsThreshold: storageInfo.exceedsThreshold,
            },
            message: "Dry run completed - no files deleted",
          };
        }

        // Run actual cleanup
        const summary = cleanupAllBackups(
          info.path,
          options?.customPolicy,
          isProduction,
        );

        return {
          success: true,
          dryRun: false,
          summary: {
            totalFilesFound: summary.totalFilesFound,
            totalFilesDeleted: summary.totalFilesDeleted,
            totalBytesFreed: summary.totalBytesFreed,
            byType: summary.backupTypes.map((t) => ({
              type: t.type,
              filesFound: t.filesFound,
              filesDeleted: t.filesDeleted,
              bytesFreed: t.bytesFreed,
            })),
            errors: summary.errors,
            warnings: summary.warnings,
          },
          message: `Cleanup completed: Deleted ${summary.totalFilesDeleted} files, freed ${(summary.totalBytesFreed / (1024 * 1024)).toFixed(2)} MB`,
        };
      } catch (error) {
        logger.error("Backup cleanup error:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to cleanup backups",
        };
      }
    },
  );

  // Get Backup Storage Info IPC Handler - Get information about backup storage
  ipcMain.handle("database:backup-storage-info", async () => {
    try {
      const db = await getDatabase();
      const info = db.getDatabaseInfo();

      const storageInfo = getBackupStorageInfo(info.path, 500);

      return {
        success: true,
        data: {
          totalSize: storageInfo.totalBackupSize,
          totalSizeMB: (storageInfo.totalBackupSize / (1024 * 1024)).toFixed(2),
          totalCount: storageInfo.totalBackupCount,
          backupsByType: Object.fromEntries(storageInfo.backupsByType),
          warnings: storageInfo.warnings,
          exceedsThreshold: storageInfo.exceedsThreshold,
          thresholdMB: 500,
        },
      };
    } catch (error) {
      logger.error("Error getting backup storage info:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to get backup storage info",
      };
    }
  });

  // App Restart IPC Handler - Restart the application
  ipcMain.handle("app:restart", async () => {
    try {
      logger.info("Restarting application...");

      // Close database connection before restart
      closeDatabase();

      // Small delay to ensure cleanup completes
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Relaunch and exit
      electronApp.relaunch();
      electronApp.exit(0);

      return { success: true };
    } catch (error) {
      logger.error("App restart error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to restart app",
      };
    }
  });

  // App Quit IPC Handler - Close the application
  ipcMain.handle("app:quit", async () => {
    try {
      logger.info("Quitting application...");

      // Close database connection before quit
      closeDatabase();

      // Quit the application
      electronApp.quit();

      return { success: true };
    } catch (error) {
      logger.error("App quit error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to quit app",
      };
    }
  });
}
