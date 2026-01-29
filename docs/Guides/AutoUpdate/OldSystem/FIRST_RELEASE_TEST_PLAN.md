# First Release Testing Guide

## Goal

Test the complete release and auto-update flow with a real GitHub release, simulating what end-users will experience.

**Note:** Version numbers in this guide are examples. Use your current version numbers when testing.

---

## Phase 1: Prepare Baseline Version

### 1.1 Build Current Version

```bash
cd /Users/admin/Documents/Developer/Electron/AuraSwift

# Verify current version
cat package.json | grep version
# Example: "version": "1.8.0"

# Clean build
rm -rf dist/
npm run build

# Package installers
npm run package

# Verify outputs
ls -la dist/
# Expected files:
# - AuraSwift-Setup-1.6.0.exe (NSIS installer)
# - AuraSwift-1.6.0-full.nupkg (Squirrel package)
# - AuraSwift-1.6.0-delta.nupkg (Delta update)
# - RELEASES (Squirrel manifest)
# - latest.yml (Update manifest)
```

### 1.2 Create GitHub Release (Baseline Version)

````bash
# Option 1: Manual (Recommended for first time)
# 1. Go to: https://github.com/Sam231221/AuraSwift/releases
# 2. Click "Draft a new release"
# 3. Fill in:
#    - Tag: v{current-version} (e.g., v1.8.0)
#    - Title: AuraSwift v{current-version} - Baseline Release
#    - Description:
#      ```
#      ## What's New
#      - Initial production release
#      - Complete POS system with inventory management
#      - User management (admin, manager, cashier roles)
#      - Transaction processing
#      - Receipt printing (thermal + office printers)
#      - Stripe payment integration
#
#      ## Installation
#      Download `AuraSwift-Setup-1.6.0.exe` for Windows
#
#      ## Default Login
#      - Admin: `admin` / PIN: `1234`
#      - Manager: `manager` / PIN: `5678`
#      - Cashier: `cashier` / PIN: `9999`
#      ```
# 4. Upload ALL files from dist/:
#    - AuraSwift-Setup-1.6.0.exe
#    - AuraSwift-1.6.0-full.nupkg
#    - AuraSwift-1.6.0-delta.nupkg
#    - RELEASES
#    - latest.yml
# 5. Check "Set as the latest release"
# 6. Click "Publish release"

# Option 2: Automated (Requires GH_TOKEN)
export GH_TOKEN="your_github_personal_access_token"
npm run publish
````

### 1.3 Test Fresh Install (Scenario 1)

**Environment**: Clean Windows 10/11 VM

```bash
# 1. Download installer from GitHub
# URL: https://github.com/Sam231221/AuraSwift/releases/download/v1.6.0/AuraSwift-Setup-1.6.0.exe

# 2. Run installer
# - Windows Defender may warn (unsigned app)
# - Click "More info" → "Run anyway"
# - Install with default options

# 3. Launch AuraSwift
# - From Start Menu or Desktop shortcut
```

**Expected Logs**:

```
Database path: C:\Users\TestUser\AppData\Roaming\AuraSwift\pos_system.db

🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: ...auraswift-backup-2025-11-12T16-00-00-000Z.db
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0000_initial_schema.sql
   📝 Applying migration: 0001_add_discount_system.sql
   🔍 Verifying database integrity after migration...
   ✅ Database integrity check passed
   ✅ All migrations completed successfully!

✅ Database initialized successfully

🌱 Checking if seed data is needed...
📦 Seeding database with default data...
🏪 Creating default business...
👤 Creating admin user...
👤 Creating manager user...
👤 Creating cashier user...
✅ Database seeded successfully!
```

**Test App Functionality**:

```bash
# 1. Login with default admin
Username: admin
PIN: 1234

# 2. Create test data
# - Add product: "Test Product" - $10.00
# - Create transaction: Sell 1 unit
# - Add user: "Test Cashier"

# 3. Verify data saved
# - Check Products page
# - Check Transactions history
# - Check Users list

# 4. Close app
```

**Verify Database**:

```bash
# 1. Open database with SQLite browser
# Location: C:\Users\TestUser\AppData\Roaming\AuraSwift\pos_system.db

# 2. Run queries
SELECT * FROM __drizzle_migrations;
-- Should show 2 migrations: 0000_initial, 0001_discounts

SELECT * FROM _app_version;
-- Should show: version='1.6.0'

SELECT * FROM users;
-- Should show: 4 users (3 default + 1 test)

SELECT * FROM products;
-- Should show: 1 product (Test Product)

SELECT * FROM transactions;
-- Should show: 1 transaction

# 3. Check backup
# Navigate to: C:\Users\TestUser\AppData\Roaming\AuraSwift\backups\
# Should contain: auraswift-backup-*.db
```

