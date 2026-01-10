/**
 * Database Compatibility Checker
 *
 * Layer 2: Database Compatibility Validation
 * Checks if existing database is compatible with current app version
 * and if migration path exists.
 */

import Database from "better-sqlite3";
import { app } from "electron";
import semver from "semver";
import fs from "fs";
import { getDatabaseAge, formatDatabaseAge } from "./db-validator.js";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("db-compatibility");

export interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
  canMigrate?: boolean;
  databaseVersion?: string;
  appVersion: string;
  databaseAge?: number;
  migrationPathExists?: boolean;
  requiresFreshDatabase?: boolean;
}

/**
 * Check database compatibility with current app version
 *
 * @param db - Open database connection
 * @param dbPath - Path to database file
 * @returns Compatibility result with detailed information
 */
export function checkDatabaseCompatibility(
  db: Database.Database,
  dbPath: string
): CompatibilityResult {
  const appVersion = app.getVersion();

  try {
    // Check 1: Does database have migration tracking?
    const hasMigrationsTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
      )
      .get();

    if (!hasMigrationsTable) {
      // Old database without migration tracking
      // Check if it has any tables to determine if it's truly empty
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        .all() as Array<{ name: string }>;

      if (tables.length === 0) {
        // Empty database - compatible, just needs initial setup
        return {
          compatible: true,
          canMigrate: true,
          appVersion,
          migrationPathExists: true,
        };
      }

      // Database has tables but no migration tracking
      // This is an old database from before migration system
      const dbAge = getDatabaseAge(dbPath);
      const ageStr = dbAge ? formatDatabaseAge(dbAge) : "unknown";

      return {
        compatible: false,
        reason: `Database appears to be from an old version (created ${ageStr} ago) and lacks migration tracking. This database cannot be automatically migrated.`,
        canMigrate: false,
        appVersion,
        databaseAge: dbAge || undefined,
        requiresFreshDatabase: true,
      };
    }

    // Check 2: Get latest migration applied
    const latestMigration = db
      .prepare(
        "SELECT created_at, hash FROM __drizzle_migrations ORDER BY id DESC LIMIT 1"
      )
      .get() as { created_at: number; hash: string } | undefined;

    if (!latestMigration) {
      // Migration table exists but no migrations applied
      return {
        compatible: true,
        canMigrate: true,
        appVersion,
        migrationPathExists: true,
      };
    }

    // Check 3: Get app version from database
    let databaseVersion: string | undefined;
    try {
      const versionTableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='_app_version'"
        )
        .get();

      if (versionTableExists) {
        const versionRow = db
          .prepare("SELECT version FROM _app_version LIMIT 1")
          .get() as { version: string } | undefined;

        if (versionRow) {
          databaseVersion = versionRow.version;
        }
      }
    } catch (error) {
      // Version table doesn't exist or error reading it - not critical
      logger.warn("Could not read app version from database:", error);
    }

    // Check 4: Get database age
    const dbAge = getDatabaseAge(dbPath);

    // Check 5: Validate schema integrity
    let schemaValid = true;
    let schemaError: string | undefined;

    try {
      // Quick check if core tables exist
      const coreTables = [
        // Add your core required tables here
        // Example: 'users', 'products', 'transactions'
      ];

      // For now, just check if we can read from migrations table
      const testQuery = db.prepare(
        "SELECT COUNT(*) as count FROM __drizzle_migrations"
      );
      testQuery.get();
    } catch (error) {
      schemaValid = false;
      schemaError = error instanceof Error ? error.message : String(error);
    }

    if (!schemaValid) {
      return {
        compatible: false,
        reason: `Database schema is corrupted: ${schemaError}`,
        canMigrate: false,
        databaseVersion,
        appVersion,
        databaseAge: dbAge || undefined,
        requiresFreshDatabase: true,
      };
    }

    // Database appears compatible - migrations can be applied
    return {
      compatible: true,
      canMigrate: true,
      databaseVersion,
      appVersion,
      databaseAge: dbAge || undefined,
      migrationPathExists: true,
    };
  } catch (error) {
    // Error during compatibility check - assume incompatible
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      compatible: false,
      reason: `Error checking database compatibility: ${errorMessage}`,
      canMigrate: false,
      appVersion,
      requiresFreshDatabase: true,
    };
  }
}

/**
 * Check if migration path exists from database's current state
 *
 * @param db - Open database connection
 * @param migrationsFolder - Path to migrations folder
 * @returns True if migration path exists
 */
export function checkMigrationPathExists(
  db: Database.Database,
  migrationsFolder: string
): boolean {
  try {
    // Check if migrations folder exists
    if (!fs.existsSync(migrationsFolder)) {
      return false;
    }

    // Get current migration state from database
    const hasMigrationsTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
      )
      .get();

    if (!hasMigrationsTable) {
      // No migration tracking - need to check if migrations folder has initial migration
      const migrationFiles = fs
        .readdirSync(migrationsFolder)
        .filter((f: string) => f.endsWith(".sql"));

      return migrationFiles.length > 0;
    }

    // Migration tracking exists - Drizzle will handle migration path
    // This is a basic check - Drizzle's migrate() will do the actual validation
    return true;
  } catch (error) {
    logger.error("Error checking migration path:", error);
    return false;
  }
}

/**
 * Get database version information
 *
 * @param db - Open database connection
 * @returns Version information
 */
export function getDatabaseVersionInfo(db: Database.Database): {
  appVersion?: string;
  lastMigration?: number;
  migrationCount?: number;
  schemaVersion?: string;
} {
  try {
    let appVersion: string | undefined;
    let lastMigration: number | undefined;
    let migrationCount: number | undefined;

    // Get app version
    try {
      const versionTableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='_app_version'"
        )
        .get();

      if (versionTableExists) {
        const versionRow = db
          .prepare("SELECT version FROM _app_version LIMIT 1")
          .get() as { version: string } | undefined;

        if (versionRow) {
          appVersion = versionRow.version;
        }
      }
    } catch (error) {
      // Ignore
    }

    // Get migration info
    try {
      const migrationsTableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
        )
        .get();

      if (migrationsTableExists) {
        const migrations = db
          .prepare(
            "SELECT id, created_at FROM __drizzle_migrations ORDER BY id DESC"
          )
          .all() as Array<{ id: number; created_at: number }>;

        migrationCount = migrations.length;

        if (migrations.length > 0) {
          lastMigration = migrations[0].created_at;
        }
      }
    } catch (error) {
      // Ignore
    }

    // Get SQLite version (not app version, but useful for debugging)
    const sqliteVersion = db
      .prepare("SELECT sqlite_version() as version")
      .get() as {
      version: string;
    };

    return {
      appVersion,
      lastMigration,
      migrationCount,
      schemaVersion: sqliteVersion?.version,
    };
  } catch (error) {
    logger.error("Error getting database version info:", error);
    return {};
  }
}
