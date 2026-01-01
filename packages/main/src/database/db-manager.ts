import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app, dialog } from "electron";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { runDrizzleMigrations } from "./drizzle-migrator.js";
import Database from "better-sqlite3";
import semver from "semver";
import * as schema from "./schema.js";
import { isDevelopmentMode } from "./utils/environment.js";
// Layer 1: Pre-connection validation
import {
  validateDatabaseFile,
  validateDatabaseDirectory,
  isDatabaseLocked,
} from "./utils/db-validator.js";
// Layer 2: Compatibility checks
import {
  checkDatabaseCompatibility,
  checkMigrationPathExists,
} from "./utils/db-compatibility.js";
// Layer 3: Repair mechanisms
import { repairDatabase, createFreshDatabase } from "./utils/db-repair.js";

import { getLogger } from "../utils/logger.js";
const logger = getLogger("db-manager");
// Layer 4: User dialogs
import {
  showRecoveryDialog,
  showDatabaseTooOldDialog,
  showCorruptedDatabaseDialog,
  showMigrationFailureDialog,
  showIncompatibleSchemaDialog,
  showDatabaseErrorDialog,
  type RecoveryAction,
} from "./utils/db-recovery-dialog.js";
// Path migration utility
import {
  hasOldDatabasePath,
  shouldMigrateDatabasePath,
  migrateDatabaseFromOldPath,
  getOldDatabasePath,
} from "./utils/db-path-migration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database Manager
 *
 * Handles low-level database initialization and schema creation.
 *
 * Initialization Flow:
 * 1. Connect to SQLite database
 * 2. Create baseline schema via initializeTables() (if needed)
 * 3. Run Drizzle ORM migrations automatically
 *
 * Connection Lifecycle:
 * - Database connection is opened once during initialization
 * - Connection remains open for the lifetime of the application
 * - This is appropriate for SQLite's single-writer model
 * - Connection is properly closed on app exit via close() method
 *
 * Migration System:
 * - Uses Drizzle Kit's built-in migrator
 * - Migrations tracked in __drizzle_migrations table
 * - .sql files in migrations/ folder are auto-applied
 * - No manual copying of SQL needed!
 *
 * To add a new migration:
 * 1. Update schema.ts
 * 2. Run: npm run db:generate
 * 3. Commit the generated .sql file
 * 4. Migration auto-runs on client update
 *
 * For database operations, use DatabaseManager from database.ts
 * which provides manager classes for domain-specific operations.
 */
export class DBManager {
  private db: Database.Database | null = null;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private initializationAttempts: number = 0;
  private static readonly MAX_INITIALIZATION_ATTEMPTS = 3;

