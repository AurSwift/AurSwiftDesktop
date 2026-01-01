/**
 * Log Path Migration Utility
 *
 * Handles migration of log files from old incorrect paths (Roaming/APPDATA) to new correct paths (Local/LOCALAPPDATA).
 * Specifically handles the case where old versions stored logs in Roaming profile:
 * - Old (suboptimal): %USERPROFILE%\AppData\Roaming\aurswift\logs\
 * - New (correct): %USERPROFILE%\AppData\Local\aurswift\logs\
 *
 * This migration is important because:
 * - Logs are machine-specific and don't need to sync across machines
 * - Logs can grow large and shouldn't be in Roaming profile
 * - Reduces network overhead in domain environments
 */

import path from "path";
import fs from "fs";
import { app } from "electron";

// Lazy-load logger to avoid circular dependency issues during migration
// The logger will be initialized after the migration check, so it's safe
let loggerInstance: ReturnType<typeof import("./logger.js").getLogger> | null =
  null;

async function getLoggerInstance() {
  if (!loggerInstance) {
    // Use dynamic import to avoid circular dependency
    // This ensures logger is only loaded when needed, after migration check
    const loggerModule = await import("./logger.js");
    loggerInstance = loggerModule.getLogger("log-path-migration");
  }
  return loggerInstance;
}

export interface LogMigrationResult {
  migrated: boolean;
  oldPath?: string;
  newPath?: string;
  filesMoved?: number;
  reason?: string;
}

/**
 * Get the old log path (Roaming/APPDATA)
 * This is where logs were stored in older versions
 *
 * @returns Old log path, or null if not applicable
 */
