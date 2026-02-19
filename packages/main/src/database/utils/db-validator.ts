/**
 * Database Validator
 *
 * Layer 1: Pre-Connection Health Assessment
 * Validates database file before attempting to open it.
 * This prevents crashes from corrupted or incompatible databases.
 */

import fs from "fs";
import path from "path";

export interface DatabaseValidationResult {
  valid: boolean;
  reason?: string;
  canRecover?: boolean;
  fileSize?: number;
  isCorrupted?: boolean;
  isEmpty?: boolean;
}

/**
 * SQLite database file header (first 16 bytes)
 * Valid SQLite databases start with: "SQLite format 3\x00"
 */
const SQLITE_HEADER = Buffer.from("SQLite format 3\x00");

/**
 * Validate database file before opening connection
 *
 * Checks:
 * 1. File exists
 * 2. File is readable/writable
 * 3. File has valid SQLite header
 * 4. File size is reasonable
 * 5. File is not locked by another process
 *
 * @param dbPath - Path to database file
 * @returns Validation result with detailed information
 */
export function validateDatabaseFile(dbPath: string): DatabaseValidationResult {
  try {
    // Check 1: File exists
    if (!fs.existsSync(dbPath)) {
      return {
        valid: true, // Empty database is valid (will be created)
        isEmpty: true,
        canRecover: true,
      };
    }

    // Check 2: File statistics
    let stats: fs.Stats;
    try {
      stats = fs.statSync(dbPath);
    } catch (error) {
      return {
        valid: false,
        reason: `Cannot access database file: ${
          error instanceof Error ? error.message : String(error)
        }`,
        canRecover: false,
      };
    }

    // Check 3: File size validation
    const fileSize = stats.size;

    // Empty file is suspicious (might be corrupted)
    if (fileSize === 0) {
      return {
        valid: false,
        reason:
          "Database file is empty (0 bytes). This may indicate corruption.",
        canRecover: false,
        fileSize: 0,
        isCorrupted: true,
        isEmpty: true,
      };
    }

    // SQLite databases should be at least 512 bytes (minimal valid database)
    if (fileSize < 512) {
      return {
        valid: false,
        reason: `Database file is too small (${fileSize} bytes). Valid SQLite databases are at least 512 bytes.`,
        canRecover: false,
        fileSize,
        isCorrupted: true,
      };
    }

    // Check 4: Read permissions
    try {
      fs.accessSync(dbPath, fs.constants.R_OK);
    } catch (error) {
      return {
        valid: false,
        reason: `Database file is not readable. Check file permissions.`,
        canRecover: false,
        fileSize,
      };
    }

    // Check 5: SQLite header validation
    // Open file and read first 16 bytes to check SQLite header
    let fileDescriptor: number | null = null;
    try {
      fileDescriptor = fs.openSync(dbPath, "r");
      const header = Buffer.alloc(16);
      const bytesRead = fs.readSync(fileDescriptor, header, 0, 16, 0);

      if (bytesRead < 16) {
        // Close file descriptor before returning
        if (fileDescriptor !== null) {
          try {
            fs.closeSync(fileDescriptor);
          } catch {
            // Ignore close errors
          }
        }
        return {
          valid: false,
          reason: "Database file is too small to contain valid SQLite header.",
          canRecover: false,
          fileSize,
          isCorrupted: true,
        };
      }

      // Check if header matches SQLite format
      if (!header.equals(SQLITE_HEADER)) {
        // Close file descriptor before returning
        if (fileDescriptor !== null) {
          try {
            fs.closeSync(fileDescriptor);
          } catch {
            // Ignore close errors
          }
        }

        // Check if it's close but might be recoverable
        const headerStr = header.toString("utf-8", 0, 15);
        if (headerStr.includes("SQLite")) {
          return {
            valid: false,
            reason: "Database file header is corrupted or invalid.",
            canRecover: true, // Might be recoverable
            fileSize,
            isCorrupted: true,
          };
        }

        return {
          valid: false,
          reason: "File does not appear to be a valid SQLite database.",
          canRecover: false,
          fileSize,
          isCorrupted: true,
        };
      }

      // Close file descriptor after reading
      if (fileDescriptor !== null) {
        try {
          fs.closeSync(fileDescriptor);
          fileDescriptor = null;
        } catch {
          // Ignore close errors
        }
      }

      // Check 6: Write permissions (for future operations)
      try {
        fs.accessSync(dbPath, fs.constants.W_OK);
      } catch (error) {
        return {
          valid: false,
          reason: `Database file is not writable. Check file permissions.`,
          canRecover: false,
          fileSize,
        };
      }

      // All checks passed
      return {
        valid: true,
        fileSize,
        canRecover: true,
      };
    } catch (error) {
      // Close file descriptor on error
      if (fileDescriptor !== null) {
        try {
          fs.closeSync(fileDescriptor);
        } catch {
          // Ignore close errors
        }
      }

      return {
        valid: false,
        reason: `Error reading database file: ${
          error instanceof Error ? error.message : String(error)
        }`,
        canRecover: false,
        fileSize,
        isCorrupted: true,
      };
    }
  } catch (error) {
    // Unexpected error during validation
    return {
      valid: false,
      reason: `Unexpected error during database validation: ${
        error instanceof Error ? error.message : String(error)
      }`,
      canRecover: false,
    };
  }
}

