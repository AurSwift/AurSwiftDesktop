# Database Documentation

This directory contains comprehensive documentation for AuraSwift's database system.

## 📚 Documentation Structure

### [Configuration](./Configuration/DATABASE_CONFIG.md)

Database configuration, paths, and environment setup for development and production.

**Topics:**

- Development vs Production database locations
- Environment detection
- Custom database paths
- Database inspection tools
- Migration between environments

### [Seeding](./Seeding/SEEDING_GUIDE.md)

Automatic database seeding with default data on app startup.

**Topics:**

- Default credentials and accounts
- Default business, users, roles, and VAT categories
- How seeding works
- Customization options
- Security considerations

### [Migrations](./Migrations/DATABASE_MIGRATION_SYSTEM.md)

Database schema migration system using Drizzle ORM.

**Topics:**

- Drizzle ORM migration system
- Generating migrations
- Migration execution and tracking
- Production deployment
- Best practices

### [Database System Overview](./DATABASE_SYSTEM.md)

Complete overview of the database system architecture, features, and implementation.

**Topics:**

- System architecture and components
- All database managers (30+ managers)
- Database utilities (validation, repair, compatibility)
- Initialization flow and error handling
- Key features and implementation details

---

## 🗄️ Database System Overview

AuraSwift uses:

- **Database Engine:** SQLite (better-sqlite3)
- **ORM:** Drizzle ORM
- **Migration Tool:** Drizzle Kit
- **Schema Location:** `packages/main/src/database/schema.ts`
- **Migrations Location:** `packages/main/src/database/migrations/`

### Key Features

- ✅ **Type-safe** database operations with Drizzle ORM
- ✅ **Automatic migrations** on app startup
- ✅ **Automatic seeding** with default data
- ✅ **Transaction-safe** migrations with rollback support
- ✅ **Production-ready** with automatic backups

---

## 🚀 Quick Start

### First Time Setup

1. **Start the app:**

   ```bash
   npm start
   ```

2. **Database is automatically:**

   - Created at the appropriate location (dev/prod)
   - Migrated to the latest schema
   - Seeded with default data

3. **Login with default credentials:**
   - Admin: `MrAdmin` / `admin123` / PIN: `1234`
   - Manager: `MrManager` / `manager123` / PIN: `1234`
   - Cashier: `MrCashier` / `cashier123` / PIN: `1234`

### Development Workflow

1. **Make schema changes:**

   ```typescript
   // Edit packages/main/src/database/schema.ts
   ```

2. **Generate migration:**

   ```bash
   npm run db:generate
   ```

3. **Test migration:**

   ```bash
   npm run dev
   ```

4. **Commit migration files:**
   ```bash
   git add packages/main/src/database/migrations/
   git commit -m "Add new feature"
   ```

---

## 📖 Documentation Guide

### For Developers

1. **Setting up database:** Read [Configuration](./Configuration/DATABASE_CONFIG.md)
2. **Understanding seeding:** Read [Seeding Guide](./Seeding/SEEDING_GUIDE.md)
3. **Creating migrations:** Read [Migration System](./Migrations/DATABASE_MIGRATION_SYSTEM.md)

### For Users

1. **Database location:** See [Configuration](./Configuration/DATABASE_CONFIG.md) for where your database is stored
2. **Default accounts:** See [Seeding Guide](./Seeding/SEEDING_GUIDE.md) for login credentials
3. **Troubleshooting:** Check [Configuration](./Configuration/DATABASE_CONFIG.md) troubleshooting section

---

## 🔗 Related Documentation

- **Schema Definition:** `packages/main/src/database/schema.ts`
- **Seeding Logic:** `packages/main/src/database/seed.ts`
- **Migration System:** `packages/main/src/database/drizzle-migrator.ts`
- **Database Manager:** `packages/main/src/database/db-manager.ts`
- **Database Utilities:** `packages/main/src/database/utils/`
  - `db-validator.ts` - File validation
  - `db-compatibility.ts` - Compatibility checking
  - `db-repair.ts` - Database repair
  - `db-path-migration.ts` - Path migration
  - `db-recovery-dialog.ts` - Recovery dialogs
  - `dbInfo.ts` - Database information

---

**Last Updated:** 2025-01-XX
