/**
 * Database Backup Cleanup Utility
 *
 * Comprehensive cleanup for all database backup file types:
 * - Migration backups (aurswift-backup-*.db)
 * - Repair backups (aurswift-repair-backup-*.db)
 * - Fresh start backups (aurswift-fresh-start-backup-*.db)
 * - Path migration backups (aurswift-path-migration-backup-*.db)
 * - Empty operation backups (pos_system-backup-before-empty-*.db)
 * - Import operation backups (pos_system-backup-before-import-*.db)
 * - Old database files (pos_system.db.old.*)
 *
 * Features:
 * - Configurable retention policies per backup type
 * - Automatic cleanup on app startup
 * - Manual cleanup command
 * - Storage monitoring and warnings
 * - Safe cleanup with error handling
 */

import { existsSync, readdirSync, statSync, unlinkSync, Stats } from "node:fs";
import { join, dirname } from "node:path";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger("backup-cleanup");

/**
 * Backup file type configuration
 */
export interface BackupTypeConfig {
  /** File name pattern to match */
  pattern: RegExp;
  /** Maximum number of backups to keep */
  retention: number;
  /** Human-readable description */
  description: string;
  /** Search in root data directory (not backups/) */
  inRootDir?: boolean;
}

/**
 * Retention configuration per backup type
 */
export interface BackupRetentionPolicy {
  // Migration backups in backups/ folder
  migration: number;
  repair: number;
  freshStart: number;
  pathMigration: number;

  // Operation backups in root data/ folder
  emptyOperation: number;
  importOperation: number;

  // Old database files in root data/ folder
  // IMPORTANT: Uses count-based retention (not age-based) for predictable storage
  // Old files can be very large (40+ MB) so limiting count prevents excessive storage
  oldDatabases: number; // Number of files to keep (count-based retention)
}

/**
 * Cleanup result for a single backup type
 */
export interface BackupCleanupResult {
  type: string;
  pattern: string;
  filesFound: number;
  filesDeleted: number;
  bytesFreed: number;
  errors: string[];
}

/**
 * Overall cleanup summary
 */
export interface CleanupSummary {
  totalFilesFound: number;
  totalFilesDeleted: number;
  totalBytesFreed: number;
  backupTypes: BackupCleanupResult[];
  warnings: string[];
  errors: string[];
}

/**
 * Storage monitoring result
 */
export interface StorageInfo {
  totalBackupSize: number;
  totalBackupCount: number;
  backupsByType: Map<string, { count: number; size: number }>;
  warnings: string[];
  exceedsThreshold: boolean;
}

/**
 * Default retention policy for user-facing operations
 *
 * Best Practices:
 * - Production: More backups for safety (users can't easily recover)
 * - Development: Fewer backups to save disk space (devs iterate frequently)
 * - Critical operations (repair, fresh start, empty, import): More in production
 * - Old files: Count-based (not age) for predictable storage usage
 */
export function getDefaultRetentionPolicy(
  isProduction: boolean,
): BackupRetentionPolicy {
  return {
    // Backups in backups/ subfolder
    migration: isProduction ? 10 : 5, // Frequent migrations need rollback history
    repair: isProduction ? 5 : 3, // Critical: Before repair attempts
    freshStart: isProduction ? 5 : 3, // Critical: Before recreating DB
    pathMigration: 3, // Rare operation, same for prod/dev

    // Backups in root data/ folder (user-initiated operations)
    emptyOperation: isProduction ? 5 : 3, // User data loss risk
    importOperation: isProduction ? 5 : 3, // User data loss risk

    // Old database files (.old.*) - COUNT-based retention (not age-based)
    // Count-based provides predictable storage (old files can be 40+ MB each)
    oldDatabases: isProduction ? 5 : 3, // Keep last N files
  };
}

/**
 * Get backup type configurations
 */
function getBackupTypeConfigs(
  policy: BackupRetentionPolicy,
): BackupTypeConfig[] {
  return [
    // Backups in backups/ subfolder
    {
      pattern: /^aurswift-backup-\d{8}-\d{6}\.db$/,
      retention: policy.migration,
      description: "Migration backups",
      inRootDir: false,
    },
    {
      pattern: /^aurswift-repair-backup-\d{8}-\d{6}\.db$/,
      retention: policy.repair,
      description: "Repair backups",
      inRootDir: false,
    },
    {
      pattern: /^aurswift-fresh-start-backup-\d{8}-\d{6}\.db$/,
      retention: policy.freshStart,
      description: "Fresh start backups",
      inRootDir: false,
    },
    {
      pattern: /^aurswift-path-migration-backup-\d+\.db$/,
      retention: policy.pathMigration,
      description: "Path migration backups",
      inRootDir: false,
    },

    // Backups in root data/ folder
    {
      pattern:
        /^pos_system-backup-before-empty-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.db$/,
      retention: policy.emptyOperation,
      description: "Empty operation backups",
      inRootDir: true,
    },
    {
      pattern:
        /^pos_system-backup-before-import-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.db$/,
      retention: policy.importOperation,
      description: "Import operation backups",
      inRootDir: true,
    },
    {
      pattern: /^pos_system\.db\.old\.\d+$/,
      retention: policy.oldDatabases,
      description: "Old database files",
      inRootDir: true,
    },
  ];
}

