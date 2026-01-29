# Database Architecture

## Overview

AuraSwift's database layer has evolved from a single monolithic `database.ts` file into a hybrid system that combines the simplicity of a single-file approach with modern versioning and migration capabilities.

---

## Current Architecture

### Database File Structure

```
packages/main/src/
├── database.ts                    # Main database manager (current production)
│   ├── DatabaseManager class
│   ├── All table schemas (CREATE TABLE statements)
│   ├── All CRUD operations
│   ├── Migration system integration
│   └── Schema versioning (PRAGMA user_version)
│
└── database/                      # Future modular structure
    ├── versioning/
    │   ├── index.ts              # Migration runner, backup system
    │   └── migrations.ts         # Migration definitions
    └── docs/                     # Documentation (you are here)
```

---

## Database Manager Class

### Location

`packages/main/src/database.ts`

### Key Components

#### 1. **Initialization**

```typescript
class DatabaseManager {
  private db: any;
  private readonly SCHEMA_VERSION = 2;

  async initialize() {
    // 1. Load dependencies (better-sqlite3, bcryptjs, uuid)
    // 2. Determine database path (dev vs production)
    // 3. Create database connection
    // 4. Initialize tables (final schema)
    // 5. Run migrations (transform old schemas)
    // 6. Create default admin user
  }
}
```

#### 2. **Database Path Logic**

```typescript
private getDatabasePath(): string {
  // Development: ./data/pos_system.db
  // Production (macOS): ~/Library/Application Support/AuraSwift/pos_system.db
  // Production (Windows): %APPDATA%\AuraSwift\pos_system.db
}
```

#### 3. **Table Initialization**

```typescript
private initializeTables() {
  // Define FINAL schema (what fresh installs get)
  // CREATE TABLE IF NOT EXISTS for all tables
  // Then call runMigrations() for existing databases
}
```

#### 4. **Migration System**

```typescript
private readonly SCHEMA_VERSION = 2;

private runMigrations() {
  // Check current version (from schema_version table)
  // Compare with SCHEMA_VERSION
  // Run pending migrations sequentially
  // Record each migration in schema_version table
}

private migration_v1_xxx() {
  // Individual migration logic
  // Add columns, create tables, etc.
  // Record version in schema_version table
}
```

---

## Schema Design

### Core Tables

#### Business & Users

- **businesses** - Store information (name, owner, contact details)
- **users** - User accounts (email, password, role, permissions)
- **sessions** - Authentication tokens

#### Products & Inventory

- **categories** - Product categories (hierarchical with parentId)
- **products** - Product catalog (SKU, price, stock, weight-based)
- **modifiers** - Product customizations (size, toppings, etc.)
- **modifier_options** - Options for each modifier
- **product_modifiers** - Many-to-many relationship
- **stock_adjustments** - Inventory tracking history

#### Operations

- **schedules** - Staff work schedules
- **shifts** - Active work sessions
- **transactions** - Sales, refunds, voids
- **transaction_items** - Line items with modifiers
- **applied_modifiers** - Modifier selections per item
- **cash_drawer_counts** - Reconciliation records

#### Discounts & Promotions

- **discounts** - Promotional rules (percentage, fixed, BOGO)

#### System

- **app_settings** - Key-value configuration storage
- **audit_logs** - Security and compliance tracking
- **print_jobs** - Office printer queue
- **print_job_retries** - Retry tracking

#### Migration Tracking

- **schema_version** - Migration history (version, name, applied_at)

---

## Database Features

### 1. **Foreign Key Relationships**

All tables use proper foreign key constraints:

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  businessId TEXT NOT NULL,
  category TEXT NOT NULL,
  FOREIGN KEY (businessId) REFERENCES businesses (id),
  FOREIGN KEY (category) REFERENCES categories (id)
)
```

**Cascading Rules:**

- `ON DELETE CASCADE` - For dependent data (modifiers, line items)
- `ON DELETE SET NULL` - For optional relationships (category parent)

### 2. **Indexing Strategy**

Performance indexes on:

- Primary lookup columns (`email`, `sku`, `plu`)
- Foreign keys (all relationships)
- Frequently filtered fields (`status`, `type`, `isActive`)
- Time-based queries (`timestamp`, `startTime`)

```sql
CREATE INDEX IF NOT EXISTS idx_products_businessId ON products(businessId);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
```

### 3. **Data Integrity**

**CHECK Constraints:**

```sql
role TEXT NOT NULL CHECK (role IN ('cashier', 'manager', 'admin'))
type TEXT NOT NULL CHECK (type IN ('sale', 'refund', 'void'))
```

**UNIQUE Constraints:**

```sql
UNIQUE(name, businessId)  -- No duplicate category names per business
UNIQUE(email)             -- No duplicate user emails
```

**NOT NULL Constraints:**

```sql
name TEXT NOT NULL
price REAL NOT NULL
businessId TEXT NOT NULL
```

### 4. **Default Values**

Safe defaults for optional fields:

```sql
isActive BOOLEAN DEFAULT 1
stockLevel INTEGER DEFAULT 0
discountAmount REAL DEFAULT 0
```

---

## CRUD Operations

### Entity Managers

Each entity has its own set of methods in DatabaseManager:

#### User Management

```typescript
async createUser(userData): Promise<User>
getUserByEmail(email): User | null
getUserById(id): User | null
async authenticateUser(email, password): Promise<User | null>
updateUser(id, updates): boolean
deleteUser(id): boolean  // Soft delete
```

#### Session Management

```typescript
createSession(userId, expiryDays): Session
getSessionByToken(token): Session | null
deleteSession(token): boolean
deleteUserSessions(userId): void
cleanupExpiredSessions(): void
```

#### Product Management

```typescript
async createProduct(productData): Promise<Product>
getProductById(id): Product
getProductByPLU(plu): Product
getProductsByBusiness(businessId): Product[]
async updateProduct(id, updates): Promise<Product>
deleteProduct(id): boolean  // Soft delete
```

#### Category Management

```typescript
async createCategory(categoryData): Promise<Category>
getCategoryById(id): Category
getCategoriesByBusiness(businessId): Category[]
updateCategory(id, updates): Category
deleteCategory(id): boolean
reorderCategories(businessId, categoryIds): void
```

... and so on for all entities.

---

## Transaction Pattern

For operations requiring multiple steps:

```typescript
const transaction = this.db.transaction(() => {
  // Step 1: Insert/Update/Delete
  this.db.prepare('...').run(...);

  // Step 2: Related operations
  this.db.prepare('...').run(...);

  // All or nothing - automatic rollback on error
});

