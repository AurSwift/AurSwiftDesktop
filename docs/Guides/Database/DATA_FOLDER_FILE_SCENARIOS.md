# Scenarios That Populate Files in `desktop/data` Folder

This document lists all scenarios where files are created, written, or populated in the `desktop/data` directory.

## Overview

The `desktop/data` folder is used in **development mode only**. In production, files are stored in the OS-specific user data directory (e.g., `~/Library/Application Support/aurswift/` on macOS).

**Important Note**:

- **Export/Backup Database**: Does **NOT** create files in `data/` folder - saves to user-selected location (Downloads, Documents, etc.)
- **Import Database**: **DOES** create backup files in `data/` folder (automatic safety backup before importing)

## Quick Reference: Which Operations Create Files in `data/` Folder?

### ✅ Operations That CREATE Files in `data/` Folder:

1. Database initialization (creates `pos_system.db`)
2. Database migrations (creates backups in `backups/` folder)
3. Database import (creates `pos_system.db-backup-before-import-*.db`)
4. Database empty operation (creates `pos_system.db-backup-before-empty-*.db`)
5. Database repair operations (creates repair backups)
6. Fresh start operations (creates fresh start backups)
7. Database path migration (creates path migration backups)
8. Database restore (creates `.old.*` files)
9. SQLite WAL operations (auto-creates `-wal` and `-shm` files)

### ❌ Operations That Do NOT Create Files in `data/` Folder:

1. **Manual database backup/export** - Saves to user-selected location
2. **Data export (JSON/SQLite)** - Saves to user's Documents folder
3. **CSV report exports** - Saves to user-selected location
4. **Booker CSV import** - Only reads files, doesn't create any

## File Types Found in `desktop/data`

Based on the current directory structure:

- **Database files**: `pos_system.db`, `pos_system.db-wal`, `pos_system.db-shm`
- **Backup files**: `pos_system.db.old.*` (with optional `-shm` and `-wal` files)
- **Backup directory**: `backups/` containing various backup types

---

## Scenarios That Create/Populate Files

### 1. **Database Initialization**

**Location**: `desktop/packages/main/src/database/db-manager.ts`

**When**: On first app launch or when database doesn't exist

**Files Created**:

- `pos_system.db` - Main SQLite database file
- `pos_system.db-wal` - Write-Ahead Log file (SQLite WAL mode)
- `pos_system.db-shm` - Shared Memory file (SQLite WAL mode)

**Details**:

- Creates new database if it doesn't exist
- Runs migrations to set up schema
- Seeds default data (admin user, etc.)

---

### 2. **Database Migrations**

**Location**: `desktop/packages/main/src/database/drizzle-migrator.ts`

**When**: On app startup when pending migrations are detected

**Files Created**:

- `backups/aurswift-backup-YYYYMMDD-HHMMSS.db` - Automatic backup before migration

**Details**:

- Creates backup in `backups/` directory before applying migrations
- Backup naming: `aurswift-backup-YYYYMMDD-HHMMSS.db`
- In development: May skip backup if recent backup exists (< 5 minutes) and no migrations pending
- In production: Always creates backup before migrations
- Retention: Keeps last 10 backups in production, 5 in development

---

### 3. **Manual Database Backup (Export)**

**Location**: `desktop/packages/main/src/ipc/db.handler.ts` (handler: `database:backup`)

**When**: User clicks "Backup Database" or "Export Database" in admin dashboard settings/UI

**Files Created**:

- **User-selected location** (NOT in `data/` folder)
- Default filename: `aurswift-backup-YYYYMMDD-HHMMSS.db`

**Details**:

- Shows file save dialog to user
- User chooses where to save the backup file
- Copies current database to user-selected location
- **Does NOT create files in `data/` folder** - saves to wherever user selects (typically Downloads, Documents, or external drive)
- Returns file path and size information

---

### 4. **Database Empty Operation**

**Location**: `desktop/packages/main/src/ipc/db.handler.ts` (handler: `database:empty`)

**When**: User clicks "Empty Database" in settings/UI

**Files Created**:

- `pos_system.db-backup-before-empty-YYYY-MM-DD-HH-MM-SS.db` - Automatic backup before emptying

**Details**:

- Creates automatic backup before deleting all data
- Backup is created in same directory as main database
- Preserves receipt email settings across empty operation
- Reseeds database with default data after emptying

---

### 5. **Database Import Operation**

**Location**: `desktop/packages/main/src/ipc/db.handler.ts` (handler: `database:import`)

**When**: User imports a database file via admin dashboard settings/UI

**Files Created**:

