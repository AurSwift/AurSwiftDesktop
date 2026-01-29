# Database Schema Changes During Auto-Updates

## 📋 Table of Contents

1. [Overview](#overview)
2. [Safe Operations](#safe-operations)
3. [Risky Operations](#risky-operations)
4. [Dangerous Operations](#dangerous-operations)
5. [Complete Scenarios Analysis](#complete-scenarios-analysis)
6. [Best Practices & Migration Strategies](#best-practices--migration-strategies)
7. [Testing Your Migrations](#testing-your-migrations)

---

## 🎯 Overview

When you push database schema changes and users auto-update, the **database file is NEVER replaced** - only your application code is replaced. This means your new code must be able to handle the old database schema and migrate it safely.

### The Critical Rule:

> ⚠️ **Your migration code runs against a LIVE PRODUCTION DATABASE with REAL USER DATA.**  
> There's no staging environment, no rollback - it either works or users lose data!

---

## 🚀 Quick Reference: Will My Database Change Work?

### ✅ **YES - These Operations Work Safely with Auto-Updates:**

| Operation                   | Status    | Example                                                 |
| --------------------------- | --------- | ------------------------------------------------------- |
| **Add new table**           | ✅ SAFE   | `CREATE TABLE IF NOT EXISTS discounts (...)`            |
| **Add column with DEFAULT** | ✅ SAFE   | `ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0` |
| **Add nullable column**     | ✅ SAFE   | `ALTER TABLE users ADD COLUMN phone TEXT`               |
| **Add index**               | ✅ SAFE   | `CREATE INDEX IF NOT EXISTS idx_name ON table(col)`     |
| **Add foreign key**         | ⚠️ SAFE\* | \*With validation & table recreation                    |
| **Add UNIQUE constraint**   | ⚠️ SAFE\* | \*After resolving duplicates first                      |

### ⚠️ **MAYBE - These Need Careful Implementation:**

| Operation                | Status   | Notes                                      |
| ------------------------ | -------- | ------------------------------------------ |
| **Rename column**        | ⚠️ RISKY | Requires table recreation, test thoroughly |
| **Change column type**   | ⚠️ RISKY | Data conversion might fail                 |
| **Add NOT NULL**         | ⚠️ RISKY | Must fill existing NULL values first       |
| **Define relationships** | ⚠️ RISKY | Must validate no orphaned references       |

### ❌ **NO - These Can Cause Data Loss:**

| Operation              | Status       | Why Dangerous                 |
| ---------------------- | ------------ | ----------------------------- |
| **Drop column**        | ❌ DANGEROUS | Permanently deletes user data |
| **Drop table**         | ❌ DANGEROUS | All table data lost forever   |
| **Change primary key** | ❌ DANGEROUS | Breaks all FK relationships   |

---

## 💡 Real-World Examples for Your Use Cases

### ✅ **Adding a Field to a Table:**

```typescript
// ✅ YES - This will work perfectly
try {
  this.db.exec(`
    ALTER TABLE products ADD COLUMN requiresWeight BOOLEAN DEFAULT 0;
  `);
  console.log("✅ Added requiresWeight column");
} catch (error) {
  // Column already exists, that's fine
  console.log("Column already exists, skipping");
}
```

**Result:** All existing products get `requiresWeight = 0`, new products can set it to 1.

---

### ✅ **Adding a New Table:**

```typescript
// ✅ YES - This will work perfectly
this.db.exec(`
  CREATE TABLE IF NOT EXISTS discounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
    value REAL NOT NULL,
    businessId TEXT NOT NULL,
    isActive BOOLEAN DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (businessId) REFERENCES businesses (id)
  )
`);
console.log("✅ Discounts table created");
```

**Result:** New empty table created, existing data untouched.

---

### ⚠️ **Defining Relationships (Foreign Keys):**

```typescript
// ⚠️ YES - But needs validation first
async addProductCategoryRelationship() {
  const transaction = this.db.transaction(() => {
    // Step 1: Validate - Check for orphaned references
    const orphaned = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM products p
      WHERE p.categoryId IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = p.categoryId)
    `).get();

    if (orphaned.count > 0) {
      console.log(`⚠️ Found ${orphaned.count} orphaned product references`);

      // Create default category for orphaned products
      const defaultCategoryId = this.uuid.v4();
      this.db.exec(`
        INSERT INTO categories (id, name, businessId, createdAt, updatedAt)
        VALUES (?, 'Uncategorized', 'default', datetime('now'), datetime('now'))
      `).run(defaultCategoryId);

      // Fix orphaned references
      this.db.exec(`
        UPDATE products
        SET categoryId = ?
        WHERE categoryId IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = products.categoryId)
      `).run(defaultCategoryId);
    }

    // Step 2: Recreate table with FK constraint
    this.db.exec(`PRAGMA foreign_keys = OFF`);

    this.db.exec(`
      CREATE TABLE products_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        categoryId TEXT,
        -- ... other columns
        FOREIGN KEY (categoryId) REFERENCES categories(id)
      )
    `);

    this.db.exec(`INSERT INTO products_new SELECT * FROM products`);
    this.db.exec(`DROP TABLE products`);
    this.db.exec(`ALTER TABLE products_new RENAME TO products`);

    this.db.exec(`PRAGMA foreign_keys = ON`);
  });

  try {
    transaction();
    console.log('✅ Foreign key relationship added');
  } catch (error) {
    console.error('❌ Failed to add relationship:', error);
    throw error;
  }
}
```

**Result:** ✅ FK relationship added, orphaned data handled gracefully.

---

### ⚠️ **Adding UNIQUE Constraint:**

```typescript
// ⚠️ YES - But must resolve duplicates first
async makeFieldUnique() {
  const transaction = this.db.transaction(() => {
    // Step 1: Find duplicates
    const duplicates = this.db.prepare(`
      SELECT name, businessId, GROUP_CONCAT(id) as ids, COUNT(*) as count
      FROM categories
      GROUP BY name, businessId
      HAVING COUNT(*) > 1
    `).all();

    if (duplicates.length > 0) {
      console.log(`⚠️ Found ${duplicates.length} duplicate categories, resolving...`);

      // Step 2: Rename duplicates
      for (const dup of duplicates) {
        const ids = dup.ids.split(',');
        // Keep first, rename others
        for (let i = 1; i < ids.length; i++) {
          const newName = `${dup.name} (${i})`;
          this.db.prepare(`
            UPDATE categories
            SET name = ?, updatedAt = datetime('now')
            WHERE id = ?
          `).run(newName, ids[i]);

          console.log(`  Renamed: "${dup.name}" → "${newName}"`);
        }
      }
    }

    // Step 3: Recreate table with UNIQUE constraint
    this.db.exec(`
      CREATE TABLE categories_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        businessId TEXT NOT NULL,
        -- ... other columns
        UNIQUE(name, businessId)  -- ✅ NOW safe to add
      )
    `);

    this.db.exec(`INSERT INTO categories_new SELECT * FROM categories`);
    this.db.exec(`DROP TABLE categories`);
    this.db.exec(`ALTER TABLE categories_new RENAME TO categories`);
  });

  try {
    transaction();
    console.log('✅ UNIQUE constraint added');
  } catch (error) {
    console.error('❌ Failed to add UNIQUE constraint:', error);
    throw error;
  }
}
```

**Result:** ✅ UNIQUE constraint added, duplicates resolved automatically.

---

## ✅ Your Current Migration Pattern is PERFECT!

The pattern you're already using in `database.ts` is exactly right:

```typescript
// From your database.ts - THIS IS EXCELLENT! ✅
private initializeTables() {
  // ✅ SAFE: Create tables with IF NOT EXISTS
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ownerId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // ✅ SAFE: Add columns with DEFAULT and try-catch
  try {
    this.db.exec(`ALTER TABLE businesses ADD COLUMN address TEXT DEFAULT '';`);
  } catch (error) {
    // Column might already exist, ignore error
  }

  try {
    this.db.exec(`ALTER TABLE businesses ADD COLUMN phone TEXT DEFAULT '';`);
  } catch (error) {
    // Column might already exist, ignore error
  }

  // ✅ SAFE: Add columns to transactions
  try {
    this.db.exec(`ALTER TABLE transactions ADD COLUMN discountAmount REAL DEFAULT 0;`);
  } catch (error) {
    // Column might already exist, ignore error
  }

  try {
    this.db.exec(`ALTER TABLE transactions ADD COLUMN appliedDiscounts TEXT;`);
  } catch (error) {
    // Column might already exist, ignore error
  }
}
```

**Why this pattern works:**

1. ✅ Uses `CREATE TABLE IF NOT EXISTS` - idempotent
2. ✅ Uses `DEFAULT` values for new columns - existing rows automatically populated
3. ✅ Wrapped in try-catch - can run multiple times safely
4. ✅ Never drops tables or columns - preserves user data
5. ✅ Additive only - no destructive operations

**This means your auto-updates will work perfectly!** 🎉

---

## ✅ Safe Operations

These operations are **safe** and will work reliably during auto-updates:

### 1. **Adding New Tables** ✅

**Why it's safe:** Creating a new table doesn't affect existing data.

```typescript
// ✅ SAFE: Add new table
this.db.exec(`
  CREATE TABLE IF NOT EXISTS discounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    businessId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (businessId) REFERENCES businesses (id)
  )
`);
```

**What happens during update:**

```
Before Update (v3.0.0 database):
├─ businesses ✓
├─ users ✓
├─ products ✓
└─ transactions ✓

After Update (v3.2.0 runs migration):
├─ businesses ✓ (unchanged)
├─ users ✓ (unchanged)
├─ products ✓ (unchanged)
├─ transactions ✓ (unchanged)
└─ discounts ✓ (NEW, empty)
```

**Result:** ✅ All existing data preserved, new table created.

---

### 2. **Adding Columns with DEFAULT Values** ✅

**Why it's safe:** SQLite adds the column and populates existing rows with default value.

```typescript
// ✅ SAFE: Add column with DEFAULT
try {
  this.db.exec(`ALTER TABLE products ADD COLUMN requiresWeight BOOLEAN DEFAULT 0;`);
} catch (error) {
  // Column already exists, ignore
}

try {
  this.db.exec(`ALTER TABLE transactions ADD COLUMN discountAmount REAL DEFAULT 0;`);
} catch (error) {
  // Column already exists, ignore
}
```

**What happens during update:**

```
Before Update:
transactions table (1000 existing rows):
├─ id
├─ total
├─ paymentMethod
└─ (no discountAmount column)

After Migration:
transactions table (1000 rows - ALL PRESERVED):
├─ id ✓
├─ total ✓
├─ paymentMethod ✓
└─ discountAmount (ALL rows have value: 0.0)
```

**Result:** ✅ Existing rows get default value automatically.

---

### 3. **Adding Indexes** ✅

**Why it's safe:** Indexes don't affect data, only query performance.

```typescript
// ✅ SAFE: Add index
this.db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_timestamp 
  ON transactions(timestamp)
`);

this.db.exec(`
  CREATE INDEX IF NOT EXISTS idx_products_category 
  ON products(category)
`);
```

**What happens during update:**

```
Before: Table exists, no index → Queries slower
After: Table exists, index added → Queries faster
Data: COMPLETELY UNCHANGED ✅
```

**Result:** ✅ Performance improvement, zero data risk.

---

### 4. **Adding Foreign Key Constraints (to new columns)** ✅

**Why it's safe:** When adding new columns with FK, existing data isn't affected.

```typescript
// ✅ SAFE: New column with FK (for future data)
try {
  this.db.exec(`
    ALTER TABLE transactions ADD COLUMN managerId TEXT;
  `);
} catch (error) {
  // Already exists
}

// Add FK by recreating table (see migration pattern below)
```

**Result:** ✅ Safe if done correctly using table recreation pattern.

---

## ⚠️ Risky Operations

These operations can work but require **careful implementation**:

### 1. **Adding Columns WITHOUT DEFAULT (nullable)** ⚠️

**Risk:** Old code might not handle NULL values.

```typescript
// ⚠️ RISKY: Adding nullable column
try {
  this.db.exec(`ALTER TABLE products ADD COLUMN customField TEXT;`);
  // Existing rows will have NULL in customField
} catch (error) {
  // Already exists
}
```

**Potential issue:**

```typescript
// Old code (v3.0.0) might crash:
const product = getProduct(id);
const length = product.customField.length; // ❌ TypeError: Cannot read property 'length' of null

// New code (v3.2.0) must handle NULL:
const length = product.customField?.length ?? 0; // ✅ Safe
```

**Solution:** Always provide DEFAULT or handle NULL in code.

```typescript
// ✅ BETTER: Add with default
this.db.exec(`ALTER TABLE products ADD COLUMN customField TEXT DEFAULT '';`);
```

---

### 2. **Renaming Columns** ⚠️

**Risk:** Requires table recreation, can fail if not done correctly.

**Problem:** SQLite doesn't have `ALTER COLUMN RENAME` (before version 3.25.0).

```typescript
// ⚠️ COMPLEX: Renaming column requires table recreation
const transaction = this.db.transaction(() => {
  // 1. Create new table with new column name
  this.db.exec(`
    CREATE TABLE products_new (
      id TEXT PRIMARY KEY,
      productName TEXT NOT NULL,  -- Was 'name'
      price REAL NOT NULL,
      -- ... other columns
    )
  `);

  // 2. Copy data with column mapping
  this.db.exec(`
    INSERT INTO products_new (id, productName, price, ...)
    SELECT id, name, price, ... FROM products
  `);

  // 3. Drop old table
  this.db.exec(`DROP TABLE products`);

  // 4. Rename new table
  this.db.exec(`ALTER TABLE products_new RENAME TO products`);

  // 5. Recreate indexes
  this.db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_name 
    ON products(productName)
  `);
});

