# Database Migration & Auto-Update System

> **Last Updated:** January 24, 2026  
> **Applies to:** AurSwift Desktop EPOS Application

This document explains how database migrations are handled during auto-updates and the complete lifecycle from code change to client deployment.

---

## Table of Contents

1. [Overview](#overview)
2. [Release Workflow](#release-workflow)
3. [Auto-Update Flow on Client](#auto-update-flow-on-client)
4. [Database Migration System](#database-migration-system)
5. [Migration Safety Features](#migration-safety-features)
6. [Recovery Scenarios & UI Dialogs](#recovery-scenarios--ui-dialogs)
7. [Developer Guide](#developer-guide)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The AurSwift desktop app uses:

- **Electron Auto-Updater** for application updates
- **Drizzle ORM** with SQLite for database management
- **Automatic migrations** that run on app startup after updates

### Key Principles

1. **Data Safety First**: User data is never lost - backups are created before any destructive operation
2. **Atomic Migrations**: All migrations run in transactions with automatic rollback on failure
3. **Graceful Degradation**: Clear UI dialogs guide users through recovery scenarios
4. **Offline Support**: Migrations work entirely offline

---

## Release Workflow

### 1. Developer Makes Changes

```
┌─────────────────────────────────────────────────────────────┐
│  Developer Workflow                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Make code changes (features, fixes, DB schema)          │
│     └── packages/main/src/database/schema.ts (if DB change) │
│     └── packages/renderer/src/... (UI changes)              │
│     └── packages/main/src/... (backend changes)             │
│                                                              │
│  2. If schema changed, generate migration:                   │
│     $ npm run db:generate                                    │
│     └── Creates: migrations/0001_xxx.sql                     │
│     └── Creates: migrations/meta/0001_snapshot.json          │
│                                                              │
│  3. Test locally                                             │
│     $ npm run dev                                            │
│                                                              │
│  4. Commit with conventional commit message:                 │
│     $ git commit -m "feat: add table management feature"     │
│     $ git commit -m "fix: resolve payment calculation bug"   │
│                                                              │
│  5. Push to main branch                                      │
│     $ git push origin main                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. CI/CD Pipeline (GitHub Actions)

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions Workflow                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  On push to main with feat/fix commits:                     │
│                                                              │
│  1. semantic-release analyzes commits                        │
│     └── feat: → minor version bump (1.0.0 → 1.1.0)          │
│     └── fix:  → patch version bump (1.0.0 → 1.0.1)          │
│     └── feat!: or BREAKING CHANGE → major (1.0.0 → 2.0.0)   │
│                                                              │
│  2. Build application for all platforms                      │
│     └── Windows: NSIS installer + Squirrel                  │
│     └── macOS: DMG + ZIP (x64 + arm64)                      │
│     └── Linux: DEB                                          │
│                                                              │
│  3. Bundle migrations into release                           │
│     └── extraResources: migrations/ folder                   │
│     └── Copied to: resources/migrations/ in packaged app    │
│                                                              │
│  4. Create GitHub Release                                    │
│     └── Upload installers                                    │
│     └── Generate latest.yml (for auto-updater)              │
│     └── Create release notes from commits                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. Release Artifacts

```
dist/
├── aurswift-1.5.0-win-x64.exe      # NSIS installer
├── aurswift-1.5.0-win-x64.nupkg    # Squirrel delta update
├── aurswift-1.5.0-mac-x64.dmg      # macOS Intel
├── aurswift-1.5.0-mac-arm64.dmg    # macOS Apple Silicon
├── aurswift-1.5.0-linux-x64.deb    # Linux Debian
├── latest.yml                       # Windows update manifest
├── latest-mac.yml                   # macOS update manifest
└── latest-linux.yml                 # Linux update manifest
```

---

## Auto-Update Flow on Client

### Timeline of Events

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT MACHINE - Update Flow                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │ App Running  │ (v1.4.0)                                  │
│  │ Version 1.4.0│                                           │
│  └──────┬───────┘                                           │
│         │                                                    │
│         │ Every 4 hours (or on app start)                   │
│         ▼                                                    │
│  ┌──────────────────┐                                       │
│  │ Check for Update │                                       │
│  │ GET latest.yml   │                                       │
│  └──────┬───────────┘                                       │
│         │                                                    │
│         │ New version found: 1.5.0                          │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │           UPDATE AVAILABLE                     │           │
│  │  ┌────────────────────────────────────────┐   │           │
│  │  │  A new version is available!            │   │           │
│  │  │                                         │   │           │
│  │  │  Current: 1.4.0                         │   │           │
│  │  │  New:     1.5.0                         │   │           │
│  │  │                                         │   │           │
│  │  │  What's New:                            │   │           │
│  │  │  • Added table management feature       │   │           │
│  │  │  • Fixed payment calculation bug        │   │           │
│  │  │                                         │   │           │
│  │  │  ┌──────────────┐  ┌─────────────────┐  │   │           │
│  │  │  │ Update Now   │  │ Remind Later    │  │   │           │
│  │  │  └──────────────┘  └─────────────────┘  │   │           │
│  │  └────────────────────────────────────────┘   │           │
│  └──────────────────────────────────────────────┘           │
│         │                                                    │
│         │ User clicks "Update Now"                          │
│         ▼                                                    │
│  ┌──────────────────┐                                       │
│  │ Download Update  │                                       │
│  │ (background)     │ ████████████░░░░ 75%                  │
│  └──────┬───────────┘                                       │
│         │                                                    │
│         │ Download complete                                  │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │           RESTART TO UPDATE                    │           │
│  │  ┌────────────────────────────────────────┐   │           │
│  │  │  Update downloaded and ready to install │   │           │
│  │  │                                         │   │           │
│  │  │  ┌──────────────────┐  ┌────────────┐   │   │           │
│  │  │  │ Restart & Update │  │   Later    │   │   │           │
│  │  │  └──────────────────┘  └────────────┘   │   │           │
│  │  └────────────────────────────────────────┘   │           │
│  └──────────────────────────────────────────────┘           │
│         │                                                    │
│         │ User clicks "Restart & Update"                    │
│         ▼                                                    │
│  ┌──────────────────┐                                       │
│  │ App Quits        │                                       │
│  │ Installer Runs   │                                       │
│  │ Files Replaced   │                                       │
│  └──────┬───────────┘                                       │
│         │                                                    │
│         │ App restarts automatically                        │
│         ▼                                                    │
│  ┌──────────────────┐                                       │
│  │ App Starts v1.5.0│ ◄── NEW VERSION                       │
│  └──────┬───────────┘                                       │
│         │                                                    │
│         │ Initialization begins                             │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │ DATABASE INITIALIZATION                        │           │
│  │                                                │           │
│  │ 1. Check DB compatibility                     │           │
│  │ 2. Check disk space (2.5x DB size required)   │           │
│  │ 3. Create backup                              │           │
│  │ 4. Run pending migrations                     │           │
│  │ 5. Verify integrity                           │           │
│  │                                                │           │
│  └──────────────────────────────────────────────┘           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────┐                                       │
│  │ App Ready ✅      │                                       │
│  │ All features      │                                       │
│  │ available         │                                       │
│  └──────────────────┘                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Migration System

### Architecture

```
packages/main/src/database/
├── schema.ts                  # Drizzle schema definitions
├── db-manager.ts              # Database lifecycle management
├── drizzle-migrator.ts        # Migration execution engine
├── migrations/
│   ├── 0000_cool_mysterio.sql # Initial migration (all tables)
│   ├── 0001_xxx.sql           # Incremental migration
│   └── meta/
│       ├── _journal.json      # Migration tracking
│       └── 0000_snapshot.json # Schema snapshots
└── utils/
    ├── db-compatibility.ts    # Version compatibility checks
    ├── db-validator.ts        # Integrity validation
    ├── db-repair.ts           # Repair mechanisms
    ├── db-recovery-dialog.ts  # User-facing dialogs
    └── backup-cleanup.ts      # Backup retention
```

### Migration Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│  runDrizzleMigrations() Flow                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 🔍 Check database integrity                              │
│     └── PRAGMA integrity_check                               │
│     └── PRAGMA foreign_key_check                             │
│                                                              │
│  2. 💾 Check disk space                                      │
│     └── Require 2.5x database size                           │
│     └── Minimum 50MB for new databases                       │
│     └── Fail early if insufficient                           │
│                                                              │
│  3. 📋 Check pending migrations                              │
│     └── Compare migrations/ folder with __drizzle_migrations │
│     └── Log count of pending migrations                      │
│                                                              │
│  4. 📦 Create backup (if needed)                             │
│     └── WAL checkpoint first                                 │
│     └── Copy to backups/aurswift-backup-YYYYMMDD-HHMMSS.db  │
│     └── Verify backup size matches source                    │
│                                                              │
│  5. ⚙️  Apply migrations                                      │
│     └── Drizzle's migrate() handles:                         │
│         - Reading SQL files                                  │
│         - Executing in order                                 │
│         - Transaction per migration                          │
│         - Recording in __drizzle_migrations                  │
│                                                              │
│  6. 🔍 Verify integrity after migration                      │
│     └── PRAGMA integrity_check                               │
│     └── PRAGMA foreign_key_check                             │
│                                                              │
│  7. ✅ Success OR 🔄 Rollback from backup                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### How Drizzle Tracks Migrations

```sql
-- __drizzle_migrations table (created automatically)
SELECT * FROM __drizzle_migrations;

┌────┬──────────────────────────────────────────────────────────────────┬───────────────┐
│ id │ hash                                                             │ created_at    │
├────┼──────────────────────────────────────────────────────────────────┼───────────────┤
│ 1  │ 414f56698705ba1df00af5f9fa04b10fd88b5f557f66b1ff500efd6ce3d9320b │ 1769262701893 │
│ 2  │ a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2 │ 1769348800000 │
└────┴──────────────────────────────────────────────────────────────────┴───────────────┘

-- Hash is SHA-256 of the SQL file content
-- Drizzle compares hashes to determine which migrations to run
```

---

## Migration Safety Features

### 1. Disk Space Check

```typescript
// Prevents migration failure due to full disk
function checkDiskSpace(dbPath: string) {
  const dbSize = statSync(dbPath).size;
  const required = Math.max(50MB, dbSize * 2.5);
  const available = statfsSync(dirname(dbPath)).bfree * bsize;

  if (available < required) {
    throw new Error(`Insufficient disk space: ${available}MB < ${required}MB`);
  }
}
```

### 2. Automatic Backup

```typescript
// Backup created before every migration (in production)
backups/
├── aurswift-backup-20260124-140000.db  # Before migration 0001
├── aurswift-backup-20260125-090000.db  # Before migration 0002
└── ... (keeps last 10 in production)
```

### 3. Rollback on Failure

```typescript
// If migration fails, automatically restore from backup
if (!migrationSuccess) {
  await rollbackMigration(dbPath, backupPath, rawDb);
  // Shows recovery dialog to user
}
```

### 4. Retry Logic

```typescript
// Maximum 3 initialization attempts
if (initializationAttempts > 3) {
  showDatabaseErrorDialog("Database Initialization Failed", ...);
  app.quit();
}
```

---

## Recovery Scenarios & UI Dialogs

### Scenario 1: Database Too Old (No Migration Tracking)

**When:** Client has database from before migration system was implemented.

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Incompatible Database Detected                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Your database cannot be automatically migrated.            │
│                                                              │
│  Your database was created with a very old version of       │
│  aurswift and cannot be automatically migrated to the       │
│  current version.                                           │
│                                                              │
│  We recommend creating a backup of your current database    │
│  and starting fresh. Your old database will be preserved    │
│  and can be manually inspected if needed.                   │
│                                                              │
│  ┌───────────────────────┐   ┌────────────┐                 │
│  │ Backup & Start Fresh  │   │   Cancel   │                 │
│  └───────────────────────┘   └────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**What happens:**

1. Old database renamed to `pos_system.db.old.20260124-140000`
2. Fresh database created with all tables
3. User starts with empty data (can manually import if needed)

---

### Scenario 2: Migration Hash Mismatch

**When:** Fresh migration was regenerated (like we just did), changing the hash.

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Database Migration Failed                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Failed to migrate your database to the current version.    │
│                                                              │
│  The database migration encountered an error. Your database │
│  has been restored to its previous state.                   │
│                                                              │
│  Options:                                                    │
│  • Restore from Backup: Restore from the last successful    │
│    backup and retry                                          │
│  • Backup & Start Fresh: Create a backup and start with     │
│    a fresh database                                          │
│                                                              │
│  Backup location: ~/Library/Application Support/aurswift/   │
│  Backup file: aurswift-backup-20260124-135123.db            │
│                                                              │
│  ┌─────────────────────┐  ┌────────────────────┐            │
│  │ Restore from Backup │  │ Backup & Start Fresh│            │
│  └─────────────────────┘  └────────────────────┘            │
│                    ┌────────────┐                            │
│                    │   Cancel   │                            │
│                    └────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Scenario 3: Database Corruption

**When:** Database file is damaged (power loss, disk error, etc.)

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Database Corruption Detected                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Your database appears to be corrupted.                     │
│                                                              │
│  Automatic repair attempts failed. Your database may have   │
│  been damaged.                                               │
│                                                              │
│  Options:                                                    │
│  • Backup & Start Fresh: Creates a backup and starts with   │
│    a new database (recommended)                              │
│  • Try Repair: Attempts advanced repair techniques          │
│    (may lose some data)                                      │
│                                                              │
│  ┌───────────────────────┐  ┌────────────┐                  │
│  │ Backup & Start Fresh  │  │ Try Repair │                  │
│  └───────────────────────┘  └────────────┘                  │
│                    ┌────────────┐                            │
│                    │   Cancel   │                            │
│                    └────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Scenario 4: Insufficient Disk Space

**When:** Not enough space for backup + migration

```
┌─────────────────────────────────────────────────────────────┐
│  ❌  Database Migration Error                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Insufficient disk space for migration.                     │
│                                                              │
│  Database size: 45.2 MB                                     │
│  Required: 113.0 MB                                          │
│  Available: 52.3 MB                                          │
│                                                              │
│  Please free up disk space before proceeding.               │
│                                                              │
│                    ┌────────────┐                            │
│                    │     OK     │                            │
│                    └────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Developer Guide

### Adding a New Database Column

```bash
# 1. Update schema
vim packages/main/src/database/schema.ts

# Add your column:
export const products = sqliteTable("products", {
  // ... existing columns
  newColumn: text("new_column").default(""),  // NEW
});

# 2. Generate migration
npm run db:generate

# Output:
# [✓] Your SQL migration file ➜ migrations/0001_xxx.sql

# 3. Review generated SQL
cat packages/main/src/database/migrations/0001_xxx.sql
# ALTER TABLE `products` ADD `new_column` text DEFAULT '';

# 4. Test locally
npm run dev

# 5. Commit with proper message
git add .
git commit -m "feat(db): add new_column to products table"
git push origin main
```

### Adding a New Table

```typescript
// schema.ts
export const newTable = sqliteTable("new_table", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  businessId: text("business_id").references(() => businesses.id, {
    onDelete: "cascade",
  }),
  createdAt: integer("created_at").notNull(),
});
```

### Safe Migration Practices

| ✅ Safe Operations        | ❌ Unsafe Operations               |
| ------------------------- | ---------------------------------- |
| `ADD COLUMN` with DEFAULT | `DROP COLUMN` (SQLite < 3.35)      |
| `CREATE TABLE`            | `ALTER COLUMN TYPE`                |
| `CREATE INDEX`            | `ADD COLUMN NOT NULL` (no default) |
| `DROP INDEX`              | `RENAME COLUMN` (SQLite < 3.25)    |

### Testing Migrations

```bash
# Test fresh migration
rm data/pos_system.db
node scripts/run-drizzle-migrations.mjs

# Test with existing data
cp data/pos_system.db data/test-backup.db
npm run dev
# Make changes
# Verify data integrity
```

---

## Troubleshooting

### "Migrations folder not found"

**Cause:** Build didn't include migrations in extraResources.

**Fix:**

1. Check `electron-builder.mjs` has:
   ```javascript
   extraResources: [
     {
       from: 'packages/main/dist/migrations',
       to: 'migrations',
       filter: ['**/*'],
     },
   ],
   ```
2. Rebuild: `npm run build --workspace=@app/main`
3. Verify: `ls packages/main/dist/migrations/`

### "Migration hash mismatch"

**Cause:** Migration file content changed after being applied to client.

**Fix (for development):**

```bash
# Reset local database
rm data/pos_system.db
npm run dev
```

**Fix (for production):**

- User sees recovery dialog
- User selects "Backup & Start Fresh"
- Old data preserved in `.db.old.*` file

### "Database locked"

**Cause:** Another process has the database open.

**Fix:**

1. Close other instances of aurswift
2. Check for orphaned processes: `lsof | grep pos_system.db`
3. Restart machine if needed

### "Foreign key violation"

**Cause:** Migration adds FK constraint that existing data violates.

**Fix:**

1. Migration rolled back automatically
2. Clean up orphaned data in development
3. For production: May need data migration script

---

## File Locations

### Development

```
desktop/
├── data/
│   ├── pos_system.db           # Active database
│   ├── pos_system.db.old.*     # Old backups
│   └── backups/
│       └── aurswift-backup-*.db
└── packages/main/src/database/migrations/
    └── *.sql                    # Migration files
```

### Production (macOS)

```
~/Library/Application Support/aurswift/
├── pos_system.db
├── pos_system.db.old.*
└── backups/
    └── aurswift-backup-*.db
```

### Production (Windows)

```
%LOCALAPPDATA%/aurswift/
├── pos_system.db
├── pos_system.db.old.*
└── backups/
    └── aurswift-backup-*.db
```

---

## Summary

| Stage                | What Happens                     | User Experience     |
| -------------------- | -------------------------------- | ------------------- |
| **Code Push**        | Developer pushes feat/fix commit | N/A                 |
| **CI/CD**            | Build + Release created          | N/A                 |
| **Update Check**     | App polls GitHub releases        | Runs silently       |
| **Update Available** | New version found                | Dialog appears      |
| **Download**         | Update downloaded in background  | Progress shown      |
| **Install**          | App quits, installer runs        | Brief interruption  |
| **App Restart**      | New version starts               | Splash screen       |
| **DB Migration**     | Migrations applied automatically | Invisible (success) |
| **Migration Fail**   | Rollback + recovery dialog       | User chooses action |
| **Ready**            | App fully operational            | Normal usage        |

---

## Related Documentation

- [Electron Builder Config](../electron-builder.mjs)
- [Auto Updater Module](../packages/main/src/modules/AutoUpdater.ts)
- [DB Manager](../packages/main/src/database/db-manager.ts)
- [Drizzle Migrator](../packages/main/src/database/drizzle-migrator.ts)
- [Recovery Dialogs](../packages/main/src/database/utils/db-recovery-dialog.ts)
