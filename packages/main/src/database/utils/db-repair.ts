/**
 * Database Repair Utilities
 *
 * Layer 3: Database Repair & Recovery
 * Attempts to repair corrupted or damaged databases.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { copyFileSync } from "fs";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("db-repair");

export interface RepairResult {
  success: boolean;
  repaired: boolean;
  reason?: string;
  backupCreated?: string;
}

/**
 * Attempt to repair database using various techniques
 *
 * Repair strategies (in order of aggressiveness):
 * 1. WAL checkpoint (consolidate WAL files)
 * 2. VACUUM (rebuild database)
 * 3. REINDEX (rebuild indexes)
 *
 * @param db - Open database connection
 * @param dbPath - Path to database file
 * @returns Repair result
 */
export async function repairDatabase(
  db: Database.Database,
  dbPath: string
): Promise<RepairResult> {
  let backupPath: string | undefined;

  try {
    // Always create backup before repair attempts
    const dbDir = path.dirname(dbPath);
    const backupDir = path.join(dbDir, "backups");
    // Generate clean timestamp: YYYYMMDD-HHMMSS format
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

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    backupPath = path.join(backupDir, `aurswift-repair-backup-${timestamp}.db`);

    // Checkpoint WAL to ensure all data is in main file before backup
    try {
      db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run();
    } catch (error) {
      logger.warn("WAL checkpoint before backup failed:", error);
    }

    // Create backup
    copyFileSync(dbPath, backupPath);

    // Verify backup was created
    if (!fs.existsSync(backupPath)) {
      return {
        success: false,
        repaired: false,
        reason: "Failed to create backup before repair",
      };
    }

    logger.info(`📦 Backup created before repair: ${backupPath}`);

    // Strategy 1: WAL Checkpoint (non-destructive)
    try {
      logger.info("🔧 Attempting WAL checkpoint...");
      db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run();
      logger.info("✅ WAL checkpoint completed");
    } catch (error) {
      logger.warn("⚠️  WAL checkpoint failed:", error);
    }

    // Strategy 2: Integrity check
    try {
      logger.info("🔍 Running integrity check...");
      const integrityCheck = db.prepare("PRAGMA integrity_check").get() as {
        integrity_check: string;
      };

      if (integrityCheck.integrity_check !== "ok") {
        logger.warn(
          `⚠️  Integrity check found issues: ${integrityCheck.integrity_check}`
        );
      } else {
        logger.info("✅ Integrity check passed");
        return {
          success: true,
          repaired: true,
          backupCreated: backupPath,
        };
      }
    } catch (error) {
      logger.warn("⚠️  Integrity check failed:", error);
    }

    // Strategy 3: REINDEX (rebuild all indexes)
    try {
      logger.info("🔧 Rebuilding indexes...");
      db.exec("REINDEX");
      logger.info("✅ Indexes rebuilt");
    } catch (error) {
      logger.warn("⚠️  REINDEX failed:", error);
      // Continue to next strategy
    }

    // Strategy 4: VACUUM (rebuild entire database)
    // WARNING: This can take a long time for large databases
    try {
      logger.info("🔧 Running VACUUM (this may take a while)...");
      db.exec("VACUUM");
      logger.info("✅ VACUUM completed");
    } catch (error) {
      logger.warn("⚠️  VACUUM failed:", error);
      // This is non-fatal - database might still be usable
    }

    // Final integrity check
    try {
      const finalCheck = db.prepare("PRAGMA integrity_check").get() as {
        integrity_check: string;
      };

      if (finalCheck.integrity_check === "ok") {
        return {
          success: true,
          repaired: true,
          backupCreated: backupPath,
        };
      } else {
        return {
          success: false,
          repaired: false,
          reason: `Database still has integrity issues after repair: ${finalCheck.integrity_check}`,
          backupCreated: backupPath,
        };
      }
    } catch (error) {
      return {
        success: false,
        repaired: false,
        reason: `Error during final integrity check: ${
          error instanceof Error ? error.message : String(error)
        }`,
        backupCreated: backupPath,
      };
    }
  } catch (error) {
    return {
      success: false,
      repaired: false,
      reason: `Repair failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      backupCreated: backupPath,
    };
  }
}

/**
 * Attempt quick repair (non-destructive operations only)
 *
 * @param db - Open database connection
 * @returns True if quick repair succeeded
 */
export function quickRepair(db: Database.Database): boolean {
  try {
    // WAL checkpoint only
    db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run();

    // Quick integrity check
    const check = db.prepare("PRAGMA quick_check").get() as {
      quick_check: string;
    };

    return check.quick_check === "ok";
  } catch (error) {
    logger.error("Quick repair failed:", error);
    return false;
  }
}

/**
 * Create a fresh database with current schema
 * Backs up old database first
 *
 * @param oldDbPath - Path to old database
 * @param migrationsFolder - Path to migrations folder
 * @returns Path to new database file
 */
export async function createFreshDatabase(
  oldDbPath: string,
  migrationsFolder: string
): Promise<string> {
  // Backup old database
  const dbDir = path.dirname(oldDbPath);
  const backupDir = path.join(dbDir, "backups");
  // Generate clean timestamp: YYYYMMDD-HHMMSS format
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

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(
    backupDir,
    `aurswift-fresh-start-backup-${timestamp}.db`
  );

  if (fs.existsSync(oldDbPath)) {
    copyFileSync(oldDbPath, backupPath);
    logger.info(`📦 Old database backed up to: ${backupPath}`);
  }

  // Rename old database (add .old extension)
  const oldBackupPath = `${oldDbPath}.old.${timestamp}`;
  if (fs.existsSync(oldDbPath)) {
    fs.renameSync(oldDbPath, oldBackupPath);
    logger.info(`📦 Old database renamed to: ${oldBackupPath}`);
  }

  // New database will be created by DBManager on next initialization
  return oldDbPath; // Return same path - new file will be created here
}
