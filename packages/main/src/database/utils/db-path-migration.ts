/**
 * Database Path Migration Utility
 *
 * Handles migration of databases from old incorrect paths to new correct paths.
 * Specifically handles the case where old versions created double-nested paths:
 * - Old (wrong): C:\Users\<username>\AppData\Roaming\aurswift\aurswift\pos_system.db
 * - New (correct): C:\Users\<username>\AppData\Roaming\aurswift\pos_system.db
 */

import path from "path";
import fs from "fs";
import { app } from "electron";
import { validateDatabaseFile } from "./db-validator.js";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("db-path-migration");

export interface PathMigrationResult {
  migrated: boolean;
  oldPath?: string;
  newPath?: string;
  backupPath?: string;
  reason?: string;
}

/**
 * Get the old incorrect database path (double-nested)
 * This is where databases were stored in older versions
 *
 * @returns Old incorrect path, or null if not applicable
 */
export function getOldDatabasePath(): string | null {
  // Only check in production mode (development uses different path)
  if (app.isPackaged) {
    const userDataPath = app.getPath("userData");
    // Old path had double nesting: userData/aurswift/pos_system.db
    // But userData already includes aurswift, so we check for aurswift/aurswift
    const oldPath = path.join(userDataPath, "aurswift", "pos_system.db");

    // Only return if it exists
    if (fs.existsSync(oldPath)) {
      return oldPath;
    }
  }

  return null;
}

/**
 * Get the correct database path (single-nested)
 *
 * @returns Correct database path
 */
export function getCorrectDatabasePath(): string {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "pos_system.db");
}

/**
 * Check if database exists at old incorrect path
 *
 * @returns True if old database exists, false otherwise
 */
export function hasOldDatabasePath(): boolean {
  const oldPath = getOldDatabasePath();
  return oldPath !== null && fs.existsSync(oldPath);
}

/**
 * Migrate database from old path to new path
 *
 * This function:
 * 1. Validates old database exists and is valid
 * 2. Creates backup of old database
 * 3. Copies database to new location
 * 4. Validates new database is valid
 * 5. Optionally removes old database (after confirmation)
 *
 * @param removeOld - Whether to remove old database after migration (default: false)
 * @returns Migration result
 */
export function migrateDatabaseFromOldPath(
  removeOld: boolean = false
): PathMigrationResult {
  const oldPath = getOldDatabasePath();
  const newPath = getCorrectDatabasePath();

  if (!oldPath) {
    return {
      migrated: false,
      reason: "No old database path found",
    };
  }

  // Check if old database exists
  if (!fs.existsSync(oldPath)) {
    return {
      migrated: false,
      reason: "Old database file not found",
    };
  }

  // Validate old database file
  const validation = validateDatabaseFile(oldPath);
  if (!validation.valid) {
    return {
      migrated: false,
      oldPath,
      reason: `Old database is invalid: ${validation.reason}`,
    };
  }

  try {
    // Create backup of old database before migration
    const backupDir = path.join(path.dirname(oldPath), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(
      backupDir,
      `aurswift-path-migration-backup-${timestamp}.db`
    );

    // Copy old database to backup location
    fs.copyFileSync(oldPath, backupPath);

    // Create new directory if it doesn't exist
    const newDir = path.dirname(newPath);
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }

    // Check if new database already exists
    if (fs.existsSync(newPath)) {
      // Validate existing new database
      const newValidation = validateDatabaseFile(newPath);
      if (
        newValidation.valid &&
        newValidation.fileSize &&
        newValidation.fileSize > 0
      ) {
        // New database exists and is valid - don't overwrite
        return {
          migrated: false,
          oldPath,
          newPath,
          backupPath,
          reason:
            "New database already exists and is valid. Old database preserved at backup location.",
        };
      } else {
        // New database exists but is invalid - backup it first
        const newBackupPath = `${newPath}.invalid.${timestamp}.db`;
        fs.renameSync(newPath, newBackupPath);
        logger.info(`📦 Backed up invalid new database to: ${newBackupPath}`);
      }
    }

    // Copy old database to new location
    fs.copyFileSync(oldPath, newPath);

    // Validate new database
    const newValidation = validateDatabaseFile(newPath);
    if (!newValidation.valid) {
      // Migration failed - new database is invalid
      // Remove new database if we created it
      if (fs.existsSync(newPath)) {
        try {
          fs.unlinkSync(newPath);
        } catch {
          // Ignore deletion errors
        }
      }

      return {
        migrated: false,
        oldPath,
        newPath,
        backupPath,
        reason: `Migration failed: New database is invalid: ${newValidation.reason}`,
      };
    }

    // Migration successful - optionally remove old database
    if (removeOld) {
      try {
        // Also remove old directory if it's now empty
        const oldDir = path.dirname(oldPath);
        fs.unlinkSync(oldPath);

        // Try to remove old directory if empty
        try {
          const files = fs.readdirSync(oldDir);
          if (files.length === 0 || files.every((f) => f === "backups")) {
            // Only backups left or empty - can remove aurswift subdirectory
            if (files.length === 0) {
              fs.rmdirSync(oldDir);
            }
          }
        } catch {
          // Ignore directory removal errors (might not be empty)
        }
      } catch (error) {
        logger.warn(`⚠️  Failed to remove old database: ${error}`);
        // Don't fail migration if cleanup fails
      }
    }

    return {
      migrated: true,
      oldPath,
      newPath,
      backupPath,
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
 * Check if migration is needed (old path exists, new path doesn't or is invalid)
 *
 * @returns True if migration should be performed
 */
export function shouldMigrateDatabasePath(): boolean {
  const oldPath = getOldDatabasePath();
  const newPath = getCorrectDatabasePath();

  // No old path exists - no migration needed
  if (!oldPath || !fs.existsSync(oldPath)) {
    return false;
  }

  // Old path exists - check if new path exists
  if (!fs.existsSync(newPath)) {
    // New path doesn't exist - migration needed
    return true;
  }

  // Both paths exist - check if new database is valid
  const newValidation = validateDatabaseFile(newPath);
  if (
    !newValidation.valid ||
    !newValidation.fileSize ||
    newValidation.fileSize === 0
  ) {
    // New database is invalid or empty - migration needed
    return true;
  }

  // Both exist and new is valid - check which is newer
  const oldStats = fs.statSync(oldPath);
  const newStats = fs.statSync(newPath);

  // If old database is significantly newer (modified within last hour),
  // it might have more recent data - suggest migration
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  if (oldStats.mtimeMs > newStats.mtimeMs && oldStats.mtimeMs > oneHourAgo) {
    return true;
  }

  return false;
}
