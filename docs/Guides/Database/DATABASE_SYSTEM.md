# Database System - Complete Overview

This document provides a comprehensive overview of AuraSwift's database system, including architecture, features, and implementation details.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Database Managers](#database-managers)
- [Database Utilities](#database-utilities)
- [Initialization Flow](#initialization-flow)
- [Error Handling & Recovery](#error-handling--recovery)
- [Key Features](#key-features)
- [Implementation Details](#implementation-details)

---

## Architecture Overview

### Technology Stack

- **Database Engine:** SQLite (better-sqlite3)
- **ORM:** Drizzle ORM
- **Migration Tool:** Drizzle Kit
- **Schema Definition:** TypeScript (`packages/main/src/database/schema.ts`)
- **Migrations:** SQL files (`packages/main/src/database/migrations/`)

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Database System Architecture              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  DBManager      │───▶│  Drizzle ORM    │                 │
│  │  (Low-level)    │    │  (Type-safe)    │                 │
│  └─────────────────┘    └─────────────────┘                 │
│         │                       │                             │
│         │                       ▼                             │
│         │              ┌─────────────────┐                   │
│         │              │  Database        │                   │
│         │              │  Managers        │                   │
│         │              │  (Business Logic)│                   │
│         │              └─────────────────┘                   │
│         │                                                      │
│         ▼                                                      │
│  ┌─────────────────────────────────────────────┐             │
│  │  Utilities Layer                            │             │
│  │  - Validation                               │             │
│  │  - Compatibility Checking                   │             │
│  │  - Repair & Recovery                        │             │
│  │  - Path Migration                           │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Core Files

- **`db-manager.ts`** - Low-level database initialization and connection management
- **`index.ts`** - Main entry point, creates and exports all managers (lazy initialization; see below)
- **`drizzle.ts`** - Drizzle ORM initialization wrapper
- **`drizzle-migrator.ts`** - Migration execution system
- **`seed.ts`** - Default data seeding
- **`schema.ts`** - Database schema definitions (2600+ lines)

---

## Database Managers

The database system uses a manager pattern where each domain has its own manager class. All managers use Drizzle ORM for type-safe database operations.

### Available Managers

#### Core Business Managers

- **`UserManager`** - User authentication, profiles, and management
- **`BusinessManager`** - Business/organization management
- **`SessionManager`** - User session management
- **`ProductManager`** - Product catalog and management
- **`CategoryManager`** - Product category hierarchy
- **`InventoryManager`** - Inventory tracking and management
- **`TransactionManager`** - Sales transactions and processing
- **`CashDrawerManager`** - Cash drawer operations and reconciliation
- **`ShiftManager`** - Cashier shift management
- **`ReportManager`** - Business reports and analytics

#### RBAC (Role-Based Access Control) Managers

- **`RoleManager`** - Role definitions and management
- **`UserRoleManager`** - User-role assignments
- **`UserPermissionManager`** - Permission management

#### Advanced Features Managers

- **`TimeTrackingManager`** - Employee time tracking
- **`TimeTrackingReportManager`** - Time tracking reports
- **`AuditManager`** - System audit functionality
- **`AuditLogManager`** - Comprehensive audit logging
- **`SettingsManager`** - Application settings management
- **`DiscountManager`** - Discount and promotion management
- **`ScheduleManager`** - Employee scheduling
- **`AgeVerificationManager`** - Age-restricted product verification

#### Inventory & Supply Chain Managers

- **`BatchManager`** - Product batch/lot tracking
- **`SupplierManager`** - Supplier management
- **`StockMovementManager`** - Stock movement tracking
- **`ExpirySettingsManager`** - Product expiry configuration
- **`ExpiryNotificationManager`** - Expiry alerts and notifications
- **`SalesUnitSettingsManager`** - Sales unit configuration

#### VAT & Tax Managers

- **`VatCategoryManager`** - VAT category management

#### Point of Sale Managers

- **`CartManager`** - Shopping cart management
- **`TerminalManager`** - POS terminal management

#### Data Management Managers

- **`ImportManager`** - Data import functionality
- **`CategoryManager`** - Category management with hierarchy support

### Manager Pattern

All managers follow a consistent pattern:

```typescript
class ManagerName {
  constructor(drizzle: BetterSQLite3Database, uuid: { v4: () => string }, dependencies?: OtherManager[]) {
    // Initialize with Drizzle ORM
  }

  // CRUD operations
  create(data): Promise<Entity>;
  findById(id): Promise<Entity | null>;
  update(id, data): Promise<Entity>;
  delete(id): Promise<boolean>;

  // Domain-specific methods
  // ...
}
```

### Manager Dependencies

Some managers depend on others:

- **`UserManager`** depends on `SessionManager`, `TimeTrackingManager`, and `ScheduleManager`
- **`InventoryManager`** depends on `StockMovementManager`
- **`StockMovementManager`** depends on `BatchManager`

### Lazy Initialization

Managers are **lazily initialized** on first access, except **`SessionManager`** and **`AuditLogManager`**, which are created eagerly because they run startup cleanups (expired sessions, old audit logs). All other managers are created when first accessed via `db.<manager>`. Dependency order is enforced by getters: e.g. accessing `db.users` ensures `sessions`, `timeTracking`, and `schedules` exist first; `db.inventory` ensures `stockMovements` (and thus `batches`) exist. This reduces startup cost and memory use for less-used managers.

---

## Database Utilities

The database system includes several utility modules for validation, repair, compatibility checking, and path management.

### 1. Database Validator (`db-validator.ts`)

**Purpose:** Pre-connection health assessment

**Features:**

- Validates database file before opening connection
- Checks file existence, readability, and writability
- Validates SQLite header (first 16 bytes)
- Checks file size (detects empty/corrupted files)
- Detects file locking issues

**Validation Checks:**

1. File exists
2. File is accessible (read/write permissions)
3. Valid SQLite header: `"SQLite format 3\x00"`
4. Reasonable file size (not 0 bytes)
5. File not locked by another process

**Returns:**

```typescript
interface DatabaseValidationResult {
  valid: boolean;
  reason?: string;
  canRecover?: boolean;
  fileSize?: number;
  isCorrupted?: boolean;
  isEmpty?: boolean;
}
```

### 2. Database Compatibility Checker (`db-compatibility.ts`)

**Purpose:** Check if existing database is compatible with current app version

**Features:**

- Checks for migration tracking table (`__drizzle_migrations`)
- Validates migration path exists
- Detects old databases without migration system
- Checks database age
- Determines if fresh database is required

**Compatibility Checks:**

1. Migration tracking table exists
2. Latest migration applied
3. Migration path exists for pending migrations
4. Database age (for old databases)
5. Schema version compatibility

**Returns:**

```typescript
interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
  canMigrate?: boolean;
  databaseVersion?: string;
  appVersion: string;
  databaseAge?: number;
  migrationPathExists?: boolean;
  requiresFreshDatabase?: boolean;
}
```

### 3. Database Repair (`db-repair.ts`)

**Purpose:** Repair corrupted or damaged databases

**Repair Strategies (in order of aggressiveness):**

1. **WAL Checkpoint** (non-destructive)

   - Consolidates WAL (Write-Ahead Log) files
   - Commands: `PRAGMA wal_checkpoint(TRUNCATE)`

2. **Integrity Check**

   - Validates database integrity
   - Command: `PRAGMA integrity_check`

3. **REINDEX** (rebuild indexes)

   - Rebuilds all database indexes
   - Command: `REINDEX`

4. **VACUUM** (rebuild entire database)
   - Rebuilds entire database file
   - **Warning:** Can take a long time for large databases
   - Command: `VACUUM`

**Safety Features:**

- Always creates backup before repair attempts
- Timestamped backup files
- Returns repair status and backup path

**Returns:**

```typescript
interface RepairResult {
  success: boolean;
  repaired: boolean;
  reason?: string;
  backupCreated?: string;
}
```

### 4. Database Path Migration (`db-path-migration.ts`)

**Purpose:** Migrate databases from old incorrect paths to new correct paths

**Problem Solved:**

- Old versions created double-nested paths:
  - ❌ Old: `AppData/Roaming/AuraSwift/AuraSwift/pos_system.db`
  - ✅ New: `AppData/Roaming/AuraSwift/pos_system.db`

**Migration Process:**

1. Validates old database exists and is valid
2. Creates backup of old database
3. Copies database to new location
4. Validates new database is valid
5. Optionally removes old database (after confirmation)

**Returns:**

```typescript
interface PathMigrationResult {
  migrated: boolean;
  oldPath?: string;
  newPath?: string;
  backupPath?: string;
  reason?: string;
}
```

### 5. Database Info (`dbInfo.ts`)

**Purpose:** Get database information and statistics

**Information Provided:**

- Database path
- Environment mode (development/production)
- Database existence status
- Database file size
- Other metadata

**Usage:**

```typescript
const info = getDatabaseInfo();
// Returns: { path, mode, exists, size }
```

### 6. Database Recovery Dialogs (`db-recovery-dialog.ts`)

**Purpose:** User-friendly dialogs for database recovery scenarios

**Dialog Types:**

- **Corrupted Database Dialog** - Options: Backup & Fresh, Cancel
- **Database Too Old Dialog** - Options: Create Fresh, Cancel
- **Incompatible Schema Dialog** - Options: Create Fresh, Cancel
- **Database Error Dialog** - General error display

**Recovery Actions:**

- `backup-and-fresh` - Create backup and start fresh
- `repair` - Attempt repair (future)
- `cancel` - Quit application

---

## Initialization Flow

The database initialization follows a multi-layer approach with comprehensive error handling:

### Layer 1: Pre-Connection Validation

```typescript
validateDatabaseFile(dbPath);
```

**Checks:**

- File exists
- File is accessible
- Valid SQLite header
- Reasonable file size
- Not locked

### Layer 2: Path Migration (if needed)

```typescript
if (shouldMigrateDatabasePath()) {
  migrateDatabaseFromOldPath();
}
```

**Actions:**

- Detects old database path
- Migrates to correct path
- Creates backup

### Layer 3: Database Connection

```typescript
this.db = new Database(dbPath);
```

**Error Handling:**

- If connection fails, shows recovery dialog
- Options: Backup & Fresh, Cancel

### Layer 4: Compatibility Check

```typescript
checkDatabaseCompatibility(db, dbPath);
```

**Checks:**

- Migration tracking exists
- Migration path available
- Database age
- Version compatibility

**Error Handling:**

- If incompatible, shows dialog
- Options: Create Fresh, Cancel

### Layer 5: Downgrade Detection

```typescript
checkForDowngrade(db, dbPath);
```

**Checks:**

- App version vs database schema version
- Prevents opening newer database with older app

**Error Handling:**

- Shows error dialog
- Quits application (prevents data corruption)

### Layer 6: Database Repair (if needed)

```typescript
if (fileValidation.canRecover) {
  repairDatabase(db, dbPath);
}
```

**Actions:**

- Attempts repair strategies
- Creates backup before repair
- Validates repair success

### Layer 7: Migration Execution

```typescript
runDrizzleMigrations(drizzleDb, rawDb, dbPath);
```

**Actions:**

- Finds pending migrations
- Creates backup (production)
- Applies migrations in order
- Updates migration tracking
- Verifies integrity

### Layer 8: Seeding

```typescript
seedDefaultData(drizzle, schema);
```

**Actions:**

- Checks if database is empty
- Creates default business, users, roles, etc.
- Logs completion

### Layer 9: Manager Initialization

```typescript
// Create all manager instances
const users = new UserManager(drizzle, uuid);
// ... all other managers
```

**Actions:**

- Initializes all domain managers
- Sets up dependencies
- Returns `DatabaseManagers` interface

---

## Error Handling & Recovery

### Error Recovery Layers

The system has multiple layers of error recovery:

1. **File Validation** - Prevents opening corrupted files
2. **Compatibility Check** - Detects incompatible databases
3. **Repair System** - Attempts automatic repair
4. **User Dialogs** - Provides recovery options
5. **Backup System** - Preserves data before destructive operations

### Recovery Strategies

#### Strategy 1: Automatic Repair

```typescript
repairDatabase(db, dbPath);
```

- WAL checkpoint
- Integrity check
- REINDEX
- VACUUM

#### Strategy 2: Backup & Fresh Start

```typescript
createFreshDatabase(oldDbPath, migrationsFolder);
```

- Creates backup
- Renames old database
- Creates fresh database
- Applies all migrations

#### Strategy 3: Path Migration

```typescript
migrateDatabaseFromOldPath();
```

- Migrates from old path to new path
- Validates migration
- Preserves data

### Error Scenarios

#### Scenario 1: Corrupted Database File

**Detection:** File validation fails or connection fails

**Recovery:**

1. Show corrupted database dialog
2. User chooses: Backup & Fresh or Cancel
3. If Backup & Fresh: Create backup, start fresh

#### Scenario 2: Incompatible Database

**Detection:** Compatibility check fails

**Recovery:**

1. Show incompatible database dialog
2. User chooses: Create Fresh or Cancel
3. If Create Fresh: Backup old, create new

#### Scenario 3: Database Too Old

**Detection:** Database lacks migration tracking

**Recovery:**

1. Show database too old dialog
2. User chooses: Create Fresh or Cancel
3. If Create Fresh: Backup old, create new

#### Scenario 4: Downgrade Attempt

**Detection:** Database schema newer than app version

**Recovery:**

1. Show error dialog
2. Quit application (prevents corruption)
3. User must update app

#### Scenario 5: Migration Failure

**Detection:** Migration execution fails

**Recovery:**

1. Transaction automatically rolls back
2. Database remains in previous state
3. Error logged with details
4. App may not start (prevents inconsistent state)

---

## Key Features

### 1. Type-Safe Database Operations

- **Drizzle ORM** provides full TypeScript type safety
- Schema defined in TypeScript
- Compile-time type checking
- IntelliSense support

### 2. Automatic Migrations

- Migrations run automatically on app startup
- Tracked in `__drizzle_migrations` table
- Transaction-safe (each migration in own transaction)
- Automatic backups before migrations (production)

### 3. Automatic Seeding

- Default data created automatically
- Business, users, roles, VAT categories
- Idempotent (safe to run multiple times)

### 4. Multi-Layer Error Handling

- Pre-connection validation
- Compatibility checking
- Automatic repair attempts
- User-friendly recovery dialogs
- Comprehensive backup system

### 5. Path Migration

- Automatic migration from old paths
- Preserves user data
- Validates migration success

### 6. Database Repair

- Multiple repair strategies
- Automatic backup before repair
- Non-destructive first, then aggressive

### 7. RBAC (Role-Based Access Control)

- Roles with permissions
- User-role assignments
- Permission checking
- System roles (admin, manager, cashier)

### 8. Comprehensive Audit Logging

- All user actions logged
- System events tracked
- Resource-level auditing
- Terminal tracking

### 9. Multi-Tenant Support

- Business-level isolation
- Business-specific data
- Owner management

### 10. Connection Management

- Single connection per app instance
- Appropriate for SQLite's single-writer model
- Properly closed on app exit
- Connection pooling not needed (SQLite)

---

## Implementation Details

### Singleton Pattern

The database system uses a singleton pattern:

```typescript
let managersInstance: DatabaseManagers | null = null;
let initializationPromise: Promise<DatabaseManagers> | null = null;

export async function getDatabase(): Promise<DatabaseManagers> {
  if (managersInstance) {
    return managersInstance; // Return existing
  }

  if (initializationPromise) {
    return initializationPromise; // Wait for ongoing init
  }

  // Start initialization
  initializationPromise = (async () => {
    // ... initialization logic
    return managersInstance;
  })();

  return initializationPromise;
}
```

**Benefits:**

- Single database connection
- Prevents concurrent initialization
- Thread-safe initialization

### Manager Dependencies

Managers are initialized in dependency order:

```typescript
// Independent managers first
const batches = new BatchManager(drizzle, uuid);
const suppliers = new SupplierManager(drizzle, uuid);

// Dependent managers
const stockMovements = new StockMovementManager(drizzle, uuid, batches);
const inventory = new InventoryManager(drizzle, uuid, stockMovements);
```

### UUID Generation

All entities use UUID v4 for IDs:

```typescript
const uuid = { v4: uuidv4 };
// Passed to all managers
const users = new UserManager(drizzle, uuid);
```

**Benefits:**

- Better security (no enumeration)
- Distributed system friendly
- No ID conflicts

### Transaction Safety

- Migrations run in transactions
- Each migration in its own transaction
- Automatic rollback on failure
- All-or-nothing updates

### Backup System

**Automatic Backups Created:**

- Before migrations (production)
- Before repair attempts
- Before fresh database creation
- During path migration

**Backup Locations:**

- Development: `./data/backups/`
- Production: `{userData}/backups/`

**Backup Naming:**

- Timestamped: `auraswift-{type}-backup-{timestamp}.db`
- Types: `migration`, `repair`, `fresh-start`

### Logging

Comprehensive logging throughout:

- Database initialization steps
- Migration progress
- Seeding progress
- Error details
- Recovery actions

**Logger:** Uses Electron logger with context:

- `db-manager` - Database manager
- `drizzle-migrator` - Migration system
- `db-repair` - Repair operations
- `db-compatibility` - Compatibility checks
- `seed` - Seeding operations

### Environment Detection

```typescript
// Development
!app.isPackaged || process.env.NODE_ENV === "development" || process.env.ELECTRON_IS_DEV === "true";

// Production
app.isPackaged && process.env.NODE_ENV !== "development";
```

**Database Paths:**

- Development: `./data/pos_system.db`
- Production: `{userData}/pos_system.db`

### Migration Folder Detection

The system checks multiple locations for migrations:

1. `process.resourcesPath/migrations` (extraResources)
2. `__dirname/migrations` (inside asar)
3. `app.getAppPath()/node_modules/@app/main/dist/migrations`
4. `app.getAppPath()/database/migrations` (legacy)

---

## Related Documentation

- [Configuration Guide](./Configuration/DATABASE_CONFIG.md) - Database paths and configuration
- [Seeding Guide](./Seeding/SEEDING_GUIDE.md) - Default data seeding
- [Migration System](./Migrations/DATABASE_MIGRATION_SYSTEM.md) - Schema migrations

---

**Last Updated:** 2025-01-XX  
**Database System:** Drizzle ORM with SQLite (better-sqlite3)  
**Total Managers:** 30+ domain-specific managers  
**Schema Size:** 2600+ lines of TypeScript definitions