**✅ Checkpoint**: If fresh install works, proceed to Phase 2

---

## Phase 2: Prepare Update Version

### 2.1 Create New Migration

```bash
cd /Users/admin/Documents/Developer/Electron/AuraSwift

# Create new migration file
# Example: Add loyalty program feature

# 1. Update schema
# File: packages/main/src/database/schema.ts
```

Add to schema.ts:

```typescript
export const loyaltyMembers = sqliteTable("loyalty_members", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id),
  userId: text("user_id").references(() => users.id), // Optional link to user
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  points: integer("points").default(0),
  totalSpent: real("total_spent").default(0),
  tier: text("tier").default("bronze"), // bronze, silver, gold, platinum
  joinedAt: integer("joined_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  lastTransactionAt: integer("last_transaction_at", { mode: "timestamp" }),
});

export const loyaltyTransactions = sqliteTable("loyalty_transactions", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => loyaltyMembers.id),
  transactionId: text("transaction_id").references(() => transactions.id),
  pointsEarned: integer("points_earned").notNull(),
  pointsRedeemed: integer("points_redeemed").default(0),
  amountSpent: real("amount_spent").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});
```

```bash
# 2. Generate migration
npm run db:generate

# Drizzle Kit will prompt:
# "What do you want to call this migration?"
# Enter: add_loyalty_program

# Output:
# ✓ Generated 0002_add_loyalty_program.sql

# 3. Verify migration file
cat packages/main/src/database/migrations/0002_add_loyalty_program.sql
```

Expected migration content:

```sql
CREATE TABLE `loyalty_members` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `user_id` text,
  `name` text NOT NULL,
  `email` text,
  `phone` text NOT NULL,
  `points` integer DEFAULT 0,
  `total_spent` real DEFAULT 0,
  `tier` text DEFAULT 'bronze',
  `joined_at` integer DEFAULT (unixepoch()),
  `last_transaction_at` integer,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

CREATE TABLE `loyalty_transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL,
  `transaction_id` text,
  `points_earned` integer NOT NULL,
  `points_redeemed` integer DEFAULT 0,
  `amount_spent` real NOT NULL,
  `created_at` integer DEFAULT (unixepoch()),
  FOREIGN KEY (`member_id`) REFERENCES `loyalty_members`(`id`),
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`)
);

CREATE INDEX `idx_loyalty_members_business` ON `loyalty_members`(`business_id`);
CREATE INDEX `idx_loyalty_transactions_member` ON `loyalty_transactions`(`member_id`);
```

```bash
# 4. Test migration locally
npm run start
# App should launch and apply migration
# Check logs for: "Applying migration: 0002_add_loyalty_program.sql"

# 5. Verify in database
# Check loyalty_members table exists
```

### 2.2 Bump Version

```bash
# Bump version (or use semantic-release for automatic versioning)
npm version minor
# This updates package.json: "1.8.0" → "1.9.0" (example)
# And creates git tag: v1.9.0

# Verify
cat package.json | grep version
# Should show updated version
```

### 2.3 Build New Version

```bash
# Clean previous build
rm -rf dist/

# Build
npm run build

# Package
npm run package

# Verify outputs
ls -la dist/
# Expected files:
# - AuraSwift-Setup-1.7.0.exe
# - AuraSwift-1.7.0-full.nupkg
# - AuraSwift-1.7.0-delta.nupkg (delta from 1.6.0 → 1.7.0)
# - RELEASES (updated with 1.7.0)
# - latest.yml (updated with 1.7.0)
```

### 2.4 Create GitHub Release (New Version)

````bash
# 1. Go to: https://github.com/Sam231221/AuraSwift/releases
# 2. Click "Draft a new release"
# 3. Fill in:
#    - Tag: v1.7.0
#    - Title: AuraSwift v1.7.0 - Loyalty Program
#    - Description:
#      ```
#      ## What's New
#      - 🎁 Loyalty Program System
#        - Member management
#        - Points earning and redemption
#        - Tiered rewards (Bronze, Silver, Gold, Platinum)
#      - 🐛 Bug fixes and improvements
#
#      ## Database Changes
#      - New tables: `loyalty_members`, `loyalty_transactions`
#      - Migration automatically applied on update
#      - Existing data preserved
#
#      ## Update Notes
#      - Automatic backup created before update
#      - All existing data preserved
#      - No user action required
#      ```
# 4. Upload ALL files from dist/:
#    - AuraSwift-Setup-1.7.0.exe
#    - AuraSwift-1.7.0-full.nupkg
#    - AuraSwift-1.7.0-delta.nupkg
#    - RELEASES
#    - latest.yml
# 5. Check "Set as the latest release"
# 6. Click "Publish release"
````