- `pos_system.db-backup-before-import-YYYY-MM-DD-HH-MM-SS.db` - **Created in `data/` folder** (same directory as main database)

**Details**:

- **Creates automatic backup in `data/` folder** before importing new database
- Backup is created in same directory as main database (not user-selected location)
- Extracts and preserves license data from current database
- Restores license data to imported database after import
- Validates imported database structure before completing
- **This is the only import/export operation that creates files in `data/` folder**

---

### 6. **Database Repair Operations**

**Location**: `desktop/packages/main/src/database/utils/db-repair.ts`

**When**: Database corruption detected or user initiates repair

**Files Created**:

- `backups/aurswift-repair-backup-YYYYMMDD-HHMMSS.db` - Backup before repair attempt
- `pos_system.db.old.TIMESTAMP` - Old database renamed before repair

**Details**:

- Creates backup before attempting repair
- Renames corrupted database with `.old.TIMESTAMP` suffix
- Creates fresh database if repair fails
- Retention: Keeps last 3 repair backups

---

### 7. **Fresh Start / Database Recreation**

**Location**: `desktop/packages/main/src/database/utils/db-repair.ts` (`createFreshDatabase`)

**When**: User chooses "Fresh Start" or database is beyond repair

**Files Created**:

- `backups/aurswift-fresh-start-backup-YYYYMMDD-HHMMSS.db` - Backup before fresh start
- `pos_system.db.old.TIMESTAMP` - Old database renamed

**Details**:

- Backs up old database before creating fresh one
- Renames old database with `.old.TIMESTAMP` suffix
- Creates new database with current schema
- Retention: Keeps last 3 fresh start backups

---

### 8. **Database Path Migration**

**Location**: `desktop/packages/main/src/database/utils/db-path-migration.ts`

**When**: Migrating from old incorrect database path (double-nested path issue)

**Files Created**:

- `backups/aurswift-path-migration-backup-TIMESTAMP.db` - Backup during path migration

**Details**:

- Only occurs in production mode
- Migrates database from old path (`userData/aurswift/aurswift/pos_system.db`) to correct path (`userData/aurswift/pos_system.db`)
- Creates backup before migration
- Retention: Keeps last 3 path migration backups

---

### 9. **Database Restore from Backup**

**Location**: `desktop/packages/main/src/database/db-manager.ts` (`restoreFromBackup`)

**When**: User restores database from a backup file

**Files Created**:

- `pos_system.db.old.TIMESTAMP` - Current database renamed before restore

**Details**:

- Renames current database before restoring from backup
- Copies backup file to database location
- Preserves old database as `.old.TIMESTAMP` file

---

### 10. **Automatic Scheduled Backups**

**Location**: `desktop/packages/main/src/services/dataExportService.ts` (`scheduleAutomaticBackups`)

**When**: Automatic backup scheduling is enabled (currently not actively used in codebase)

**Files Created**:

- `backups/aurswift-database-backup-YYYY-MM-DDTHH-MM-SS.db` - Scheduled backups

**Details**:

- Can be configured to run at intervals (default: 24 hours)
- Stores backups in user data directory's `backups/` folder
- Includes cleanup function to remove old backups (keeps last 30 by default)

---

### 11. **Data Export (JSON/SQLite)**

**Location**: `desktop/packages/main/src/services/dataExportService.ts` (`exportLocalData`)

**When**: User exports data for GDPR compliance or backup purposes

**Files Created**:

