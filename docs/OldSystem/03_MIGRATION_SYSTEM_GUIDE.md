# Migration System Guide

## Overview

AuraSwift uses a robust database versioning system to track schema changes and automatically apply migrations. This guide covers the complete system architecture, best practices, and API reference.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Version Tracking](#version-tracking)
3. [Migration Flow](#migration-flow)
4. [Best Practices](#best-practices)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)
7. [Production Deployment](#production-deployment)

---

## Architecture

### System Components

```
DatabaseManager (database.ts)
├── SCHEMA_VERSION constant           # Target version (2, 3, 4...)
├── initializeTables()               # Final schema definition
├── runMigrations()                  # Migration orchestrator
├── migration_v1_xxx()              # Individual migrations
├── migration_v2_xxx()
└── migration_vN_xxx()

schema_version table (SQLite)
├── version (INTEGER)                # Migration number
├── migration_name (TEXT)           # Descriptive name
└── applied_at (TEXT)               # Timestamp
```

### Key Concepts

**Version Tracking:**

- Single source of truth: `schema_version` table
- Sequential versioning: 1, 2, 3, 4...
- Each migration increments version by 1

**Hybrid Pattern:**

- `initializeTables()` = Final destination (fresh installs)
- `runMigrations()` = Journey to get there (existing databases)

**Safety Features:**

- Idempotent migrations (safe to re-run)
- Version validation (prevents downgrades)
- Try-catch blocks (handle existing structures)
- Detailed logging (debug-friendly)

---

## Version Tracking

### The schema_version Table

Created automatically on first migration:

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  migration_name TEXT NOT NULL,
  applied_at TEXT NOT NULL
)
```

**Example data:**

```
version | migration_name          | applied_at
--------|------------------------|---------------------------
1       | add_business_fields    | 2025-11-08 10:30:45
2       | add_discount_fields    | 2025-11-08 10:30:46
3       | add_product_weight     | 2025-11-08 14:22:10
```

### Version Check Logic

```typescript
// Get current version
const result = this.db
  .prepare(
    `
  SELECT COALESCE(MAX(version), 0) as version 
  FROM schema_version
`
  )
  .get() as { version: number };

const currentVersion = result.version; // 0 if no migrations yet

// Get target version
const targetVersion = this.SCHEMA_VERSION; // From constant

// Determine pending migrations
if (currentVersion < targetVersion) {
  // Run migrations from currentVersion+1 to targetVersion
}
```

---

## Migration Flow

### Initialization Sequence

```
1. App Start
   ↓
2. DatabaseManager.initialize()
   ↓
3. getDatabasePath() - Determine location
   ↓
4. new Database(dbPath) - Connect
   ↓
5. initializeTables()
   ├─ CREATE TABLE IF NOT EXISTS (all tables)
   └─ Define final schema
   ↓
6. runMigrations()
   ├─ CREATE TABLE schema_version
   ├─ Check current version
   ├─ Compare with SCHEMA_VERSION
   └─ Run pending migrations sequentially
   ↓
7. createDefaultAdmin() - If no users
   ↓
8. Ready ✅
```

### Migration Execution

```typescript
private runMigrations() {
  // 1. Ensure schema_version table exists
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (...)
  `);

  // 2. Get current version
  const result = this.db.prepare(`
    SELECT COALESCE(MAX(version), 0) as version
    FROM schema_version
  `).get();

  const currentVersion = result.version;

  // 3. Log status
  console.log(`📊 Current schema version: ${currentVersion}`);
  console.log(`📊 Target schema version: ${this.SCHEMA_VERSION}`);

  // 4. Check if up-to-date
  if (currentVersion >= this.SCHEMA_VERSION) {
    console.log('✅ Database schema is up to date');
    return;
  }

  // 5. Run pending migrations
  console.log('🔄 Running database migrations...');

  if (currentVersion < 1) {
    this.migration_v1_add_business_fields();
  }

  if (currentVersion < 2) {
    this.migration_v2_add_discount_fields();
  }

  // ... more migrations ...

  console.log('✅ All migrations completed successfully');
}
```

### Individual Migration Pattern

- 1 . DEFINE migration
- 2 . ADD TO SCHEMA VERSION TABLE

```typescript
/**
 * Migration v1: Add contact fields to businesses
 */
private migration_v1_add_business_fields() {
  console.log('  ⏳ Migration v1: Adding address fields to businesses...');

  // Step 1: Apply changes (idempotent)
  try {
    this.db.exec(`ALTER TABLE businesses ADD COLUMN address TEXT DEFAULT '';`);
  } catch (error) {
    // Column already exists, ignore
  }

  try {
    this.db.exec(`ALTER TABLE businesses ADD COLUMN phone TEXT DEFAULT '';`);
  } catch (error) {
    // Column already exists, ignore
  }

  try {
    this.db.exec(`ALTER TABLE businesses ADD COLUMN vatNumber TEXT DEFAULT '';`);
  } catch (error) {
    // Column already exists, ignore
  }

  // Step 2: Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(1, 'add_business_fields');

  console.log('  ✅ Migration v1 completed');
}
```

---

## Best Practices

### DO ✅

#### 1. **Make Migrations Idempotent**

Migrations should be safe to run multiple times:

```typescript
// ✅ GOOD: Check before adding
const tableInfo = db.pragma("table_info(products)");
const columnNames = tableInfo.map((col) => col.name);

if (!columnNames.includes("weight")) {
  db.exec(`ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0;`);
}

// ✅ GOOD: Use IF NOT EXISTS
db.exec(`CREATE TABLE IF NOT EXISTS table_name (...)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_name ON table(column)`);

// ✅ GOOD: Use try-catch for ALTER TABLE
try {
  db.exec(`ALTER TABLE table ADD COLUMN column TEXT;`);
} catch (error) {
  // Already exists, safe to ignore
}
```

#### 2. **Increment Version Sequentially**

```typescript
// ✅ GOOD: Sequential
SCHEMA_VERSION = 1, 2, 3, 4, 5...

// ❌ BAD: Gaps
SCHEMA_VERSION = 1, 3, 5, 10...
```

#### 3. **Update Both Places**

When adding a migration:

```typescript
// 1. Update initializeTables() with final schema
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  weight REAL DEFAULT 0,  // ✅ New column
  // ...
)

// 2. Create migration for existing databases
private migration_v3_add_weight() {
  // Add column with ALTER TABLE
}

// 3. Call migration in runMigrations()
if (currentVersion < 3) {
  this.migration_v3_add_weight();
}
```

#### 4. **Use Descriptive Names**

```typescript
// ✅ GOOD
private migration_v1_add_business_fields() { }
private migration_v2_add_discount_fields() { }
private migration_v3_create_loyalty_table() { }

// ❌ BAD
private migration1() { }
private migrateV2() { }
private updateDB() { }
```

#### 5. **Add Helpful Logs**

```typescript
console.log("  ⏳ Migration v3: Adding weight field to products...");
console.log("  ✅ Added weight column");
console.log("  ✅ Created weight index");
console.log("  ✅ Migration v3 completed");
```

#### 6. **Test Thoroughly**

```bash
# Test 1: Fresh database
rm data/pos_system.db && npm run dev

# Test 2: Existing database (v1 → v3)
# Keep old database, run app

# Test 3: Up-to-date database
# Run app again, should skip migrations
```

### DON'T ❌

#### 1. **Never Modify Released Migrations**

```typescript
// ❌ BAD: Changing existing migration
private migration_v1_add_business_fields() {
  // Original code...
  // DON'T add more changes here!
}

// ✅ GOOD: Create new migration
private migration_v4_add_more_fields() {
  // New changes go here
}
```

#### 2. **Never Skip Version Numbers**

```typescript
// ❌ BAD
SCHEMA_VERSION = 1;
// Released...
SCHEMA_VERSION = 5; // Where are 2, 3, 4?

// ✅ GOOD
SCHEMA_VERSION = 1;
SCHEMA_VERSION = 2;
SCHEMA_VERSION = 3;
```

#### 3. **Never Delete Old Migrations**

```typescript
// ❌ BAD: Removing migration methods
// Breaks users on old versions upgrading to new versions

// ✅ GOOD: Keep all migrations forever
// They're documentation of schema evolution
```

#### 4. **Never Make Destructive Changes Without Warning**

```typescript
// ❌ BAD: Silent data loss
DROP TABLE old_data;

// ✅ GOOD: Warn user first
// Show dialog, get confirmation
// Create backup, then migrate
```

#### 5. **Never Use Direct ALTER TABLE for Constraints**

```typescript
// ❌ BAD: Will fail if data violates constraint
ALTER TABLE products ADD CONSTRAINT unique_sku UNIQUE(sku);

// ✅ GOOD: Validate and clean data first
// See Advanced Migration Patterns guide
```

---

## API Reference

### Constants

#### `SCHEMA_VERSION`

```typescript
private readonly SCHEMA_VERSION = 2;
```

**Purpose:** Target database version for current app code  
**Type:** `number`  
**Location:** `DatabaseManager` class property  
**Usage:** Compared against current DB version to determine pending migrations

---

### Methods

#### `runMigrations()`

```typescript
private runMigrations(): void
```

**Purpose:** Main migration orchestrator  
**Called by:** `initializeTables()`  
**Returns:** `void`  
**Side effects:**

- Creates `schema_version` table if needed
- Runs all pending migrations sequentially
- Logs progress to console

**Example:**

```typescript
private initializeTables() {
  // Create tables...
  this.runMigrations();  // Run migrations
}
```

---

#### `migration_vN_name()`

```typescript
private migration_v1_add_business_fields(): void
```

**Purpose:** Apply a specific schema change  
**Called by:** `runMigrations()`  
**Returns:** `void`  
**Naming:** `migration_v{N}_{description}`  
**Requirements:**

- Must be idempotent
- Must log progress
- Must record version in `schema_version` table

**Example:**

```typescript
private migration_v3_add_weight() {
  console.log('  ⏳ Migration v3: Adding weight field...');

  try {
    this.db.exec(`ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0;`);
  } catch (error) {
    // Already exists
  }

  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(3, 'add_product_weight');

  console.log('  ✅ Migration v3 completed');
}
```

---

### Database Queries

#### Get Current Version

```typescript
const result = this.db
  .prepare(
    `
  SELECT COALESCE(MAX(version), 0) as version 
  FROM schema_version
`
  )
  .get() as { version: number };

const currentVersion = result.version;
```

#### Record Migration

```typescript
this.db
  .prepare(
    `
  INSERT INTO schema_version (version, migration_name, applied_at)
  VALUES (?, ?, datetime('now'))
`
  )
  .run(version, "migration_name");
```

#### Get Migration History

```typescript
const history = this.db
  .prepare(
    `
  SELECT version, migration_name, applied_at 
  FROM schema_version 
  ORDER BY version ASC
`
  )
  .all();
```

---

## Troubleshooting

### Issue: "Column already exists"

**Symptom:**

```
Error: duplicate column name: weight
```

**Cause:** Migration ran twice or column already in fresh install

**Solution:** Wrap ALTER TABLE in try-catch:

```typescript
try {
  this.db.exec(`ALTER TABLE products ADD COLUMN weight REAL;`);
} catch (error) {
  // Already exists, safe to ignore
}
```

---

### Issue: "No such table: schema_version"

**Symptom:**

```
Error: no such table: schema_version
```

**Cause:** Table not created before querying

**Solution:** Create table in `runMigrations()`:

```typescript
private runMigrations() {
  // First create the table
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (...)
  `);

  // Then query it
  const result = this.db.prepare(...).get();
}
```

---

### Issue: "Database version ahead of code"

**Symptom:**

```
Database at v5, but code expects v3
```

**Cause:** User downgraded app

**Solution:** User must update to latest version. In code:

```typescript
if (currentVersion > this.SCHEMA_VERSION) {
  throw new Error(`Database version (v${currentVersion}) is ahead of code version (v${this.SCHEMA_VERSION}). ` + `Please update to the latest version.`);
}
```

---

### Issue: "Migration not running"

**Symptom:** New migration doesn't execute

**Checklist:**

- [ ] `SCHEMA_VERSION` constant incremented?
- [ ] Migration method created?
- [ ] Migration called in `runMigrations()`?
- [ ] Version check condition correct? (`currentVersion < N`)

**Debug:**

```typescript
console.log("Current version:", currentVersion);
console.log("Target version:", this.SCHEMA_VERSION);
console.log("Will run migration v3?", currentVersion < 3);
```

---

### Issue: "Data lost after migration"

**Cause:** Destructive migration without backup

**Prevention:**

1. Test migrations thoroughly
2. Never DROP TABLE with user data
3. Use transactions for complex operations
4. Implement backup system (future enhancement)

---

## Production Deployment

### Pre-Release Checklist

- [ ] All migrations tested locally
- [ ] Tested with fresh database (v0 → vN)
- [ ] Tested with existing database (v1 → vN)
- [ ] Tested with up-to-date database (vN → vN)
- [ ] Version numbers sequential
- [ ] initializeTables() matches migrations
- [ ] Console logs are helpful
- [ ] No breaking changes
- [ ] Documentation updated

### Release Process

1. **Increment version in code**

   ```typescript
   SCHEMA_VERSION = 3; // Was 2
   ```

2. **Add migration method**

   ```typescript
   private migration_v3_xxx() { }
   ```

3. **Update runMigrations()**

   ```typescript
   if (currentVersion < 3) {
     this.migration_v3_xxx();
   }
   ```

4. **Update initializeTables()**

   ```typescript
   // Add new columns/tables to final schema
   ```

5. **Test locally**

   ```bash
   npm run dev
   ```

6. **Commit and push**

   ```bash
   git add packages/main/src/database.ts
   git commit -m "feat: Add product weight tracking (v3)"
   git push
   ```

7. **Create release**
   - Tag version
   - GitHub Actions builds app
   - Auto-updater distributes

### User Experience

When users update:

```
User launches updated app
  ↓
Database manager initializes
  ↓
📊 Current schema version: 2
📊 Target schema version: 3
🔄 Running database migrations...
  ⏳ Migration v3: Adding weight field to products...
  ✅ Migration v3 completed
✅ All migrations completed successfully
  ↓
App continues normally
```

**No user intervention required!** ✅

---

## Performance Considerations

### Migration Speed

- SQLite ALTER TABLE is instant (metadata only)
- Data migrations can be slow (depends on row count)
- Show progress for long-running migrations

### Startup Impact

- Version check: < 1ms
- No migrations: < 1ms
- Running migrations: Depends on complexity

**Optimization:**

```typescript
// Skip version check if already checked
if (this.migrationsRun) return;
this.migrationsRun = true;
```

---

## Future Enhancements

### Planned Features

1. **Automatic Backups**

   - Create backup before each migration run
   - Rotate old backups (keep last 10)
   - One-click restore from UI

2. **Rollback Support**

   - Implement `down()` migrations
   - Limited by SQLite (can't drop columns)
   - Restore from backup alternative

3. **Migration Status UI**

   - Show migration progress to user
   - Display version history
   - View pending migrations

4. **Dry-Run Mode**

   - Test migrations without applying
   - Validate SQL syntax
   - Check for potential issues

5. **Performance Metrics**
   - Track migration execution time
   - Log slow migrations
   - Optimize database operations

---

## Related Documentation

- **[Migration Quick Start](./02_MIGRATION_QUICK_START.md)** - How to add migrations (5 minutes)
- **[Advanced Migration Patterns](./04_ADVANCED_MIGRATION_PATTERNS.md)** - Constraints, relationships, complex changes
- **[Auto-Update Integration](./05_AUTO_UPDATE_INTEGRATION.md)** - How migrations work with auto-updater
- **[Database Architecture](./01_DATABASE_ARCHITECTURE.md)** - Complete system overview

---

**Back to:** [Documentation Index](./INDEX.md)
