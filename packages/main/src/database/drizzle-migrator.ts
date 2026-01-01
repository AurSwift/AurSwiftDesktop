/**
 * Drizzle ORM Migration System
 *
 * Uses Drizzle Kit's generated SQL migrations directly
 * No need to manually copy SQL to TypeScript!
 *
 * Safety Features:
 * - Transaction wrapper for atomic migrations
 * - Automatic backups before migrations
 * - Integrity checks before/after
 * - Rollback on failure
 *
 * Migration Folder Detection:
 * - Development: Uses migrations folder relative to dist directory
 * - Production: Checks multiple locations in order:
 *   1. process.resourcesPath/migrations (electron-builder extraResources)
 *   2. __dirname/migrations (inside asar bundle)
 *   3. app.getAppPath()/node_modules/@app/main/dist/migrations
 *   4. app.getAppPath()/database/migrations (legacy)
 *
 * Expected Bundle Structure (Production):
 * - migrations/ folder should be in extraResources (electron-builder config)
 * - Or bundled in the asar archive at: node_modules/@app/main/dist/migrations/
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  existsSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { app } from "electron";
import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

import { getLogger } from "../utils/logger.js";
const logger = getLogger("drizzle-migrator");

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get migrations folder path - handles both development and production
 * In production, migrations should be bundled with the app
 */
/**
 * Get the path to the migrations folder.
 *
 * In development, migrations are in the source directory.
 * In production, checks multiple locations in order:
 * 1. process.resourcesPath/migrations (extraResources - recommended)
 * 2. __dirname/migrations (inside asar bundle)
 * 3. app.getAppPath()/node_modules/@app/main/dist/migrations
 * 4. app.getAppPath()/database/migrations (legacy)
 *
 * @returns Path to migrations folder
 * @throws Error if folder not found (in production)
 */
function getMigrationsFolder(): string {
  // In development, use source folder
  if (!app.isPackaged) {
    const devPath = join(__dirname, "migrations");
    if (!existsSync(devPath)) {
      throw new Error(
        `Development migrations folder not found: ${devPath}\n` +
          "Make sure migrations folder exists in packages/main/src/database/"
      );
    }
    return devPath;
  }

  // In production, migrations are bundled in the app
  // Try multiple locations in order of preference
  // IMPORTANT: Check extraResources FIRST (electron-builder puts them there)

  const checkedPaths: string[] = [];

  // Option 1: Check using extraResources (outside asar) - THIS IS WHERE ELECTRON-BUILDER PUTS THEM
  // This is the recommended location for electron-builder
  const resourcesPath = process.resourcesPath;
  if (resourcesPath) {
    const resourcesMigrationsPath = join(resourcesPath, "migrations");
    checkedPaths.push(
      `1. ${resourcesMigrationsPath} (extraResources - recommended)`
    );
    if (existsSync(resourcesMigrationsPath)) {
      logger.info(
        `   📁 Found migrations in extraResources: ${resourcesMigrationsPath}`
      );
      return resourcesMigrationsPath;
    }
  }

  // Option 2: Check relative to current file (inside asar: node_modules/@app/main/dist/migrations)
  const distMigrationsPath = join(__dirname, "migrations");
  checkedPaths.push(`2. ${distMigrationsPath} (inside asar)`);
  if (existsSync(distMigrationsPath)) {
    logger.info(`   📁 Found migrations in asar: ${distMigrationsPath}`);
    return distMigrationsPath;
  }

  // Option 3: Check in app path (if migrations are at app root)
  const appPath = app.getAppPath();
  const appMigrationsPath = join(
    appPath,
    "node_modules",
    "@app",
    "main",
    "dist",
    "migrations"
  );
  checkedPaths.push(`3. ${appMigrationsPath} (app path)`);
  if (existsSync(appMigrationsPath)) {
    logger.info(`   📁 Found migrations in app path: ${appMigrationsPath}`);
    return appMigrationsPath;
  }

  // Option 4: Try app path with database subfolder (legacy)
  const asarMigrationsPath = join(appPath, "database", "migrations");
  checkedPaths.push(`4. ${asarMigrationsPath} (legacy)`);
  if (existsSync(asarMigrationsPath)) {
    logger.info(
      `   📁 Found migrations in legacy location: ${asarMigrationsPath}`
    );
    return asarMigrationsPath;
  }

  // No migrations folder found - provide detailed error message
  const errorMessage =
    `Migrations folder not found in any expected location.\n\n` +
    `Checked paths (in order):\n${checkedPaths.join("\n")}\n\n` +
    `Expected Bundle Structure:\n` +
    `- Migrations should be in extraResources (recommended for electron-builder)\n` +
    `- Configure in electron-builder.mjs:\n` +
    `  extraResources: [\n` +
    `    { from: "packages/main/src/database/migrations", to: "migrations" }\n` +
    `  ]\n` +
    `- Or bundled in asar at: node_modules/@app/main/dist/migrations/\n\n` +
    `Troubleshooting:\n` +
    `- Check that migrations folder exists in source code\n` +
    `- Verify electron-builder configuration includes migrations\n` +
    `- Check that migrations are included in the build output`;

  throw new Error(errorMessage);
}

