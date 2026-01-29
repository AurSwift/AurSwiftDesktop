# Client Migration Testing Guide

## Complete Testing Plan for GitHub Releases

---

## 🎯 TESTING OBJECTIVES

Validate that database migrations work correctly for all client update scenarios when releases are published to GitHub.

**Current Version in Production:** v1.8.0  
**Note**: Version numbers in examples are illustrative - use current versions when testing

---

## 📋 ALL TESTING SCENARIOS

### ✅ SCENARIO 1: Fresh Install (New Client)

**Description:** Brand new user downloads latest release from GitHub  
**Database State:** No database exists  
**Expected Outcome:** Database created with all migrations applied + default data seeded

### ✅ SCENARIO 2: Normal Update (Existing Client)

**Description:** Client running previous version updates to new version  
**Database State:** Previous version schema exists with user data  
**Expected Outcome:** New migrations applied, data preserved, backup created

### ⚠️ SCENARIO 3: Skip Version Update

**Description:** Client running older version updates directly to newer version (skips intermediate)  
**Database State:** Older version schema with outdated structure  
**Expected Outcome:** All intermediate migrations applied in order

### 🔴 SCENARIO 4: Downgrade Attempt

**Description:** Client running newer version tries to open with older version app  
**Database State:** Newer version schema  
**Expected Outcome:** App shows error dialog and quits gracefully

### ⚡ SCENARIO 5: Migration Interrupted

**Description:** App crashes or power failure during migration  
**Database State:** Transaction started but not committed  
**Expected Outcome:** Rollback to pre-migration state, backup available

### 💥 SCENARIO 6: Corrupted Database

**Description:** Database file corrupted before update  
**Database State:** Failed integrity check  
**Expected Outcome:** Migration aborted, error logged, backup suggested

### 🔄 SCENARIO 7: Reinstall Same Version

**Description:** User reinstalls current version over existing installation  
**Database State:** Current version schema already exists  
**Expected Outcome:** No migrations run, database unchanged

### 📦 SCENARIO 8: Manual Database Modification

**Description:** User manually added/modified tables via SQL  
**Database State:** Schema diverged from expected  
**Expected Outcome:** Integrity check may fail or migrations skip already-applied changes

---

## 🧪 DETAILED TEST PROCEDURES

---

### SCENARIO 1: Fresh Install (New Client)

#### Test Setup:

```bash
# Simulated environment: Clean Windows VM or Mac
# No AuraSwift previously installed
# No database file exists
```

#### Steps to Test:

1. **Download Release from GitHub**

   - Go to: https://github.com/Sam231221/AuraSwift/releases/latest
   - Download: `AuraSwift-{version}-Windows-x64.exe` (or Mac .dmg)

2. **Install Application**

   - Windows: Run installer → Choose install location → Complete
   - Mac: Open DMG → Drag to Applications → Open

3. **First Launch**

   - App starts
   - Database initialization begins

4. **Expected Console Logs:**

   ```
   Database path: C:\Users\John\AppData\Roaming\AuraSwift\pos_system.db
   🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: ...backups/auraswift-backup-2025-11-12T10-30-00.db
   🔒 Starting migration transaction...
   ⚙️  Applying pending migrations...
   🔍 Verifying database integrity after migration...
   ✅ Database integrity check passed
   ✅ Committing migration transaction...
   ✅ All migrations completed successfully!

   ✅ Drizzle ORM initialized
   🌱 Checking if seed data is needed...
   🌱 Seeding default business and users...
   ✅ Default business created: Demo Store
   ✅ Default users created: admin, manager, cashier
   ✅ Default settings created
   ✅ Database seeding completed!
   ```

