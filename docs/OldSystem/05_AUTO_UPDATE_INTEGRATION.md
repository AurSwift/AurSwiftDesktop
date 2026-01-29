# Auto-Update Integration

## Overview

This guide explains how database migrations work seamlessly with Electron's auto-updater, ensuring safe schema evolution when users update to new versions of AuraSwift.

---

## Table of Contents

1. [How Auto-Updates Work](#how-auto-updates-work)
2. [Migration During Updates](#migration-during-updates)
3. [File Replacement vs Data Preservation](#file-replacement-vs-data-preservation)
4. [User Experience](#user-experience)
5. [Safety Guarantees](#safety-guarantees)
6. [Common Update Scenarios](#common-update-scenarios)
7. [Troubleshooting Updates](#troubleshooting-updates)

---

## How Auto-Updates Work

### Update Workflow

```
1. User launches AuraSwift
   ↓
2. Auto-updater checks GitHub for new version
   ↓
3. If update available, downloads in background
   ↓
4. User prompted to install update
   ↓
5. User agrees → App quits
   ↓
6. Installer runs (replaces application files)
   ↓
7. User launches updated app
   ↓
8. Database migrations run automatically
   ↓
9. App continues normally
```

### What Gets Updated

**Replaced (Application Files):**

- All code in `C:\Program Files\AuraSwift\` (Windows)
- All code in `/Applications/AuraSwift.app/` (macOS)
- `/packages/main/`, `/packages/renderer/`, etc.
- `database.ts` with new schema version and migrations

**Preserved (User Data):**

- Database: `%APPDATA%\AuraSwift\pos_system.db` (Windows)
- Database: `~/Library/Application Support/AuraSwift/pos_system.db` (macOS)
- Settings, preferences, user files
- ALL user data remains untouched

---

## Migration During Updates

### Automatic Migration Flow

```
User launches updated app (v1.2.0 → v1.3.0)
   ↓
DatabaseManager.initialize() runs
   ↓
Database file located in userData directory
   ↓
Connection established
   ↓
initializeTables() executes
   ├─ CREATE TABLE IF NOT EXISTS (all skipped, tables exist)
   └─ Completes instantly
   ↓
runMigrations() executes
   ├─ Check current version (e.g., v2 from schema_version table)
   ├─ Check target version (e.g., v3 from new SCHEMA_VERSION constant)
   ├─ Pending migrations found: v3
   └─ Run migration_v3_xxx()
       ├─ Add new columns
       ├─ Create new tables
       ├─ Update indexes
       └─ Record in schema_version table
   ↓
✅ Database now at v3
✅ All user data preserved
✅ App continues normally
```

### Console Output During Update

```
Database path: /Users/username/Library/Application Support/AuraSwift/pos_system.db
Database initialized successfully

📊 Current schema version: 2
📊 Target schema version: 3
🔄 Running database migrations...
  ⏳ Migration v3: Adding product weight tracking...
      ✅ Added 'weight' column to products
      ✅ Created weight index
  ✅ Migration v3 completed
✅ All migrations completed successfully

✅ Database initialized successfully (v3/3)
```

---

## File Replacement vs Data Preservation

### Windows Platform

**Application Code (Replaced):**

```
C:\Program Files\AuraSwift\
├── AuraSwift.exe               ✅ Replaced with new version
├── resources\
│   └── app.asar               ✅ Replaced (contains all code)
└── ...
```

**User Data (Preserved):**

```
C:\Users\Username\AppData\Roaming\AuraSwift\
├── pos_system.db               ❌ NEVER replaced (user data)
├── app_settings.json           ❌ NEVER replaced
└── ...
```

### macOS Platform

**Application Code (Replaced):**

```
/Applications/AuraSwift.app/
└── Contents\
    ├── MacOS\AuraSwift         ✅ Replaced
    └── Resources\app.asar      ✅ Replaced (contains all code)
```

**User Data (Preserved):**

```
~/Library/Application Support/AuraSwift/
├── pos_system.db               ❌ NEVER replaced (user data)
├── app_settings.json           ❌ NEVER replaced
└── ...
```

### Why This Matters

```typescript
// New code in database.ts (v1.3.0)
private readonly SCHEMA_VERSION = 3;  // Incremented from 2

private initializeTables() {
  // Defines final schema with new columns
  CREATE TABLE products (
    id TEXT,
    weight REAL DEFAULT 0,  // ← New column in code
    // ...
  )
}

private runMigrations() {
  // Checks old database (v2) vs new code (v3)
  // Runs migration_v3_xxx() to add weight column
}
```

**Result:**

- New code knows about `weight` column
- Old database doesn't have `weight` column
- Migration adds `weight` column automatically
- User data preserved, schema updated ✅

---

## User Experience

### Silent Update (Recommended)

User sees minimal disruption:

```
1. User working in app (v1.2.0)
2. Background: Update downloads
3. Dialog: "Update ready to install"
4. User: "Install and Restart"
5. App closes, installer runs (5-10 seconds)
6. App reopens automatically
7. Brief loading (migrations run - < 1 second)
8. User continues working (v1.3.0)
```

**From user perspective:**

- App restarted (expected)
- All data still there ✅
- New features available ✅
- No manual steps required ✅

### With Migration Notification (Optional)

For major schema changes, show progress:

```typescript
// In main process during initialization
mainWindow.webContents.send("migration-started", {
  currentVersion: 2,
  targetVersion: 3,
  pendingCount: 1,
});

// Run migrations...

mainWindow.webContents.send("migration-completed", {
  newVersion: 3,
  success: true,
});
```

**User sees:**

```
┌────────────────────────────────────┐
│ 🗄️  Updating Database...          │
│                                    │
│ Current version: 2                 │
│ New version: 3                     │
│                                    │
│ 🔄 Running migrations...           │
│ ✅ Migration 3 completed           │
│                                    │
│ ✅ Database updated successfully!  │
└────────────────────────────────────┘
```

---

## Safety Guarantees

### 1. Version Tracking

```typescript
// schema_version table ensures:
// - Each migration runs exactly once
// - Version history is permanent
// - Downgrades are detected

const currentVersion = getCurrentVersion(); // From database
const targetVersion = this.SCHEMA_VERSION; // From new code

if (currentVersion > targetVersion) {
  // User downgraded app (rare)
  throw new Error("Database version ahead of code version");
}
```

### 2. Idempotent Migrations

```typescript
// Safe to run multiple times (if app crashes during migration)

try {
  this.db.exec(`ALTER TABLE products ADD COLUMN weight REAL;`);
} catch (error) {
  // Column already exists, safe to ignore
}

// Or with explicit check
const columns = this.db.pragma("table_info(products)");
if (!columns.some((col) => col.name === "weight")) {
  this.db.exec(`ALTER TABLE products ADD COLUMN weight REAL;`);
}
```

### 3. Data Preservation

- ✅ All existing data remains intact
- ✅ New columns have safe defaults
- ✅ Foreign keys validated before adding
- ✅ Duplicates resolved before UNIQUE constraints
- ✅ NULL values set before NOT NULL constraints

### 4. Transaction Safety

```typescript
// Complex migrations wrapped in transactions
const transaction = this.db.transaction(() => {
  // Multiple operations
  // All or nothing
});

transaction(); // Automatic rollback on error
```

### 5. Automatic Execution

- No manual SQL scripts
- No user intervention required
- Happens automatically on first launch after update
- Fast (< 1 second for most migrations)

---

## Common Update Scenarios

### Scenario 1: Minor Update (Add Columns)

**Update:** v1.2.0 → v1.2.1  
**Changes:** Add `notes` field to products  
**Migration:**

```typescript
// New code (v1.2.1)
SCHEMA_VERSION = 3  // Was 2

migration_v3_add_product_notes() {
  try {
    this.db.exec(`ALTER TABLE products ADD COLUMN notes TEXT DEFAULT '';`);
  } catch (error) {
    // Already exists
  }
}
```

**User impact:**

- Update downloads (5 MB)
- App restarts
- Migration runs (< 100ms)
- New notes field available
- All existing products have empty notes

---

### Scenario 2: Major Update (New Tables)

**Update:** v1.2.0 → v1.3.0  
**Changes:** Add loyalty points system  
**Migration:**

```typescript
// New code (v1.3.0)
SCHEMA_VERSION = 4  // Was 2, now 4 (added v3 and v4)

migration_v3_add_product_notes() {
  // From previous version
}

migration_v4_create_loyalty_system() {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS loyalty_points (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      earnedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  this.db.exec(`
    CREATE TABLE IF NOT EXISTS loyalty_rewards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pointsCost INTEGER NOT NULL,
      description TEXT
    )
  `);
}
```

**User impact:**

- Update downloads (8 MB)
- App restarts
- Two migrations run (< 200ms)
- Loyalty system available
- Existing users have 0 points to start

---

### Scenario 3: Data Transformation

**Update:** v1.3.0 → v1.4.0  
**Changes:** Normalize phone numbers  
**Migration:**

```typescript
migration_v5_normalize_phone_numbers() {
  const users = this.db.prepare(`
    SELECT id, phone FROM businesses WHERE phone IS NOT NULL
  `).all();

  const updateStmt = this.db.prepare(`
    UPDATE businesses SET phone = ? WHERE id = ?
  `);

  for (const user of users) {
    // Remove non-numeric characters
    const normalized = user.phone.replace(/\D/g, '');
    updateStmt.run(normalized, user.id);
  }

  console.log(`  ✅ Normalized ${users.length} phone numbers`);
}
```

**User impact:**

- Update downloads (6 MB)
- App restarts
- Migration runs (time depends on data volume)
- Phone numbers now in consistent format
- All existing data transformed

---

### Scenario 4: Add Constraints

**Update:** v1.4.0 → v1.5.0  
**Changes:** Enforce unique product SKUs  
**Migration:**

```typescript
migration_v6_unique_product_skus() {
  // Find duplicates
  const duplicates = this.db.prepare(`
    SELECT sku, COUNT(*) as count
    FROM products
    GROUP BY sku
    HAVING COUNT(*) > 1
  `).all();

  // Resolve duplicates
  for (const dup of duplicates) {
    const products = this.db.prepare(`
      SELECT id FROM products WHERE sku = ?
    `).all(dup.sku);

    // Keep first, modify others
    for (let i = 1; i < products.length; i++) {
      const newSku = `${dup.sku}-${i}`;
      this.db.prepare(`
        UPDATE products SET sku = ? WHERE id = ?
      `).run(newSku, products[i].id);
    }
  }

  // Recreate table with UNIQUE constraint
  // (see Advanced Migration Patterns guide)
}
```

**User impact:**

- Update downloads (7 MB)
- App restarts
- Migration runs (time depends on duplicates)
- Duplicate SKUs resolved automatically
- Future SKUs must be unique

---

## Troubleshooting Updates

### Issue: Migration Fails

**Symptom:**

```
Error during migration v3: ...
App may not start correctly
```

**Causes:**

1. Data violates new constraints
2. SQL syntax error in migration
3. Database file corrupted

**Solution:**

```typescript
// Add validation before applying constraints
if (currentVersion < 3) {
  try {
    this.migration_v3_xxx();
  } catch (error) {
    console.error("Migration v3 failed:", error);
    // Log to file for debugging
    // Continue with old schema (app still works)
    // User can contact support
  }
}
```

### Issue: Version Mismatch

**Symptom:**

```
Database version (v5) ahead of code version (v3)
```

**Cause:** User downgraded app (installed older version)

**Solution:**
Tell user to update to latest version:

```typescript
if (currentVersion > this.SCHEMA_VERSION) {
  dialog.showErrorBox("Version Mismatch", `Your database (v${currentVersion}) is newer than this app version (v${this.SCHEMA_VERSION}).\n\n` + `Please update to the latest version of AuraSwift.`);
  app.quit();
}
```

### Issue: Slow Migration

**Symptom:** App takes long time to start after update

**Cause:** Large data transformation (e.g., updating millions of rows)

**Solution:**

```typescript
// Show progress to user
mainWindow.webContents.send("migration-progress", {
  current: 5000,
  total: 100000,
  message: "Updating product data...",
});

// Batch operations
const batchSize = 1000;
for (let offset = 0; offset < total; offset += batchSize) {
  // Update batch
  // Report progress
}
```

### Issue: App Crashes During Migration

**Symptom:** App closes during update, won't restart

**Cause:** Migration error not handled

**Prevention:**

```typescript
// Wrap migrations in try-catch
try {
  this.runMigrations();
  this.initialized = true;
} catch (error) {
  console.error("Migration failed:", error);

  // Log to file
  fs.appendFileSync("migration-error.log", error.stack);

  // Show user-friendly message
  dialog.showErrorBox("Update Failed", "Database update failed. Please contact support.\n\n" + `Error: ${error.message}`);

  // App continues with old schema (if possible)
  // Or quit gracefully
}
```

---

## Best Practices for Production

### 1. Test Updates Thoroughly

```bash
# Test update path: v1.2.0 → v1.3.0
# 1. Install v1.2.0
# 2. Add test data
# 3. Install v1.3.0
# 4. Verify data intact
# 5. Verify migrations ran
# 6. Test all features
```

### 2. Version Update in package.json

```json
{
  "name": "auraswift",
  "version": "1.3.0", // Update version
  "description": "POS System"
}
```

### 3. Create Changelog

```markdown
# v1.3.0

## New Features

- Loyalty points system
- Product weight tracking

## Database Changes

- Added loyalty_points table
- Added loyalty_rewards table
- Added weight column to products
- Migrations run automatically on update
```

### 4. Release Notes

Show to users after update:

```typescript
// Check if first launch after update
const lastVersion = getSetting("last_version");
const currentVersion = app.getVersion();

if (lastVersion !== currentVersion) {
  // Show changelog
  mainWindow.webContents.send("show-changelog", {
    version: currentVersion,
    changes: ["Added loyalty points system", "Product weight tracking", "Improved performance"],
  });

  setSetting("last_version", currentVersion);
}
```

### 5. Monitoring

```typescript
// Log migration success/failure
import * as Sentry from "@sentry/electron";

try {
  this.runMigrations();
  Sentry.captureMessage(`Migrations successful: v${currentVersion} → v${this.SCHEMA_VERSION}`);
} catch (error) {
  Sentry.captureException(error, {
    extra: {
      currentVersion,
      targetVersion: this.SCHEMA_VERSION,
      migration: "runMigrations",
    },
  });
}
```

---

## Summary

### What Happens During Update

1. **Application files replaced** (new code)
2. **Database file preserved** (user data)
3. **App launches with new code**
4. **Migrations run automatically**
5. **User continues working**

### Safety Features

- ✅ Version tracking (schema_version table)
- ✅ Idempotent migrations (safe to retry)
- ✅ Data validation (before constraints)
- ✅ Transaction safety (all or nothing)
- ✅ Error handling (graceful failures)

### User Experience

- ✅ No manual steps required
- ✅ All data preserved
- ✅ Fast (< 1 second typically)
- ✅ Automatic and seamless
- ✅ Works across versions

---

## Related Documentation

- **[Migration Quick Start](./02_MIGRATION_QUICK_START.md)** - How to add migrations
- **[Migration System Guide](./03_MIGRATION_SYSTEM_GUIDE.md)** - Complete system overview
- **[Advanced Migration Patterns](./04_ADVANCED_MIGRATION_PATTERNS.md)** - Constraints and relationships
- **[Auto-Update Guide](/docs/AutoUpdate/)** - Complete auto-update documentation

---

**Back to:** [Documentation Index](./INDEX.md)
