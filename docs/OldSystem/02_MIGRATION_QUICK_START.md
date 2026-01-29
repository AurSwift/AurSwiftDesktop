# Migration Quick Start

## 5-Minute Guide to Adding a New Migration

This guide shows you how to add a database migration in AuraSwift. The entire process takes about 5 minutes.

---

## Current System

**Location:** `packages/main/src/database.ts`  
**Current Version:** 2  
**Method:** Inline migrations in DatabaseManager class

---

## Step 1: Update Schema Version (30 seconds)

Open `packages/main/src/database.ts` and increment the `SCHEMA_VERSION`:

```typescript
export class DatabaseManager {
  private readonly SCHEMA_VERSION = 3; // Was 2, now 3
  // ...
}
```

---

## Step 2: Update Final Schema (1 minute)

In the same file, update `initializeTables()` with your changes. This defines what **fresh installs** should get:

```typescript
private initializeTables() {
  // Update existing table with new column
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      weight REAL DEFAULT 0,        // ✅ Add new column here
      businessId TEXT NOT NULL,
      // ... other columns
    )
  `);

  // Or add new table
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS loyalty_points (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Run migrations for existing databases
  this.runMigrations();
}
```

---

## Step 3: Create Migration Method (2 minutes)

Add a new migration method for **existing databases**:

```typescript
/**
 * Migration v3: Add weight tracking to products
 */
private migration_v3_add_product_weight() {
  console.log('  ⏳ Migration v3: Adding weight field to products...');

  try {
    this.db.exec(`ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0;`);
  } catch (error) {
    // Column already exists (fresh install), ignore
  }

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(3, 'add_product_weight');

  console.log('  ✅ Migration v3 completed');
}
```

---

## Step 4: Call Migration in runMigrations() (30 seconds)

Update the `runMigrations()` method to call your new migration:

```typescript
private runMigrations() {
  // ... existing code to check version ...

  if (currentVersion < 1) {
    this.migration_v1_add_business_fields();
  }

  if (currentVersion < 2) {
    this.migration_v2_add_discount_fields();
  }

  // ✅ Add your new migration
  if (currentVersion < 3) {
    this.migration_v3_add_product_weight();
  }

  console.log('✅ All migrations completed successfully');
}
```

---

## Step 5: Test Locally (1 minute)

Run your app to test the migration:

```bash
npm run dev
```

**Expected console output:**

```
Database initialized successfully
📊 Current schema version: 2
📊 Target schema version: 3
🔄 Running database migrations...
  ⏳ Migration v3: Adding weight field to products...
  ✅ Migration v3 completed
✅ All migrations completed successfully
```

**Verify the change:**

```bash
# Check version
sqlite3 data/pos_system.db "PRAGMA user_version"
# Output: 3

# Check schema_version table
sqlite3 data/pos_system.db "SELECT * FROM schema_version"
# Should show version 3 entry