---

## Phase 3: Test Auto-Update (Scenario 2)

### 3.1 Setup Test Environment

**Use existing Windows VM with v1.6.0 installed** (from Phase 1)

```bash
# 1. Ensure v1.6.0 is running
# Check Help → About: Should show "Version 1.6.0"

# 2. Verify test data exists
# - Products: 1 test product
# - Transactions: 1 test transaction
# - Users: 4 users (3 default + 1 test)

# 3. Close app
```

### 3.2 Trigger Update Check

```bash
# Option 1: Wait for automatic check (4 hours)
# Option 2: Manual check (Recommended for testing)

# 1. Launch AuraSwift v1.6.0
# 2. Click menu: Help → Check for Updates
# 3. Wait for update notification
```

### 3.3 Expected Update Flow

**Step 1: Update Notification**

```
Update Available

A new version of AuraSwift is available!

Current version: 1.6.0
New version: 1.7.0

Release notes:
- Loyalty Program System
- Member management
- Points and rewards
...

[Download Now] [Remind Later] [Skip This Version]
```

**Step 2: Download Progress**

```
Downloading Update...

Version 1.7.0
Downloaded: 45.2 MB / 52.8 MB (85%)

[Cancel]
```

**Step 3: Ready to Install**

```
Update Ready

AuraSwift v1.7.0 has been downloaded and is ready to install.

The application will restart to complete the update.

[Restart and Install] [Install Later]
```

**Step 4: Installation**

```bash
# 1. Click "Restart and Install"
# 2. App closes
# 3. Installer runs (may see brief window)
# 4. App relaunches automatically
```

### 3.4 Verify Update Success

**Check Version**:

```bash
# 1. Click Help → About
# Should show: "Version 1.7.0"
```

**Check Logs**:

```
Database path: C:\Users\TestUser\AppData\Roaming\AuraSwift\pos_system.db

🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: ...auraswift-backup-2025-11-12T17-30-00-000Z.db
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0002_add_loyalty_program.sql
   🔍 Verifying database integrity after migration...
   ✅ Database integrity check passed
   ✅ All migrations completed successfully!

✅ Database initialized successfully

🌱 Checking if seed data is needed...
⏭️  Database already seeded, skipping...
```

**Verify Database**:

```bash
# 1. Open database with SQLite browser
# Location: C:\Users\TestUser\AppData\Roaming\AuraSwift\pos_system.db

# 2. Check migrations
SELECT * FROM __drizzle_migrations ORDER BY hash;
-- Should show 3 migrations now:
-- 0000_initial
-- 0001_discounts
-- 0002_loyalty_program (NEW!)

# 3. Check version updated
SELECT * FROM _app_version;
-- Should show: version='1.7.0'

# 4. Check existing data preserved
SELECT COUNT(*) FROM users;
-- Should be 4 (same as before update)

SELECT COUNT(*) FROM products;
-- Should be 1 (same as before update)

SELECT COUNT(*) FROM transactions;
-- Should be 1 (same as before update)

# 5. Check new tables exist
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'loyalty%';
-- Should return:
-- loyalty_members
-- loyalty_transactions

# 6. Check backups
# Navigate to: C:\Users\TestUser\AppData\Roaming\AuraSwift\backups\
# Should contain TWO backups now:
-- auraswift-backup-{v1.6.0-timestamp}.db (from initial install)
-- auraswift-backup-{v1.7.0-timestamp}.db (from update)
```

**Test App Functionality**:

```bash
# 1. Login with admin account
# Username: admin, PIN: 1234

# 2. Verify existing features work
# - View products (Test Product should be there)
# - View transactions (test transaction should be there)
# - View users (all 4 users should be there)

# 3. Test new loyalty feature (if implemented in UI)
# - Navigate to Loyalty menu
# - Add loyalty member
# - Award points

# 4. Create new transaction to verify system works
# - Add product to cart
# - Complete sale
# - Verify transaction saved
```

**✅ Checkpoint**: If update works correctly, Phase 3 complete!

---

## Phase 4: Edge Case Testing (Optional)

### 4.1 Test Skip Version Update

```bash
# Requires: v1.8.0 release

# 1. Have v1.6.0 installed
# 2. Skip v1.7.0 (don't install it)
# 3. Release v1.8.0 with another migration
# 4. Update directly from v1.6.0 → v1.8.0

# Expected: Both migrations (0002, 0003) applied in sequence
```

### 4.2 Test Downgrade Prevention