5. **Verification Steps:**

   **A. Check Database File Created:**

   ```bash
   # Windows
   dir "C:\Users\%USERNAME%\AppData\Roaming\AuraSwift\pos_system.db"

   # Mac
   ls -lh ~/Library/Application\ Support/AuraSwift/pos_system.db
   ```

   **Expected:** File exists, size ~240 KB

   **B. Check Migrations Applied:**

   - Open database with DB Browser for SQLite
   - Check `__drizzle_migrations` table:

   ```sql
   SELECT * FROM __drizzle_migrations;
   ```

   **Expected:**

   ```
   | id | hash      | created_at  |
   |----|-----------|-------------|
   | 1  | ee88e399  | 1731408600  |
   | 2  | a1b2c3d4  | 1731408601  | -- If new version has new migration
   ```

   **C. Check Seeded Data:**

   ```sql
   SELECT COUNT(*) FROM users;      -- Expected: 3
   SELECT COUNT(*) FROM businesses; -- Expected: 1
   SELECT * FROM app_settings;      -- Expected: 4 rows
   ```

   **D. Check Version Tracking:**

   ```sql
   SELECT * FROM _app_version;
   ```

   **Expected:**

   ```
   | id | version | updated_at  |
   |----|---------|-------------|
   | 1  | {version}   | 1731408601  |
   ```

   **E. Login Test:**

   - Launch app → Login screen should show 3 users
   - Try: Username: `admin`, PIN: `1234`
   - **Expected:** Login successful, POS dashboard loads

6. **Success Criteria:**
   - ✅ Database file created
   - ✅ All migrations applied
   - ✅ Default data seeded (3 users, 1 business, 4 settings)
   - ✅ Current version tracked in `_app_version`
   - ✅ Login works with default credentials
   - ✅ No errors in console

---

### SCENARIO 2: Normal Update (Existing Client)

#### Test Setup:

```bash
# Simulated environment: Windows VM with AuraSwift previous version installed
# Database exists: pos_system.db with user transactions, products, etc.
# App has been used for several weeks
```

#### Pre-Test Data Setup:

1. **Install previous version**
2. **Add Test Data:**

   ```sql
   -- Add some products
   INSERT INTO products (id, name, price, sku, businessId, createdAt, updatedAt)
   VALUES
     ('prod-001', 'Test Product 1', 19.99, 'SKU001', 'default-business-001', datetime('now'), datetime('now')),
     ('prod-002', 'Test Product 2', 29.99, 'SKU002', 'default-business-001', datetime('now'), datetime('now'));

   -- Add a transaction
   INSERT INTO transactions (id, userId, businessId, total, createdAt, updatedAt)
   VALUES ('txn-001', 'default-admin-001', 'default-business-001', 49.98, datetime('now'), datetime('now'));
   ```

3. **Verify Database State:**
   ```sql
   SELECT version FROM _app_version; -- Expected: previous version
   SELECT * FROM __drizzle_migrations; -- Should show only baseline migration
   SELECT COUNT(*) FROM products; -- Expected: 2
   ```

#### Steps to Test:

1. **Trigger Auto-Update Check**

   - With previous version running, go to: `Help` → `Check for Updates...`
   - **Expected:** Dialog shows "Update Available: v{new-version}"

2. **Download Update**

   - Click "Download Now"
   - **Expected:** Background download starts, progress shown

3. **Install Update**

   - Download completes → Click "Restart Now"
   - App closes → Installer runs → App reopens

4. **Expected Console Logs on First Launch:**

   ```
   Database path: C:\Users\John\AppData\Roaming\AuraSwift\pos_system.db
   🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: ...backups/auraswift-backup-2025-11-12T11-45-00.db
   🔒 Starting migration transaction...
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0001_add_promotions_and_barcode.sql
   🔍 Verifying database integrity after migration...
   ✅ Database integrity check passed
   ✅ Committing migration transaction...
   ✅ All migrations completed successfully!

   ✅ Drizzle ORM initialized
   🌱 Checking if seed data is needed...
   ⏭️  Database already seeded, skipping...
   ```