transaction();
```

**What can go wrong:**

- ❌ Foreign key constraints might break
- ❌ Indexes need to be recreated
- ❌ Triggers need to be recreated
- ❌ If migration fails midway, data could be corrupted

**Solution:** Test extensively, use transactions, have rollback plan.

---

### 3. **Changing Column Types** ⚠️

**Risk:** Data might not convert cleanly.

```typescript
// ⚠️ RISKY: Changing column type
// Example: Change price from INTEGER to REAL

const transaction = this.db.transaction(() => {
  this.db.exec(`
    CREATE TABLE products_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,  -- Was INTEGER, now REAL
      -- ... other columns
    )
  `);

  // Copy data - SQLite will attempt conversion
  this.db.exec(`
    INSERT INTO products_new (id, name, price, ...)
    SELECT id, name, CAST(price AS REAL), ... FROM products
  `);

  this.db.exec(`DROP TABLE products`);
  this.db.exec(`ALTER TABLE products_new RENAME TO products`);
});

transaction();
```

**Potential issues:**

- ❌ TEXT to INTEGER: Non-numeric strings become 0
- ❌ INTEGER to TEXT: Works, but might break queries expecting numbers
- ❌ Loss of precision in some conversions

---

### 4. **Adding NOT NULL Constraints to Existing Tables** ⚠️

**Risk:** Fails if any existing rows have NULL values.

```typescript
// ⚠️ DANGEROUS: Adding NOT NULL to existing column
// This will FAIL if any row has NULL!