export function getOldLogPath(): string | null {
  // Only check in production mode (development uses different path)
  if (app.isPackaged) {
    const userDataPath = app.getPath("userData");
    const oldLogPath = path.join(userDataPath, "logs");

    // Only return if it exists and has files
    if (fs.existsSync(oldLogPath)) {
      try {
        const files = fs.readdirSync(oldLogPath);
        if (files.length > 0) {
          return oldLogPath;
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return null;
}

/**
 * Get the correct log path (Local/LOCALAPPDATA)
 *
 * @returns Correct log path
 */
export function getCorrectLogPath(): string {
  // On Windows, ensure logs go to LOCALAPPDATA instead of Roaming
  if (process.platform === "win32") {
    const logsPath = app.getPath("logs");
    const appDataPath = app.getPath("appData"); // This is APPDATA (Roaming)
    const localAppDataPath = app.getPath("appData").replace("Roaming", "Local");

    // If logs path is in Roaming, redirect to Local
    if (logsPath.includes("Roaming")) {
      const appName = app.getName();
      return path.join(localAppDataPath, appName, "logs");
    }

    // Otherwise, use the default logs path (should be in Local already)
    return logsPath;
  }

  // For macOS and Linux, use Electron's default logs path
  return app.getPath("logs");
}

/**
 * Check if logs exist at old incorrect path
 *
 * @returns True if old logs exist, false otherwise
 */
export function hasOldLogPath(): boolean {
  const oldPath = getOldLogPath();
  return oldPath !== null && fs.existsSync(oldPath);
}

/**
 * Migrate logs from old path (Roaming) to new path (Local)
 *
 * This function:
 * 1. Checks if old logs exist
 * 2. Creates new log directory if needed
 * 3. Moves log files from old location to new location
 * 4. Optionally removes old log directory (after confirmation)
 *
 * @param removeOld - Whether to remove old logs after migration (default: false)
 * @returns Migration result
 */
export async function migrateLogsFromOldPath(
  removeOld: boolean = false
): Promise<LogMigrationResult> {
  const oldPath = getOldLogPath();
  const newPath = getCorrectLogPath();

  if (!oldPath) {
    return {
      migrated: false,
      reason: "No old log path found or no log files to migrate",
    };
  }

  // Check if old logs exist
  if (!fs.existsSync(oldPath)) {
    return {
      migrated: false,
      reason: "Old log directory not found",
    };
  }

  try {
    // Get list of log files in old location
    const logFiles = fs.readdirSync(oldPath).filter((file) => {
      // Only move log files (not other files that might be there)
      return file.endsWith(".log") || file.endsWith(".log.json");
    });

    if (logFiles.length === 0) {
      return {
        migrated: false,
        oldPath,
        newPath,
        reason: "No log files found in old location",
      };
    }

    // Create new log directory if it doesn't exist
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
      (await getLoggerInstance()).info(
        `📁 Created new log directory: ${newPath}`
      );
    }

    let filesMoved = 0;
    const errors: string[] = [];

    // Move each log file
    for (const file of logFiles) {
      const oldFilePath = path.join(oldPath, file);
      const newFilePath = path.join(newPath, file);

      try {
        // Check if file already exists in new location
        if (fs.existsSync(newFilePath)) {
          // Compare file sizes - if old is larger, it might have more data
          const oldStats = fs.statSync(oldFilePath);
          const newStats = fs.statSync(newFilePath);

          if (oldStats.size > newStats.size) {
            // Old file is larger - backup new file and move old one
            const backupPath = `${newFilePath}.backup-${Date.now()}`;
            fs.renameSync(newFilePath, backupPath);
            (await getLoggerInstance()).info(
              `📦 Backed up existing log file: ${backupPath}`
            );
            fs.copyFileSync(oldFilePath, newFilePath);
            filesMoved++;
          } else {
            // New file is same size or larger - skip this file
            (await getLoggerInstance()).debug(
              `⏭️  Skipping ${file} - newer version already exists`
            );
          }
        } else {
          // File doesn't exist in new location - move it
          fs.copyFileSync(oldFilePath, newFilePath);
          filesMoved++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push(`Failed to move ${file}: ${errorMessage}`);
        (await getLoggerInstance()).warn(
          `⚠️  Failed to move log file ${file}: ${errorMessage}`
        );
      }
    }

    if (filesMoved === 0 && errors.length > 0) {
      return {
        migrated: false,
        oldPath,
        newPath,
        reason: `Migration failed: ${errors.join("; ")}`,
      };
    }

    // Migration successful - optionally remove old logs
    if (removeOld && filesMoved > 0) {
      try {
        // Remove moved log files
        for (const file of logFiles) {
          const oldFilePath = path.join(oldPath, file);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }

        // Try to remove old log directory if empty
        try {
          const remainingFiles = fs.readdirSync(oldPath);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(oldPath);
            (await getLoggerInstance()).info(
              `🗑️  Removed empty old log directory: ${oldPath}`
            );
          }
        } catch {
          // Ignore directory removal errors (might not be empty)
        }
      } catch (error) {
        (await getLoggerInstance()).warn(
          `⚠️  Failed to remove old logs: ${error}`
        );
        // Don't fail migration if cleanup fails
      }
    }

    return {
      migrated: true,
      oldPath,
      newPath,
      filesMoved,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      migrated: false,
      oldPath,
      newPath,
      reason: `Migration failed: ${errorMessage}`,
    };
  }
}

/**
 * Check if log migration is needed (old path exists with files, new path doesn't have them)
 *
 * @returns True if migration should be performed
 */
export function shouldMigrateLogPath(): boolean {
  const oldPath = getOldLogPath();
  const newPath = getCorrectLogPath();

  // No old path exists - no migration needed
  if (!oldPath || !fs.existsSync(oldPath)) {
    return false;
  }

  // Old path exists - check if it has log files
  try {
    // Filter for both .log and .log.json files (consistent with migration function)
    const logFiles = fs
      .readdirSync(oldPath)
      .filter((file) => file.endsWith(".log") || file.endsWith(".log.json"));
    if (logFiles.length === 0) {
      return false;
    }

    // Check if new path exists and has the same files
    if (fs.existsSync(newPath)) {
      try {
        // Filter for both .log and .log.json files (consistent with migration function)
        const newLogFiles = fs
          .readdirSync(newPath)
          .filter(
            (file) => file.endsWith(".log") || file.endsWith(".log.json")
          );
        // If new path has all the files, no migration needed
        if (newLogFiles.length >= logFiles.length) {
          return false;
        }
      } catch {
        // If we can't read new path, assume migration is needed
        return true;
      }
    }

    // Old path has files and new path doesn't or has fewer - migration needed
    return true;
  } catch {
    // If we can't read old path, assume no migration needed
    return false;
  }
}