transaction();  // Execute
```

**Used for:**

- Creating user + business together
- Stock adjustments + inventory updates
- Complex migrations (table recreation)

---

## Migration System Integration

### Version Tracking

Uses `schema_version` table:

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  migration_name TEXT NOT NULL,
  applied_at TEXT NOT NULL
)
```

### Migration Flow

```
1. initializeTables()
   └─ Defines final schema (CREATE TABLE IF NOT EXISTS)

2. runMigrations()
   ├─ Check current version (MAX version from schema_version)
   ├─ Compare with SCHEMA_VERSION constant
   └─ Run pending migrations

3. migration_vX_name()
   ├─ Check if already applied (idempotent)
   ├─ Apply changes (ALTER TABLE, CREATE INDEX, etc.)
   └─ Record in schema_version table
```

### Current Migrations

**v1: add_business_fields**

- Add `address`, `phone`, `vatNumber` to businesses table

**v2: add_discount_fields**

- Add `discountAmount`, `appliedDiscounts` to transactions
- Add `discountAmount`, `appliedDiscounts` to transaction_items

---

## Development vs Production

### Development Mode

```typescript
const isDev = process.env.NODE_ENV === "development" || process.env.ELECTRON_IS_DEV === "true" || !app.isPackaged;

if (isDev) {
  dbPath = "./data/pos_system.db";
}
```

**Features:**

- Database in project directory
- Easy to inspect with SQLite tools
- Quick reset (delete file)
- Visible backups in `./data/backups/`

### Production Mode

```typescript
if (!isDev) {
  const userDataPath = app.getPath("userData");
  dbPath = path.join(userDataPath, "AuraSwift", "pos_system.db");
}
```

**Features:**

- Database in system user data directory
- Protected from accidental deletion
- Persists across app reinstalls
- Automatic backups in userData/backups/

---

## Performance Considerations

### 1. **Connection Pooling**

- Single persistent connection (better-sqlite3 is synchronous)
- No connection pool needed for SQLite

### 2. **Prepared Statements**

```typescript
// ✅ GOOD: Reusable prepared statement
const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
const user = stmt.get(userId);

// ❌ BAD: String concatenation (SQL injection risk)
this.db.exec(`SELECT * FROM users WHERE id = '${userId}'`);
```

### 3. **Transaction Batching**

```typescript
// ✅ GOOD: Batch operations in transaction
const insertMany = this.db.transaction((items) => {
  for (const item of items) {
    insertStmt.run(item);
  }
});
insertMany(data);

// ❌ BAD: Individual inserts
for (const item of data) {
  this.db.prepare("INSERT...").run(item);
}
```

### 4. **Index Usage**

All foreign keys and frequently queried columns are indexed.

---

## Security Features

### 1. **Password Hashing**

```typescript
const hashedPassword = await this.bcrypt.hash(password, 10);
const isValid = await this.bcrypt.compare(password, user.password);
```

### 2. **SQL Injection Prevention**

Always use prepared statements with parameterized queries.

### 3. **Session Management**

- Token-based authentication
- Automatic expiry (configurable, default 7 days)
- Session cleanup utility

### 4. **Audit Logging**

Track sensitive operations:

```typescript
audit_logs(userId, action, resource, resourceId, details, timestamp);
```

---

## Data Validation

### Application Layer

- TypeScript interfaces enforce type safety
- Zod schemas for input validation (in renderer process)
- Business logic validation in manager methods

### Database Layer

- CHECK constraints for enums
- NOT NULL constraints for required fields
- UNIQUE constraints for identifiers
- Foreign key constraints for relationships

---

## Future Enhancements

### Planned Improvements

1. **Full modular refactor** - Split into managers/ directory
2. **Soft delete tracking** - Add deletedAt timestamps
3. **Multi-tenant isolation** - Enhanced businessId filtering
4. **Query builder** - Type-safe query construction
5. **Migration dry-run** - Test migrations before applying
6. **Replication support** - Backup to cloud storage

---

## Related Documentation

- [Migration Quick Start](./02_MIGRATION_QUICK_START.md) - How to add migrations
- [Migration System Guide](./03_MIGRATION_SYSTEM_GUIDE.md) - Complete versioning system
- [Advanced Migration Patterns](./04_ADVANCED_MIGRATION_PATTERNS.md) - Constraints and relationships
- [Auto-Update Integration](./05_AUTO_UPDATE_INTEGRATION.md) - How updates work

---

**Next:** Learn how to add migrations in [Migration Quick Start](./02_MIGRATION_QUICK_START.md)
