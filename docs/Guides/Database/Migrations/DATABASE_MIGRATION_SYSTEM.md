# 🗄️ Database Migration System - Drizzle ORM

**Status:** ✅ PRODUCTION READY  
**Migration System:** Drizzle ORM with Drizzle Kit  
**Database:** SQLite (better-sqlite3)

---

## 🎯 Overview

AuraSwift uses **Drizzle ORM** with **Drizzle Kit** for database migrations. This provides a type-safe, automated migration system that tracks applied migrations and ensures schema consistency across app updates.

---

## ✅ How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    App Startup Process                       │
├─────────────────────────────────────────────────────────────┤
│ 1. App starts                                                │
│ 2. Database.initialize() called                             │
│    ├── Connect to SQLite database                           │
│    ├── Initialize Drizzle ORM                               │
│    ├── Run Drizzle migrations automatically                 │
│    │   ├── Check __drizzle_migrations table                 │
│    │   ├── Find pending migrations in migrations/ folder    │
│    │   ├── Create backup (if production)                    │
│    │   ├── Apply pending migrations in order               │
│    │   │   └── Each migration runs in its own transaction   │
│    │   ├── Update __drizzle_migrations table                │
│    │   └── Verify database integrity                        │
│    └── ✅ Database ready                                     │
│ 3. Seed default data (if needed)                            │
│ 4. App runs normally                                         │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. **Drizzle Kit Migration Generation**

Migrations are generated automatically from schema changes:

```bash
# Generate migration after schema changes
npm run db:generate
```

This command:

- Compares `packages/main/src/database/schema.ts` with current database state
- Generates SQL migration files in `packages/main/src/database/migrations/`
- Creates files like `0001_spicy_sir_ram.sql`, `0002_friendly_orphan.sql`, etc.

#### 2. **Migration File Structure**

Migrations are stored as SQL files:

```
packages/main/src/database/migrations/
├── 0000_friendly_sunset_bain.sql
├── 0001_spicy_sir_ram.sql
├── 0002_friendly_orphan.sql
├── 0003_damp_victor_mancha.sql
└── ...
```

Each file contains SQL statements to transform the database schema.

#### 3. **Migration Tracking**

Drizzle tracks applied migrations in the `__drizzle_migrations` table:

```sql
CREATE TABLE __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL,
  created_at INTEGER
);
```

This ensures:

- ✅ Migrations only run once
- ✅ Migrations run in order
- ✅ No duplicate migrations
- ✅ Track migration history

#### 4. **Automatic Migration Execution**

Migrations run automatically on app startup via `packages/main/src/database/drizzle-migrator.ts`:

```typescript
// Called from db-manager.ts during initialization
await runDrizzleMigrations(drizzleDb, rawDb, dbPath);
```

**Safety Features:**

- ✅ Automatic backups before migrations (production mode)
- ✅ Integrity checks before and after migrations
- ✅ Transaction-safe (each migration in its own transaction)
- ✅ Rollback on failure (transaction rollback)
- ✅ Detailed logging for debugging

#### 5. **Migration Folder Detection**

The system automatically finds migrations in both development and production:

**Development:**

- `packages/main/src/database/migrations/` (source folder)

**Production (checks in order):**

1. `process.resourcesPath/migrations` (electron-builder extraResources)
2. `__dirname/migrations` (inside asar bundle)
3. `app.getAppPath()/node_modules/@app/main/dist/migrations`
4. `app.getAppPath()/database/migrations` (legacy)

---

## 📝 Adding New Migrations

### Step 1: Update Schema

Edit `packages/main/src/database/schema.ts`:

```typescript
export const products = createTable("products", {
  // ... existing columns ...
  barcode: text("barcode"), // Add new column
  // ...
});
```

### Step 2: Generate Migration

```bash
npm run db:generate
```

This creates a new SQL file in `packages/main/src/database/migrations/` with the necessary ALTER TABLE statements.