// Step 1: First, fill NULL values
this.db.exec(`UPDATE products SET description = 'No description' WHERE description IS NULL`);

// Step 2: Recreate table with NOT NULL constraint
const transaction = this.db.transaction(() => {
  this.db.exec(`
    CREATE TABLE products_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,  -- Adding NOT NULL
      price REAL NOT NULL,
      -- ...
    )
  `);

  this.db.exec(`INSERT INTO products_new SELECT * FROM products`);
  this.db.exec(`DROP TABLE products`);
  this.db.exec(`ALTER TABLE products_new RENAME TO products`);
});

transaction();
```

---

## ❌ Dangerous Operations

These operations can cause **data loss** or **migration failures**:

### 1. **Dropping Columns** ❌

**Risk:** User data is permanently deleted.

```typescript
// ❌ DANGEROUS: Dropping column deletes data!
const transaction = this.db.transaction(() => {
  this.db.exec(`
    CREATE TABLE products_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL
      -- Removed: description column (USER DATA LOST!)
    )
  `);

  this.db.exec(`
    INSERT INTO products_new (id, name, price)
    SELECT id, name, price FROM products
    -- description data is NOT copied = DELETED!
  `);

  this.db.exec(`DROP TABLE products`);
  this.db.exec(`ALTER TABLE products_new RENAME TO products`);
});
```

**Result:** ❌ All user descriptions permanently deleted!

**Better approach:**

```typescript
// ✅ SAFER: Mark column as deprecated, hide in UI
// Keep the data in database for potential recovery
try {
  this.db.exec(`ALTER TABLE products ADD COLUMN description_deprecated TEXT;`);
  this.db.exec(`UPDATE products SET description_deprecated = description WHERE description IS NOT NULL`);
} catch (error) {
  // Already migrated
}