/**
 * Check if database directory exists and is writable
 *
 * @param dbPath - Path to database file
 * @returns True if directory exists and is writable
 */
export function validateDatabaseDirectory(dbPath: string): {
  valid: boolean;
  reason?: string;
  directory?: string;
} {
  try {
    const dbDir = path.dirname(dbPath);

    // Check if directory exists
    if (!fs.existsSync(dbDir)) {
      return {
        valid: false,
        reason: `Database directory does not exist: ${dbDir}`,
        directory: dbDir,
      };
    }

    // Check if it's actually a directory
    const stats = fs.statSync(dbDir);
    if (!stats.isDirectory()) {
      return {
        valid: false,
        reason: `Database path is not a directory: ${dbDir}`,
        directory: dbDir,
      };
    }

    // Check write permissions
    try {
      fs.accessSync(dbDir, fs.constants.W_OK);
    } catch (error) {
      return {
        valid: false,
        reason: `Database directory is not writable: ${dbDir}. Check permissions.`,
        directory: dbDir,
      };
    }

    return {
      valid: true,
      directory: dbDir,
    };
  } catch (error) {
    return {
      valid: false,
      reason: `Error validating database directory: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Check if database file is locked by another process
 *
 * @param dbPath - Path to database file
 * @returns True if file appears to be locked
 */
export function isDatabaseLocked(dbPath: string): boolean {
  try {
    if (!fs.existsSync(dbPath)) {
      return false; // No file means no lock
    }

    // Check for SQLite lock files
    const walFile = `${dbPath}-wal`;
    // If WAL or SHM files exist but are older than 5 minutes,
    // they might be stale locks from crashed processes
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    if (fs.existsSync(walFile)) {
      const walStats = fs.statSync(walFile);
      const walAge = now - walStats.mtimeMs;

      // If WAL file is recent, database might be in use
      if (walAge < staleThreshold) {
        // Check if we can open the file exclusively
        try {
          const fd = fs.openSync(dbPath, "r+");
          fs.closeSync(fd);
          return false; // File is not locked
        } catch (error) {
          // If we can't open it, it might be locked
          return true;
        }
      }
    }

    return false; // No active lock detected
  } catch (error) {
    // On error, assume not locked (will be caught when trying to open)
    return false;
  }
}

/**
 * Get database age (how old is the database file)
 *
 * @param dbPath - Path to database file
 * @returns Age in milliseconds, or null if file doesn't exist
 */
export function getDatabaseAge(dbPath: string): number | null {
  try {
    if (!fs.existsSync(dbPath)) {
      return null;
    }

    const stats = fs.statSync(dbPath);
    const now = Date.now();
    const age = now - stats.mtimeMs;

    return age;
  } catch (error) {
    return null;
  }
}

/**
 * Format database age as human-readable string
 *
 * @param ageMs - Age in milliseconds
 * @returns Human-readable age string
 */
export function formatDatabaseAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return `${years} year${years > 1 ? "s" : ""}`;
  } else if (months > 0) {
    return `${months} month${months > 1 ? "s" : ""}`;
  } else if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    return `${seconds} second${seconds > 1 ? "s" : ""}`;
  }
}