/**
 * Get all backup files matching a pattern in a directory
 */
function getMatchingBackups(
  directory: string,
  pattern: RegExp,
): Array<{ name: string; path: string; stats: Stats }> {
  if (!existsSync(directory)) {
    return [];
  }

  try {
    const files = readdirSync(directory);

    return files
      .filter((f) => pattern.test(f))
      .map((f) => {
        const filePath = join(directory, f);
        try {
          const stats = statSync(filePath);
          // Only include files (not directories)
          return stats.isFile() ? { name: f, path: filePath, stats } : null;
        } catch {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  } catch (error) {
    logger.warn(`Failed to read directory ${directory}:`, error);
    return [];
  }
}

/**
 * Clean up backups for a specific type
 */
function cleanupBackupType(
  directory: string,
  config: BackupTypeConfig,
  useAgeBased: boolean = false,
): BackupCleanupResult {
  const result: BackupCleanupResult = {
    type: config.description,
    pattern: config.pattern.source,
    filesFound: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    errors: [],
  };

  try {
    const backups = getMatchingBackups(directory, config.pattern);
    result.filesFound = backups.length;

    if (backups.length === 0) {
      return result;
    }

    // Sort by modification time (newest first)
    backups.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

    let filesToDelete: typeof backups = [];

    if (useAgeBased) {
      // Age-based retention: delete files older than X days
      const maxAgeMs = config.retention * 24 * 60 * 60 * 1000;
      const cutoffTime = Date.now() - maxAgeMs;

      filesToDelete = backups.filter(
        (backup) => backup.stats.mtime.getTime() < cutoffTime,
      );

      if (filesToDelete.length > 0) {
        logger.info(
          `   🗑️  ${config.description}: Found ${filesToDelete.length} files older than ${config.retention} days`,
        );
      }
    } else {
      // Count-based retention: keep only N newest files
      if (backups.length > config.retention) {
        filesToDelete = backups.slice(config.retention);
        logger.info(
          `   🗑️  ${config.description}: Keeping ${config.retention} newest, removing ${filesToDelete.length} old files`,
        );
      }
    }

    // Delete old backups
    for (const backup of filesToDelete) {
      try {
        unlinkSync(backup.path);
        result.filesDeleted++;
        result.bytesFreed += backup.stats.size;
        logger.debug(`      Deleted: ${backup.name}`);
      } catch (error) {
        const errorMsg = `Failed to delete ${backup.name}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        result.errors.push(errorMsg);
        logger.warn(`      ⚠️  ${errorMsg}`);
      }
    }

    // Also clean up associated WAL/SHM files for deleted databases
    if (result.filesDeleted > 0 && config.pattern.source.includes("db")) {
      cleanupOrphanedWalFiles(
        directory,
        backups.map((b) => b.name),
      );
    }
  } catch (error) {
    const errorMsg = `Failed to cleanup ${config.description}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    result.errors.push(errorMsg);
    logger.warn(`   ⚠️  ${errorMsg}`);
  }

  return result;
}

/**
 * Clean up orphaned WAL and SHM files
 * These are SQLite journal files that should be deleted when their parent DB is deleted
 */
function cleanupOrphanedWalFiles(
  directory: string,
  existingDbFiles: string[],
): void {
  try {
    if (!existsSync(directory)) {
      return;
    }

    const files = readdirSync(directory);
    const walShmFiles = files.filter(
      (f) => f.endsWith("-wal") || f.endsWith("-shm"),
    );

    for (const walShmFile of walShmFiles) {
      // Get the base database filename (remove -wal or -shm suffix)
      const baseDbName = walShmFile.replace(/-(wal|shm)$/, "");

      // If the parent database doesn't exist, delete the WAL/SHM file
      if (!existingDbFiles.includes(baseDbName)) {
        try {
          const filePath = join(directory, walShmFile);
          unlinkSync(filePath);
          logger.debug(`   🗑️  Deleted orphaned journal file: ${walShmFile}`);
        } catch (error) {
          logger.warn(
            `   ⚠️  Failed to delete orphaned journal file ${walShmFile}:`,
            error,
          );
        }
      }
    }
  } catch (error) {
    logger.warn("Failed to cleanup orphaned WAL files:", error);
  }
}

/**
 * Perform comprehensive cleanup of all backup types
 *
 * @param dbPath - Path to the main database file
 * @param policy - Retention policy (uses defaults if not provided)
 * @param isProduction - Whether running in production mode
 * @returns Cleanup summary with results
 */
export function cleanupAllBackups(
  dbPath: string,
  policy?: Partial<BackupRetentionPolicy>,
  isProduction: boolean = false,
): CleanupSummary {
  const startTime = Date.now();
  logger.info("\n🧹 Starting comprehensive backup cleanup...");

  const fullPolicy = {
    ...getDefaultRetentionPolicy(isProduction),
    ...policy,
  };

  const dataDir = dirname(dbPath);
  const backupsDir = join(dataDir, "backups");

  const summary: CleanupSummary = {
    totalFilesFound: 0,
    totalFilesDeleted: 0,
    totalBytesFreed: 0,
    backupTypes: [],
    warnings: [],
    errors: [],
  };

  // Get all backup type configurations
  const configs = getBackupTypeConfigs(fullPolicy);

  // Process each backup type
  for (const config of configs) {
    const directory = config.inRootDir ? dataDir : backupsDir;
    // All backup types now use count-based retention (more predictable)
    const useAgeBased = false;

    const result = cleanupBackupType(directory, config, useAgeBased);

    summary.backupTypes.push(result);
    summary.totalFilesFound += result.filesFound;
    summary.totalFilesDeleted += result.filesDeleted;
    summary.totalBytesFreed += result.bytesFreed;

    if (result.errors.length > 0) {
      summary.errors.push(...result.errors);
    }

    // Log results for this type
    if (result.filesDeleted > 0) {
      const freedMB = (result.bytesFreed / (1024 * 1024)).toFixed(2);
      logger.info(
        `   ✅ ${config.description}: Deleted ${result.filesDeleted}/${result.filesFound} files (freed ${freedMB} MB)`,
      );
    } else if (result.filesFound > 0) {
      logger.debug(
        `   ℹ️  ${config.description}: All ${result.filesFound} files within retention policy`,
      );
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalFreedMB = (summary.totalBytesFreed / (1024 * 1024)).toFixed(2);

  if (summary.totalFilesDeleted > 0) {
    logger.info(
      `\n✅ Cleanup completed in ${duration}s: Deleted ${summary.totalFilesDeleted} files, freed ${totalFreedMB} MB`,
    );
  } else {
    logger.info(
      `\n✅ Cleanup completed in ${duration}s: No files to delete (all within retention policy)`,
    );
  }

  if (summary.errors.length > 0) {
    logger.warn(
      `⚠️  ${summary.errors.length} error(s) occurred during cleanup`,
    );
  }

  return summary;
}

/**
 * Get storage information for all backups
 *
 * @param dbPath - Path to the main database file
 * @param warningThresholdMB - Threshold in MB to trigger warning (default: 500 MB)
 * @returns Storage information with warnings
 */
export function getBackupStorageInfo(
  dbPath: string,
  warningThresholdMB: number = 500,
): StorageInfo {
  const dataDir = dirname(dbPath);
  const backupsDir = join(dataDir, "backups");

  const info: StorageInfo = {
    totalBackupSize: 0,
    totalBackupCount: 0,
    backupsByType: new Map(),
    warnings: [],
    exceedsThreshold: false,
  };

  const configs = getBackupTypeConfigs(getDefaultRetentionPolicy(false));

  for (const config of configs) {
    const directory = config.inRootDir ? dataDir : backupsDir;
    const backups = getMatchingBackups(directory, config.pattern);

    let typeSize = 0;
    for (const backup of backups) {
      typeSize += backup.stats.size;
    }

    info.backupsByType.set(config.description, {
      count: backups.length,
      size: typeSize,
    });

    info.totalBackupCount += backups.length;
    info.totalBackupSize += typeSize;
  }

  // Check threshold
  const totalSizeMB = info.totalBackupSize / (1024 * 1024);
  if (totalSizeMB > warningThresholdMB) {
    info.exceedsThreshold = true;
    info.warnings.push(
      `Total backup size (${totalSizeMB.toFixed(2)} MB) exceeds threshold (${warningThresholdMB} MB)`,
    );
    info.warnings.push(
      `Consider running cleanup or adjusting retention policies`,
    );
  }

  // Check for excessive files per type
  info.backupsByType.forEach((typeInfo, typeName) => {
    if (typeInfo.count > 20) {
      info.warnings.push(
        `${typeName}: ${typeInfo.count} files (consider cleanup)`,
      );
    }
  });

  return info;
}

/**
 * Log storage information in a readable format
 */
export function logStorageInfo(info: StorageInfo): void {
  logger.info("\n📊 Backup Storage Information:");
  logger.info(
    `   Total: ${info.totalBackupCount} files, ${(
      info.totalBackupSize /
      (1024 * 1024)
    ).toFixed(2)} MB`,
  );

  logger.info("\n   Breakdown by type:");
  info.backupsByType.forEach((typeInfo, typeName) => {
    const sizeMB = (typeInfo.size / (1024 * 1024)).toFixed(2);
    logger.info(`   • ${typeName}: ${typeInfo.count} files (${sizeMB} MB)`);
  });

  if (info.warnings.length > 0) {
    logger.warn("\n   ⚠️  Warnings:");
    info.warnings.forEach((warning) => {
      logger.warn(`   • ${warning}`);
    });
  }
}