// In your code, just ignore the column
// Users' data is preserved even if not displayed
```

---

### 2. **Dropping Tables** ❌

**Risk:** ALL USER DATA IN THAT TABLE IS LOST FOREVER.

```typescript
// ❌ CATASTROPHIC: Dropping table = deleting all user data!
this.db.exec(`DROP TABLE IF EXISTS old_categories`);
// Result: All categories user created = GONE FOREVER! 🗑️
```

**When this is acceptable:**

- ✓ Table was only for temporary/cache data
- ✓ Table was never used in production
- ✓ You've explicitly backed up and migrated data elsewhere

**Safer approach:**

```typescript
// ✅ SAFER: Rename table instead of dropping
try {
  this.db.exec(`ALTER TABLE old_categories RENAME TO old_categories_backup`);
  console.log("⚠️ Old categories table backed up for potential recovery");
} catch (error) {
  // Already renamed or doesn't exist
}

// Create new table with better schema
this.db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    -- new schema
  )
`);

// Migrate data from backup
this.db.exec(`
  INSERT INTO categories (id, name, businessId)
  SELECT id, name, businessId FROM old_categories_backup
`);
```

---

### 3. **Changing Primary Keys** ❌

**Risk:** Breaks foreign key relationships, can corrupt database.

```typescript
// ❌ EXTREMELY DANGEROUS: Changing PK breaks everything!

// Old schema:
// products: id (TEXT) → PK
// transaction_items: productId (TEXT) → FK to products.id

// Trying to change to:
// products: id (INTEGER) → PK
// This breaks ALL references in transaction_items!

// If you MUST do this:
const transaction = this.db.transaction(() => {
  // 1. Disable FK constraints
  this.db.exec(`PRAGMA foreign_keys = OFF`);

  // 2. Create new products table with INTEGER id
  this.db.exec(`
    CREATE TABLE products_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      -- ...
    )
  `);

  // 3. Create mapping of old TEXT ids to new INTEGER ids
  this.db.exec(`
    INSERT INTO products_new (name, price, ...)
    SELECT name, price, ... FROM products
  `);

  // 4. Update ALL foreign key references
  // This is where it gets VERY complex and error-prone!
  this.db.exec(`
    UPDATE transaction_items 
    SET productId = (
      SELECT pn.id FROM products_new pn
      JOIN products p ON pn.name = p.name  -- Risky mapping!
      WHERE p.id = transaction_items.productId
    )
  `);

  // 5. Drop old tables, rename new ones
  this.db.exec(`DROP TABLE products`);
  this.db.exec(`ALTER TABLE products_new RENAME TO products`);

  // 6. Re-enable FK constraints
  this.db.exec(`PRAGMA foreign_keys = ON`);
});

transaction();
```