/**
 * Check database integrity before migrations
 * Enhanced with foreign key validation and quick check
 */
function checkDatabaseIntegrity(
  rawDb: Database.Database,
  isProduction: boolean = false
): boolean {
  try {
    // 1. Quick check (faster for large databases)
    if (isProduction) {
      const quickCheck = rawDb.prepare("PRAGMA quick_check").get() as {
        quick_check: string;
      };
      if (quickCheck.quick_check !== "ok") {
        logger.warn("Quick check found issues, running full check...");
        // Fall through to full integrity check
      } else {
        logger.info("Quick integrity check passed");
      }
    }

    // 2. Full integrity check
    const result = rawDb.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    };
    if (result.integrity_check !== "ok") {
      logger.error("Database integrity check failed:", result.integrity_check);
      return false;
    }
    logger.info("   ✅ Database integrity check passed");

    // 3. Foreign key check (if foreign keys are enabled)
    try {
      const fkCheck = rawDb.prepare("PRAGMA foreign_key_check").all() as Array<{
        table: string;
        rowid: number;
        parent: string;
        fkid: number;
      }>;
      if (fkCheck.length > 0) {
        logger.error(
          `   ❌ Foreign key violations found: ${fkCheck.length} violation(s)`
        );
        if (!isProduction) {
          // In development, show details
          fkCheck.slice(0, 5).forEach((violation) => {
            logger.error(
              `      - Table: ${violation.table}, Row: ${violation.rowid}, Parent: ${violation.parent}`
            );
          });
        }
        return false;
      }
      logger.info("   ✅ Foreign key check passed");
    } catch (fkError) {
      // Foreign keys might not be enabled, which is OK
      logger.info("   ℹ️  Foreign key check skipped (FKs may not be enabled)");
    }

    return true;
  } catch (error) {
    logger.error("   ❌ Integrity check error:", error);
    return false;
  }
}

/**
 * Backup retention configuration
 * Different backup types have different retention policies
 */
interface BackupRetentionConfig {
  /** Regular migration backups - created on every migration */
  migration: number;
  /** Repair backups - created before repair attempts */
  repair: number;
  /** Fresh start backups - created when starting fresh */
  freshStart: number;
  /** Path migration backups - created during path migration */
  pathMigration: number;
}

/**
 * All backup prefixes used by the system
 */
const BACKUP_PREFIXES = {
  migration: "aurswift-backup-",
  repair: "aurswift-repair-backup-",
  freshStart: "aurswift-fresh-start-backup-",
  pathMigration: "aurswift-path-migration-backup-",
} as const;

/**
 * Cleanup old backups, keeping only the most recent N backups for each type
 * This handles ALL backup types created by the system:
 * - aurswift-backup-* (migration backups)
 * - aurswift-repair-backup-* (repair backups)
 * - aurswift-fresh-start-backup-* (fresh start backups)
 * - aurswift-path-migration-backup-* (path migration backups)
 *
 * @param backupDir - Directory containing backups
 * @param maxBackups - Maximum number of migration backups to keep (default: 10)
 *                     Repair/fresh-start backups keep 3x this value
 */
