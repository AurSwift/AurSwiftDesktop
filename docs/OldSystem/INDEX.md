# Database Documentation Index

## 📚 Complete Documentation Guide

This directory contains all documentation for AuraSwift's database system, including schema management, migrations, and auto-update integration.

---

## 🗂️ Documentation Structure

### 1. Getting Started

- **[Database Architecture](./01_DATABASE_ARCHITECTURE.md)** - Overview of the refactored database structure, modules, and design patterns

### 2. Migration System

- **[Migration Quick Start](./02_MIGRATION_QUICK_START.md)** - 5-minute guide to adding new migrations
- **[Migration System Guide](./03_MIGRATION_SYSTEM_GUIDE.md)** - Complete versioning system, best practices, and API reference
- **[Advanced Migration Patterns](./04_ADVANCED_MIGRATION_PATTERNS.md)** - Handling constraints, relationships, and complex schema changes

### 3. Auto-Update Integration

- **[Auto-Update Integration](./05_AUTO_UPDATE_INTEGRATION.md)** - How migrations work with Electron auto-updater

### 4. Backup System

- **[Database Backup System](./06_DATABASE_BACKUP_SYSTEM.md)** - Complete backup documentation, recovery procedures, and best practices

### 5. Drizzle ORM Integration

- **[Drizzle ORM Integration](./07_DRIZZLE_ORM_INTEGRATION.md)** - Type-safe queries, gradual migration guide, and best practices

---

## 📖 Quick Navigation

### I want to...

**Get an overview of the database system**
→ Read [Database Architecture](./01_DATABASE_ARCHITECTURE.md)

**Add a new migration**
→ Follow [Migration Quick Start](./02_MIGRATION_QUICK_START.md)

**Understand how versioning works**
→ Study [Migration System Guide](./03_MIGRATION_SYSTEM_GUIDE.md)

**Add foreign keys or UNIQUE constraints**
→ Check [Advanced Migration Patterns](./04_ADVANCED_MIGRATION_PATTERNS.md)

**Understand auto-updates and migrations**
→ Read [Auto-Update Integration](./05_AUTO_UPDATE_INTEGRATION.md)

**Understand database backups**
→ Read [Database Backup System](./06_DATABASE_BACKUP_SYSTEM.md)

**Recover from backup**
→ See [Database Backup System - Recovery Procedures](./06_DATABASE_BACKUP_SYSTEM.md#recovery-procedures)

**Use Drizzle ORM for type-safe queries**
→ Read [Drizzle ORM Integration](./07_DRIZZLE_ORM_INTEGRATION.md)

**Write type-safe queries**
→ See [Drizzle ORM - Type-Safe Queries](./07_DRIZZLE_ORM_INTEGRATION.md#type-safe-queries)

---

## 🎯 Common Tasks

### Adding a Column

```typescript
// In migrations.ts
{
  version: 5,
  name: "add_products_weight",
  description: "Add weight field to products table",
  up: (db) => {
    const tableInfo = db.pragma("table_info(products)");
    const columnNames = tableInfo.map((col) => col.name);

    if (!columnNames.includes("weight")) {
      db.exec(`ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0;`);
      console.log("      ✅ Added 'weight' column");
    }
  }
}
```

See: [Migration Quick Start](./02_MIGRATION_QUICK_START.md#add-a-column)

### Creating a Table

```typescript
{
  version: 6,
  name: "create_loyalty_table",
  description: "Create loyalty points tracking table",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        points INTEGER DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
  }
}
```

See: [Migration Quick Start](./02_MIGRATION_QUICK_START.md#add-a-table)

### Adding Constraints

```typescript
// Requires data validation first!
// See Advanced Migration Patterns
```

See: [Advanced Migration Patterns](./04_ADVANCED_MIGRATION_PATTERNS.md)

---

## 🔧 Current System Status

**Schema Version:** 2 (as of refactor)
**Migration System:** SQLite PRAGMA user_version
**Auto-Backup:** ✅ Enabled (keeps last 10)
**Integrity Checks:** ✅ Before/after migrations
**Transaction Safety:** ✅ Atomic migrations

---

## 📂 File Locations

```
packages/main/src/
├── database.ts                    # Monolithic database (being refactored)
└── database/                      # New modular structure (in progress)
    ├── versioning/
    │   ├── index.ts              # Migration runner
    │   └── migrations.ts         # Migration definitions
    └── docs/                     # You are here!
        ├── INDEX.md              # This file
        ├── README.md             # Quick overview
        ├── 01_DATABASE_ARCHITECTURE.md
        ├── 02_MIGRATION_QUICK_START.md
        ├── 03_MIGRATION_SYSTEM_GUIDE.md
        ├── 04_ADVANCED_MIGRATION_PATTERNS.md
        ├── 05_AUTO_UPDATE_INTEGRATION.md
        ├── 06_DATABASE_BACKUP_SYSTEM.md
        └── 07_DRIZZLE_ORM_INTEGRATION.md
```

**Backups stored at:**

- Development: `./data/backups/`
- Production: `~/Library/Application Support/AuraSwift/backups/` (macOS)
- Production: `%APPDATA%\AuraSwift\backups\` (Windows)

See: [Database Backup System](./06_DATABASE_BACKUP_SYSTEM.md) for complete backup documentation

---

## 🚀 Related Documentation

### Auto-Update System

See: `/docs/AutoUpdate/`

- Complete update workflow documentation
- Schema change safety guide
- Migration best practices for production

### Database Types

See: `/types/database.d.ts`

- Central type definitions
- Interface documentation

---

## 💡 Quick Tips

- **Migrations are immutable** - Never modify after release
- **Test with fresh AND existing databases** before releasing
- **Always increment version sequentially** (no gaps)
- **Make migrations idempotent** (safe to re-run)
- **Check for existing structures** before creating
- **Use transactions** for data transformations

---

## 📞 Need Help?

1. Check the relevant guide above
2. Search for examples in `migrations.ts`
3. Review console logs during migration
4. Check backup files in `data/backups/`

---

**Last Updated:** November 8, 2025  
**Current Version:** v2.0 (Refactored migration system)