**Why this is dangerous:**

- ❌ Complex mapping between old and new IDs
- ❌ If migration fails, database is corrupted
- ❌ Foreign key references might break
- ❌ No easy rollback

**Recommendation:** **DON'T DO THIS IN PRODUCTION UPDATES!** Design PKs correctly from the start.

---

### 4. **Adding UNIQUE Constraints to Existing Data** ❌

**Risk:** Migration fails if duplicate data exists.

```typescript
// ❌ DANGEROUS: Adding UNIQUE constraint when duplicates exist

// User's database might have:
// categories: [
//   { id: 1, name: "Beverages", businessId: "abc" },
//   { id: 2, name: "Beverages", businessId: "abc" },  // Duplicate!
// ]

// Your migration:
this.db.exec(`
  CREATE TABLE categories_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    businessId TEXT NOT NULL,
    UNIQUE(name, businessId)  -- ❌ FAILS if duplicates exist!
  )
`);

// Result: Migration CRASHES, app won't start! 💥
```

**Solution:** Handle duplicates BEFORE adding constraint:

```typescript
// ✅ SAFE: Resolve duplicates first
const transaction = this.db.transaction(() => {
  // 1. Find duplicates
  const duplicates = this.db
    .prepare(
      `
    SELECT name, businessId, GROUP_CONCAT(id) as ids, COUNT(*) as count
    FROM categories
    GROUP BY name, businessId
    HAVING COUNT(*) > 1
  `
    )
    .all();

  // 2. Rename duplicates
  for (const dup of duplicates) {
    const ids = dup.ids.split(",");
    for (let i = 1; i < ids.length; i++) {
      const newName = `${dup.name} (${i})`;
      this.db
        .prepare(
          `
        UPDATE categories 
        SET name = ? 
        WHERE id = ?
      `
        )
        .run(newName, ids[i]);
      console.log(`Renamed duplicate: "${dup.name}" → "${newName}"`);
    }
  }

  // 3. NOW add UNIQUE constraint
  this.db.exec(`
    CREATE TABLE categories_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      businessId TEXT NOT NULL,
      UNIQUE(name, businessId)  -- ✅ Safe now!
    )
  `);

  this.db.exec(`INSERT INTO categories_new SELECT * FROM categories`);
  this.db.exec(`DROP TABLE categories`);
  this.db.exec(`ALTER TABLE categories_new RENAME TO categories`);
});

transaction();
```

---

## 📊 Complete Scenarios Analysis

### Scenario 1: Adding Relationships (Foreign Keys)

**Your Change:**

```typescript
// v3.0.0: No relationship
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  categoryId TEXT  -- Just a text field
);

// v3.2.0: Add FK relationship
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  categoryId TEXT,
  FOREIGN KEY (categoryId) REFERENCES categories(id)
);
```

**Migration Strategy:**

