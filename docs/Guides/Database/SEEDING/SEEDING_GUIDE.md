# Database Seeding Guide

AuraSwift automatically seeds the database with default data on app startup, ensuring a fresh database is always initialized with the required minimum data.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Default Data](#default-data)
- [How It Works](#how-it-works)
- [Usage](#usage)
- [Customization](#customization)
- [Security](#security)
- [Technical Details](#technical-details)

---

## Overview

### What Gets Seeded

When a new database is created, the seeding process automatically creates:

- ✅ 1 default business (AuraSwift Demo Store)
- ✅ 3 default VAT categories (Standard, Reduced, Zero rates)
- ✅ 1 default terminal (Main Counter)
- ✅ 3 default roles (Admin, Manager, Cashier) with permissions
- ✅ 3 default users (MrAdmin, MrManager, MrCashier) with assigned roles
- ✅ User-role assignments linking users to their roles

### When Seeding Runs

- **Automatically** on first run of the Electron app
- **During development, testing, or production** whenever the app starts with an empty database
- **Only once** - if businesses already exist, seeding is skipped (no duplicates)

### Safety Features

- ✅ **Idempotent** - Safe to run multiple times, won't create duplicates
- ✅ **Type-safe** - Uses Drizzle ORM for type-safe database operations
- ✅ **Secure** - All passwords and PINs are hashed using bcrypt
- ✅ **Non-destructive** - Never overwrites existing data

---

## Default Data

### 🏪 Default Business

- **Name:** AuraSwift Demo Store
- **Owner:** Admin User (MrAdmin) - same UUID as admin user
- **Email:** admin@auraswift.com
- **Phone:** +1234567890
- **Website:** https://auraswift.com
- **Address:** 123 Main Street
- **City:** New York
- **Postal Code:** 10001
- **Country:** United States
- **VAT Number:** null
- **Business Type:** retail
- **Currency:** USD
- **Timezone:** America/New_York

### 👥 Default Users

#### 1. Admin User

- **Username:** `MrAdmin`
- **Email:** `mradmin@auraswift.com`
- **Password:** `admin123`
- **PIN:** `1234`
- **Full Name:** Admin User
- **Role:** Administrator
- **Permissions:** ALL (full system access via `PERMISSIONS.ALL`)
- **Shift Required:** No

#### 2. Manager User

- **Username:** `MrManager`
- **Email:** `mrmanager@auraswift.com`
- **Password:** `manager123`
- **PIN:** `1234`
- **Full Name:** Store Manager
- **Role:** Store Manager
- **Permissions:**
  - `SALES_READ`
  - `SALES_WRITE`
  - `REPORTS_READ`
  - `ANALYTICS_VIEW`
  - `INVENTORY_MANAGE`
  - `USERS_MANAGE`
  - `TRANSACTIONS_OVERRIDE`
- **Shift Required:** Yes

#### 3. Cashier User

- **Username:** `MrCashier`
- **Email:** `mrcashier@auraswift.com`
- **Password:** `cashier123`
- **PIN:** `1234`
- **Full Name:** John Cashier
- **Role:** Cashier
- **Permissions:**
  - `SALES_READ`
  - `SALES_WRITE`
- **Shift Required:** Yes

### 💰 Default VAT Categories

1. **Standard Rate**

   - **Code:** `STD`
   - **Rate:** 20.0%
   - **Default:** Yes
   - **Description:** Standard VAT rate

2. **Reduced Rate**

   - **Code:** `RED`
   - **Rate:** 5.0%
   - **Default:** No
   - **Description:** Reduced VAT rate

3. **Zero Rate**
   - **Code:** `ZRO`
   - **Rate:** 0.0%
   - **Default:** No
   - **Description:** Zero VAT rate

### 🖥️ Default Terminal

- **Name:** Main Counter
- **Type:** pos
- **Status:** active
- **IP Address:** 127.0.0.1
- **Device Token:** (UUID generated)

---

## How It Works

### Implementation

The seeding system is implemented in `packages/main/src/database/seed.ts` and is called automatically during database initialization.

**File Structure:**

```
packages/main/src/database/
├── seed.ts              # Main seeding logic
├── index.ts             # Calls seedDefaultData() after DB init
└── schema.ts            # Database schema definitions
```

### Seeding Process Flow

1. **Check if database is already seeded:**

   ```typescript
   const existingBusinesses = db.select().from(schema.businesses).all();
   if (existingBusinesses.length > 0) {
     return; // Skip seeding
   }
   ```

2. **Create default business:**

   - Generate UUIDs for business and owner
   - Insert business record with default values

3. **Create VAT categories:**

   - Insert 3 default VAT categories linked to the business

4. **Create default terminal:**

   - Insert terminal record for "Main Counter"

5. **Create default roles:**

   - Admin role with `PERMISSIONS.ALL`
   - Manager role with manager permissions
   - Cashier role with cashier permissions

6. **Create default users:**

   - Generate bcrypt hashes for passwords and PINs
   - Insert 3 user records with hashed credentials

7. **Assign roles to users:**

   - Link users to their roles via `user_roles` table

8. **Log completion:**
   - Output credentials and account details to console

### Integration Point

Seeding is called from `packages/main/src/database/index.ts` in the `getDatabase()` function:

```typescript
// Initialize Drizzle ORM
const drizzle = initializeDrizzle(db);

// Seed database with default data if needed
try {
  await seedDefaultData(drizzle as any, schema);
} catch (error) {
  // Log error but continue - app can function without default data
  logger.error("❌ Database seeding failed:", error);
}
```

---

## Usage

### First Time Setup

1. **Start the application:**

   ```bash
   npm start
   ```

2. **Database is automatically:**

   - Created (if it doesn't exist)
   - Migrated to latest schema
   - Seeded with default data

3. **Login with default credentials:**
   - Use any of the three default accounts listed above

### Reset to Default

To reset the database and reseed:

```bash
# Clean database (removes database file)
npm run db:dev:clean

# Start app (will recreate and reseed automatically)
npm start
```

### Verify Seeding

Check that seeding completed successfully:

```bash
# Check business
sqlite3 data/pos_system.db "SELECT businessName, email, phone FROM businesses;"

# Check users
sqlite3 data/pos_system.db "SELECT username, email, firstName, lastName FROM users;"

# Check roles
sqlite3 data/pos_system.db "SELECT name, displayName, isSystemRole FROM roles;"

# Check user-role assignments
sqlite3 data/pos_system.db "SELECT u.username, r.name as role FROM user_roles ur JOIN users u ON ur.user_id = u.id JOIN roles r ON ur.role_id = r.id;"

# Check VAT categories
sqlite3 data/pos_system.db "SELECT name, code, ratePercent, isDefault FROM vat_categories;"

# Check terminal
sqlite3 data/pos_system.db "SELECT name, type, status FROM terminals;"
```

### Expected Results

After successful seeding, you should see:

```
businesses: 1 row (AuraSwift Demo Store)
vat_categories: 3 rows (Standard, Reduced, Zero)
terminals: 1 row (Main Counter)
roles: 3 rows (admin, manager, cashier)
users: 3 rows (MrAdmin, MrManager, MrCashier)
user_roles: 3 rows (linking users to their roles)
All other tables: Empty (ready for transactions)
```

---

## Customization

### Modifying Default Data

To customize the default seeded data, edit `packages/main/src/database/seed.ts`:

#### Change Business Details

```typescript
db.insert(schema.businesses)
  .values({
    businessName: "Your Store Name",
    email: "admin@yourstore.com",
    phone: "+1234567890",
    // ... other fields
  })
  .run();
```

#### Change User Credentials

```typescript
// Generate new password hash
const salt = await bcrypt.genSalt(10);
const customPasswordHash = await bcrypt.hash("YourPassword123", salt);
const customPinHash = await bcrypt.hash("5678", salt);

db.insert(schema.users)
  .values({
    username: "youradmin",
    email: "admin@yourstore.com",
    passwordHash: customPasswordHash,
    pinHash: customPinHash,
    // ... other fields
  })
  .run();
```

#### Change VAT Categories

```typescript
const customVatCategories = [
  {
    name: "Standard VAT",
    code: "STD",
    ratePercent: 21.0, // Your local VAT rate
    isDefault: true,
  },
  // ... add more categories
];
```

### Applying Customizations

After modifying `seed.ts`:

```bash
# Build the main package
npm run build --workspace @app/main

# Clean existing database
npm run db:dev:clean

# Start app (will use new seeding logic)
npm start
```

---

## Security

### ⚠️ Important Security Considerations

#### Default Credentials

- **Change Default Passwords:** In production, require users to change passwords on first login
- **Default PINs:** All default users share the same PIN (1234) - **change this in production**
- **Remove Default Accounts:** After creating your own accounts, consider deactivating the default users

#### Password Hashing

- **Algorithm:** bcrypt
- **Salt Rounds:** 10 (configurable)
- **Consideration:** For production, consider increasing salt rounds to 12-14 for better security

#### UUID IDs

- All entities use UUID v4 for IDs
- Provides better security than sequential IDs
- Prevents enumeration attacks

### Production Recommendations

1. **Require password change on first login**
2. **Generate unique PINs per installation**
3. **Disable default accounts after setup**
4. **Increase bcrypt salt rounds to 12-14**
5. **Review and customize default permissions**

---

## Technical Details

### Dependencies

- **drizzle-orm** - Type-safe database queries
- **bcryptjs** - Password/PIN hashing
- **uuid** - UUID v4 generation for entity IDs
- **@app/shared/constants/permissions** - Permission constants

### Error Handling

If seeding fails, the error is logged but the app continues to start:

```typescript
try {
  await seedDefaultData(drizzle, schema);
} catch (error) {
  logger.error("❌ Database seeding failed:", error);
  // App continues - allows functionality even if seeding fails
  // Some default data may be missing
}
```

This design allows the app to function even if seeding encounters issues, though some default data may be missing.

### Transaction Safety

Currently, seeding operations are executed directly (not wrapped in a single transaction). However, each operation is idempotent, so:

- ✅ Safe to run multiple times
- ✅ Won't create duplicates
- ✅ Can recover from partial failures

### Logging

The seeding process logs:

- Start of seeding process
- Progress for each step (business, VAT categories, terminal, roles, users)
- Completion with account credentials
- Any errors encountered

Example output:

```
🌱 Starting database seeding...
   📦 Creating default business...
   💰 Creating default VAT categories...
   🖥️  Creating default terminal...
   👔 Creating default roles...
   👤 Creating default users...
   🔗 Assigning roles to users...
✅ Database seeding completed successfully!

📋 Default Accounts Created:
   👨‍💼 Admin:
      Username: MrAdmin
      Password: admin123
      PIN: 1234
   ...
```

---

## Troubleshooting

### Seeding Not Running

**Problem:** Database is empty but seeding didn't run.

**Solutions:**

1. Check console logs for errors
2. Verify `seed.ts` is being imported correctly
3. Check if businesses table exists (migrations may not have run)
4. Verify database path is correct

### Duplicate Data

**Problem:** Seeding creates duplicate records.

**Solutions:**

1. Check the `existingBusinesses` check is working
2. Verify database wasn't manually modified
3. Clean database and restart: `npm run db:dev:clean && npm start`

### Missing Default Data

**Problem:** Some default data is missing after seeding.

**Solutions:**

1. Check console logs for specific errors
2. Verify all tables exist (run migrations first)
3. Check foreign key constraints
4. Review `seed.ts` for any conditional logic

---

## Next Steps

After seeding:

1. ✅ Login with one of the default users
2. ✅ Update business profile with your actual information
3. ✅ Add real products and categories
4. ✅ Create additional users as needed
5. ✅ Configure VAT rates for your region
6. ✅ Start making transactions!

---

**Last Updated:** 2025-01-XX  
**Database System:** Drizzle ORM with SQLite (better-sqlite3)  
**Seeding Method:** Automatic on app startup via `seedDefaultData()` function  
**File Location:** `packages/main/src/database/seed.ts`
