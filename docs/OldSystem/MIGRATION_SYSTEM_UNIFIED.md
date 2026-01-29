# AuraSwift Migration System - Unified Approach

## ⚠️ CRITICAL: Only One Migration System

**AuraSwift now uses a SINGLE migration tracking system:**

- ✅ **PRAGMA user_version** (SQLite's built-in versioning)
- ❌ **NO schema_version table** (old system removed)
- ❌ **NO SCHEMA_VERSION constant** (old system removed)

## Overview

The migration system tracks database schema changes and applies them automatically on app startup.

### Version 0: The Baseline

**Version 0 represents the baseline schema:**

- All tables created by `initializeTables()` in `db-manager.ts`
- Includes ALL historical changes:
  - Business fields (address, phone, vatNumber)
  - Discount fields (discountAmount, appliedDiscounts)
  - All core tables, indexes, and constraints
- New databases start at version 0
- No migrations to apply until version 1+

### Version 1+: Future Migrations

**Future schema changes start from version 1:**

- Defined in `packages/main/src/database/versioning/migrations.ts`
- Applied automatically on app startup
- Backed up before each migration
- Tracked via PRAGMA user_version

---

## Architecture

```
Initialization Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. DBManager.initialize()                                   │
│    - Connect to SQLite database                             │
│    - Create data directory if needed                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. DBManager.initializeTables()                             │
│    - CREATE TABLE IF NOT EXISTS for all tables              │
│    - Establishes baseline schema (version 0)                │
│    - Safe for both new and existing databases               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. initializeVersioning(db, dbPath)                         │
│    - Check current version: PRAGMA user_version             │
│    - Load pending migrations from migrations.ts             │
│    - Apply migrations in order                              │
│    - Update PRAGMA user_version after each migration        │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
packages/main/src/database/
├── db-manager.ts                    # Database initialization
│   ├── initialize()                 # Main entry point
│   └── initializeTables()          # Baseline schema (v0)
│
├── versioning/
│   ├── index.ts                    # Migration engine
│   │   ├── getCurrentVersion()     # Read PRAGMA user_version
│   │   ├── setDatabaseVersion()   # Write PRAGMA user_version
│   │   ├── runMigrations()        # Apply pending migrations
│   │   ├── createBackup()         # Backup before migrations
│   │   └── verifyIntegrity()      # Check database health
│   │
│   └── migrations.ts               # Migration definitions
│       ├── MIGRATIONS[]            # Array of all migrations
│       ├── getLatestVersion()      # Get highest version number
│       └── getPendingMigrations()  # Filter unapplied migrations
│
└── database.ts                     # High-level database manager
    └── DatabaseManager class       # Domain-specific operations
```

---

## How Versioning Works

### PRAGMA user_version

SQLite has a built-in integer for versioning:

```sql
-- Read current version
PRAGMA user_version;  -- Returns: 0 (new db), 1, 2, 3... (migrated db)

-- Set version
PRAGMA user_version = 1;
```

**Benefits:**

- Built into SQLite (no extra table needed)
- Atomic with transactions
- Single source of truth
- Fast to read/write

### Version States

| Version | State    | Description                                             |
| ------- | -------- | ------------------------------------------------------- |
| 0       | Baseline | Fresh install, all tables created by initializeTables() |
| 1       | Migrated | First migration applied (if any exist)                  |
| 2       | Migrated | Second migration applied                                |
| N       | Migrated | Nth migration applied                                   |

---

## Creating a Migration

### Step 1: Define the Migration

Edit `packages/main/src/database/versioning/migrations.ts`:

```typescript
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "add_user_preferences",
    description: "Add preferences field to users table",
    up: (db: Database) => {
      db.exec(`
        ALTER TABLE users 
        ADD COLUMN preferences TEXT DEFAULT '{}';
      `);
    },
  },

  {
    version: 2,
    name: "add_product_tags",
    description: "Add tags field to products table for categorization",
    up: (db: Database) => {
      db.exec(`
        ALTER TABLE products 
        ADD COLUMN tags TEXT DEFAULT '[]';
        
        CREATE INDEX IF NOT EXISTS idx_products_tags 
        ON products(tags);
      `);
    },
  },

  // Add more migrations here...
];
```

### Step 2: Test Locally

1. **With Existing Database:**

   ```bash
   npm run dev
   ```

   - Migration runs automatically on startup
   - Check console for migration logs
   - Backup created in `data/backups/`

2. **With Fresh Database:**

   ```bash
   # Delete existing database
   rm data/pos_system.db

   # Start app - baseline schema created (v0)
   npm run dev

   # Your migrations will run automatically
   ```

### Step 3: Verify Migration

```typescript
// Check logs for:
// ✅ Migration v1: add_user_preferences
//    Add preferences field to users table
//    ✅ Migration v1 completed successfully

// ✅ Database updated from v0 to v1
```

---

## Migration Guidelines

### ✅ DO

1. **Sequential Versioning**

   ```typescript
   // Good: 1, 2, 3, 4...
   MIGRATIONS = [
     { version: 1, ... },
     { version: 2, ... },
     { version: 3, ... },
   ];
   ```

2. **Make Migrations Idempotent**

   ```typescript
   // Safe to run multiple times
   up: (db) => {
     db.exec(`
       ALTER TABLE users 
       ADD COLUMN IF NOT EXISTS newField TEXT;
     `);
   };
   ```

3. **Use Descriptive Names**

   ```typescript
   {
     version: 1,
     name: "add_product_weight_support",  // Clear and specific
     description: "Add requiresWeight, unit, and pricePerUnit fields",
   }
   ```

4. **Test Both Paths**
   - Fresh install (baseline only)
   - Existing database (with migrations)

### ❌ DON'T

1. **Never Modify Existing Migrations**

   ```typescript
   // Bad: Changing version 1 after it's released
   MIGRATIONS = [
     { version: 1, ... }, // Already applied to production!
   ];

   // Good: Add a new migration
   MIGRATIONS = [
     { version: 1, ... }, // Keep unchanged
     { version: 2, ... }, // New migration
   ];
   ```

2. **Don't Skip Version Numbers**

   ```typescript
   // Bad: Gap in versions
   MIGRATIONS = [
     { version: 1, ... },
     { version: 3, ... }, // Skipped 2!
   ];
   ```

3. **Don't Use CREATE TABLE for Existing Tables**

   ```typescript
   // Bad: Table already exists in baseline
   up: (db) => {
     db.exec(`CREATE TABLE users (...)`); // Will fail!
   };

   // Good: Only modify structure
   up: (db) => {
     db.exec(`ALTER TABLE users ADD COLUMN ...`);
   };
   ```

4. **Don't Forget the Baseline**
   ```typescript
   // Remember: Version 0 already has these tables:
   // - users, businesses, products, transactions
   // - categories, shifts, schedules, sessions
   // - modifiers, stock_adjustments, etc.
   ```

---

## Migration API Reference

### getCurrentVersion(db)

Get the current database version.

```typescript
import { getCurrentVersion } from "./versioning/index.js";

const version = getCurrentVersion(db);
// Returns: 0 (baseline), 1, 2, 3... (after migrations)
```

### setDatabaseVersion(db, version)

Set the database version (internal use).

```typescript
import { setDatabaseVersion } from "./versioning/index.js";

setDatabaseVersion(db, 1);
// Sets PRAGMA user_version = 1
```

### runMigrations(db, dbPath)

Run all pending migrations.

```typescript
import { runMigrations } from "./versioning/index.js";

const success = runMigrations(db, dbPath);
// Returns: true if all migrations succeeded, false otherwise
// Creates backups automatically
// Updates version after each migration
```

### initializeVersioning(db, dbPath)

Initialize versioning system (main entry point).

```typescript
import { initializeVersioning } from "./versioning/index.js";

const success = initializeVersioning(db, dbPath);
// Returns: true if initialization succeeded
// Called automatically by DBManager.initialize()
```

### getLatestVersion()

Get the highest migration version defined.

```typescript
import { getLatestVersion } from "./versioning/index.js";

const latest = getLatestVersion();
// Returns: 0 if no migrations, otherwise highest version number
```

### getPendingMigrations(currentVersion)

Get migrations that haven't been applied yet.

```typescript
import { getPendingMigrations } from "./versioning/index.js";

const pending = getPendingMigrations(0);
// Returns: All migrations with version > 0
```

---

## Troubleshooting

### Migration Fails

**Symptoms:**

```
❌ Migration v1 FAILED: Error: ...
   Database is still at version 0
   Backup available at the backup directory
```

**Solutions:**

1. Check the error message for details
2. Restore from backup: `data/backups/auraswift-backup-v0-*.db`
3. Fix the migration SQL
4. Test locally before deploying

### Version Mismatch

**Symptoms:**

```
❌ Database version (v3) is ahead of code version (v2)
```

**Solution:**
User has newer version of app. They need to update:

```typescript
// This is handled automatically by the system
// User will see error dialog prompting them to update
```

### Integrity Check Failed

**Symptoms:**

```
❌ Database integrity check failed: ...
   Aborting migrations for safety.
```

**Solution:**
Database is corrupted. Restore from backup or recreate.

---

## Production Deployment

### Before Release

1. **Test Migrations Thoroughly**

   ```bash
   # Test with fresh database
   rm data/pos_system.db && npm run dev

   # Test with old database (copy from production)
   cp production.db data/pos_system.db && npm run dev
   ```

2. **Verify Backups Work**

   - Check `data/backups/` directory
   - Test restoring from backup
   - Verify backup cleanup (keeps last 10)

3. **Review Migration Code**
   - All migrations are idempotent
   - No breaking changes
   - Proper error handling

### During Release

1. **Users Update App**

   - App starts
   - Migrations run automatically
   - Backup created before migrations
   - Version updated after success

2. **Monitor for Issues**
   - Check user logs for migration errors
   - Have rollback plan (restore from backup)

### Rolling Back

If a migration causes issues:

1. **User-Level:**

   ```
   1. Close app
   2. Navigate to data/backups/
   3. Copy backup file to data/pos_system.db
   4. Open app
   ```

2. **Developer-Level:**
   - Release hotfix that skips problematic migration
   - Or release fix for the migration issue
   - Never modify existing migration - add new one

---

## Example: Complete Migration Lifecycle

### Scenario: Add Email Preferences

**1. Define Migration:**

```typescript
// packages/main/src/database/versioning/migrations.ts
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "add_email_preferences",
    description: "Add email notification preferences to users",
    up: (db: Database) => {
      db.exec(`
        ALTER TABLE users 
        ADD COLUMN emailNotifications TEXT DEFAULT '{"enabled":true}';
      `);
    },
  },
];
```

**2. Test Locally:**

```bash
# Fresh database
rm data/pos_system.db
npm run dev

# Logs:
# 🗄️  Initializing Database Versioning System...
# 🔍 Database Version Check:
#    Current: v0
#    Latest:  v1
#
# 🚀 Running 1 migration(s)...
# 📦 Backup created: auraswift-backup-v0-2025-11-10...
#
# 📝 Migration v1: add_email_preferences
#    Add email notification preferences to users
#    ✅ Migration v1 completed successfully
#
# ✅ All 1 migration(s) completed successfully!
#    Database updated from v0 to v1
```

**3. Deploy to Users:**

```bash
npm run build
npm run release
```

**4. User Experience:**

- User updates app
- App starts normally
- Migration runs automatically (< 1 second)
- User continues working
- Backup saved in case of issues

---

## Summary

✅ **Unified System:**

- Single versioning method: PRAGMA user_version
- No conflicting systems
- Clear migration path

✅ **Version 0 = Baseline:**

- All tables created by initializeTables()
- Historical changes already included
- New databases start here

✅ **Version 1+ = Future:**

- Defined in migrations.ts
- Applied automatically
- Backed up before changes

✅ **Safe & Reliable:**

- Idempotent migrations
- Automatic backups
- Integrity checks
- Clear error messages

---

## Quick Reference

| Task            | File            | Function                  |
| --------------- | --------------- | ------------------------- |
| Add migration   | `migrations.ts` | Add to `MIGRATIONS[]`     |
| Check version   | `index.ts`      | `getCurrentVersion(db)`   |
| Run migrations  | `index.ts`      | `runMigrations(db, path)` |
| Baseline schema | `db-manager.ts` | `initializeTables()`      |
| Initialize      | `db-manager.ts` | `initialize()`            |

---

**For more information:**

- See `packages/main/src/database/versioning/migrations.ts` for migration structure
- See `packages/main/src/database/versioning/index.ts` for migration engine
- See `packages/main/src/database/db-manager.ts` for initialization flow