5. **Verification Steps:**

   **A. Check Version Updated:**

   ```sql
   SELECT version FROM _app_version;
   ```

   **Expected:** `{new-version}`

   **B. Check New Migrations Applied:**

   ```sql
   SELECT * FROM __drizzle_migrations ORDER BY id;
   ```

   **Expected:** New migration row added (id=2)

   **C. Check Schema Changes:**

   ```sql
   -- If migration added 'promotions' table
   SELECT name FROM sqlite_master WHERE type='table' AND name='promotions';
   ```

   **Expected:** `promotions` table exists

   ```sql
   -- If migration added 'barcode' column to products
   PRAGMA table_info(products);
   ```

   **Expected:** `barcode` column present

   **D. Check Existing Data Preserved:**

   ```sql
   SELECT COUNT(*) FROM products; -- Expected: 2 (unchanged)
   SELECT COUNT(*) FROM transactions; -- Expected: 1 (unchanged)
   SELECT * FROM users WHERE username='admin'; -- Expected: Still exists
   ```

   **E. Check Backup Created:**

   ```bash
   # Windows
   dir "C:\Users\%USERNAME%\AppData\Roaming\AuraSwift\backups\auraswift-backup-*.db"

   # Mac
   ls -lh ~/Library/Application\ Support/AuraSwift/backups/
   ```

   **Expected:** New backup file dated today

   **F. Test App Functionality:**

   - Login with existing credentials
   - View existing products → Should still show Test Product 1, Test Product 2
   - Create new transaction
   - Check new features (if promotions UI added)

6. **Success Criteria:**
   - ✅ Update downloaded and installed
   - ✅ New migration applied (promotions table + barcode column)
   - ✅ Version updated to new version in `_app_version`
   - ✅ Existing data preserved (products, transactions, users)
   - ✅ Backup created before migration
   - ✅ App fully functional with new schema
   - ✅ No errors or data loss

---

### SCENARIO 3: Skip Version Update

#### Test Setup:

```bash
# Client has older version installed
# Intermediate and newer versions are both available
# Client updates directly to newer version (skips intermediate)
```

#### Steps to Test:

