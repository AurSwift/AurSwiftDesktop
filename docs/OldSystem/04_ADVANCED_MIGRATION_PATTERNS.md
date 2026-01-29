# Advanced Migration Patterns

## Overview

This guide covers complex migration scenarios including foreign keys, UNIQUE constraints, NOT NULL constraints, and data transformations. These operations require careful handling to avoid migration failures.

---

## Table of Contents

1. [The Problem with Constraints](#the-problem-with-constraints)
2. [Foreign Key Migrations](#foreign-key-migrations)
3. [UNIQUE Constraint Migrations](#unique-constraint-migrations)
4. [NOT NULL Constraint Migrations](#not-null-constraint-migrations)
5. [Table Recreation Pattern](#table-recreation-pattern)
6. [Data Transformation Migrations](#data-transformation-migrations)
7. [Complex Relationship Changes](#complex-relationship-changes)
8. [Validation and Safety Checks](#validation-and-safety-checks)

---

## The Problem with Constraints

### Why Constraints Fail

Constraints protect **future data**, but **existing data** might violate them:

```typescript
// ❌ DANGEROUS: Will fail if data violates constraint
this.db.exec(`
  ALTER TABLE products ADD CONSTRAINT unique_sku UNIQUE(sku)
`);
// Error: UNIQUE constraint failed if duplicates exist!
```

**The issue:** SQLite enforces constraints immediately. If existing data doesn't meet the constraint, the migration fails.

### The Solution: Validate → Clean → Apply

```typescript
// ✅ SAFE: Three-step process

// Step 1: Find violations
const duplicates = this.db
  .prepare(
    `
  SELECT sku, COUNT(*) as count 
  FROM products 
  GROUP BY sku 
  HAVING COUNT(*) > 1
`
  )
  .all();

// Step 2: Resolve violations
for (const dup of duplicates) {
  // Fix duplicate SKUs
}

// Step 3: Apply constraint
// Now safe to add UNIQUE constraint
```

---

## Foreign Key Migrations

### Pattern 1: Adding Foreign Key Column

**Scenario:** Add `categoryId` foreign key to `products` table.

```typescript
private migration_v5_add_product_category_fk() {
  console.log('  ⏳ Migration v5: Adding category foreign key to products...');

  // Step 1: Add column (nullable initially)
  try {
    this.db.exec(`
      ALTER TABLE products
      ADD COLUMN categoryId TEXT
    `);
  } catch (error) {
    // Already exists
  }

  // Step 2: Set valid default values
  // Get first category for each business
  const products = this.db.prepare(`
    SELECT p.id, p.businessId,
           (SELECT id FROM categories WHERE businessId = p.businessId LIMIT 1) as defaultCategoryId
    FROM products
    WHERE categoryId IS NULL
  `).all();

  const updateStmt = this.db.prepare(`
    UPDATE products SET categoryId = ? WHERE id = ?
  `);

  for (const product of products) {
    updateStmt.run(product.defaultCategoryId, product.id);
  }

  // Step 3: Now recreate table with foreign key
  this.db.exec('PRAGMA foreign_keys = OFF;');

  this.db.exec(`
    CREATE TABLE products_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      businessId TEXT NOT NULL,
      -- ... other columns
      FOREIGN KEY (categoryId) REFERENCES categories(id),
      FOREIGN KEY (businessId) REFERENCES businesses(id)
    )
  `);

  this.db.exec(`
    INSERT INTO products_new
    SELECT * FROM products
  `);

  this.db.exec('DROP TABLE products;');
  this.db.exec('ALTER TABLE products_new RENAME TO products;');

  this.db.exec('PRAGMA foreign_keys = ON;');

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(5, 'add_product_category_fk');

  console.log('  ✅ Migration v5 completed');
}
```

### Pattern 2: Fixing Orphaned Records

**Scenario:** Add foreign key but orphaned records exist.

```typescript
private migration_v6_cleanup_orphaned_data() {
  console.log('  ⏳ Migration v6: Cleaning up orphaned records...');

  // Find orphaned orders (user_id doesn't exist in users)
  const orphanedOrders = this.db.prepare(`
    SELECT COUNT(*) as count
    FROM orders
    WHERE userId NOT IN (SELECT id FROM users)
    AND userId IS NOT NULL
  `).get();

  if (orphanedOrders.count > 0) {
    console.log(`  ⚠️ Found ${orphanedOrders.count} orphaned orders`);

    // Option 1: Delete orphaned records
    this.db.prepare(`
      DELETE FROM orders
      WHERE userId NOT IN (SELECT id FROM users)
      AND userId IS NOT NULL
    `).run();

    // Option 2: Set to NULL (if column allows)
    // this.db.prepare(`
    //   UPDATE orders SET userId = NULL
    //   WHERE userId NOT IN (SELECT id FROM users)
    // `).run();

    console.log(`  ✅ Cleaned up orphaned orders`);
  }

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(6, 'cleanup_orphaned_data');

  console.log('  ✅ Migration v6 completed');
}
```

---

## UNIQUE Constraint Migrations

### Pattern 1: Adding UNIQUE Constraint (Table Recreation)

**Scenario:** Add UNIQUE constraint on `(name, businessId)` in categories table.

**Real example from AuraSwift:**

```typescript
private migration_v4_add_categories_unique_constraint() {
  console.log('  ⏳ Migration v4: Adding UNIQUE constraint to categories...');

  // Step 1: Check if constraint already exists
  const tableSql = this.db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='categories'
  `).get() as { sql: string } | undefined;

  if (tableSql?.sql.includes('UNIQUE') && tableSql?.sql.includes('name')) {
    console.log('  ℹ️ UNIQUE constraint already exists, skipping');

    this.db.prepare(`
      INSERT OR IGNORE INTO schema_version (version, migration_name, applied_at)
      VALUES (?, ?, datetime('now'))
    `).run(4, 'add_categories_unique_constraint');

    return;
  }

  // Step 2: Find and resolve duplicates
  const duplicates = this.db.prepare(`
    SELECT name, businessId, GROUP_CONCAT(id) as ids, COUNT(*) as count
    FROM categories
    GROUP BY name, businessId
    HAVING COUNT(*) > 1
  `).all() as Array<{ name: string; businessId: string; ids: string; count: number }>;

  if (duplicates.length > 0) {
    console.log(`  ⚠️ Found ${duplicates.length} duplicate categories, resolving...`);

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

        console.log(`    Renamed: "${dup.name}" → "${newName}"`);
      }
    }
  }

  // Step 3: Recreate table with UNIQUE constraint
  const transaction = this.db.transaction(() => {
    this.db.exec('PRAGMA foreign_keys = OFF;');

    this.db.exec(`
      CREATE TABLE categories_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parentId TEXT,
        description TEXT,
        businessId TEXT NOT NULL,
        isActive BOOLEAN DEFAULT 1,
        sortOrder INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (businessId) REFERENCES businesses (id),
        FOREIGN KEY (parentId) REFERENCES categories_new (id) ON DELETE SET NULL,
        UNIQUE(name, businessId)
      )
    `);

    this.db.exec(`
      INSERT INTO categories_new
      SELECT * FROM categories
    `);

    this.db.exec('DROP TABLE categories;');
    this.db.exec('ALTER TABLE categories_new RENAME TO categories;');

    // Recreate indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_categories_businessId ON categories(businessId);
      CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
      CREATE INDEX IF NOT EXISTS idx_categories_sortOrder ON categories(sortOrder);
    `);

    this.db.exec('PRAGMA foreign_keys = ON;');
  });

  transaction();

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(4, 'add_categories_unique_constraint');

  console.log('  ✅ Migration v4 completed');
}
```

### Pattern 2: Simple UNIQUE via Index

**Scenario:** Add UNIQUE constraint using index (simpler but less strict).

```typescript
private migration_vN_add_unique_index() {
  console.log('  ⏳ Migration vN: Adding unique index...');

  // Find duplicates
  const duplicates = this.db.prepare(`
    SELECT email, COUNT(*) as count
    FROM users
    GROUP BY email
    HAVING COUNT(*) > 1
  `).all();

  if (duplicates.length > 0) {
    console.log(`  ⚠️ Found ${duplicates.length} duplicate emails`);

    // Resolve: append user ID to make unique
    for (const dup of duplicates) {
      const users = this.db.prepare(`
        SELECT id, email FROM users WHERE email = ?
      `).all(dup.email);

      // Keep first, modify others
      for (let i = 1; i < users.length; i++) {
        const newEmail = `${users[i].id}_${users[i].email}`;
        this.db.prepare(`
          UPDATE users SET email = ? WHERE id = ?
        `).run(newEmail, users[i].id);
      }
    }
  }

  // Create unique index
  this.db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
    ON users(email)
  `);

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'add_unique_email_index');

  console.log('  ✅ Migration vN completed');
}
```

---

## NOT NULL Constraint Migrations

### Pattern: Set Defaults then Add Constraint

**Scenario:** Make `email` column NOT NULL.

```typescript
private migration_vN_make_email_required() {
  console.log('  ⏳ Migration vN: Making email required...');

  // Step 1: Find NULL values
  const nullCount = this.db.prepare(`
    SELECT COUNT(*) as count FROM users WHERE email IS NULL
  `).get() as { count: number };

  if (nullCount.count > 0) {
    console.log(`  ⚠️ Found ${nullCount.count} users without email`);

    // Step 2: Set default values
    // Option A: Generate unique placeholder emails
    this.db.prepare(`
      UPDATE users
      SET email = 'user_' || id || '@placeholder.com'
      WHERE email IS NULL
    `).run();

    // Option B: Delete records (if acceptable)
    // this.db.prepare(`
    //   DELETE FROM users WHERE email IS NULL
    // `).run();

    console.log(`  ✅ Set default emails for users`);
  }

  // Step 3: Recreate table with NOT NULL constraint
  // (SQLite doesn't support ALTER COLUMN)
  this.db.exec('PRAGMA foreign_keys = OFF;');

  this.db.exec(`
    CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,  -- Now NOT NULL
      -- ... other columns
    )
  `);

  this.db.exec(`INSERT INTO users_new SELECT * FROM users`);
  this.db.exec('DROP TABLE users;');
  this.db.exec('ALTER TABLE users_new RENAME TO users;');

  this.db.exec('PRAGMA foreign_keys = ON;');

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'make_email_required');

  console.log('  ✅ Migration vN completed');
}
```

---

## Table Recreation Pattern

### When to Use

SQLite doesn't support many ALTER TABLE operations:

- Can't drop columns
- Can't modify column types
- Can't add NOT NULL to existing column
- Can't add CHECK constraints

**Solution:** Recreate the table with desired schema.

### Safe Recreation Pattern

```typescript
private migration_vN_recreate_table() {
  console.log('  ⏳ Migration vN: Recreating table with new schema...');

  const transaction = this.db.transaction(() => {
    // 1. Disable foreign keys temporarily
    this.db.exec('PRAGMA foreign_keys = OFF;');

    // 2. Create new table with desired schema
    this.db.exec(`
      CREATE TABLE table_name_new (
        id TEXT PRIMARY KEY,
        column1 TEXT NOT NULL,
        column2 REAL CHECK(column2 >= 0),
        -- ... desired schema with constraints
        UNIQUE(column1, column3)
      )
    `);

    // 3. Copy data (with transformations if needed)
    this.db.exec(`
      INSERT INTO table_name_new (id, column1, column2)
      SELECT id, column1, COALESCE(column2, 0)
      FROM table_name
    `);

    // 4. Drop old table
    this.db.exec('DROP TABLE table_name;');

    // 5. Rename new table
    this.db.exec('ALTER TABLE table_name_new RENAME TO table_name;');

    // 6. Recreate indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_table_column1 ON table_name(column1);
    `);

    // 7. Re-enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON;');
  });

  transaction();

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'recreate_table');

  console.log('  ✅ Migration vN completed');
}
```

---

## Data Transformation Migrations

### Pattern 1: Normalize Data

**Scenario:** Split full name into firstName and lastName.

```typescript
private migration_vN_split_name() {
  console.log('  ⏳ Migration vN: Splitting full name into first/last...');

  // Add new columns
  try {
    this.db.exec(`ALTER TABLE users ADD COLUMN firstName TEXT;`);
    this.db.exec(`ALTER TABLE users ADD COLUMN lastName TEXT;`);
  } catch (error) {
    // Already exists
  }

  // Transform data
  const users = this.db.prepare(`
    SELECT id, name FROM users WHERE firstName IS NULL
  `).all();

  const updateStmt = this.db.prepare(`
    UPDATE users SET firstName = ?, lastName = ? WHERE id = ?
  `);

  for (const user of users) {
    const parts = user.name.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    updateStmt.run(firstName, lastName, user.id);
  }

  console.log(`  ✅ Split names for ${users.length} users`);

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'split_user_names');

  console.log('  ✅ Migration vN completed');
}
```

### Pattern 2: Denormalize Data

**Scenario:** Add `productName` to transaction_items for faster queries.

```typescript
private migration_vN_denormalize_product_names() {
  console.log('  ⏳ Migration vN: Denormalizing product names...');

  // Add column
  try {
    this.db.exec(`
      ALTER TABLE transaction_items
      ADD COLUMN productName TEXT
    `);
  } catch (error) {
    // Already exists
  }

  // Populate from products table
  this.db.exec(`
    UPDATE transaction_items
    SET productName = (
      SELECT name FROM products WHERE id = transaction_items.productId
    )
    WHERE productName IS NULL
  `);

  const updated = this.db.prepare(`
    SELECT COUNT(*) as count FROM transaction_items WHERE productName IS NOT NULL
  `).get() as { count: number };

  console.log(`  ✅ Updated ${updated.count} transaction items`);

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'denormalize_product_names');

  console.log('  ✅ Migration vN completed');
}
```

---

## Complex Relationship Changes

### Pattern: Table Splitting

**Scenario:** Split `users` table into `users` + `user_profiles`.

```typescript
private migration_vN_split_user_table() {
  console.log('  ⏳ Migration vN: Splitting users into users + profiles...');

  const transaction = this.db.transaction(() => {
    // 1. Create profiles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        bio TEXT,
        avatarUrl TEXT,
        phoneNumber TEXT,
        dateOfBirth TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(userId)
      )
    `);

    // 2. Migrate data
    this.db.exec(`
      INSERT INTO user_profiles (id, userId, bio, avatarUrl, phoneNumber, createdAt, updatedAt)
      SELECT
        lower(hex(randomblob(16))) as id,
        id as userId,
        bio,
        avatarUrl,
        phoneNumber,
        datetime('now'),
        datetime('now')
      FROM users
      WHERE bio IS NOT NULL OR avatarUrl IS NOT NULL OR phoneNumber IS NOT NULL
    `);

    // 3. Remove columns from users (requires table recreation)
    this.db.exec('PRAGMA foreign_keys = OFF;');

    this.db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        role TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
        -- bio, avatarUrl, phoneNumber removed
      )
    `);

    this.db.exec(`
      INSERT INTO users_new
      SELECT id, email, password, firstName, lastName, role, createdAt, updatedAt
      FROM users
    `);

    this.db.exec('DROP TABLE users;');
    this.db.exec('ALTER TABLE users_new RENAME TO users;');

    this.db.exec('PRAGMA foreign_keys = ON;');
  });

  transaction();

  console.log('  ✅ Split users table successfully');

  // Record migration
  this.db.prepare(`
    INSERT INTO schema_version (version, migration_name, applied_at)
    VALUES (?, ?, datetime('now'))
  `).run(N, 'split_users_table');

  console.log('  ✅ Migration vN completed');
}
```

---

## Validation and Safety Checks

### Pre-Migration Validation

```typescript
private validateBeforeConstraintMigration() {
  console.log('  🔍 Validating data before adding constraints...');

  // Check 1: No NULL values in soon-to-be NOT NULL column
  const nullCount = this.db.prepare(`
    SELECT COUNT(*) as count FROM table_name WHERE column IS NULL
  `).get() as { count: number };

  if (nullCount.count > 0) {
    throw new Error(
      `Cannot add NOT NULL constraint: ${nullCount.count} NULL values found. ` +
      `Please run data cleanup migration first.`
    );
  }

  // Check 2: No duplicates for UNIQUE constraint
  const duplicates = this.db.prepare(`
    SELECT column, COUNT(*) as count
    FROM table_name
    GROUP BY column
    HAVING COUNT(*) > 1
  `).all();

  if (duplicates.length > 0) {
    throw new Error(
      `Cannot add UNIQUE constraint: ${duplicates.length} duplicate values found. ` +
      `Please run deduplication migration first.`
    );
  }

  // Check 3: No orphaned records for foreign key
  const orphaned = this.db.prepare(`
    SELECT COUNT(*) as count
    FROM child_table
    WHERE parent_id NOT IN (SELECT id FROM parent_table)
    AND parent_id IS NOT NULL
  `).get() as { count: number };

  if (orphaned.count > 0) {
    throw new Error(
      `Cannot add foreign key: ${orphaned.count} orphaned records found. ` +
      `Please run cleanup migration first.`
    );
  }

  console.log('  ✅ All validation checks passed');
}
```

### Post-Migration Verification

```typescript
private verifyConstraints() {
  console.log('  🔍 Verifying constraints...');

  // Verify UNIQUE constraint
  const duplicates = this.db.prepare(`
    SELECT column, COUNT(*) as count
    FROM table_name
    GROUP BY column
    HAVING COUNT(*) > 1
  `).all();

  if (duplicates.length > 0) {
    console.error('  ❌ UNIQUE constraint violated!', duplicates);
    throw new Error('Migration verification failed: UNIQUE constraint violated');
  }

  // Verify foreign keys
  this.db.exec('PRAGMA foreign_key_check;');

  // Verify NOT NULL
  const nulls = this.db.prepare(`
    SELECT COUNT(*) as count FROM table_name WHERE column IS NULL
  `).get() as { count: number };

  if (nulls.count > 0) {
    console.error('  ❌ NOT NULL constraint violated!');
    throw new Error('Migration verification failed: NULL values found');
  }

  console.log('  ✅ All constraints verified');
}
```

---

## Summary: Safe Migration Checklist

### For Foreign Keys:

- [ ] Check for orphaned records
- [ ] Delete or fix orphaned data
- [ ] Add column (nullable initially)
- [ ] Populate with valid values
- [ ] Recreate table with foreign key

### For UNIQUE Constraints:

- [ ] Check for duplicates
- [ ] Resolve duplicates (rename/merge/delete)
- [ ] Add UNIQUE constraint or index
- [ ] Verify no duplicates remain

### For NOT NULL Constraints:

- [ ] Check for NULL values
- [ ] Set default values
- [ ] Recreate table with NOT NULL
- [ ] Verify no NULLs remain

### General:

- [ ] Wrap in transaction
- [ ] Disable foreign_keys if recreating tables
- [ ] Log progress for debugging
- [ ] Record migration in schema_version
- [ ] Test with real production-like data

---

## Related Documentation

- **[Migration Quick Start](./02_MIGRATION_QUICK_START.md)** - Basic migration patterns
- **[Migration System Guide](./03_MIGRATION_SYSTEM_GUIDE.md)** - Complete system overview
- **[Auto-Update Integration](./05_AUTO_UPDATE_INTEGRATION.md)** - How migrations work with updates

---

**Back to:** [Documentation Index](./INDEX.md)
