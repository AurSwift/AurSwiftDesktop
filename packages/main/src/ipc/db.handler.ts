// Cash Drawer IPC Handlers
import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("dbHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

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
      const { dialog, BrowserWindow } = await import("electron");
      const fs = await import("fs/promises");
      const path = await import("path");

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

      // Create automatic backup before emptying
      const fs = await import("fs/promises");
      const path = await import("path");

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
        `-backup-before-empty-${timestamp}-${timeStr}.db`
      );

      // Create backup
      await fs.copyFile(info.path, backupPath);
      logger.info(`Backup created before emptying: ${backupPath}`);

      // Get backup file stats
      const backupStats = await fs.stat(backupPath);
      const backupSize = backupStats.size;

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
      } catch (seedError) {
        logger.error(
          "⚠️  Failed to reseed database after emptying:",
          seedError
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
    try {
      const { dialog, app: electronApp } = await import("electron");
      const fs = await import("fs/promises");
      const path = await import("path");
      const Database = (await import("better-sqlite3")).default;

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

      // Verify the file exists and is readable
      try {
        await fs.access(importPath);
      } catch (error) {
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
        const requiredTables = [
          "users",
          "businesses",
          "products",
          "categories",
          "transactions",
          "sessions",
        ];

        const missingTables = requiredTables.filter(
          (table) => !tableNames.includes(table)
        );

        if (missingTables.length > 0) {
          testDb.close();
          logger.warn(
            `Database missing required tables: ${missingTables.join(", ")}`
          );
          return {
            success: false,
            message: `Invalid aurswift database: Missing required tables (${missingTables.join(
              ", "
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
            return {
              success: false,
              message:
                "Database has no users. Cannot import an empty database. Please use the 'Empty Database' feature instead, or ensure the database you're importing has at least one user.",
            };
          }
        } catch (userCheckError) {
          testDb.close();
          logger.error("Failed to check users table:", userCheckError);
          return {
            success: false,
            message:
              "Database users table appears to be corrupted or incompatible.",
          };
        }

        testDb.close();

        logger.info(
          `Database validation passed. Found ${tables.length} tables with ${requiredTables.length} required tables present.`
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
        `-backup-before-import-${timestamp}-${timeStr}.db`
      );

      // Backup current database
      let backupCreated = false;
      if (info.exists) {
        try {
          await fs.copyFile(info.path, backupPath);
          logger.info(`Current database backed up to: ${backupPath}`);
          backupCreated = true;
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
      const { closeDatabase } = await import("../database/index.js");
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
      logger.info("Verifying imported database can be opened...");
      try {
        const testDb = new Database(info.path, { readonly: true });

        // Quick validation: check if we can query users table
        const userCount = testDb
          .prepare("SELECT COUNT(*) as count FROM users")
          .get() as { count: number };
        testDb.close();

        logger.info(
          `✅ Imported database verified: ${userCount.count} users found`
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
        "Database file imported and verified successfully. Reinitializing connection..."
      );

      // CRITICAL: Reinitialize the database immediately so it's ready for API calls
      // The renderer will make auth/settings calls before the reload happens
      // We need a fresh connection to the new database file RIGHT NOW
      try {
        const { getDatabase: reinitDatabase } = await import(
          "../database/index.js"
        );
        await reinitDatabase();
        logger.info(
          "✅ Database reinitialized successfully with imported file"
        );
      } catch (reinitError) {
        logger.error(
          "❌ Failed to reinitialize database after import:",
          reinitError
        );

        // Restore backup on failure
        if (backupCreated) {
          try {
            await fs.copyFile(backupPath, info.path);
            logger.info("Restored backup after failed reinitialization");
            // Try to reinitialize with the backup
            const { getDatabase: reinitBackup } = await import(
              "../database/index.js"
            );
            await reinitBackup();
          } catch (restoreError) {
            logger.error(
              "Failed to restore and reinitialize backup:",
              restoreError
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

      // Return success (window will reload from renderer side to refresh UI)
      return {
        success: true,
        data: {
          importedFrom: importPath,
          importSize,
          backupPath: info.exists ? backupPath : undefined,
          newSize: newStats.size,
        },
        message: "Database imported successfully",
      };
    } catch (error) {
      logger.error("Database import error:", error);

      // Try to reinitialize database if import failed
      try {
        const { getDatabase: getNewDatabase } = await import(
          "../database/index.js"
        );
        await getNewDatabase();
      } catch (reinitError) {
        logger.error(
          "Failed to reinitialize database after error:",
          reinitError
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
      const { app: electronApp } = await import("electron");
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

  // App Restart IPC Handler - Restart the application
  ipcMain.handle("app:restart", async () => {
    try {
      const { app: electronApp } = await import("electron");

      logger.info("Restarting application...");

      // Close database connection before restart
      const { closeDatabase } = await import("../database/index.js");
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
      const { app: electronApp } = await import("electron");

      logger.info("Quitting application...");

      // Close database connection before quit
      const { closeDatabase } = await import("../database/index.js");
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