  async initialize(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return immediately if already initialized
    if (this.initialized) {
      return;
    }

    // Check for infinite loop protection
    this.initializationAttempts++;
    if (this.initializationAttempts > DBManager.MAX_INITIALIZATION_ATTEMPTS) {
      const errorMessage =
        `Database initialization failed after ${DBManager.MAX_INITIALIZATION_ATTEMPTS} attempts. ` +
        `This may indicate a corrupted migration file or schema issue. ` +
        `Please check the migration files in packages/main/src/database/migrations/ for duplicates or errors.`;
      logger.error(`❌ ${errorMessage}`);

      // Show error dialog and quit
      await showDatabaseErrorDialog(
        "Database Initialization Failed",
        `Failed to initialize database after ${DBManager.MAX_INITIALIZATION_ATTEMPTS} attempts.`,
        "This may indicate:\n" +
          "• Duplicate or conflicting migration files\n" +
          "• Corrupted migration SQL syntax\n" +
          "• File permission issues\n\n" +
          "Please check the application logs for more details."
      );
      app.quit();
      throw new Error(errorMessage);
    }

    logger.info(
      `🔄 Database initialization attempt ${this.initializationAttempts}/${DBManager.MAX_INITIALIZATION_ATTEMPTS}`
    );

    // Start initialization and store the promise to prevent concurrent initializations
    this.initializationPromise = (async (): Promise<void> => {
      try {
        // ========================================
        // PATH MIGRATION: Check for old database path
        // ========================================

        // Check if database exists at old incorrect path (double-nested)
        if (shouldMigrateDatabasePath()) {
          const oldPath = getOldDatabasePath();
          logger.info("📦 Detected old database at incorrect path:", oldPath);
          logger.info("🔧 Attempting to migrate to correct location...");

          const migrationResult = migrateDatabaseFromOldPath(false); // Don't remove old yet

          if (migrationResult.migrated) {
            logger.info("✅ Database migrated successfully!");
            logger.info(`   Old location: ${migrationResult.oldPath}`);
            logger.info(`   New location: ${migrationResult.newPath}`);
            if (migrationResult.backupPath) {
              logger.info(`   Backup created: ${migrationResult.backupPath}`);
            }
          } else {
            const errorMessage =
              migrationResult.reason || "Unknown error during path migration";
            logger.error("❌ Database migration failed:", errorMessage);
            logger.error(
              "   Old database preserved at:",
              migrationResult.oldPath
            );

            // CRITICAL: Stop initialization to prevent data loss (silent fresh start)
            await showDatabaseErrorDialog(
              "Database Migration Failed",
              "We found your data in an old location but couldn't move it automatically.",
              `Your existing data is safe at:\n${
                migrationResult.oldPath || "unknown location"
              }\n\nReason: ${errorMessage}\n\nPlease contact support or check file permissions.`
            );

            throw new Error(`Database path migration failed: ${errorMessage}`);
          }
        }

        const dbPath = this.getDatabasePath();
        logger.info(`Database path: ${dbPath}`);

        // ========================================
        // LAYER 1: Pre-Connection Health Assessment
        // ========================================

        // Ensure directory exists first (before validation)
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
          try {
            fs.mkdirSync(dbDir, { recursive: true });
            logger.info(`✅ Created database directory: ${dbDir}`);
          } catch (mkdirError) {
            const errorMessage =
              mkdirError instanceof Error
                ? mkdirError.message
                : String(mkdirError);
            logger.error(
              `❌ Failed to create database directory: ${errorMessage}`
            );
            await showDatabaseErrorDialog(
              "Database Directory Error",
              `Failed to create database directory: ${dbDir}`,
              errorMessage
            );
            throw new Error(
              `Failed to create database directory: ${errorMessage}`
            );
          }
        }

        // Validate directory after ensuring it exists
        const dirValidation = validateDatabaseDirectory(dbPath);
        if (!dirValidation.valid) {
          const errorMessage =
            dirValidation.reason || "Invalid database directory";
          logger.error(`❌ ${errorMessage}`);
          await showDatabaseErrorDialog(
            "Database Directory Error",
            errorMessage,
            `Database directory: ${dirValidation.directory || "unknown"}`
          );
          throw new Error(errorMessage);
        }

        // Validate database file (if it exists)
        const fileValidation = validateDatabaseFile(dbPath);

        // If database file doesn't exist, it's fine - will be created
        if (fileValidation.isEmpty === false && !fileValidation.valid) {
          logger.warn(
            "⚠️  Database file validation issues:",
            fileValidation.reason
          );

          // Check if database is locked
          if (isDatabaseLocked(dbPath)) {
            await showDatabaseErrorDialog(
              "Database Locked",
              "Database is locked by another process.",
              "Please close any other instances of aurswift or other applications that might be using the database."
            );
            throw new Error("Database is locked by another process");
          }

          // If corrupted but might be recoverable, attempt repair later
          // For now, continue and we'll handle it after opening
        }

        // Check if database file exists (not just validation)
        const dbExists = fs.existsSync(dbPath);

        // Open database connection
        // Note: Connection stays open for the lifetime of the application
        // This is appropriate for SQLite which uses a single-writer model
        try {
          this.db = new Database(dbPath);
        } catch (openError) {
          // Database might be corrupted - try to handle it
          const errorMessage =
            openError instanceof Error ? openError.message : String(openError);

          logger.error(`❌ Failed to open database: ${errorMessage}`);

          // If database exists but couldn't open, offer recovery options
          if (dbExists) {
            const action = await showCorruptedDatabaseDialog();

            if (action === "backup-and-fresh") {
              // Create fresh database
              await this.handleCreateFreshDatabase(dbPath);
              // Retry opening
              this.db = new Database(dbPath);
            } else if (action === "cancel") {
              app.quit();
              return;
            } else {
              throw new Error(
                `Database could not be opened: ${errorMessage}. User cancelled recovery.`
              );
            }
          } else {
            throw new Error(`Database could not be opened: ${errorMessage}`);
          }
        }

        // Initialize Drizzle ORM wrapper with schema
        const drizzleDb = drizzle(this.db, { schema });

        // ========================================
        // LAYER 2: Database Compatibility Check
        // ========================================

        // Check database compatibility if database exists
        if (dbExists) {
          const compatibility = checkDatabaseCompatibility(this.db, dbPath);

          if (!compatibility.compatible) {
            logger.error(
              "❌ Database compatibility check failed:",
              compatibility.reason
            );

            // Close database before showing dialog
            this.db.close();
            this.db = null;

            if (compatibility.requiresFreshDatabase) {
              const action = await showDatabaseTooOldDialog();
              await this.handleRecoveryAction(action, dbPath);
              // Reset state and retry initialization
              this.initialized = false;
              this.initializationPromise = null;
              return this.initialize();
            } else {
              await showDatabaseErrorDialog(
                "Database Compatibility Error",
                compatibility.reason ||
                  "Database is not compatible with this version",
                "Please contact support if you need to recover data from this database."
              );
              throw new Error(
                compatibility.reason || "Database compatibility check failed"
              );
            }
          }

          // Check if migration path exists
          const migrationsFolder = this.getMigrationsFolder();
          const migrationPathExists = checkMigrationPathExists(
            this.db,
            migrationsFolder
          );

          if (!migrationPathExists) {
            logger.error("❌ Migration path does not exist");
            this.db.close();
            this.db = null;

            const action = await showIncompatibleSchemaDialog();
            await this.handleRecoveryAction(action, dbPath);
            // Reset state and retry initialization
            this.initialized = false;
            this.initializationPromise = null;
            return this.initialize();
          }
        }

        // Check for downgrade scenario (newer database, older app)
        // Note: We open the connection first to read version info from the database
        // This is acceptable as the downgrade check is quick and the connection
        // will be closed immediately if a downgrade is detected
        const isDowngradeAttempt = this.checkForDowngrade(this.db, dbPath);
        if (isDowngradeAttempt) {
          logger.error(
            "❌ Database downgrade detected - app version is older than database schema"
          );
          // Close database connection before quitting
          this.db.close();
          this.db = null;
          dialog.showErrorBox(
            "Cannot Open Database",
            "This database was created with a newer version of aurswift.\n\n" +
              "Please update the application to the latest version to continue.\n\n" +
              `Current app version: ${this.getAppVersion()}\n` +
              "Database requires a newer version."
          );
          app.quit();
          return;
        }

        // ========================================
        // LAYER 3: Database Repair (if needed)
        // ========================================

        // If file validation indicated potential issues, attempt repair
        if (
          dbExists &&
          fileValidation.valid === false &&
          fileValidation.canRecover
        ) {
          logger.info("🔧 Attempting database repair...");
          const repairResult = await repairDatabase(this.db, dbPath);

          if (!repairResult.success) {
            logger.warn("⚠️  Database repair failed:", repairResult.reason);

            // Close database before showing dialog
            this.db.close();
            this.db = null;

            const action = await showCorruptedDatabaseDialog(
              repairResult.backupCreated
            );
            await this.handleRecoveryAction(action, dbPath);
            // Reset state and retry initialization
            this.initialized = false;
            this.initializationPromise = null;
            return this.initialize();
          } else if (repairResult.repaired) {
            logger.info("✅ Database repair successful");
          }
        }

        // ========================================
        // LAYER 5: Migration Safety (enhanced in drizzle-migrator.ts)
        // ========================================

        // Run Drizzle migrations automatically
        // Pass both Drizzle wrapper (for migrate()) and raw DB (for transactions/integrity checks)
        const migrationSuccess = await runDrizzleMigrations(
          drizzleDb,
          this.db,
          dbPath
        );

        if (!migrationSuccess) {
          const errorMessage = `Database migration failed. Check the migration logs above for details. Database path: ${dbPath}`;
          logger.error(`❌ ${errorMessage}`);

          // Find latest backup
          const backupDir = path.join(path.dirname(dbPath), "backups");
          let latestBackup: string | undefined;
          if (fs.existsSync(backupDir)) {
            const backups = fs
              .readdirSync(backupDir)
              .filter(
                (f) => f.startsWith("aurswift-backup-") && f.endsWith(".db")
              )
              .map((f) => path.join(backupDir, f))
              .sort((a, b) => {
                const statA = fs.statSync(a);
                const statB = fs.statSync(b);
                return statB.mtimeMs - statA.mtimeMs;
              });
            latestBackup = backups[0];
          }

          // Close database before showing dialog
          this.db.close();
          this.db = null;

          // Show recovery dialog
          const action = await showMigrationFailureDialog(latestBackup);
          await this.handleRecoveryAction(action, dbPath, latestBackup);
          // Reset state and retry initialization
          this.initialized = false;
          this.initializationPromise = null;
          return this.initialize();
        }

        this.initialized = true;
        this.initializationAttempts = 0; // Reset counter on successful initialization
        logger.info("✅ Database initialized successfully\n");
      } catch (error) {
        // Reset state on error to allow retry
        this.initialized = false;
        this.initializationPromise = null;
        if (this.db) {
          this.db.close();
          this.db = null;
        }

        // Provide detailed error context
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        const dbPath = this.getDatabasePath();

        logger.error("❌ Database initialization error:");
        logger.error(`   Path: ${dbPath}`);
        logger.error(`   Error: ${errorMessage}`);
        if (errorStack) {
          logger.error(`   Stack: ${errorStack}`);
        }

        throw new Error(
          `Database initialization failed at ${dbPath}: ${errorMessage}`,
          { cause: error }
        );
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Get the actual app version from package.json, not Electron's version
   * app.getVersion() can return Electron's version in dev mode, which is incorrect
   */
  private getAppVersion(): string {
    try {
      // Find package.json at project root
      const projectRoot = isDevelopmentMode()
        ? path.resolve(process.cwd())
        : path.resolve(app.getAppPath(), "../../..");

      const packageJsonPath = path.join(projectRoot, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      return packageJson.version;
    } catch (error) {
      logger.warn(
        "Could not read version from package.json, falling back to app.getVersion():",
        error
      );
      return app.getVersion();
    }
  }

  /**
   * Check if user is trying to open a newer database with an older app version
   * This prevents crashes from schema mismatches during downgrades
   */
  private checkForDowngrade(db: Database.Database, dbPath: string): boolean {
    try {
      // Get app version from package.json (not from Electron which returns wrong version)
      const appVersion = this.getAppVersion();

      // Check if database has migration tracking table
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
        )
        .get();

      if (!tableExists) {
        // No migrations applied yet - fresh database, no downgrade risk
        return false;
      }

      // Get the latest migration applied to database
      const latestMigration = db
        .prepare(
          "SELECT created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 1"
        )
        .get() as { created_at: number } | undefined;

      if (!latestMigration) {
        // No migrations applied yet
        return false;
      }

      // Store app version in a custom table for version tracking
      // This allows us to detect downgrades across updates
      const versionTableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='_app_version'"
        )
        .get();

      if (!versionTableExists) {
        // Create version tracking table
        db.exec(`
          CREATE TABLE IF NOT EXISTS _app_version (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);

        // Store current version
        db.prepare(
          "INSERT OR REPLACE INTO _app_version (id, version, updated_at) VALUES (1, ?, ?)"
        ).run(appVersion, Date.now());

        return false; // First time tracking, no downgrade
      }

      // Get stored version
      const storedVersion = db
        .prepare("SELECT version FROM _app_version WHERE id = 1")
        .get() as { version: string } | undefined;

      if (!storedVersion) {
        // No version stored, store current and continue
        db.prepare(
          "INSERT OR REPLACE INTO _app_version (id, version, updated_at) VALUES (1, ?, ?)"
        ).run(appVersion, Date.now());
        return false;
      }

      // Compare versions (simple string comparison works for semver if formatted correctly)
      const isDowngrade = this.isVersionDowngrade(
        storedVersion.version,
        appVersion
      );

      if (!isDowngrade) {
        // Update stored version to current
        db.prepare(
          "UPDATE _app_version SET version = ?, updated_at = ? WHERE id = 1"
        ).run(appVersion, Date.now());
      }

      return isDowngrade;
    } catch (error) {
      logger.error("Error checking for downgrade:", error);
      // On error, allow to proceed (don't block legitimate updates)
      return false;
    }
  }

  /**
   * Compare two semver version strings
   * Returns true if newVersion < storedVersion (downgrade attempt)
   * Uses semver library for proper version comparison
   */
  private isVersionDowngrade(
    storedVersion: string,
    newVersion: string
  ): boolean {
    try {
      // Validate versions are valid semver
      if (!semver.valid(storedVersion) || !semver.valid(newVersion)) {
        logger.warn(
          `Invalid semver format - stored: ${storedVersion}, current: ${newVersion}. Falling back to simple comparison.`
        );
        // Fallback to simple comparison for non-semver versions
        const stored = storedVersion.split(".").map(Number);
        const current = newVersion.split(".").map(Number);

        for (let i = 0; i < Math.max(stored.length, current.length); i++) {
          const s = stored[i] || 0;
          const c = current[i] || 0;

          if (c < s) return true; // Downgrade detected
          if (c > s) return false; // Upgrade, OK
        }

        return false; // Same version, OK
      }

      // Use semver for proper comparison (handles pre-release, build metadata, etc.)
      return semver.lt(newVersion, storedVersion);
    } catch (error) {
      logger.error(
        `Version comparison error - stored: ${storedVersion}, current: ${newVersion}:`,
        error
      );
      // On error, don't block (allow to proceed)
      return false;
    }
  }

  public getDatabasePath(): string {
    // Use centralized environment detection
    const isDev = isDevelopmentMode();

    // Allow override via environment variable for testing
    const customDbPath = process.env.POS_DB_PATH;
    if (customDbPath) {
      logger.info(`Using custom database path: ${customDbPath}`);
      // Validate custom path doesn't contain invalid characters
      if (customDbPath.includes("\0") || customDbPath.includes("\x00")) {
        throw new Error(`Invalid database path: ${customDbPath}`);
      }
      return customDbPath;
    }

    let finalPath: string;

    if (isDev) {
      // Development: Store in project directory at root level
      // FIXED: Use __dirname for reliable path resolution (always resolves to project root)
      // This file is at: packages/main/src/database/db-manager.ts
      // __dirname resolves to: <project-root>/packages/main/src/database
      // Go up 3 levels to get project root
      const projectRoot = path.resolve(__dirname, "../../../");
      finalPath = path.join(projectRoot, "data", "pos_system.db");

      // Validate path is at root level (not in packages/)
      if (finalPath.includes(path.join("packages", "data"))) {
        throw new Error(
          `Database path resolved incorrectly to: ${finalPath}. ` +
            `Expected: ${path.join(projectRoot, "data", "pos_system.db")}`
        );
      }

      logger.info("Development mode: Using project directory for database");
      logger.info(`Project root: ${projectRoot}`);
      logger.info(`Database path: ${finalPath}`);
    } else {
      // Production: Use proper user data directory based on platform
      // Note: app.getPath("userData") already includes the app name (e.g., "aurswift")
      const userDataPath = app.getPath("userData");
      finalPath = path.join(userDataPath, "pos_system.db");
      logger.info("Production mode: Using user data directory for database");
    }

    // Validate path doesn't contain invalid characters
    if (finalPath.includes("\0") || finalPath.includes("\x00")) {
      throw new Error(`Invalid database path: ${finalPath}`);
    }

    logger.info(`Database at: ${finalPath}`);
    return finalPath;
  }

  getDb(): Database.Database {
    if (!this.initialized || !this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  /**
   * Get migrations folder path (used by compatibility checker)
   * Uses same logic as drizzle-migrator to ensure consistency
   */
  private getMigrationsFolder(): string {
    // In development, use source folder
    if (!app.isPackaged) {
      return path.join(__dirname, "migrations");
    }

    // In production, migrations are bundled in the app
    // Try multiple locations in order of preference

    // Option 1: Check using extraResources (outside asar)
    const resourcesPath = process.resourcesPath;
    if (resourcesPath) {
      const resourcesMigrationsPath = path.join(resourcesPath, "migrations");
      if (fs.existsSync(resourcesMigrationsPath)) {
        return resourcesMigrationsPath;
      }
    }

    // Option 2: Check relative to current file (inside asar)
    const distMigrationsPath = path.join(__dirname, "migrations");
    if (fs.existsSync(distMigrationsPath)) {
      return distMigrationsPath;
    }

    // Option 3: Check in app path
    const appPath = app.getAppPath();
    const appMigrationsPath = path.join(
      appPath,
      "node_modules",
      "@app",
      "main",
      "dist",
      "migrations"
    );
    if (fs.existsSync(appMigrationsPath)) {
      return appMigrationsPath;
    }

    // Option 4: Try app path with database subfolder (legacy)
    const asarMigrationsPath = path.join(appPath, "database", "migrations");
    if (fs.existsSync(asarMigrationsPath)) {
      return asarMigrationsPath;
    }

    // Last resort: Return expected path
    return distMigrationsPath;
  }

  /**
   * Handle recovery action from user dialog
   */
  private async handleRecoveryAction(
    action: RecoveryAction,
    dbPath: string,
    backupPath?: string
  ): Promise<void> {
    switch (action) {
      case "backup-and-fresh":
        await this.handleCreateFreshDatabase(dbPath);
        break;

      case "repair":
        // Repair will be attempted on next initialization
        // For now, just inform user we'll retry
        logger.info("🔧 User requested repair - will retry initialization");
        break;

      case "restore-backup":
        if (backupPath && fs.existsSync(backupPath)) {
          await this.handleRestoreFromBackup(dbPath, backupPath);
        } else {
          await showDatabaseErrorDialog(
            "Backup Not Found",
            "The backup file could not be found.",
            backupPath
              ? `Expected location: ${backupPath}`
              : "No backup path provided"
          );
          app.quit();
        }
        break;

      case "cancel":
        app.quit();
        break;
    }
  }

  /**
   * Handle creating a fresh database
   */
  private async handleCreateFreshDatabase(dbPath: string): Promise<void> {
    logger.info("🔄 Creating fresh database...");
    const migrationsFolder = this.getMigrationsFolder();
    await createFreshDatabase(dbPath, migrationsFolder);
    logger.info("✅ Fresh database prepared");
  }

  /**
   * Handle restoring from backup
   */
  private async handleRestoreFromBackup(
    dbPath: string,
    backupPath: string
  ): Promise<void> {
    logger.info(`🔄 Restoring database from backup: ${backupPath}`);

    try {
      // Close database if open
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      // Remove current database if exists
      if (fs.existsSync(dbPath)) {
        const oldBackupPath = `${dbPath}.old.${Date.now()}`;
        fs.renameSync(dbPath, oldBackupPath);
        logger.info(`📦 Old database backed up to: ${oldBackupPath}`);
      }

      // Copy backup to database location
      fs.copyFileSync(backupPath, dbPath);
      logger.info("✅ Database restored from backup");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await showDatabaseErrorDialog(
        "Restore Failed",
        "Failed to restore database from backup.",
        errorMessage
      );
      throw error;
    }
  }

  close(): void {
    if (this.db) {
      try {
        // Checkpoint WAL file to ensure all data is written to main database file
        // This is critical for database import/export operations
        this.db.pragma("wal_checkpoint(TRUNCATE)");
        logger.info("✅ WAL checkpoint completed");
      } catch (walError) {
        logger.warn("⚠️  WAL checkpoint failed:", walError);
      }

      this.db.close();
      this.initialized = false;
      logger.info("✅ Database connection closed");
    }
  }
}