function cleanupOldBackups(backupDir: string, maxBackups: number = 10): void {
  try {
    if (!existsSync(backupDir)) {
      return;
    }

    // Configure retention per backup type
    // Repair and path migration backups are more important - keep more
    const retention: BackupRetentionConfig = {
      migration: maxBackups,
      repair: Math.max(3, Math.floor(maxBackups / 2)),
      freshStart: Math.max(3, Math.floor(maxBackups / 2)),
      pathMigration: Math.max(3, Math.floor(maxBackups / 2)),
    };

    let totalFreed = 0;
    const allFiles = readdirSync(backupDir);

    // Process each backup type
    for (const [type, prefix] of Object.entries(BACKUP_PREFIXES)) {
      const typeRetention = retention[type as keyof BackupRetentionConfig];

      const backups = allFiles
        .filter((f) => f.startsWith(prefix) && f.endsWith(".db"))
        .map((f) => {
          const filePath = join(backupDir, f);
          try {
            const stats = statSync(filePath);
            return {
              name: f,
              path: filePath,
              mtime: stats.mtime,
              size: stats.size,
            };
          } catch {
            return null;
          }
        })
        .filter((f): f is NonNullable<typeof f> => f !== null)
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Newest first

      if (backups.length > typeRetention) {
        const toDelete = backups.slice(typeRetention);

        for (const backup of toDelete) {
          try {
            totalFreed += backup.size;
            unlinkSync(backup.path);
            logger.info(`   🗑️  Removed old backup: ${backup.name}`);
          } catch (error) {
            logger.warn(`   ⚠️  Failed to remove backup ${backup.name}:`, {
              error,
            });
          }
        }
      }
    }

    // Also clean up any .old files that accumulate from failed operations
    const oldFiles = allFiles.filter(
      (f) => f.includes(".old.") && f.endsWith(".db")
    );
    for (const oldFile of oldFiles) {
      try {
        const filePath = join(backupDir, oldFile);
        const stats = statSync(filePath);
        // Only remove .old files older than 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (stats.mtimeMs < sevenDaysAgo) {
          totalFreed += stats.size;
          unlinkSync(filePath);
          logger.info(`   🗑️  Removed old file: ${oldFile}`);
        }
      } catch {
        // Ignore errors for individual .old files
      }
    }

    if (totalFreed > 0) {
      const freedMB = (totalFreed / (1024 * 1024)).toFixed(2);
      logger.info(`   💾 Freed ${freedMB} MB by cleaning up old backups`);
    }
  } catch (error) {
    logger.warn(`   ⚠️  Failed to cleanup old backups`, { error });
    // Don't throw - backup cleanup failure shouldn't block migrations
  }
}

/**
 * Check if any migrations are pending
 * Reads the migrations folder and compares with __drizzle_migrations table
 *
 * @param rawDb - Raw database instance
 * @param migrationsFolder - Path to migrations folder
 * @returns Object with hasPending and count of pending migrations
 */
function checkPendingMigrations(
  rawDb: Database.Database,
  migrationsFolder: string
): { hasPending: boolean; pendingCount: number; appliedCount: number } {
  try {
    // Get list of migration files
    const migrationFiles = readdirSync(migrationsFolder)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Check if __drizzle_migrations table exists
    const tableExists = rawDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
      )
      .get();

    if (!tableExists) {
      // No migrations table = all migrations are pending
      return {
        hasPending: migrationFiles.length > 0,
        pendingCount: migrationFiles.length,
        appliedCount: 0,
      };
    }

    // Get applied migrations
    const appliedMigrations = rawDb
      .prepare("SELECT hash FROM __drizzle_migrations")
      .all() as Array<{ hash: string }>;

    const appliedCount = appliedMigrations.length;
    const pendingCount = Math.max(0, migrationFiles.length - appliedCount);

    return {
      hasPending: pendingCount > 0,
      pendingCount,
      appliedCount,
    };
  } catch (error) {
    // On error, assume migrations might be pending (safer)
    logger.warn(`   ⚠️  Could not check pending migrations, assuming pending`, {
      error,
    });
    return { hasPending: true, pendingCount: -1, appliedCount: -1 };
  }
}

/**
 * Check if backup should be skipped based on throttling rules
 *
 * Rules:
 * - In development: Skip if backup was created within last 5 minutes
 * - In production: Always create backup before migrations
 *
 * @param backupDir - Directory containing backups
 * @param isProduction - Whether app is in production mode
 * @returns Whether to skip backup creation
 */
function shouldSkipBackup(backupDir: string, isProduction: boolean): boolean {
  // Never skip in production
  if (isProduction) {
    return false;
  }

  // In development, check for recent backups
  const minIntervalMs = 5 * 60 * 1000; // 5 minutes

  try {
    if (!existsSync(backupDir)) {
      return false;
    }

    const backups = readdirSync(backupDir)
      .filter((f) => f.startsWith("aurswift-backup-") && f.endsWith(".db"))
      .map((f) => {
        try {
          return statSync(join(backupDir, f)).mtimeMs;
        } catch {
          return 0;
        }
      })
      .filter((t) => t > 0);

    if (backups.length === 0) {
      return false;
    }

    const mostRecentBackup = Math.max(...backups);
    const timeSinceLastBackup = Date.now() - mostRecentBackup;

    return timeSinceLastBackup < minIntervalMs;
  } catch {
    return false;
  }
}

/**
 * Rollback migration by restoring from backup
 * @param dbPath - Path to database file
 * @param backupPath - Path to backup file
 * @param rawDb - Raw database instance (will be closed)
 */
