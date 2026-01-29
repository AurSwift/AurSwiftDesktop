# Database Backup System

Complete guide to AuraSwift's database backup system, including automatic backups, manual backups, backup types, and recovery procedures.

---

## Table of Contents

1. [Overview](#overview)
2. [Backup Types](#backup-types)
3. [Automatic Backup Triggers](#automatic-backup-triggers)
4. [Manual Backup Operations](#manual-backup-operations)
5. [Backup File Naming Convention](#backup-file-naming-convention)
6. [Backup Storage Locations](#backup-storage-locations)
7. [Backup Lifecycle Management](#backup-lifecycle-management)
8. [Recovery Procedures](#recovery-procedures)
9. [Safety Features](#safety-features)
10. [Use Cases & Scenarios](#use-cases--scenarios)
11. [What Happens If You Delete Backups](#what-happens-if-you-delete-backups)
12. [Best Practices](#best-practices)
13. [Troubleshooting](#troubleshooting)
14. [API Reference](#api-reference)

---

## Overview

AuraSwift implements a **multi-layered backup system** to protect your data:

1. **Automatic backups** before risky operations (migrations, data deletion, imports)
2. **Manual backups** via user-initiated save dialog
3. **Migration backups** created during schema version updates
4. **Retention policy** to prevent disk space issues (keeps last 10 backups)

### Why Multiple Backups?

Your database is critical business data. Multiple backup types ensure:

- **Safety net** before destructive operations
- **Version history** for troubleshooting
- **Recovery options** if something goes wrong
- **Audit trail** of database state over time

---

## Backup Types

### 1. Migration Backups (Automatic)

**Created when:** App updates trigger schema migrations

**Naming pattern:**

```
auraswift-backup-v{version}-{timestamp}.db
```

**Example:**

```
auraswift-backup-v1-2025-11-06T12-06-18-444Z.db
```

**Location:** `data/backups/` (development) or `~/Library/Application Support/AuraSwift/backups/` (production)

**Purpose:**

- Preserve database state before schema changes
- Enable rollback if migration fails
- Track which version the backup corresponds to

**Code location:** `packages/main/src/database/versioning/index.ts`

```typescript
function createBackup(dbPath: string, currentVersion: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(dirname(dbPath), "backups");

  const backupPath = join(backupDir, `auraswift-backup-v${currentVersion}-${timestamp}.db`);

  copyFileSync(dbPath, backupPath);
  return backupPath;
}
```

---

### 2. Before-Empty Backups (Automatic)

**Created when:** User empties all data from database

**Naming pattern:**

```
pos_system-backup-before-empty-{date}-{time}.db
```

**Example:**

```
pos_system-backup-before-empty-2025-11-06-23-29-37.db
```

**Location:** Same directory as main database file

**Purpose:**

- **Critical safety net** - emptying database is irreversible
- Allows full recovery if user accidentally empties database
- Preserves complete state including all transactions and history

**Code location:** `packages/main/src/authStore.ts` (line ~1217)

```typescript
ipcMain.handle("database:empty", async (event) => {
  // Create automatic backup before emptying
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  const timeStr = new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
  const backupPath = info.path.replace(".db", `-backup-before-empty-${timestamp}-${timeStr}.db`);

  await fs.copyFile(info.path, backupPath);
  console.log(`Backup created before emptying: ${backupPath}`);

  // Now safe to empty database
  const result = await db.emptyAllTables();
});
```

**User Flow:**

1. User clicks "Empty Database" in settings
2. System **automatically** creates backup (no user prompt)
3. System deletes all data from all tables
4. User can recover from backup if needed

---

### 3. Before-Import Backups (Automatic)

**Created when:** User imports a database file

**Naming pattern:**

```
pos_system-backup-before-import-{date}-{time}.db
```

**Example:**

```
pos_system-backup-before-import-2025-11-06-23-40-50.db
```

**Location:** Same directory as main database file

**Purpose:**

- Preserve current database before replacing with imported one
- Enable rollback if imported database is corrupted or wrong
- Maintain history of database state before major changes

**Code location:** `packages/main/src/authStore.ts` (line ~1315)

```typescript
ipcMain.handle("database:import", async (event) => {
  // Create backup of current database before importing
  const backupPath = info.path.replace(".db", `-backup-before-import-${timestamp}-${timeStr}.db`);

  if (info.exists) {
    await fs.copyFile(info.path, backupPath);
    console.log(`Current database backed up to: ${backupPath}`);
  }

  // Close database connection
  closeDatabase();

  // Replace with imported database
  await fs.copyFile(importPath, info.path);
});
```

**User Flow:**

1. User clicks "Import Database" in settings
2. User selects a `.db` file via file picker
3. System **automatically** backs up current database
4. System closes database connection
5. System replaces database with imported file
6. App restarts to load new database

---

### 4. Manual User Backups (On-Demand)

**Created when:** User clicks "Backup Database" button

**Naming pattern:**

```
auraswift-backup-{date}-{time}.db
```

**Default filename:**

```
auraswift-backup-2025-11-06-23-45-30.db
```

**Location:** User-selected location via save dialog

**Purpose:**

- User-controlled backup for external storage
- Create backups before testing risky operations
- Export database for transfer to another machine
- Archive specific database states

**Code location:** `packages/main/src/authStore.ts` (line ~1149)

```typescript
ipcMain.handle("database:backup", async (event) => {
  const defaultFilename = `auraswift-backup-${timestamp}-${timeStr}.db`;

  const result = await dialog.showSaveDialog(focusedWindow!, {
    title: "Save Database Backup",
    defaultPath: defaultFilename,
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!result.canceled) {
    await fs.copyFile(info.path, result.filePath);
  }
});
```

**User Flow:**

1. User clicks "Backup Database" in settings
2. System shows save dialog with default filename
3. User chooses location and optionally renames file
4. System copies database to selected location
5. User receives success confirmation

---

## Automatic Backup Triggers

### Migration Triggers

**When:** App version increases and schema migrations are needed

**Flow:**

```
App Launch
  ↓
Check Schema Version
  ↓
Pending Migrations Found?
  ↓ YES
Create Migration Backup (data/backups/)
  ↓
Run Migrations
  ↓
Update Schema Version
  ↓
Cleanup Old Backups (keep last 10)
```

**Code path:**

```typescript
// packages/main/src/database/versioning/index.ts
function runMigrations(db: Database, dbPath: string): boolean {
  const currentVersion = getCurrentVersion(db);
  const pendingMigrations = getPendingMigrations(currentVersion);

  if (pendingMigrations.length > 0) {
    // Create backup before migrations
    createBackup(dbPath, currentVersion);

    // Run migrations...
  }
}
```

**Console output:**

```
🔍 Database Version Check:
   Current: v1
   Latest:  v2

🚀 Running 1 migration(s)...

   📦 Backup created: data/backups/auraswift-backup-v1-2025-11-06T12-06-18-444Z.db

   🔄 Running migration 2: add_discount_fields...
   ✅ Migration 2 completed successfully

   ✅ Database version updated to 2
```

---

### Empty Database Trigger

**When:** User clicks "Empty Database" button

**Flow:**

```
User Clicks "Empty Database"
  ↓
Create Before-Empty Backup
  ↓
Empty All Tables (DELETE FROM...)
  ↓
Return Success with Backup Info
  ↓
Show Confirmation to User
```

**Safety:**

- Backup created **before** any data deletion
- Backup stored in same directory as database (easy to find)
- If deletion fails, backup still exists

---

### Import Database Trigger

**When:** User imports a database file

**Flow:**

```
User Clicks "Import Database"
  ↓
User Selects File
  ↓
Create Before-Import Backup
  ↓
Close Database Connection
  ↓
Replace Database File
  ↓
App Restart Required
```

**Safety:**

- Current database backed up before any changes
- Database connection closed before file operations
- Import failure preserves original database
- App restart ensures clean connection to new database

---

## Manual Backup Operations

### Creating Manual Backup

**From UI:**

1. Open Settings
2. Navigate to Database section
3. Click "Backup Database"
4. Choose location and filename
5. Click Save

**From Renderer (React):**

```typescript
const handleBackup = async () => {
  const result = await window.api.invoke("database:backup");

  if (result.success) {
    console.log("Backup saved to:", result.data.path);
    console.log("Backup size:", result.data.size, "bytes");
  } else if (result.cancelled) {
    console.log("User cancelled backup");
  } else {
    console.error("Backup failed:", result.message);
  }
};
```

**Response format:**

```typescript
{
  success: true,
  data: {
    path: "/Users/admin/Downloads/auraswift-backup-2025-11-06-23-45-30.db",
    size: 389120, // bytes
    timestamp: "2025-11-06T23:45:30.123Z"
  },
  message: "Database backed up successfully"
}
```

---

### Restoring from Backup

**Method 1: Import Database (Recommended)**

1. Open Settings → Database
2. Click "Import Database"
3. Select backup file
4. App restarts with restored database

**Method 2: Manual File Replacement (Advanced)**

```bash
# 1. Stop the application
# 2. Locate current database
cd ~/Library/Application\ Support/AuraSwift  # macOS production
# or
cd ./data  # Development

# 3. Backup current database (safety!)
cp pos_system.db pos_system-current-backup.db

# 4. Replace with backup
cp /path/to/backup.db pos_system.db

# 5. Restart application
```

**⚠️ Warning:** Manual file replacement should only be done when app is closed.

---

## Backup File Naming Convention

### Pattern Breakdown

**Migration Backups:**

```
auraswift-backup-v{VERSION}-{ISO_TIMESTAMP}.db
                    ↑        ↑
                    |        ISO 8601 timestamp with colons replaced by dashes
                    Current database schema version
```

**Before-Empty Backups:**

```
pos_system-backup-before-empty-{DATE}-{TIME}.db
           ↑                    ↑      ↑
           |                    |      HH-MM-SS format
           |                    YYYY-MM-DD format
           Operation indicator
```

**Before-Import Backups:**

```
pos_system-backup-before-import-{DATE}-{TIME}.db
           ↑                     ↑      ↑
           |                     |      HH-MM-SS format
           |                     YYYY-MM-DD format
           Operation indicator
```

**Manual Backups:**

```
auraswift-backup-{DATE}-{TIME}.db
                 ↑      ↑
                 |      HH-MM-SS format
                 YYYY-MM-DD format
```

### Timestamp Format

All timestamps use:

- **Date:** `YYYY-MM-DD` (e.g., `2025-11-06`)
- **Time:** `HH-MM-SS` (e.g., `23-45-30`)
- **ISO:** `YYYY-MM-DDTHH-MM-SS-mmmZ` (e.g., `2025-11-06T12-06-18-444Z`)

Colons replaced with dashes for cross-platform filename compatibility.

---

## Backup Storage Locations

### Development Mode

**Main database:**

```
./data/pos_system.db
```

**Automatic backups (migration):**

```
./data/backups/auraswift-backup-v{version}-{timestamp}.db
```

**Before-empty/import backups:**

```
./data/pos_system-backup-before-{operation}-{date}-{time}.db
```

**Manual backups:**

```
User-selected location (typically Downloads or Documents)
```

---

### Production Mode (macOS)

**Main database:**

```
~/Library/Application Support/AuraSwift/pos_system.db
```

**Automatic backups (migration):**

```
~/Library/Application Support/AuraSwift/backups/auraswift-backup-v{version}-{timestamp}.db
```

**Before-empty/import backups:**

```
~/Library/Application Support/AuraSwift/pos_system-backup-before-{operation}-{date}-{time}.db
```

**Manual backups:**

```
User-selected location
```

---

### Production Mode (Windows)

**Main database:**

```
%APPDATA%\AuraSwift\pos_system.db
```

**Automatic backups (migration):**

```
%APPDATA%\AuraSwift\backups\auraswift-backup-v{version}-{timestamp}.db
```

**Before-empty/import backups:**

```
%APPDATA%\AuraSwift\pos_system-backup-before-{operation}-{date}-{time}.db
```

---

## Backup Lifecycle Management

### Automatic Cleanup

**Policy:** Keep last 10 migration backups

**Trigger:** After creating a new migration backup

**Logic:**

```typescript
function cleanupOldBackups(backupDir: string): void {
  const backupFiles = readdirSync(backupDir)
    .filter((file) => file.startsWith("auraswift-backup-") && file.endsWith(".db"))
    .map((file) => ({
      name: file,
      path: join(backupDir, file),
      time: statSync(join(backupDir, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time); // Newest first

  if (backupFiles.length > MAX_BACKUPS) {
    const filesToDelete = backupFiles.slice(MAX_BACKUPS);
    for (const file of filesToDelete) {
      unlinkSync(file.path);
      console.log(`   🗑️  Removed old backup: ${file.name}`);
    }
  }
}
```

**What gets cleaned:**

- ✅ Migration backups older than 10th most recent
- ❌ Before-empty backups (never auto-deleted)
- ❌ Before-import backups (never auto-deleted)
- ❌ Manual backups (stored outside app directory)

---

### Backup Retention by Type

| Backup Type           | Auto-Cleanup | Retention Policy     |
| --------------------- | ------------ | -------------------- |
| Migration backups     | ✅ Yes       | Keep last 10         |
| Before-empty backups  | ❌ No        | Manual deletion only |
| Before-import backups | ❌ No        | Manual deletion only |
| Manual backups        | ❌ No        | User manages         |

---

### Manual Cleanup

**Safe to delete:**

```bash
# Migration backups (except most recent 2-3)
rm data/backups/auraswift-backup-v*-old-timestamp.db

# Old before-empty backups (after verifying data)
rm data/pos_system-backup-before-empty-old-date.db

# Old before-import backups (after verifying imported data)
rm data/pos_system-backup-before-import-old-date.db
```

**Keep forever:**

- Most recent 2-3 migration backups
- Before-empty backup from the last empty operation
- Before-import backup from the last import operation

---

## Recovery Procedures

### Scenario 1: Migration Failed

**Problem:** App won't start after update, database corrupted

**Solution:**

```bash
# 1. Find most recent migration backup
ls -lt data/backups/

# 2. Stop app if running

# 3. Restore backup
cp data/backups/auraswift-backup-v1-2025-11-06T12-06-18-444Z.db data/pos_system.db

# 4. Restart app (migrations will retry)
```

**Via Import UI:**

1. Open app (may show errors)
2. Settings → Database → Import Database
3. Select backup file from `data/backups/`
4. App restarts with restored database

---

### Scenario 2: Accidentally Emptied Database

**Problem:** Clicked "Empty Database" by mistake

**Solution:**

```bash
# 1. Find the before-empty backup
ls -lt data/pos_system-backup-before-empty-*.db

# 2. Stop app

# 3. Restore backup
cp data/pos_system-backup-before-empty-2025-11-06-23-29-37.db data/pos_system.db

# 4. Restart app
```

**⚡ Quick recovery:** This is why before-empty backups are critical!

---

### Scenario 3: Imported Wrong Database

**Problem:** Imported a test database instead of production

**Solution:**

```bash
# 1. Find the before-import backup
ls -lt data/pos_system-backup-before-import-*.db

# 2. Use Import Database feature
Settings → Database → Import Database → Select before-import backup

# 3. App restarts with previous database
```

---

### Scenario 4: Database Corruption

**Problem:** App crashes, SQLite errors, data inconsistency

**Solution - Try each step until resolved:**

**Step 1: Restart app**

```bash
# Sometimes resolves temporary locks
```

**Step 2: Check integrity**

```bash
sqlite3 data/pos_system.db "PRAGMA integrity_check;"
```

**Step 3: Restore from most recent backup**

```bash
# Migration backup (most recent version)
cp data/backups/auraswift-backup-v2-latest.db data/pos_system.db

# Or before-empty backup (if more recent)
cp data/pos_system-backup-before-empty-latest.db data/pos_system.db
```

**Step 4: Contact support**

```
If all backups are corrupted, reach out with:
- Error messages
- Console logs
- Database file (for inspection)
```

---

## Safety Features

### 1. Pre-Operation Backups

✅ **Always created before:**

- Schema migrations
- Database empty operations
- Database import operations

❌ **Never created for:**

- Normal CRUD operations (too frequent)
- Single record deletions
- Data updates

---

### 2. Transaction Safety

All migrations run in transactions:

```typescript
db.exec("BEGIN TRANSACTION;");
try {
  // Run migration
  db.exec("ALTER TABLE...");
  db.exec("COMMIT;");
} catch (error) {
  db.exec("ROLLBACK;");
  throw error;
}
```

If migration fails:

- Changes are rolled back
- Backup remains untouched
- Database returns to previous state

---

### 3. Integrity Verification

Before and after migrations:

```typescript
function verifyIntegrity(db: Database): boolean {
  const result = db.pragma("integrity_check", { simple: true });
  return result === "ok";
}
```

If integrity check fails:

- Migration aborts
- Backup can be restored
- Error logged for debugging

---

### 4. Backup Verification

After creating backup:

```typescript
// Verify backup was created
const stats = await fs.stat(backupPath);
if (stats.size === 0) {
  throw new Error("Backup file is empty!");
}
```

---

### 5. Connection Management

Before file operations:

```typescript
// Close database connection
closeDatabase();

// Wait for file handles to release
await new Promise((resolve) => setTimeout(resolve, 500));

// Now safe to replace file
await fs.copyFile(importPath, dbPath);
```

Prevents file locking issues on Windows.

---

## Use Cases & Scenarios

### Use Case 1: Testing New Features

**Scenario:** You want to test how new discount features work without risking real data.

**Workflow:**

1. **Create manual backup**

   - Settings → Backup Database
   - Save to `~/Desktop/production-backup.db`

2. **Test features**

   - Add test products
   - Apply discounts
   - Complete test transactions

3. **Restore original data**
   - Settings → Import Database
   - Select `production-backup.db`
   - App restarts with original data

**Result:** Safe testing without data loss.

---

### Use Case 2: Upgrading Application

**Scenario:** New version of AuraSwift is released with database changes.

**Automatic workflow:**

1. User installs new version
2. App launches and detects schema version mismatch
3. **Automatic backup created** (`auraswift-backup-v1-timestamp.db`)
4. Migrations run (e.g., add new discount columns)
5. Schema version updated to v2
6. App ready to use

**If migration fails:**

- Backup remains in `data/backups/`
- User can report issue
- Developer can inspect both current DB and backup
- User can restore backup to continue working

**Result:** Zero-downtime upgrades with rollback capability.

---

### Use Case 3: Moving Between Machines

**Scenario:** Moving from old computer to new computer.

**Workflow:**

**On old machine:**

1. Settings → Backup Database
2. Save to USB drive or cloud storage
3. Transfer file to new machine

**On new machine:**

1. Install AuraSwift
2. Launch app (creates empty database)
3. Settings → Import Database
4. Select backup file
5. App restarts with all data

**Result:** Complete data migration.

---

### Use Case 4: Data Entry Error

**Scenario:** Employee emptied database by accident.

**Recovery:**

1. Check `data/` directory
2. Find `pos_system-backup-before-empty-{today}.db`
3. Settings → Import Database
4. Select the before-empty backup
5. All data restored

**Time to recover:** < 2 minutes

**Result:** No data loss, minimal downtime.

---

### Use Case 5: Regular Backups

**Scenario:** You want daily backups for peace of mind.

**Workflow:**

1. **Daily:** Create manual backup

   - Settings → Backup Database
   - Save to `~/Backups/AuraSwift/backup-{date}.db`

2. **Weekly:** Copy backup to external drive

3. **Monthly:** Archive to cloud storage

**Automation option (advanced):**

```bash
#!/bin/bash
# Daily backup script (macOS/Linux)
DATE=$(date +%Y-%m-%d)
cp ~/Library/Application\ Support/AuraSwift/pos_system.db \
   ~/Backups/AuraSwift/daily-backup-$DATE.db
```

**Result:** Multiple layers of backup protection.

---

### Use Case 6: Debugging Issues

**Scenario:** Customer reports data inconsistency, developer needs to investigate.

**Workflow:**

1. Customer creates manual backup
2. Customer sends backup file to developer
3. Developer imports backup locally
4. Developer inspects data, runs queries, reproduces issue
5. Developer creates fix
6. Customer updates app

**Result:** Debug without accessing production system.

---

## What Happens If You Delete Backups?

### Deleting Migration Backups

**Impact:**

- ❌ **Cannot rollback** failed migrations
- ❌ **Lost version history** of database structure
- ✅ Database continues to work normally
- ✅ New backups created on next migration

**Risk level:** 🟡 Medium

**When safe to delete:**

- After confirming migrations worked correctly
- When keeping last 2-3 backups
- When running out of disk space

**When NOT to delete:**

- Right after an app update
- If experiencing any database issues
- Before testing new features

---

### Deleting Before-Empty Backups

**Impact:**

- ❌ **Cannot recover** from accidental empty
- ✅ Database continues to work normally
- ✅ New backup created on next empty operation

**Risk level:** 🔴 High (if deleted immediately after empty)

**When safe to delete:**

- After verifying empty was intentional
- After weeks/months of normal operation
- When database has new data that you want to keep

**When NOT to delete:**

- Immediately after emptying database
- Before verifying all data is truly unneeded
- If there's any doubt about the empty operation

---

### Deleting Before-Import Backups

**Impact:**

- ❌ **Cannot restore** previous database state
- ❌ **Lost pre-import data** permanently
- ✅ Database continues to work normally
- ✅ New backup created on next import

**Risk level:** 🔴 High (if deleted immediately after import)

**When safe to delete:**

- After verifying imported data is correct
- After weeks/months of using imported database
- When certain you don't need previous state

**When NOT to delete:**

- Immediately after importing
- Before verifying all imported data
- If imported database might be wrong

---

### Deleting All Backups

**Impact:**

- ❌ **No recovery options** if something goes wrong
- ❌ **No version history** for troubleshooting
- ❌ **No rollback capability** for migrations
- ✅ Database continues to work (for now)
- 🔴 **Very risky** - one corruption = complete data loss

**Risk level:** 🔴 Critical

**Never delete all backups unless:**

- Creating new manual backup first
- Archiving to external storage
- Absolutely certain you'll never need them

---

### Disk Space Considerations

**Backup size:** Typically same as main database

**Example:**

- Main database: 380 KB
- Each backup: 380 KB
- 10 backups: 3.8 MB total

**Typical sizes:**

- Small business (< 1000 transactions): 100 KB - 1 MB
- Medium business (< 10000 transactions): 1 MB - 10 MB
- Large business (< 100000 transactions): 10 MB - 100 MB

**Disk space impact:** Minimal (backups are tiny compared to modern drives)

**When to clean up:**

- Backups > 6 months old
- Disk space < 1 GB
- After major database cleanup

---

## Best Practices

### 1. Keep Recent Backups

✅ **DO:**

- Keep last 2-3 migration backups
- Keep before-empty backup until verified
- Keep before-import backup for 1 week

❌ **DON'T:**

- Delete backups immediately after operations
- Delete all backups to "save space"
- Keep backups from years ago (unless archiving)

---

### 2. Regular Manual Backups

✅ **DO:**

- Create manual backup before major operations
- Backup weekly if high transaction volume
- Store backups in multiple locations

❌ **DON'T:**

- Rely only on automatic backups
- Store backups only on same computer
- Forget to verify backup files exist

---

### 3. Test Recovery Procedures

✅ **DO:**

- Test importing a backup once
- Verify backup file opens in SQLite
- Document your backup locations

❌ **DON'T:**

- Assume backups work without testing
- Wait until emergency to learn recovery
- Ignore backup error messages

---

### 4. Backup Before Risky Operations

✅ **DO:**

- Manual backup before testing new features
- Manual backup before importing data
- Manual backup before major data cleanup

❌ **DON'T:**

- Test destructive operations without backup
- Trust automatic backups for everything
- Skip backups "just this once"

---

### 5. Monitor Backup Health

✅ **DO:**

- Check backup directory occasionally
- Verify backups are recent
- Ensure backups are not zero-byte files

❌ **DON'T:**

- Ignore backup warnings
- Let backup directory grow indefinitely
- Delete backups without checking contents

---

## Troubleshooting

### Issue: No Backups in Directory

**Symptoms:**

- `data/backups/` folder is empty
- No recent migration backups

**Possible causes:**

1. No migrations have run yet (fresh install)
2. Backups were manually deleted
3. App hasn't been updated since backup system added

**Solutions:**

1. Create manual backup immediately
2. Check if `data/backups/` folder exists
3. Update to latest version (triggers migration)

---

### Issue: Backup Failed

**Symptoms:**

- Error message: "Failed to create backup"
- Migration aborted

**Possible causes:**

1. Disk full
2. Permission denied
3. File system error

**Solutions:**

```bash
# Check disk space
df -h

# Check permissions
ls -la data/

# Create backups directory manually
mkdir -p data/backups
chmod 755 data/backups

# Retry operation
```

---

### Issue: Cannot Import Backup

**Symptoms:**

- Error: "Failed to import database"
- App crashes after import

**Possible causes:**

1. Backup file corrupted
2. Wrong database format
3. File locked by another process

**Solutions:**

```bash
# Verify backup integrity
sqlite3 backup.db "PRAGMA integrity_check;"

# Check file size (should not be 0)
ls -lh backup.db

# Ensure app is closed before import

# Try importing different backup
```

---

### Issue: Backup File is Huge

**Symptoms:**

- Backup file is gigabytes
- Takes long time to create

**Possible causes:**

1. Large transaction history
2. Many products/categories
3. Attached files in database (if any)

**Solutions:**

```bash
# Check database size
ls -lh data/pos_system.db

# Vacuum database to reclaim space
sqlite3 data/pos_system.db "VACUUM;"

# Consider archiving old transactions
# (implement data retention policy)
```

---

### Issue: Old Backups Not Cleaned

**Symptoms:**

- More than 10 migration backups
- Backup directory growing

**Possible causes:**

1. Cleanup code not running
2. File permissions prevent deletion
3. Backup files renamed (not matching pattern)

**Solutions:**

```bash
# Manual cleanup (keep last 10)
cd data/backups
ls -t | tail -n +11 | xargs rm

# Check cleanup logs
# (should see "🗑️ Removed old backup" messages)

# Verify cleanup is running
# (check console output after migrations)
```

---

## API Reference

### IPC Handlers

#### `database:backup`

**Purpose:** Create manual backup via save dialog

**Parameters:** None

**Returns:**

```typescript
{
  success: boolean;
  data?: {
    path: string;      // Where backup was saved
    size: number;      // Backup file size in bytes
    timestamp: string; // ISO timestamp
  };
  message: string;
  cancelled?: boolean; // True if user cancelled
}
```

**Example:**

```typescript
const result = await window.api.invoke("database:backup");
if (result.success) {
  console.log(`Backup saved: ${result.data.path}`);
}
```

---

#### `database:empty`

**Purpose:** Empty all tables (creates automatic backup)

**Parameters:** None

**Returns:**

```typescript
{
  success: boolean;
  data?: {
    backupPath: string;        // Automatic backup location
    backupSize: number;        // Backup size in bytes
    tablesEmptied: number;     // Number of tables emptied
    totalRowsDeleted: number;  // Total rows deleted
    tableList: string[];       // List of table names
  };
  message: string;
}
```

**Example:**

```typescript
const result = await window.api.invoke("database:empty");
if (result.success) {
  console.log(`Backup at: ${result.data.backupPath}`);
  console.log(`Deleted ${result.data.totalRowsDeleted} rows`);
}
```

---

#### `database:import`

**Purpose:** Import database from file (creates automatic backup)

**Parameters:** None

**Returns:**

```typescript
{
  success: boolean;
  data?: {
    importedFrom: string;      // Source file path
    importSize: number;        // Imported file size
    backupPath?: string;       // Backup of previous DB
    newSize: number;           // New database size
  };
  message: string;
  cancelled?: boolean;
}
```

**Example:**

```typescript
const result = await window.api.invoke("database:import");
if (result.success) {
  console.log(`Imported from: ${result.data.importedFrom}`);
  console.log(`Previous DB backed up to: ${result.data.backupPath}`);
  // App will restart automatically
}
```

---

### Internal Functions

#### `createBackup(dbPath, currentVersion)`

**Location:** `packages/main/src/database/versioning/index.ts`

**Purpose:** Create migration backup

**Parameters:**

- `dbPath: string` - Path to database file
- `currentVersion: number` - Current schema version

**Returns:** `string` - Path to created backup

**Example:**

```typescript
const backupPath = createBackup("/path/to/db.db", 1);
// Returns: '/path/to/backups/auraswift-backup-v1-2025-11-06T12-06-18-444Z.db'
```

---

#### `cleanupOldBackups(backupDir)`

**Location:** `packages/main/src/database/versioning/index.ts`

**Purpose:** Keep only last 10 backups

**Parameters:**

- `backupDir: string` - Path to backups directory

**Returns:** `void`

**Side effects:** Deletes backup files older than 10th most recent

---

#### `db.getDatabaseInfo()`

**Location:** `packages/main/src/database.ts`

**Purpose:** Get database metadata

**Returns:**

```typescript
{
  path: string;                      // Full path to database file
  mode: "development" | "production"; // Current mode
  exists: boolean;                   // Whether file exists
  size?: number;                     // File size in bytes
}
```

**Example:**

```typescript
const db = await getDatabase();
const info = db.getDatabaseInfo();
console.log(`Database: ${info.path} (${info.size} bytes)`);
```

---

## Summary

### Key Takeaways

1. **Multiple backup types** protect against different failure scenarios
2. **Automatic backups** created before risky operations
3. **Migration backups** enable rollback after updates
4. **Before-operation backups** provide safety nets for destructive actions
5. **Manual backups** give users full control
6. **Retention policy** prevents disk space issues (10 migration backups)
7. **Recovery is simple** via Import Database feature

### Backup Strategy

```
Daily Operations
  └─ Automatic backups handle safety

Weekly
  └─ Create manual backup to external location

Monthly
  └─ Archive backups to cloud storage

After Major Updates
  └─ Verify automatic backup was created
  └─ Test app functionality before deleting old backups

Before Risky Operations
  └─ Create manual backup
  └─ Verify backup file exists
  └─ Proceed with operation
```

### When in Doubt

🛡️ **Create a manual backup before:**

- Testing new features
- Importing data
- Major database operations
- Upgrading to new version (in addition to automatic)

💾 **Always keep:**

- Last 2-3 migration backups
- Before-empty backup (until verified)
- Before-import backup (for 1 week)
- Monthly archive backup

🚨 **Never delete:**

- All backups at once
- Backups immediately after risky operations
- The only backup you have

---

## Related Documentation

- [Database Architecture](./01_DATABASE_ARCHITECTURE.md) - System overview
- [Migration System Guide](./03_MIGRATION_SYSTEM_GUIDE.md) - How migrations work
- [Auto-Update Integration](./05_AUTO_UPDATE_INTEGRATION.md) - Updates and migrations
- [INDEX](./INDEX.md) - Complete documentation index

---

**Last Updated:** November 8, 2025  
**Version:** 1.0

---

[← Back to INDEX](./INDEX.md)