### Step 3: Review Generated Migration

Check the generated SQL file to ensure it's correct:

```sql
-- Example: packages/main/src/database/migrations/0008_add_barcode.sql
ALTER TABLE products ADD COLUMN barcode TEXT;
```

### Step 4: Commit Migration

```bash
git add packages/main/src/database/migrations/
git commit -m "Add barcode column to products"
```

### Step 5: Test Migration

```bash
# Run app - migration will apply automatically
npm run dev
```

Check console output:

```
🚀 Running Drizzle ORM Migrations...
   📁 Migrations folder: /path/to/migrations
   ⚙️  Applying pending migrations...
   ✅ Migration 0008_add_barcode applied
   ✅ All migrations completed successfully!
```

---

## 🔧 Configuration

### Drizzle Config

Located at `drizzle.config.ts`:

```typescript
export default {
  schema: "./packages/main/src/database/schema.ts",
  out: "./packages/main/src/database/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/pos_system.db",
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

### Package.json Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate"
  }
}
```

---

## 🧪 Testing Migrations

### Test Scenarios

#### 1. **Fresh Install (No existing database)**

```bash
# Expected: All migrations applied, database created
rm -rf data/pos_system.db
npm run dev
# Check: All tables exist, __drizzle_migrations has all entries
```

#### 2. **Update from Previous Version**

```bash
# Simulate old database
# (Use a database from a previous version)
npm run dev
# Expected: Only new migrations applied
# Check: __drizzle_migrations shows new entries
```

#### 3. **Failed Migration (with Rollback)**

If a migration fails:

- Transaction automatically rolls back
- Database remains in previous state
- Error logged with details
- App may not start (depending on error severity)

#### 4. **Duplicate Migration Run**

```bash
# Run app twice without changes
npm run dev
npm run dev
# Expected: "No pending migrations" or similar message
# Check: Migrations only applied once
```

---

## 🚨 Error Handling

### Migration Errors

All errors are caught and handled gracefully:

```typescript
try {
  await runDrizzleMigrations(drizzleDb, rawDb, dbPath);
} catch (error) {
  logger.error("❌ Migration failed:", error);
  // Transaction already rolled back
  // Database in previous consistent state
  // App may not start (prevents inconsistent state)
}
```

### Recovery Options

1. **Automatic Rollback**

   - Transaction automatically rolled back
   - Database reverts to previous consistent state
   - No data corruption

2. **Restore from Backup** (Production)

   - Backups created automatically before migrations
   - Located in user data directory
   - Can be restored manually if needed

3. **Manual Fix**
   - Check migration SQL for issues
   - Fix schema or migration file
   - Re-run migration

---

## 📦 Production Deployment

### Migration Bundle

For production, migrations must be bundled with the app:

**Option 1: extraResources (Recommended)**

In `electron-builder.mjs`:

```javascript
extraResources: [
  {
    from: "packages/main/src/database/migrations",
    to: "migrations",
    filter: ["**/*.sql"],
  },
],
```

**Option 2: Include in asar**

Migrations can be bundled in the asar archive, but extraResources is preferred for easier updates.

### Deployment Checklist

- [ ] All migrations tested locally
- [ ] Migrations tested on copy of production data
- [ ] Backup system verified
- [ ] Rollback tested
- [ ] Error messages are user-friendly
- [ ] Documentation updated
- [ ] Release notes include migration info
- [ ] Migrations bundled correctly for production

---

## 🔐 Best Practices

### DO ✅

1. **Always test migrations locally first**
2. **Review generated SQL before committing**
3. **Keep migrations small and focused**
4. **Test with real production data copies**
5. **Create backups before major migrations**
6. **Document breaking changes in release notes**
7. **Use transactions (automatic with Drizzle)**
8. **Verify integrity after migrations**

### DON'T ❌