1. **Install older version**
2. **Add test data** in older version
3. **Manually download newer version** from GitHub (don't install intermediate)
4. **Install newer version** over older version

#### Expected Behavior:

```
🚀 Running Drizzle ORM Migrations...
⚙️  Applying pending migrations...
📝 Applying migration: 0001_v1_6_0_changes.sql
📝 Applying migration: 0002_v1_7_0_changes.sql
✅ All migrations completed successfully!
```

**Drizzle automatically applies migrations in order:**

- Detects current database version (older version schema)
- Finds pending migrations (intermediate and newer)
- Applies all in chronological order

#### Verification:

```sql
SELECT * FROM __drizzle_migrations ORDER BY id;
```

**Expected:**

```
| id | hash      | created_at  |
|----|-----------|-------------|
| 1  | baseline  | 1730000000  |
| 2  | intermediate | 1731408600  | -- Applied during update
| 3  | newer      | 1731408601  | -- Applied during update
```

#### Success Criteria:

- ✅ Both intermediate migrations applied
- ✅ Final schema matches newer version
- ✅ No data loss
- ✅ App functional

---

### SCENARIO 4: Downgrade Attempt

#### Test Setup:

```bash
# Client running newer version
# User manually downloads older version installer
# Attempts to install older version over newer version
```

#### Steps to Test:

1. **Have newer version running** with database
2. **Close app**
3. **Install older version**
4. **Try to launch older version**

#### Expected Behavior:

**Console Logs:**

```
Database path: C:\Users\John\AppData\Roaming\AuraSwift\pos_system.db
🔍 Checking for downgrade...
❌ Downgrade detected!
   Stored version: {newer-version}
   App version: {older-version}
❌ Database downgrade detected - app version is older than database schema
```

**Error Dialog Shown:**

```
┌─────────────────────────────────────────────┐
│ Cannot Open Database                        │
│                                             │
│ This database was created with a newer     │
│ version of AuraSwift.                       │
│                                             │
│ Please update the application to the       │
│ latest version to continue.                 │
│                                             │
│ Current app version: {older-version}       │
│ Database requires a newer version.         │
│                                             │
│              [ OK ]                         │
└─────────────────────────────────────────────┘
```

**App quits immediately**

#### Verification:

1. **Database unchanged** (no corruption)
2. **No migrations attempted**
3. **User clearly informed** of the issue
4. **App exits gracefully** (no crash)

#### Success Criteria:

- ✅ Downgrade detected before any database operations
- ✅ Clear error message shown
- ✅ App quits gracefully
- ✅ Database not corrupted
- ✅ User knows to download correct version

---

### SCENARIO 5: Migration Interrupted

#### Test Setup:

```bash
# Simulate app crash or power failure during migration
# This tests transaction rollback
```

#### Steps to Test:

1. **Modify migration to be interruptible:**

   Create a test migration that takes time:

   ```sql
   -- 0002_test_interruption.sql
   CREATE TABLE promotions (...);
   -- Add artificial delay by creating many rows
   INSERT INTO test_delay SELECT * FROM generate_series(1, 100000);
   ALTER TABLE products ADD COLUMN barcode text;
   ```

2. **Start update process**
3. **Kill app process mid-migration** (Task Manager → End Task)
   - Timing: During "Applying pending migrations" phase

#### Expected Behavior on Next Launch:

**Console Logs:**

```
🚀 Running Drizzle ORM Migrations...
🔍 Checking database integrity...
✅ Database integrity check passed
📦 Backup created: ...backups/auraswift-backup-2025-11-12T12-00-00.db
🔒 Starting migration transaction...
⚙️  Applying pending migrations...
📝 Applying migration: 0002_test_interruption.sql
✅ All migrations completed successfully!
```

**SQLite Transaction Behavior:**

- Transaction started but never committed (app killed)
- SQLite automatically rolls back uncommitted transactions on next database open
- Migration state: No partial changes persisted

#### Verification:

1. **Check database integrity:**

   ```sql
   PRAGMA integrity_check;
   ```

   **Expected:** `ok`

2. **Check migration state:**

   ```sql
   SELECT * FROM __drizzle_migrations;
   ```

   **Expected:** Interrupted migration NOT recorded (because transaction rolled back)

3. **Check schema:**

   ```sql
   SELECT name FROM sqlite_master WHERE type='table' AND name='promotions';
   ```

   **Expected:** `null` (table not created, rollback succeeded)

4. **Next launch re-runs migration successfully**

#### Success Criteria:

- ✅ No database corruption
- ✅ Transaction rolled back automatically
- ✅ Next launch completes migration successfully
- ✅ Backup available if needed
- ✅ No data loss

---

### SCENARIO 6: Corrupted Database

#### Test Setup:

```bash
# Corrupt the database file before update
# Tests integrity check protection
```

#### Steps to Test:

1. **Corrupt database file:**

   ```bash
   # Overwrite some bytes in middle of file
   dd if=/dev/urandom of=pos_system.db bs=1024 seek=50 count=10 conv=notrunc
   ```

2. **Try to launch app**

#### Expected Behavior:

**Console Logs:**

```
🚀 Running Drizzle ORM Migrations...
🔍 Checking database integrity...
❌ Database integrity check failed: database disk image is malformed
❌ Migration failed: Database corrupted - aborting
```

**Error Log Created:**

```
[ERROR] Database initialization error: Database corrupted - aborting
[INFO] Backup available at: ...backups/auraswift-backup-2025-11-11T14-00-00.db
```

#### Verification:

1. **Migration not attempted** (aborted before transaction)
2. **User notified** of corruption
3. **Backup available** for restoration

#### Recovery Steps (documented for user):

```bash
# Windows
cd %APPDATA%\AuraSwift\backups
# Find latest backup
copy auraswift-backup-2025-11-11T14-00-00.db ..\pos_system.db

# Mac
cd ~/Library/Application\ Support/AuraSwift/backups
cp auraswift-backup-2025-11-11T14-00-00.db ../pos_system.db
```

#### Success Criteria:

- ✅ Corruption detected before migration
- ✅ Migration aborted
- ✅ Error clearly logged
- ✅ Backup available for restoration
- ✅ No further corruption caused

---

### SCENARIO 7: Reinstall Same Version

#### Test Setup:

```bash
# Client has current version installed and running
# User reinstalls same version (e.g., to fix bugs)
```

#### Steps to Test:

1. **Have current version running** with data
2. **Download same version installer** again
3. **Run installer** (reinstall)
4. **Launch app**

#### Expected Behavior:

**Console Logs:**

```
🚀 Running Drizzle ORM Migrations...
🔍 Checking database integrity...
✅ Database integrity check passed
ℹ️  No pending migrations found
✅ Database already up to date
```

**No migrations run** (already applied)

#### Verification:

```sql
SELECT * FROM __drizzle_migrations;
```

**Expected:** Same migrations as before, no new entries

```sql
SELECT version FROM _app_version;
```

**Expected:** Still `{current-version}`

#### Success Criteria:

- ✅ No migrations re-run
- ✅ Database unchanged
- ✅ App works normally
- ✅ No errors

---

### SCENARIO 8: Manual Database Modification

#### Test Setup:

```bash
# User manually added tables or columns via DB Browser
# Tests migration conflict handling
```

#### Steps to Test:

1. **Open database** in DB Browser for SQLite
2. **Manually add table that migration would create:**
   ```sql
   CREATE TABLE promotions (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL
   );
   ```
3. **Try to update app** (migration tries to create same table)

#### Expected Behavior (depending on migration):

**Option A: Drizzle detects and skips:**

```
⚙️  Applying pending migrations...
⚠️  Table 'promotions' already exists, skipping CREATE TABLE
✅ Migration completed with warnings
```

**Option B: Migration fails:**

```
❌ Migration failed: table promotions already exists
⏪ Rolling back migration transaction...
✅ Rollback successful
```

#### Verification:

1. **Check if migration recorded:**

   ```sql
   SELECT * FROM __drizzle_migrations;
   ```

2. **Check app functionality**

#### Recovery (if needed):

1. **Restore from backup**
2. **Remove manually-added tables**
3. **Re-run update**

#### Success Criteria:

- ✅ Conflict detected
- ✅ Rollback successful
- ✅ User informed of issue
- ✅ Backup available

---

## 🔧 TESTING TOOLS REQUIRED

### Development Tools:

- **DB Browser for SQLite** - To inspect database
- **Process Explorer** (Windows) / **Activity Monitor** (Mac) - To kill processes
- **Git** - To checkout different versions for testing

### Test Environments:

- **Clean Windows 10/11 VM** (VMware or VirtualBox)
- **Clean macOS VM** (if testing Mac builds)
- **GitHub Account** with access to releases

### Commands:

```bash
# Check app version
# Windows
Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" |
  Where-Object DisplayName -like "AuraSwift*" | Select-Object DisplayVersion

# Mac
/Applications/AuraSwift.app/Contents/Info.plist
defaults read /Applications/AuraSwift.app/Contents/Info.plist CFBundleShortVersionString

# Check database version
sqlite3 pos_system.db "SELECT version FROM _app_version;"

# Check migrations applied
sqlite3 pos_system.db "SELECT id, created_at FROM __drizzle_migrations;"

# Check database integrity
sqlite3 pos_system.db "PRAGMA integrity_check;"

# List backups
ls -lh backups/
```

---

## 📊 TEST RESULTS TEMPLATE

```markdown
# Test Run: [Date]

## Tester: [Name]

## Environment: Windows 10 VM / macOS 13

### Scenario 1: Fresh Install

- [ ] Database created
- [ ] Migrations applied
- [ ] Data seeded
- [ ] Version tracked
- [ ] Login works
- Notes: ****\_\_\_****

### Scenario 2: Normal Update (Previous → New Version)

- [ ] Update detected
- [ ] Download successful
- [ ] Migration applied
- [ ] Data preserved
- [ ] Backup created
- Notes: ****\_\_\_****

### Scenario 3: Skip Version (Older → Newer)

- [ ] All migrations applied
- [ ] Final schema correct
- [ ] Data preserved
- Notes: ****\_\_\_****

### Scenario 4: Downgrade Attempt

- [ ] Downgrade detected
- [ ] Error dialog shown
- [ ] App quit gracefully
- [ ] Database unchanged
- Notes: ****\_\_\_****

### Scenario 5: Interrupted Migration

- [ ] Rollback successful
- [ ] No corruption
- [ ] Retry succeeded
- Notes: ****\_\_\_****

### Scenario 6: Corrupted Database

- [ ] Corruption detected
- [ ] Migration aborted
- [ ] Error logged
- [ ] Backup available
- Notes: ****\_\_\_****

### Scenario 7: Reinstall Same Version

- [ ] No migrations re-run
- [ ] Database unchanged
- [ ] App works
- Notes: ****\_\_\_****

### Scenario 8: Manual Modification

- [ ] Conflict detected
- [ ] Rollback successful
- [ ] Backup available
- Notes: ****\_\_\_****

## Overall Result: PASS / FAIL

## Critical Issues: ****\_\_\_****

## Recommendations: ****\_\_\_****
```

---

## 🎯 PRIORITY ORDER FOR TESTING

### Must Test (Critical):

1. ✅ **Scenario 1: Fresh Install** - Most common for new users
2. ✅ **Scenario 2: Normal Update** - Most common for existing users
3. 🔴 **Scenario 4: Downgrade Attempt** - Safety critical

### Should Test (Important):

4. ⚡ **Scenario 5: Interrupted Migration** - Data safety
5. ⚠️ **Scenario 3: Skip Version** - Real-world scenario

### Nice to Test (Edge Cases):

6. 💥 **Scenario 6: Corrupted Database** - Rare but important
7. 🔄 **Scenario 7: Reinstall** - Low risk
8. 📦 **Scenario 8: Manual Modification** - Edge case

---

## 🚀 AUTOMATED TESTING (Future Enhancement)

Create automated tests using Playwright:

```typescript
// tests/migration.spec.ts
import { test, expect } from "@playwright/test";

test("Scenario 1: Fresh install creates database", async () => {
  // Delete existing database
  // Launch app
  // Wait for initialization
  // Check database file exists
  // Verify migrations applied
  // Verify seed data
});

test("Scenario 2: Update applies migrations", async () => {
  // Install old version
  // Add test data
  // Install new version
  // Verify migration applied
  // Verify data preserved
});
```

---

## 📝 RELEASE CHECKLIST

Before publishing release to GitHub:

- [ ] All scenarios tested successfully
- [ ] No critical issues found
- [ ] Database backups working
- [ ] Migration rollback tested
- [ ] Downgrade protection working
- [ ] Documentation updated
- [ ] CHANGELOG.md includes migration notes
- [ ] Release notes mention database changes

---

## 🆘 TROUBLESHOOTING GUIDE

### Issue: Migration Fails on Client

**Symptoms:**

- App won't start after update
- Error: "Migration failed"

**Diagnosis:**

1. Check console logs (Windows: Event Viewer, Mac: Console.app)
2. Check `_app_version` table
3. Check `__drizzle_migrations` table
4. Run `PRAGMA integrity_check`

**Recovery:**

1. Restore from backup:
   ```bash
   cd backups/
   cp latest-backup.db ../pos_system.db
   ```
2. Reinstall previous version
3. Contact support with logs

### Issue: Downgrade Protection Showing Incorrectly

**Symptoms:**

- Error shown when versions match

**Diagnosis:**

```sql
SELECT version FROM _app_version;
-- Compare to app.getVersion()
```

**Fix:**

```sql
UPDATE _app_version SET version = '{correct-version}' WHERE id = 1;
```

### Issue: Backup Not Created

**Symptoms:**

- Migration runs but no backup in backups/ folder

**Diagnosis:**

- Check disk space
- Check permissions on backups/ folder

**Fix:**

```bash
# Windows
mkdir "%APPDATA%\AuraSwift\backups"
icacls "%APPDATA%\AuraSwift\backups" /grant %USERNAME%:F

# Mac
mkdir -p ~/Library/Application\ Support/AuraSwift/backups
chmod 755 ~/Library/Application\ Support/AuraSwift/backups
```

---

## 📚 REFERENCES

- Migration Implementation: `/docs/AutoUpdate/CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md`
- Safety Features: `/docs/AutoUpdate/MIGRATION_SAFETY_IMPLEMENTATION.md`
- Drizzle Kit: https://orm.drizzle.team/kit-docs/overview
- electron-updater: https://www.electron.build/auto-update

---

**Document Version:** 1.1  
**Last Updated:** December 30, 2025  
**Current App Version:** 1.8.0  
**Status:** Updated with current implementation  
**Note:** Version numbers in examples are illustrative