# Verify column exists
sqlite3 data/pos_system.db "PRAGMA table_info(products)"
# Should see 'weight' column
```

---

## Common Migration Patterns

### Pattern 1: Add a Column

```typescript
private migration_vN_add_column() {
  console.log('  ⏳ Migration vN: Adding column...');

  try {
    this.db.exec(`ALTER TABLE table_name ADD COLUMN column_name TYPE DEFAULT value;`);
  } catch (error) {
    // Already exists
  }

  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'migration_name');

  console.log('  ✅ Migration vN completed');
}
```

**Update initializeTables():**

```typescript
CREATE TABLE IF NOT EXISTS table_name (
  id TEXT PRIMARY KEY,
  column_name TYPE DEFAULT value,  // ✅ Include in final schema
  // ... other columns
)
```

---

### Pattern 2: Add a New Table

```typescript
private migration_vN_create_table() {
  console.log('  ⏳ Migration vN: Creating new table...');

  this.db.exec(`
    CREATE TABLE IF NOT EXISTS table_name (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'create_table_name');

  console.log('  ✅ Migration vN completed');
}
```

**Update initializeTables():**

```typescript
// Add the same CREATE TABLE statement
this.db.exec(`
  CREATE TABLE IF NOT EXISTS table_name (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`);
```

---

### Pattern 3: Add Multiple Columns

```typescript
private migration_vN_add_fields() {
  console.log('  ⏳ Migration vN: Adding multiple fields...');

  const columns = [
    'address TEXT DEFAULT ""',
    'phone TEXT DEFAULT ""',
    'vatNumber TEXT DEFAULT ""'
  ];

  for (const column of columns) {
    try {
      this.db.exec(`ALTER TABLE businesses ADD COLUMN ${column};`);
    } catch (error) {
      // Already exists
    }
  }

  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'add_business_fields');

  console.log('  ✅ Migration vN completed');
}
```

---

### Pattern 4: Add Index

```typescript
private migration_vN_add_index() {
  console.log('  ⏳ Migration vN: Adding index...');

  this.db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_weight
    ON products(weight)
  `);

  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'add_product_weight_index');

  console.log('  ✅ Migration vN completed');
}
```

**Update initializeTables():**

```typescript
// Add to the index creation section
this.db.exec(`
  CREATE INDEX IF NOT EXISTS idx_products_weight ON products(weight);
`);
```

---

### Pattern 5: Data Migration

```typescript
private migration_vN_update_data() {
  console.log('  ⏳ Migration vN: Updating existing data...');

  // Example: Set default values for existing rows
  this.db.exec(`
    UPDATE products
    SET weight = 0
    WHERE weight IS NULL
  `);

  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'set_default_weights');

  console.log('  ✅ Migration vN completed');
}
```

---

## Migration Checklist

Before committing your migration:

- [ ] **Version number is sequential** (no gaps: 1, 2, 3...)
- [ ] **SCHEMA_VERSION constant updated**
- [ ] **initializeTables() includes final schema**
- [ ] **Migration method created** (migration_vN_xxx)
- [ ] **Migration called in runMigrations()**
- [ ] **Migration is idempotent** (safe to run multiple times)
- [ ] **Tested with existing database** (migration runs successfully)
- [ ] **Tested with fresh database** (tables created with final schema)
- [ ] **Console logs are helpful** (show what's happening)
- [ ] **schema_version record is inserted**
- [ ] **No breaking changes** without user communication

---

## Testing Workflow

### Test 1: Fresh Database (New Install)

```bash
# Delete database
rm data/pos_system.db

# Run app
npm run dev

# Expected:
# - Tables created with ALL columns (from initializeTables)
# - Migrations run but find everything already exists
# - Version set to current SCHEMA_VERSION
```

### Test 2: Existing Database (Update)

```bash
# Keep existing database with old version
# Run app
npm run dev

# Expected:
# - Only new migrations run
# - Old data preserved
# - Version incremented
```

### Test 3: Up-to-Date Database (Restart)

```bash
# Database already at current version
# Run app
npm run dev

# Expected:
# - No migrations run
# - "Database schema is up to date" message
# - Fast startup
```

---

## Quick Commands

```bash
# Check current version
sqlite3 data/pos_system.db "SELECT MAX(version) FROM schema_version"

# View migration history
sqlite3 data/pos_system.db "SELECT * FROM schema_version ORDER BY version"

# Check table schema
sqlite3 data/pos_system.db "PRAGMA table_info(table_name)"

# Test with fresh database
rm data/pos_system.db && npm run dev

# View console logs during migration
npm run dev 2>&1 | grep -A 20 "Running database migrations"
```

---

## Common Issues

### Issue: "Column already exists"

**Cause:** Migration ran twice  
**Solution:** Add try-catch block around ALTER TABLE

### Issue: "No such table"

**Cause:** Trying to alter table that doesn't exist yet  
**Solution:** Ensure table is created in initializeTables() first

### Issue: "Version mismatch"

**Cause:** Database version > code version (app downgraded)  
**Solution:** User must update to latest app version

### Issue: "Migration not running"

**Cause:** Forgot to call migration in runMigrations()  
**Solution:** Add if (currentVersion < N) check

---

## What Happens During Auto-Update?

When a user updates your app:

1. **User launches updated app**
2. **Database manager initializes**
3. **Current version checked** (e.g., v2)
4. **Target version checked** (e.g., v3 in new code)
5. **Migrations run automatically** (v3)
6. **User data preserved**
7. **App continues normally**

**User sees:**

```
✅ Database initialized successfully (v3/3)
```

No manual steps required! 🎉

---

## Next Steps

- **Add constraints:** See [Advanced Migration Patterns](./04_ADVANCED_MIGRATION_PATTERNS.md)
- **Understand versioning:** Read [Migration System Guide](./03_MIGRATION_SYSTEM_GUIDE.md)
- **Learn auto-updates:** Check [Auto-Update Integration](./05_AUTO_UPDATE_INTEGRATION.md)

---

**Pro Tips:**

- Keep migrations small and focused
- Test with both fresh and existing databases
- Always check for existing structures before creating
- Use descriptive migration names
- Add helpful console logs for debugging

---

**Back to:** [Documentation Index](./INDEX.md)