```typescript
// ⚠️ SQLite doesn't support adding FK to existing columns
// Must recreate table

async migrateProductsAddCategoryFK() {
  const transaction = this.db.transaction(() => {
    // Disable FK checks during migration
    this.db.exec(`PRAGMA foreign_keys = OFF`);

    // Create new table with FK
    this.db.exec(`
      CREATE TABLE products_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        categoryId TEXT,
        -- ... other columns
        FOREIGN KEY (categoryId) REFERENCES categories(id)
      )
    `);

    // Validate: Check if all categoryId values exist in categories table
    const invalidRefs = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM products p
      WHERE p.categoryId IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = p.categoryId)
    `).get();

    if (invalidRefs.count > 0) {
      console.warn(`⚠️ Found ${invalidRefs.count} products with invalid category references`);

      // Option 1: Set invalid references to NULL
      this.db.exec(`
        UPDATE products
        SET categoryId = NULL
        WHERE categoryId IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = products.categoryId)
      `);

      // Option 2: Create a default "Uncategorized" category
      const defaultCategoryId = this.uuid.v4();
      this.db.exec(`
        INSERT OR IGNORE INTO categories (id, name, businessId, createdAt, updatedAt)
        VALUES (?, 'Uncategorized', 'default', datetime('now'), datetime('now'))
      `).run(defaultCategoryId);

      this.db.exec(`
        UPDATE products
        SET categoryId = ?
        WHERE categoryId IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = products.categoryId)
      `).run(defaultCategoryId);
    }

    // Copy data
    this.db.exec(`INSERT INTO products_new SELECT * FROM products`);

    // Drop old, rename new
    this.db.exec(`DROP TABLE products`);
    this.db.exec(`ALTER TABLE products_new RENAME TO products`);

    // Recreate indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_categoryId
      ON products(categoryId)
    `);

    // Re-enable FK checks
    this.db.exec(`PRAGMA foreign_keys = ON`);
  });

  try {
    transaction();
    console.log('✅ Products table migrated with FK constraint');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
```

**Result:**

- ✅ Safe if you validate data first
- ✅ Handle orphaned references gracefully
- ⚠️ Test thoroughly - FK constraints can cause issues

---

### Scenario 2: Removing a Table

**Your Change:**

```typescript
// v3.0.0: Had old_logs table
// v3.2.0: Want to remove it
```

**❌ BAD Migration:**

```typescript
this.db.exec(`DROP TABLE IF EXISTS old_logs`);
// All log data = GONE FOREVER!
```

**✅ SAFE Migration:**

```typescript
async removeOldLogsTable() {
  // Step 1: Check if table has data
  const hasData = this.db.prepare(`
    SELECT COUNT(*) as count FROM old_logs
  `).get();

  if (hasData.count > 0) {
    console.log(`⚠️ old_logs has ${hasData.count} rows, backing up...`);

    // Step 2: Rename to backup
    this.db.exec(`ALTER TABLE old_logs RENAME TO old_logs_backup_${Date.now()}`);
    console.log('✅ Table backed up');
  } else {
    // Step 3: If empty, safe to drop
    this.db.exec(`DROP TABLE IF EXISTS old_logs`);
    console.log('✅ Empty table dropped');
  }
}
```

---

### Scenario 3: Altering Column (Adding Constraint)

**Your Change:**

```typescript
// v3.0.0: email TEXT
// v3.2.0: email TEXT UNIQUE
```

**Migration:**

```typescript
async makeEmailUnique() {
  const transaction = this.db.transaction(() => {
    // 1. Find duplicate emails
    const duplicates = this.db.prepare(`
      SELECT email, GROUP_CONCAT(id) as ids, COUNT(*) as count
      FROM users
      WHERE email IS NOT NULL
      GROUP BY email
      HAVING COUNT(*) > 1
    `).all();

    if (duplicates.length > 0) {
      console.log(`⚠️ Found ${duplicates.length} duplicate emails`);

      // 2. Handle duplicates
      for (const dup of duplicates) {
        const ids = dup.ids.split(',');

        // Keep first user, modify others
        for (let i = 1; i < ids.length; i++) {
          const newEmail = `${dup.email}.duplicate${i}@example.com`;
          this.db.prepare(`UPDATE users SET email = ? WHERE id = ?`)
            .run(newEmail, ids[i]);

          console.log(`  Modified duplicate: ${dup.email} → ${newEmail}`);
        }
      }
    }

    // 3. Recreate table with UNIQUE constraint
    this.db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        -- ... other columns
      )
    `);

    this.db.exec(`INSERT INTO users_new SELECT * FROM users`);
    this.db.exec(`DROP TABLE users`);
    this.db.exec(`ALTER TABLE users_new RENAME TO users`);

    // 4. Recreate indexes
    this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  });

  try {
    transaction();
    console.log('✅ Email column now UNIQUE');
  } catch (error) {
    console.error('❌ Failed to make email unique:', error);
    throw error;
  }
}
```

---

### Scenario 4: Deleting Columns

**Your Change:**

```typescript
// v3.0.0: products has 'oldField' column
// v3.2.0: Remove 'oldField' (no longer needed)
```

**❌ DESTRUCTIVE Migration:**

```typescript
// ❌ Data loss!
this.db.exec(`
  CREATE TABLE products_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL
    -- oldField NOT included = DATA DELETED!
  )
`);
```

**✅ SAFER Migration (Soft Delete):**

```typescript
// ✅ Keep data, just don't use it
// Option 1: Rename column to mark as deprecated
try {
  this.db.exec(`ALTER TABLE products RENAME COLUMN oldField TO oldField_deprecated`);
} catch (error) {
  // Might not be supported in older SQLite
}