1. **Never modify existing migration files** (create new ones instead)
2. **Don't delete old migrations** (needed for upgrades from old versions)
3. **Don't skip migration generation** (always use `npm run db:generate`)
4. **Don't manually edit database schema** (use migrations)
5. **Don't ignore migration errors** (fix before deploying)
6. **Don't run migrations outside the app** (let the app handle it)

---

## 📊 Migration Flow Diagram

### Normal Update Flow

```
┌──────────────────────────────────────────────────────────────┐
│ User's Database: v1.0.4 (migrations 0000-0005 applied)      │
└───────────────────┬──────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ 1. Auto-updater downloads v1.3.0                              │
│    ✅ Download succeeds                                      │
└───────────────────┬──────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ 2. Install v1.3.0 files                                       │
│    ✅ Installation succeeds                                  │
└───────────────────┬──────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ 3. App restarts with v1.3.0 code                             │
└───────────────────┬──────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ 4. Database.initialize() called                               │
│    │                                                          │
│    ├─ Initialize Drizzle ORM                                 │
│    ├─ Check __drizzle_migrations table                       │
│    │  └─ Found: 0000, 0001, 0002, 0003, 0004, 0005         │
│    │                                                          │
│    ├─ Find pending migrations                                │
│    │  └─ Found: 0006, 0007 (new in v1.3.0)                  │
│    │                                                          │
│    ├─ 📦 Create backup (production only)                     │
│    │  └─ backups/pos_system_v2025-01-XX.db                  │
│    │                                                          │
│    ├─ 🔧 Run Migration 0006:                                 │
│    │  ├─ BEGIN TRANSACTION                                   │
│    │  ├─ Execute SQL from 0006_*.sql                        │
│    │  ├─ Insert into __drizzle_migrations                   │
│    │  └─ COMMIT ✅                                           │
│    │                                                          │
│    ├─ 🔧 Run Migration 0007:                                 │
│    │  ├─ BEGIN TRANSACTION                                   │
│    │  ├─ Execute SQL from 0007_*.sql                        │
│    │  ├─ Insert into __drizzle_migrations                   │
│    │  └─ COMMIT ✅                                           │
│    │                                                          │
│    ├─ ✅ Verify integrity: OK                                │
│    └─ ✅ Database ready                                      │
└───────────────────┬──────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ 5. ✅ App starts normally with v1.3.0                        │
│    - All features work                                        │
│    - Database schema matches code expectations               │
│    - User data preserved                                     │
└───────────────────────────────────────────────────────────────┘
```

---

## 🎯 Benefits of Drizzle Migration System

### For Users

- ✅ **Seamless updates** - Migrations run automatically
- ✅ **Data safety** - Automatic backups before changes
- ✅ **No manual steps** - Everything happens in background
- ✅ **Clear errors** - If something fails, they know why

### For Developers

- ✅ **Type-safe** - Schema changes in TypeScript
- ✅ **Automatic generation** - No manual SQL writing
- ✅ **Version control** - Migrations tracked in git
- ✅ **Easy rollback** - Can revert problematic migrations
- ✅ **Test migrations** - Run on copies before production

### For DevOps

- ✅ **Automated testing** - Can test migration paths automatically
- ✅ **Monitoring** - Can check migration status in bug reports
- ✅ **Support** - Know exactly what migrations user has applied

---

## 📄 Summary

The Drizzle ORM migration system provides:

1. **Automatic Migration Generation** - From TypeScript schema changes
2. **Migration Tracking** - Via `__drizzle_migrations` table
3. **Transaction Safety** - Each migration runs atomically
4. **Backup System** - Automatic backups before migrations (production)
5. **Error Handling** - Graceful failures with rollback
6. **Production Ready** - Handles both development and production environments

**Result:** Database schema updates work seamlessly across app versions! 🎉

---

**Last Updated:** 2025-01-XX  
**Migration System:** Drizzle ORM with Drizzle Kit  
**Database:** SQLite (better-sqlite3)  
**Migration Location:** `packages/main/src/database/migrations/`