async function rollbackMigration(
  dbPath: string,
  backupPath: string,
  rawDb: Database.Database
): Promise<boolean> {
  try {
    logger.info("   🔄 Attempting to rollback migration...");

    // Close current database connection if it's open
    try {
      if (rawDb) {
        rawDb.close();
      }
    } catch (closeError) {
      // Database might already be closed, ignore
    }

    // Verify backup exists
    if (!existsSync(backupPath)) {
      logger.error(`   ❌ Backup file not found: ${backupPath}`);
      return false;
    }

    // Restore from backup
    copyFileSync(backupPath, dbPath);
    logger.info("   ✅ Database restored from backup");
    logger.info(`   📦 Restored from: ${backupPath}`);

    return true;
  } catch (error) {
    logger.error("   ❌ Rollback failed:", error);
    return false;
  }
}

/**
 * Run Drizzle migrations with transaction safety
 * This reads .sql files from the migrations folder and applies them atomically
 *
 * @param db - Drizzle DB instance
 * @param rawDb - Raw better-sqlite3 instance (for transaction control)
 * @param dbPath - Path to database file (for backup)
 */
export async function runDrizzleMigrations(
  db: BetterSQLite3Database<typeof schema>,
  rawDb: Database.Database,
  dbPath: string
): Promise<boolean> {
  let backupPath = "";
  const isProduction = app.isPackaged;
  const migrationsFolder = getMigrationsFolder();

  try {
    logger.info("\n🚀 Running Drizzle ORM Migrations...");
    if (isProduction) {
      logger.info("   🔒 Production mode: Enhanced safety checks enabled");
    } else {
      logger.info("   🛠️  Development mode: Relaxed migration checks");
    }
    logger.info(`   📁 Migrations folder: ${migrationsFolder}`);

    // Check if migrations folder exists (getMigrationsFolder now throws if not found)
    // But we still check here for additional diagnostics
    if (!existsSync(migrationsFolder)) {
      logger.error(`   ❌ Migrations folder not found: ${migrationsFolder}`);
      logger.error(
        "   💡 Make sure migrations are bundled with the app in production"
      );
      logger.error(`   📍 Current __dirname: ${__dirname}`);
      logger.error(
        `   📍 App path: ${
          app.isPackaged ? app.getAppPath() : "N/A (dev mode)"
        }`
      );
      logger.error(`   📍 Resources path: ${process.resourcesPath || "N/A"}`);

      // Try to list what's actually in the dist directory
      if (existsSync(__dirname)) {
        try {
          const distContents = readdirSync(__dirname);
          logger.error(
            `   📂 Contents of dist directory: ${distContents.join(", ")}`
          );
          if (!distContents.includes("migrations")) {
            logger.error(
              "   ⚠️  'migrations' folder not found in dist directory"
            );
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          logger.error(`   ⚠️  Could not read dist directory: ${errorMessage}`);
        }
      }

      // Additional diagnostics: check resources path contents
      if (process.resourcesPath && existsSync(process.resourcesPath)) {
        try {
          const resourcesContents = readdirSync(process.resourcesPath);
          logger.error(
            `   📂 Contents of resources directory: ${resourcesContents.join(
              ", "
            )}`
          );
          if (!resourcesContents.includes("migrations")) {
            logger.error(
              "   ⚠️  'migrations' folder not found in resources directory"
            );
            logger.error(
              "   💡 Add migrations to extraResources in electron-builder.mjs"
            );
          }
        } catch (e) {
          // Ignore - can't read resources directory
        }
      }

      return false;
    }

    // Verify we have a valid raw database instance
    if (!rawDb || typeof rawDb.prepare !== "function") {
      throw new Error(
        "Invalid raw database instance - cannot perform integrity checks"
      );
    }

    // Integrity check before migrations
    logger.info("   🔍 Checking database integrity...");
    if (!checkDatabaseIntegrity(rawDb, isProduction)) {
      throw new Error("Database integrity check failed - aborting migration");
    }

    // Setup backup directory
    const backupDir = join(dirname(dbPath), "backups");
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // Generate clean timestamp: YYYYMMDD-HHMMSS format (readable, sortable, no milliseconds)
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
    cleanupOldBackups(backupDir, isProduction ? 10 : 5);

    // Smart backup strategy: Check if backup is really needed
    const pendingStatus = checkPendingMigrations(rawDb, migrationsFolder);
    const recentBackupExists = shouldSkipBackup(backupDir, isProduction);
    const skipBackup = !pendingStatus.hasPending && recentBackupExists;

    if (pendingStatus.pendingCount === 0) {
      logger.info(
        `   ℹ️  No pending migrations (${pendingStatus.appliedCount} already applied)`
      );
      if (!isProduction) {
        logger.info(
          `   📊 Backup decision: skipBackup=${skipBackup}, recentBackupExists=${recentBackupExists}`
        );
      }
    } else if (pendingStatus.pendingCount > 0) {
      logger.info(
        `   📋 ${pendingStatus.pendingCount} pending migration(s) to apply`
      );
    }

    backupPath = join(backupDir, `aurswift-backup-${timestamp}.db`);

    // Verify database file exists before backing up
    if (!existsSync(dbPath)) {
      logger.info(
        "   ℹ️  Database file doesn't exist yet - creating new database"
      );
    } else if (skipBackup) {
      // Skip backup creation in development when no migrations pending and recent backup exists
      logger.info(
        "   ⏭️  Skipping backup - no pending migrations and recent backup exists"
      );
      backupPath = ""; // Clear backup path since we didn't create one
    } else {
      // Checkpoint WAL to ensure all data is in the main database file
      // This is important because SQLite uses WAL mode by default, which creates
      // .db-wal and .db-shm files that aren't included in simple file copies
      try {
        rawDb.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run();
        logger.info("   ✅ WAL checkpoint completed - all data in main file");
      } catch (walError) {
        logger.warn(`   ⚠️  WAL checkpoint failed (non-fatal)`, { walError });
        // Continue with backup even if checkpoint fails
      }

      // Create backup
      copyFileSync(dbPath, backupPath);
      logger.info(`   📦 Backup created: ${backupPath}`);

      // Verify backup was created successfully and is valid
      if (!existsSync(backupPath)) {
        throw new Error("Backup creation failed - backup file not found");
      }

      // Verify backup size matches source (if source exists)
      const sourceStats = statSync(dbPath);
      const backupStats = statSync(backupPath);

      if (sourceStats.size !== backupStats.size) {
        throw new Error(
          `Backup size mismatch: source ${sourceStats.size} bytes vs backup ${backupStats.size} bytes`
        );
      }

      logger.info(
        `   ✅ Backup verified: ${(backupStats.size / 1024).toFixed(2)} KB`
      );
    }

    // Production-specific safety checks
    if (isProduction) {
      // Verify backup was created successfully (only if we tried to create one)
      if (existsSync(dbPath) && backupPath && !existsSync(backupPath)) {
        throw new Error(
          "Backup creation failed - aborting migration for safety"
        );
      }

      // Additional production checks could go here:
      // - Verify migration files are valid
      // - Check disk space
      // - Verify write permissions
    }

    // Run migrations using Drizzle's migrate()
    // Drizzle handles:
    // - Tracking which migrations have been applied (__drizzle_migrations table)
    // - Only running pending migrations
    // - Executing SQL statements in order
    // - Transaction management (each migration runs in its own transaction)
    logger.info("   ⚙️  Applying pending migrations...");
    const startTime = Date.now();
    await migrate(db, { migrationsFolder: migrationsFolder });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`   ⏱️  Migrations completed in ${duration}s`);

    // Integrity check after migrations
    logger.info("   🔍 Verifying database integrity after migration...");
    if (!checkDatabaseIntegrity(rawDb, isProduction)) {
      throw new Error("Database integrity check failed after migration");
    }

    logger.info("   ✅ All migrations completed successfully!\n");
    return true;
  } catch (error) {
    // Provide detailed error context
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error("   ❌ Migration failed:");
    logger.error(`   📍 Database path: ${dbPath}`);
    logger.error(`   📝 Error message: ${errorMessage}`);
    if (errorStack) {
      logger.error(
        `   📋 Stack trace:\n${errorStack
          .split("\n")
          .map((line) => `      ${line}`)
          .join("\n")}`
      );
    }

    // Attempt automatic rollback if backup exists
    if (backupPath && existsSync(backupPath) && existsSync(dbPath)) {
      logger.error("   🔄 Attempting automatic rollback...");
      const rollbackSuccess = await rollbackMigration(
        dbPath,
        backupPath,
        rawDb
      );
      if (rollbackSuccess) {
        logger.error("   ✅ Migration rolled back successfully");
        logger.error("   💡 Database restored to pre-migration state");
      } else {
        logger.error("   ⚠️  Automatic rollback failed");
        logger.error(`   📦 Manual restore required from: ${backupPath}`);
      }
    } else {
      logger.error(
        "   💡 Drizzle automatically rolled back the failed migration"
      );
      if (backupPath) {
        logger.error(`   📦 Backup available at: ${backupPath}`);
      }
    }

    return false;
  }
}