// Option 2: Just ignore it in code
// Don't select it in queries
const product = this.db
  .prepare(
    `
  SELECT id, name, price 
  FROM products 
  WHERE id = ?
  -- oldField still exists but we don't select it
`
  )
  .get(productId);

// Option 3: Archive to separate table
this.db.exec(`
  CREATE TABLE IF NOT EXISTS products_archive (
    productId TEXT,
    oldField TEXT,
    archivedAt TEXT
  )
`);

this.db.exec(`
  INSERT INTO products_archive (productId, oldField, archivedAt)
  SELECT id, oldField, datetime('now')
  FROM products
  WHERE oldField IS NOT NULL
`);

// Now safe to recreate table without oldField
```

**Best Practice:** Only delete columns if:

1. You're 100% sure data is not needed
2. You've backed up the data elsewhere
3. You've given users warning/export option

---

## 🎯 Best Practices & Migration Strategies

### 1. **Version Your Schema**

```typescript
class DatabaseManager {
  private readonly SCHEMA_VERSION = 5; // Increment with each schema change

  async initialize() {
    // ... existing code

    // Check schema version
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        migrated_at TEXT NOT NULL
      )
    `);

    const currentVersion = this.db
      .prepare(
        `
      SELECT version FROM schema_version ORDER BY version DESC LIMIT 1
    `
      )
      .get();

    const version = currentVersion?.version ?? 0;

    if (version < this.SCHEMA_VERSION) {
      console.log(`📦 Migrating database: v${version} → v${this.SCHEMA_VERSION}`);
      await this.runMigrations(version, this.SCHEMA_VERSION);
    }
  }

  private async runMigrations(fromVersion: number, toVersion: number) {
    const migrations = [
      { version: 1, name: "initial_schema", fn: this.migration_v1.bind(this) },
      { version: 2, name: "add_discounts", fn: this.migration_v2.bind(this) },
      { version: 3, name: "add_product_weights", fn: this.migration_v3.bind(this) },
      { version: 4, name: "add_category_relationships", fn: this.migration_v4.bind(this) },
      { version: 5, name: "make_email_unique", fn: this.migration_v5.bind(this) },
    ];

    for (const migration of migrations) {
      if (migration.version > fromVersion && migration.version <= toVersion) {
        console.log(`  ⏳ Running migration: ${migration.name} (v${migration.version})`);

        try {
          await migration.fn();

          // Record successful migration
          this.db
            .prepare(
              `
            INSERT INTO schema_version (version, migrated_at)
            VALUES (?, datetime('now'))
          `
            )
            .run(migration.version);

          console.log(`  ✅ Migration ${migration.name} completed`);
        } catch (error) {
          console.error(`  ❌ Migration ${migration.name} failed:`, error);
          throw error;
        }
      }
    }
  }

  private migration_v1() {
    // Create initial tables
    this.initializeTables();
  }

  private migration_v2() {
    // Add discounts table
    this.db.exec(`CREATE TABLE IF NOT EXISTS discounts (...)`);
  }

  private migration_v3() {
    // Add weight columns to products
    try {
      this.db.exec(`ALTER TABLE products ADD COLUMN requiresWeight BOOLEAN DEFAULT 0`);
      this.db.exec(`ALTER TABLE products ADD COLUMN pricePerUnit REAL`);
    } catch (error) {
      // Already exists
    }
  }

  private migration_v4() {
    // Add FK relationships
    this.migrateProductsAddCategoryFK();
  }

  private migration_v5() {
    // Make email unique
    this.makeEmailUnique();
  }
}
```

---

### 2. **Always Use Transactions**

```typescript
// ✅ GOOD: Use transaction for all migrations
const transaction = this.db.transaction(() => {
  this.db.exec(`CREATE TABLE ...`);
  this.db.exec(`INSERT INTO ...`);
  this.db.exec(`DROP TABLE ...`);
  this.db.exec(`ALTER TABLE ...`);
});

try {
  transaction();
  console.log("✅ Migration successful");
} catch (error) {
  console.error("❌ Migration failed, rolled back:", error);
  // Database is back to previous state
}
```

---

### 3. **Validate Data Before Schema Changes**

```typescript
async migration_addUniqueConstraint() {
  // 1. Check for violations BEFORE changing schema
  const violations = this.db.prepare(`
    SELECT email, COUNT(*) as count
    FROM users
    GROUP BY email
    HAVING COUNT(*) > 1
  `).all();

  if (violations.length > 0) {
    console.log(`⚠️ Found ${violations.length} email violations, fixing...`);
    // Fix violations
    this.resolveEmailDuplicates();
  }

  // 2. NOW safe to add constraint
  this.db.exec(`
    CREATE UNIQUE INDEX idx_users_email ON users(email)
  `);
}
```

---

### 4. **Handle Migration Failures Gracefully**

```typescript
async initialize() {
  try {
    await this.runMigrations();
  } catch (error) {
    console.error('❌ Database migration failed:', error);

    // Show error to user
    dialog.showErrorBox(
      'Database Migration Failed',
      `The application failed to update your database.\n\n` +
      `Error: ${error.message}\n\n` +
      `Your data is safe. Please contact support with this error message.`
    );

    // Don't continue - app can't run with wrong schema
    app.quit();
  }
}
```

---

### 5. **Backup Before Destructive Operations**

```typescript
async migration_removeOldTable() {
  const dbPath = this.getDatabasePath();
  const backupPath = `${dbPath}.backup.v3.${Date.now()}`;

  // 1. Create backup
  console.log(`📦 Creating backup: ${backupPath}`);
  await fs.copyFile(dbPath, backupPath);

  // 2. Perform migration
  try {
    this.db.exec(`DROP TABLE old_table`);
    console.log('✅ Migration complete, backup available at:', backupPath);
  } catch (error) {
    console.error('❌ Migration failed, restore from:', backupPath);
    throw error;
  }
}
```

---

### 6. **Test with Real User Data**

```bash
# Create test database with v3.0.0 schema
npm run dev  # Run old version, create test data

# Copy database
cp data/pos_system.db data/pos_system_test.db

# Update code with migrations

# Test migration
POS_DB_PATH=data/pos_system_test.db npm run dev

# Verify:
# ✓ App starts successfully
# ✓ All old data present
# ✓ New features work
# ✓ No errors in console
```

---

## 🧪 Testing Your Migrations

### Test Checklist:

```typescript
// Create test suite for migrations
describe("Database Migrations", () => {
  it("should migrate from v1 to v5 without data loss", () => {
    // 1. Create v1 database
    const db_v1 = createV1Database();

    // 2. Insert test data
    insertTestData(db_v1);

    // 3. Run migrations
    const db_v5 = runMigrations(db_v1);

    // 4. Verify data integrity
    expect(db_v5.prepare("SELECT COUNT(*) FROM users").get().count).toBe(10);
    expect(db_v5.prepare("SELECT COUNT(*) FROM products").get().count).toBe(50);

    // 5. Verify new schema
    const schema = db_v5.prepare(`PRAGMA table_info(transactions)`).all();
    expect(schema.some((col) => col.name === "discountAmount")).toBe(true);
  });

  it("should handle duplicate emails during unique constraint migration", () => {
    const db = createDatabaseWithDuplicates();

    // Before: 2 users with same email
    expect(db.prepare('SELECT COUNT(*) FROM users WHERE email = "test@test.com"').get().count).toBe(2);

    migration_v5(db);

    // After: Duplicates resolved
    expect(db.prepare('SELECT COUNT(*) FROM users WHERE email = "test@test.com"').get().count).toBe(1);

    // Verify unique constraint works
    expect(() => {
      db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run("new-id", "test@test.com");
    }).toThrow(); // Should fail due to UNIQUE constraint
  });
});
```

---

## ✅ Summary: Will Auto-Update Work?

### ✅ **YES - Safe Operations:**

- Adding new tables
- Adding columns with DEFAULT values
- Adding indexes
- Adding foreign keys (with validation)

### ⚠️ **MAYBE - Risky Operations (with careful implementation):**

- Adding nullable columns (handle NULL in code)
- Renaming columns (complex table recreation)
- Changing column types (test conversions)
- Adding NOT NULL (after filling values)
- Adding UNIQUE (after resolving duplicates)

### ❌ **DANGEROUS - Can Cause Data Loss:**

- Dropping columns without backup
- Dropping tables without backup
- Changing primary keys
- Adding constraints without validation

---

## 🎯 Final Recommendations:

1. **✅ Always use `CREATE TABLE IF NOT EXISTS`**
2. **✅ Always use `ALTER TABLE` with try-catch**
3. **✅ Always provide DEFAULT values for new columns**
4. **✅ Version your schema and track migrations**
5. **✅ Use transactions for all migrations**
6. **✅ Validate data before adding constraints**
7. **✅ Backup before destructive operations**
8. **✅ Test migrations with real data in VirtualBox**
9. **✅ Handle migration failures gracefully**
10. **✅ Never DROP tables/columns without user consent**

**The Golden Rule:**

> Treat every migration like you're performing surgery on a live patient.  
> One mistake, and the patient (user's data) dies. There's no undo button.

Your users' data is their business - treat it with extreme care! 🔐