- `aurswift-data-export-YYYY-MM-DDTHH-MM-SS.json` - JSON export (in user's Documents folder, not `data/`)
- `aurswift-database-backup-YYYY-MM-DDTHH-MM-SS.db` - SQLite backup (in user's Documents folder, not `data/`)

**Details**:

- Exports all database tables to JSON format
- Creates SQLite database backup
- Files are saved to user's Documents folder by default, not `data/` folder
- Can be triggered manually or automatically on subscription cancellation

---

### 12. **CSV Report Exports**

**Location**: `desktop/packages/main/src/services/reportsExportService.ts` (`exportToCSV`)

**When**: User exports sales reports to CSV

**Files Created**:

- User-selected location (not in `data/` folder)
- Default filename: `sales-report-YYYY-MM-DD_to_YYYY-MM-DD.csv` or `sales-report.csv`

**Details**:

- Exports sales transaction data to CSV format
- User selects save location via file dialog
- Files are NOT stored in `data/` folder (saved to user-selected location)

---

### 13. **Booker CSV Import**

**Location**: `desktop/packages/main/src/ipc/bookerImportHandlers.ts`

**When**: User imports Booker CSV files (departments/products)

**Files Created**:

- None in `data/` folder (CSV files are read from user-selected location)

**Details**:

- Reads CSV files from user-selected location
- Parses and imports data into database
- Does NOT create files in `data/` folder (only reads CSV files)

---

### 14. **SQLite WAL Checkpoint Operations**

**Location**: Various locations (db-manager.ts, drizzle-migrator.ts)

**When**: Database operations that checkpoint WAL files

**Files Created/Modified**:

- `pos_system.db-wal` - Write-Ahead Log file (modified/truncated)
- `pos_system.db-shm` - Shared Memory file (modified)

**Details**:

- SQLite WAL mode creates these files automatically
- Checkpoint operations merge WAL into main database
- These files are created automatically by SQLite, not explicitly by application code

---

## Backup File Naming Conventions

### Backup Types and Prefixes:

1. **Migration Backups**: `aurswift-backup-YYYYMMDD-HHMMSS.db`
   - Created before database migrations
   - **Retention**: 10 files (production) / 5 files (development)
   - **Cleanup**: Automatic on startup + after migrations

2. **Repair Backups**: `aurswift-repair-backup-YYYYMMDD-HHMMSS.db`
   - Created before repair operations
   - **Retention**: 5 files (production) / 3 files (development)
   - **Cleanup**: Automatic on startup
   - **Note**: Critical safety backups - more in production

3. **Fresh Start Backups**: `aurswift-fresh-start-backup-YYYYMMDD-HHMMSS.db`
   - Created before fresh database creation
   - **Retention**: 5 files (production) / 3 files (development)
   - **Cleanup**: Automatic on startup
   - **Note**: Drastic operation - more in production

4. **Path Migration Backups**: `aurswift-path-migration-backup-TIMESTAMP.db`
   - Created during database path migration
   - **Retention**: 3 files (production & development)
   - **Cleanup**: Automatic on startup
   - **Note**: Rare operation

5. **Empty Operation Backups**: `pos_system-backup-before-empty-YYYY-MM-DD-HH-MM-SS.db`
   - Created before emptying database
   - Stored in same directory as main database
   - **Retention**: 5 files (production) / 3 files (development)
   - **Cleanup**: Automatic after each empty operation
   - **Note**: User data loss risk - more in production

6. **Import Operation Backups**: `pos_system-backup-before-import-YYYY-MM-DD-HH-MM-SS.db`
   - Created before importing database
   - Stored in same directory as main database
   - **Retention**: 5 files (production) / 3 files (development)
   - **Cleanup**: Automatic after each import operation
   - **Note**: User data loss risk - more in production

7. **Old Database Files**: `pos_system.db.old.TIMESTAMP`
   - Renamed database files (before repair, restore, etc.)
   - May include `-shm` and `-wal` files
   - **Retention**: 5 files (production) / 3 files (development) - COUNT-BASED
   - **Cleanup**: Automatic on startup
   - **Note**: Changed from age-based to count-based for predictable storage (files can be 40+ MB)

8. **Orphaned WAL/SHM Files**: `*.db-wal`, `*.db-shm`
   - SQLite journal files
   - **Cleanup**: Automatically removed when parent database is deleted

---

## Directory Structure

```
desktop/data/
├── pos_system.db                    # Main database (created on init)
├── pos_system.db-wal                # SQLite WAL file (auto-created)
├── pos_system.db-shm                # SQLite shared memory (auto-created)
├── pos_system.db.old.*              # Old database files (various operations)
├── pos_system.db-backup-before-*    # Pre-operation backups
└── backups/                         # Backup directory
    ├── aurswift-backup-*.db         # Migration backups
    ├── aurswift-repair-backup-*.db  # Repair backups
    ├── aurswift-fresh-start-backup-*.db  # Fresh start backups
    └── aurswift-path-migration-backup-*.db  # Path migration backups
```

---

## Notes

1. **Development vs Production**:
   - Development: Files stored in `desktop/data/`
   - Production: Files stored in OS user data directory:
     - **macOS**: `~/Library/Application Support/aurswift/`
     - **Windows**: `%USERPROFILE%\AppData\Roaming\AuraSwift\` (resolves to `C:\Users\<Username>\AppData\Roaming\AuraSwift\`)
     - **Linux**: `~/.config/aurswift/`

2. **Automatic Backup Cleanup**:
   - Runs on application startup
   - Runs after database migrations
   - Runs after empty/import operations (for those specific backup types)
   - Different retention policies per backup type
   - Age-based retention for .old.\* files (7 days)
   - Count-based retention for all other backup types
   - Orphaned WAL/SHM files are automatically cleaned up

3. **Manual Cleanup**:
   - Available via IPC: `database:cleanup-backups`
   - Supports dry-run mode to preview changes
   - Supports custom retention policies
   - Returns detailed cleanup summary

4. **Storage Monitoring**:
   - Available via IPC: `database:backup-storage-info`
   - Warning threshold: 500 MB total backup size
   - Provides breakdown by backup type
   - Warns if any backup type exceeds 20 files

5. **WAL Files**:
   - `-wal` and `-shm` files are automatically created by SQLite
   - Checkpoint operations merge WAL into main database
   - These files are not explicitly created by application code
   - Orphaned WAL/SHM files are automatically removed during cleanup

6. **File Operations**:
   - Most file operations use `fs.copyFile` or `fs.copyFileSync` for backups
   - Database operations use SQLite's native backup API when available
   - All backup operations include timestamp in filename for uniqueness

---

## Comprehensive Backup Cleanup System

### Overview

The application includes a robust backup cleanup system (`backup-cleanup.ts`) that manages all database backup files automatically and manually.

### Automatic Cleanup Triggers

1. **On Application Startup**: Cleans all backup types based on retention policies
2. **After Database Migrations**: Cleans migration-related backups
3. **After Empty Operations**: Cleans empty operation backups (keeps last 3)
4. **After Import Operations**: Cleans import operation backups (keeps last 3)

### Retention Policies

The system uses different retention strategies:

- **Count-Based Retention**: Keeps N newest files (for most backup types)
- **Age-Based Retention**: Keeps files from last N days (for .old.\* files)

**Production Mode Retention** (conservative - user safety first):

```
Migration backups:        10 files (frequent rollbacks)
Repair backups:           5 files  (critical safety)
Fresh start backups:      5 files  (drastic operation)
Path migration backups:   3 files  (rare operation)
Empty operation backups:  5 files  (user data loss risk)
Import operation backups: 5 files  (user data loss risk)
Old database files:       5 files  (COUNT-based, not age-based)
```

**Development Mode Retention** (aggressive - save disk space):

```
Migration backups:        5 files  (devs iterate fast)
Repair backups:           3 files  (devs can recover)
Fresh start backups:      3 files  (devs test frequently)
Path migration backups:   3 files  (rare operation)
Empty operation backups:  3 files  (devs test frequently)
Import operation backups: 3 files  (devs test frequently)
Old database files:       3 files  (COUNT-based, save space)
```

**Key Design Decisions**:

- **Production**: More backups for critical operations (5 vs 3) - users can't easily recover
- **Development**: Fewer backups to save disk space - developers iterate quickly
- **Old files**: COUNT-based (not age) - files can be 40+ MB, count provides predictable storage

### Storage Monitoring

The system monitors total backup storage and provides warnings when:

- Total backup size exceeds 500 MB
- Any backup type exceeds 20 files

**Access via IPC**: `database:backup-storage-info`

### Manual Cleanup

Users/admins can trigger manual cleanup via IPC:

**Handler**: `database:cleanup-backups`

**Options**:

```typescript
{
  customPolicy?: {
    migration?: number;
    repair?: number;
    freshStart?: number;
    pathMigration?: number;
    emptyOperation?: number;
    importOperation?: number;
    oldDatabases?: number;
  };
  dryRun?: boolean;  // Preview changes without deleting
}
```

**Returns**:

- Files found/deleted per backup type
- Bytes freed
- Detailed summary
- Errors/warnings

### Cleanup Features

1. **Safe Deletion**: Handles errors gracefully, continues on individual failures
2. **Orphaned File Cleanup**: Removes WAL/SHM files when parent database is deleted
3. **Detailed Logging**: Provides comprehensive logs of cleanup operations
4. **Non-Blocking**: Cleanup failures don't prevent app operations
5. **Performance**: Efficient file scanning and deletion

### Implementation Location

- **Core Utility**: `packages/main/src/database/utils/backup-cleanup.ts`
- **Integration Points**:
  - Database initialization (`index.ts`)
  - Migration system (`drizzle-migrator.ts`)
  - IPC handlers (`ipc/db.handler.ts`)

---

## Related Documentation

- [Database Migration System](./DATABASE_MIGRATION_SYSTEM.md)
- [Database Schema Changes Guide](../AutoUpdate/OldSystem/DATABASE_SCHEMA_CHANGES_GUIDE.md)
- [Booker CSV Import Analysis](../BookerImport/BOOKER_CSV_IMPORT_ANALYSIS.md)