```bash
# 1. Have v1.7.0 installed
# 2. Uninstall app (Control Panel → Uninstall)
#    - Database remains in AppData
# 3. Download v1.6.0 installer from GitHub
# 4. Install v1.6.0
# 5. Launch app

# Expected: Error dialog
# "Cannot Open Database - Database requires newer version"
# App quits gracefully
```

### 4.3 Test Interrupted Migration

```bash
# 1. Start update to v1.7.0
# 2. During migration (see logs: "Applying pending migrations...")
#    → Open Task Manager
#    → End AuraSwift process
# 3. Restart app

# Expected:
# - Transaction rolled back, OR
# - Migration retries and completes
# - Database integrity maintained
# - No corruption
```

---

## Phase 5: Production Checklist

### Before Public Release

- [ ] All Phase 1-3 tests passed
- [ ] Test data creation works
- [ ] Test data preserved after update
- [ ] Backups created successfully
- [ ] No errors in logs
- [ ] Login works after update
- [ ] New features functional
- [ ] Code signing certificate obtained (recommended)
- [ ] Release notes reviewed
- [ ] Support documentation updated

### GitHub Release Checklist

- [ ] Tag format correct: `v{major}.{minor}.{patch}`
- [ ] All installer files uploaded
- [ ] `latest.yml` present (for electron-updater)
- [ ] `RELEASES` present (for Squirrel)
- [ ] Release marked as "latest"
- [ ] Release notes include database changes
- [ ] Release notes include backup information

### Monitoring After Release

- [ ] Monitor GitHub Issues for bug reports
- [ ] Check auto-update success rate (if analytics enabled)
- [ ] Monitor support channels
- [ ] Have rollback plan ready (re-release previous version if critical bug)

---

## Troubleshooting

### Update Not Detected

**Problem**: v1.6.0 doesn't detect v1.7.0 update

**Solutions**:

```bash
# 1. Check GitHub release
# - Is it published (not draft)?
# - Is it marked as "latest"?
# - Does it have latest.yml file?

# 2. Check latest.yml content
# Should contain:
version: 1.7.0
files:
  - url: AuraSwift-Setup-1.7.0.exe
    sha512: {hash}
    size: {bytes}
path: AuraSwift-Setup-1.7.0.exe
sha512: {hash}
releaseDate: '2025-11-12T17:00:00.000Z'

# 3. Check app configuration
# File: electron-builder.mjs
publish:
  provider: 'github'
  owner: 'Sam231221'
  repo: 'AuraSwift'
  releaseType: 'release'

# 4. Check auto-updater logs
# Look for error messages in app logs

# 5. Manual test
# Help → Check for Updates
```

### Migration Fails

**Problem**: Migration 0002 fails to apply

**Solutions**:

```bash
# 1. Check error message in logs
# Common causes:
# - Syntax error in .sql file
# - Foreign key constraint violation
# - Duplicate column/table name

# 2. Verify migration file
cat packages/main/src/database/migrations/0002_add_loyalty_program.sql
# Check for syntax errors

# 3. Test locally first
npm run start
# Apply migration in dev environment

# 4. If production migration fails
# User can restore from backup:
# Copy: backups/auraswift-backup-{latest}.db
# To: pos_system.db
```

### Database Locked

**Problem**: "database is locked" error

**Solutions**:

```bash
# 1. Close all SQLite browser connections
# 2. Close all AuraSwift instances
# 3. Restart app
```

---

## Success Criteria Summary

### Fresh Install (v1.6.0)

✅ App launches  
✅ Database created in AppData  
✅ All initial migrations applied  
✅ Seed data created (3 users, 1 business)  
✅ Login works  
✅ Backup created

### Update (v1.6.0 → v1.7.0)

✅ Update notification received  
✅ Download successful  
✅ Installation successful  
✅ Only new migration applied  
✅ Version updated to 1.7.0  
✅ Existing data preserved  
✅ New backup created  
✅ New features functional

---

## Next Steps

1. **Complete Phase 1**: Test fresh install of v1.6.0
2. **Complete Phase 2**: Create v1.7.0 with loyalty migration
3. **Complete Phase 3**: Test auto-update flow
4. **Optional Phase 4**: Test edge cases
5. **Phase 5**: Production deployment

---

## Documentation References

- **Comprehensive Analysis**: `CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md`
- **Full Testing Guide**: `CLIENT_RELEASE_TESTING_GUIDE.md`
- **Quick Checklist**: `QUICK_TESTING_CHECKLIST.md`
- **Migration System**: `DATABASE_MIGRATION_SYSTEM.md`

---

**Test Plan Version**: 1.1  
**Note**: Version numbers are examples - use current versions when testing  
**Platform**: Windows 10/11  
**Last Updated**: December 30, 2025
