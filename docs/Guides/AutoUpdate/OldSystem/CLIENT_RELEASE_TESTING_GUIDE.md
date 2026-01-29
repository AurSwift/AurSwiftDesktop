# Client Release Testing Guide

## Overview

This guide covers **all critical scenarios** for testing AuraSwift releases with real GitHub releases. Each scenario includes exact steps, database behavior, and expected outcomes.

## Test Environment Setup

### Prerequisites

- GitHub repository with releases enabled
- Windows VM or physical machine for testing
- Clean test user account (recommended)
- GitHub Personal Access Token (for publishing)

### Build & Release Preparation

```bash
# 1. Update version in package.json
npm version patch  # or minor, or major

# 2. Build the application
npm run build

# 3. Package installers
npm run package

# 4. Verify build output
ls -la dist/*.exe dist/*.dmg

# Expected files:
# - AuraSwift-{version}-Windows-x64.exe (NSIS installer)
# - AuraSwift-{version}-win-x64.exe (Squirrel installer)
# - AuraSwift-{version}-win-x64-full.nupkg (Squirrel package)
# - AuraSwift-{version}-win-x64-delta.nupkg (Delta update package)
# - RELEASES (Squirrel manifest)
# - latest.yml (Update metadata)
```

### Publishing to GitHub

```bash
# Option 1: Automated (Recommended)
# Semantic-release automatically creates releases on push to main
# - Analyzes conventional commits
# - Bumps version automatically
# - Generates CHANGELOG.md
# - Creates GitHub Release
# - Uploads installers

# Option 2: Manual Upload
# 1. Go to https://github.com/Sam231221/AuraSwift/releases
# 2. Click "Draft a new release"
# 3. Tag: v{version} (must match package.json version)
# 4. Upload ALL files from dist/
# 5. Publish release
```

---

## Scenario 1: Fresh Install (New Client)

### Description

A new user downloads and installs AuraSwift for the first time from GitHub releases.

### Database Behavior

1. **No existing database** - Fresh installation
2. **Database location**: `C:\Users\{Username}\AppData\Roaming\AuraSwift\pos_system.db`
3. **Migration flow**:
   - SQLite database file created
   - All migrations applied from scratch (0000*initial.sql, 0001*\*.sql, etc.)
   - `__drizzle_migrations` table populated with all migration records
   - `_app_version` table created with current version
4. **Seeding**:
   - Checks if users table is empty
   - Seeds default business and 3 users (admin/manager/cashier)
5. **Backups**: First backup created in `backups/` folder

### Test Steps

```bash
# 1. Fresh Windows VM or clean user account
# 2. Download installer from GitHub release
#    Example: https://github.com/Sam231221/AuraSwift/releases/latest
#    Download: AuraSwift-{version}-Windows-x64.exe

# 3. Run installer
AuraSwift-{version}-Windows-x64.exe

# 4. During installation, Windows Defender might warn (unsigned app)
#    Click "More info" → "Run anyway"

# 5. Launch AuraSwift from Start Menu or Desktop shortcut
```

### Expected Logs

```
Database path: C:\Users\TestUser\AppData\Roaming\AuraSwift\pos_system.db

🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: C:\Users\TestUser\AppData\Roaming\AuraSwift\backups\auraswift-backup-2025-11-12T14-30-00-000Z.db
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0000_initial_schema.sql
   📝 Applying migration: 0001_add_discount_system.sql
   (... more migrations ...)
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

### Verification

```sql
-- Open database with SQLite browser
-- Location: C:\Users\TestUser\AppData\Roaming\AuraSwift\pos_system.db

-- 1. Check migrations applied
SELECT * FROM __drizzle_migrations;
-- Should show all migration files with success status

-- 2. Check version tracking
SELECT * FROM _app_version;
-- Should show: id=1, version='{current-version}', updated_at={timestamp}

-- 3. Check seeded data
SELECT COUNT(*) FROM users;  -- Should be 3
SELECT COUNT(*) FROM businesses;  -- Should be 1

-- 4. Check backup exists
-- Navigate to: C:\Users\TestUser\AppData\Roaming\AuraSwift\backups\
-- Should contain: auraswift-backup-*.db
```

### Success Criteria

✅ App launches successfully  
✅ Database created at correct location  
✅ All migrations applied  
✅ Seed data created (3 users, 1 business)  
✅ Login works with default credentials:

- Admin: `admin` / PIN: `1234`
- Manager: `manager` / PIN: `5678`
- Cashier: `cashier` / PIN: `9999`  
  ✅ Backup file created  
  ✅ No errors in logs

---

## Scenario 2: Normal Update (Existing Client)

### Description

An existing user receives update notification for a new version and installs it.

### Database Behavior

1. **Existing database** - Preserved at same location
2. **Migration flow**:
   - Opens existing database
   - Checks `__drizzle_migrations` for applied migrations
   - Applies ONLY new migrations (e.g., 0002_add_loyalty_program.sql)
   - Updates `_app_version` to new version
3. **Seeding**: Skipped (users already exist)
4. **Backups**: New backup created before applying new migrations
5. **User data**: ALL existing data preserved (transactions, products, users, etc.)

### Prerequisites

```bash
# 1. Install previous version first (follow Scenario 1)
# 2. Use the app, create some test data:
#    - Add products
#    - Create transactions
#    - Add users

# 3. Create new release with new migration
# Example migration: 000X_add_feature.sql

# 4. Build and publish (semantic-release handles versioning automatically)
npm run compile
# Or manually: npm version minor && npm run compile
# Upload to GitHub releases

# 5. Make sure new version has new migration in:
#    packages/main/src/database/migrations/000X_add_feature.sql
```

### Test Steps

```bash
# 1. Launch existing AuraSwift (previous version)
# 2. Auto-updater checks for updates (periodic checks with idle detection, or manually via Help menu)
# 3. Update notification appears:
#    "A new version is available. Download now?"
# 4. Click "Download and Install"
# 5. App downloads update in background
# 6. When ready: "Update downloaded. Restart to install?"
# 7. Click "Restart and Install"
# 8. App closes, installer runs, app relaunches with new version
```

### Expected Logs (New Version Launch)

```
Database path: C:\Users\TestUser\AppData\Roaming\AuraSwift\pos_system.db

🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: C:\Users\TestUser\AppData\Roaming\AuraSwift\backups\auraswift-backup-2025-11-12T15-45-00-000Z.db
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0002_add_loyalty_program.sql
   🔍 Verifying database integrity after migration...
   ✅ Database integrity check passed
   ✅ All migrations completed successfully!

✅ Database initialized successfully

🌱 Checking if seed data is needed...
⏭️  Database already seeded, skipping...
```

### Verification

```sql
-- 1. Check new migration applied
SELECT * FROM __drizzle_migrations ORDER BY hash;
-- Should show 0002_add_loyalty_program.sql added

-- 2. Check version updated
SELECT * FROM _app_version;
-- Should show: version='{new-version}'

-- 3. Verify existing data preserved
SELECT COUNT(*) FROM users;  -- Same as before update
SELECT COUNT(*) FROM transactions;  -- Same as before update
SELECT COUNT(*) FROM products;  -- Same as before update

-- 4. Verify new schema changes
PRAGMA table_info(loyalty_members);  -- New table from migration
-- Should show loyalty program columns

-- 5. Check backups
-- Should have TWO backups now:
-- - auraswift-backup-{previous-version-timestamp}.db
-- - auraswift-backup-{new-version-timestamp}.db
```

### Success Criteria

✅ Update notification received  
✅ Update downloaded and installed  
✅ App restarts with new version  
✅ Only new migration applied  
✅ Version updated to new version  
✅ ALL existing data preserved  
✅ No duplicate seeding  
✅ New backup created  
✅ New schema changes active  
✅ No errors in logs

---

## Scenario 3: Skip Version Update

### Description

Client skips intermediate version(s) and directly updates to a newer version.

### Database Behavior

1. **Multiple new migrations** applied in sequence
2. **Migration order**:
   - Previous version had: baseline migrations
   - New version applies: all pending migrations in order
3. **Atomic transaction**: All migrations succeed or all rollback
4. **Version jump**: Previous → New (single step, all migrations applied)

### Test Steps

```bash
# 1. Have previous version installed
# 2. Create intermediate version with migration (DO NOT INSTALL)
# 3. Create newer version with additional migration
# 4. Publish newer version to GitHub (skip intermediate)
# 5. Launch previous version
# 6. Auto-updater detects newer version
# 7. Install newer version
```

### Expected Logs

```
🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: ...
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0002_add_loyalty_program.sql
   📝 Applying migration: 0003_add_gift_cards.sql
   🔍 Verifying database integrity after migration...
   ✅ Database integrity check passed
   ✅ All migrations completed successfully!
```

### Verification

```sql
-- Check both migrations applied
SELECT * FROM __drizzle_migrations WHERE hash LIKE '%0002%' OR hash LIKE '%0003%';
-- Should show BOTH migrations

-- Check version jumped
SELECT * FROM _app_version;
-- Should show: version='1.8.0'

-- Verify both schema changes
PRAGMA table_info(loyalty_members);  -- From 0002
PRAGMA table_info(gift_cards);  -- From 0003
```

### Success Criteria

✅ Update from previous → newer version successful  
✅ All skipped migrations applied  
✅ Migrations applied in correct order  
✅ Version updated to latest  
✅ All schema changes from both migrations active  
✅ Data preserved

---

## Scenario 4: Downgrade Prevention

### Description

Client with newer version tries to install older version (should be blocked).

### Database Behavior

1. **Version check** runs on startup
2. **Comparison**: Stored version (newer) > Current app (older)
3. **Action**: Error dialog shown, app quits
4. **Database**: Unchanged, not touched

### Test Steps

```bash
# 1. Have newer version installed and running
# 2. Uninstall newer version (but keep database - it's in AppData)
#    Control Panel → Programs → Uninstall AuraSwift
# 3. Install older version from older release
# 4. Launch app
```

### Expected Dialog

```
❌ Cannot Open Database

This database was created with a newer version of AuraSwift.

Please update the application to the latest version to continue.

Current app version: {older-version}
Database requires: {newer-version} or newer
```

### Verification

```sql
-- Database should be untouched
SELECT * FROM _app_version;
-- Still shows: version='{newer-version}'

-- No new migrations or changes
SELECT COUNT(*) FROM __drizzle_migrations;
-- Same count as before downgrade attempt
```

### Success Criteria

✅ App detects downgrade attempt  
✅ Error dialog shown with clear message  
✅ App quits gracefully  
✅ Database unchanged (no corruption)  
✅ User can reinstall newer version and continue

---

## Scenario 5: Interrupted Migration (Power Loss)

### Description

Power loss or crash during migration process.

### Database Behavior

1. **Transactions** protect database integrity
2. **Drizzle ORM** wraps each migration in transaction
3. **Rollback** automatic on failure
4. **Result**: Database returns to pre-migration state

### Test Steps

```bash
# 1. Install previous version
# 2. Prepare new version with large migration (add index on big table)
# 3. Start update to new version
# 4. During "Applying pending migrations..." log
#    → Kill app process via Task Manager
#    OR
#    → Simulate power loss (VM snapshot + force power off)
# 5. Restart computer
# 6. Launch app
```

### Expected Behavior

**Scenario A: Transaction Rollback**

```
🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: ...
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0002_add_indexes.sql
   ❌ Migration failed: Process interrupted
   🔄 Rolling back transaction...
   ✅ Database rolled back to previous state
```

**Scenario B: Retry on Next Launch**

```
🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: ...
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0002_add_indexes.sql
   ✅ Migration completed successfully!
```

### Verification

```sql
-- Check migration status
SELECT * FROM __drizzle_migrations WHERE hash LIKE '%0002%';
-- Either:
-- - Not present (rolled back)
-- - Present with success (completed on retry)

-- Check version
SELECT * FROM _app_version;
-- Either:
-- - Still previous version (rollback)
-- - Now new version (retry succeeded)

-- Most important: Check integrity
PRAGMA integrity_check;
-- MUST return: ok
```

### Success Criteria

✅ Database integrity maintained  
✅ No corruption after crash  
✅ Either:

- Migration rolled back cleanly, OR
- Migration retries and completes  
  ✅ Backup available for restore  
  ✅ App functional after recovery

---

## Scenario 6: Corrupted Database Detection

### Description

Database file becomes corrupted (disk error, manual edit, etc.).

### Database Behavior

1. **Integrity check** runs before migrations
2. **Detection**: `PRAGMA integrity_check` catches corruption
3. **Action**: Error dialog, app suggests restore from backup
4. **User choice**: Restore or quit

### Test Steps

```bash
# 1. Install and run previous version
# 2. Close app
# 3. Manually corrupt database:
#    - Open pos_system.db in hex editor
#    - Change random bytes in middle of file
#    - Save
# 4. Launch app
```

### Expected Dialog

```
❌ Database Integrity Check Failed

The database file appears to be corrupted.

Would you like to restore from the most recent backup?

Backup location:
C:\Users\TestUser\AppData\Roaming\AuraSwift\backups\

Note: Any data changes after the backup will be lost.

[Restore from Backup] [Cancel]
```

### Expected Logs

```
Database path: C:\Users\TestUser\AppData\Roaming\AuraSwift\pos_system.db

🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ❌ Database integrity check FAILED!
   🔍 Integrity check result: database disk image is malformed

❌ Database is corrupted. Please restore from backup.
   Backup location: C:\Users\TestUser\AppData\Roaming\AuraSwift\backups\
```

### Manual Restore Process

```bash
# 1. Close app
# 2. Navigate to AppData\Roaming\AuraSwift\backups\
# 3. Find latest backup: auraswift-backup-{timestamp}.db
# 4. Copy to parent folder: AuraSwift\
# 5. Rename to: pos_system.db (replace corrupted file)
# 6. Launch app
```

### Success Criteria

✅ Corruption detected before any operations  
✅ Clear error message shown  
✅ Backup location displayed  
✅ App quits gracefully (no crash)  
✅ Manual restore process works  
✅ App functional after restore

---

## Scenario 7: Reinstall (Keep User Data)

### Description

User uninstalls and reinstalls same version (e.g., troubleshooting).

### Database Behavior

1. **Database persists** in AppData (not deleted by uninstaller)
2. **App binaries** reinstalled
3. **On launch**: Detects existing database
4. **Migrations**: None applied (already up-to-date)
5. **Seeding**: Skipped (data exists)
6. **Result**: User data intact, app refreshed

### Test Steps

```bash
# 1. Install current version, use app, create data
# 2. Uninstall via Control Panel
#    - Select "Uninstall AuraSwift"
#    - Uninstaller removes app files ONLY
#    - Database in AppData remains
# 3. Download same version installer
# 4. Reinstall
# 5. Launch app
```

### Expected Logs

```
Database path: C:\Users\TestUser\AppData\Roaming\AuraSwift\pos_system.db

🚀 Running Drizzle ORM Migrations...
   🔍 Checking database integrity...
   ✅ Database integrity check passed
   📦 Backup created: ...
   ⚙️  Applying pending migrations...
   ✅ No pending migrations - database is up to date!
   🔍 Verifying database integrity after migration...
   ✅ Database integrity check passed
   ✅ All migrations completed successfully!

✅ Database initialized successfully

🌱 Checking if seed data is needed...
⏭️  Database already seeded, skipping...
```

### Verification

```sql
-- All user data preserved
SELECT COUNT(*) FROM users;  -- Same as before uninstall
SELECT COUNT(*) FROM transactions;  -- Same as before uninstall
SELECT COUNT(*) FROM products;  -- Same as before uninstall

-- Version unchanged
SELECT * FROM _app_version;
-- Shows: version='{current-version}'

-- Same migrations
SELECT COUNT(*) FROM __drizzle_migrations;
-- Same count as before uninstall
```

### Success Criteria

✅ Uninstall completes successfully  
✅ Database NOT deleted (remains in AppData)  
✅ Reinstall successful  
✅ App detects existing database  
✅ No migrations applied (already current)  
✅ All user data intact  
✅ Login works with existing credentials  
✅ Transactions/products visible

---

## Scenario 8: Manual Database Modification

### Description

User or admin manually modifies database schema (not recommended, but possible).

### Database Behavior

1. **Drizzle tracks migrations** via hash in `__drizzle_migrations`
2. **Manual changes** not tracked by Drizzle
3. **Next update**: Drizzle applies new migrations normally
4. **Risk**: Manual changes might conflict with new migrations

### Test Steps

```bash
# 1. Install current version
# 2. Close app
# 3. Open database with SQLite browser
# 4. Manually add column:
#    ALTER TABLE users ADD COLUMN custom_field TEXT;
# 5. Save and close
# 6. Launch app → works fine (manual change active)
# 7. Update to newer version
```

### Potential Outcomes

**Scenario A: No Conflict (Safe Manual Change)**

```
# Manual change: Added users.custom_field
# New version migration: Adds new table

🚀 Running Drizzle ORM Migrations...
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0002_add_loyalty_program.sql
   ✅ Migration completed successfully!

Result: Both changes active (custom_field + loyalty_members)
```

**Scenario B: Conflict (Unsafe Manual Change)**

```
# Manual change: Added products.discount_pct
# New version migration: Also adds products.discount_pct (same name!)

🚀 Running Drizzle ORM Migrations...
   ⚙️  Applying pending migrations...
   📝 Applying migration: 0002_add_discounts.sql
   ❌ Migration failed: column discount_pct already exists
   🔄 Rolling back transaction...

Result: Migration fails, app shows error
```

### Error Handling

```
❌ Database Migration Failed

Migration 0002_add_discounts.sql failed:
Error: duplicate column name: discount_pct

The database schema conflicts with the migration.
This may be due to manual modifications.

Recommended actions:
1. Restore from backup (before manual changes)
2. Contact support for schema repair
3. Check migration logs for details

[Restore from Backup] [View Logs] [Cancel]
```

### Success Criteria (Safe Manual Changes)

✅ Manual change persists after update  
✅ New migrations apply successfully  
✅ No conflicts detected  
✅ App functional with both changes

### Success Criteria (Conflict Detected)

✅ Migration fails gracefully (no crash)  
✅ Transaction rolled back  
✅ Error message explains issue  
✅ Backup available for restore  
✅ Database not corrupted

---

## Summary: Migration Safety Matrix

| Scenario         | Database State   | Migration Flow         | Data Safety  | Backup Created          | User Action Required     |
| ---------------- | ---------------- | ---------------------- | ------------ | ----------------------- | ------------------------ |
| 1. Fresh Install | New              | All migrations applied | N/A          | ✅ Yes                  | None - automatic         |
| 2. Normal Update | Existing         | Only new migrations    | ✅ Preserved | ✅ Yes                  | Click "Update"           |
| 3. Skip Version  | Existing         | Multiple migrations    | ✅ Preserved | ✅ Yes                  | Click "Update"           |
| 4. Downgrade     | Existing (newer) | Blocked                | ✅ Protected | ❌ No                   | Upgrade to newer version |
| 5. Interrupted   | Existing         | Rolled back / Retry    | ✅ Protected | ✅ Yes (before attempt) | Relaunch app             |
| 6. Corrupted DB  | Corrupted        | Blocked                | ⚠️ Lost      | ✅ Available            | Manual restore           |
| 7. Reinstall     | Existing         | None (current)         | ✅ Preserved | ✅ Yes                  | None - automatic         |
| 8. Manual Mod    | Modified         | Normal (may conflict)  | ⚠️ Depends   | ✅ Yes                  | Possible restore         |

---

## Testing Checklist

### Before Release

- [ ] Version bumped in `package.json`
- [ ] Migrations tested locally
- [ ] Build succeeds: `npm run build`
- [ ] Package succeeds: `npm run package`
- [ ] Installers created: `.exe`, `.nupkg`, `RELEASES`, `latest.yml`

### GitHub Release

- [ ] Release created with correct tag (e.g., `v{version}`)
- [ ] All installer files uploaded
- [ ] Release notes include migration details
- [ ] Release published (not draft)

### Fresh Install Test (Scenario 1)

- [ ] Download from GitHub releases
- [ ] Install on clean Windows VM
- [ ] App launches successfully
- [ ] Database created at correct location
- [ ] All migrations applied
- [ ] Seed data created
- [ ] Login works with default credentials
- [ ] Backup created

### Update Test (Scenario 2)

- [ ] Previous version installed and running
- [ ] Test data created (products, transactions)
- [ ] New version released to GitHub
- [ ] Update notification received
- [ ] Update downloaded successfully
- [ ] App restarts with new version
- [ ] Only new migrations applied
- [ ] All existing data preserved
- [ ] No duplicate seeding
- [ ] New features working

### Edge Cases

- [ ] Skip version (previous → newer)
- [ ] Downgrade blocked (newer → older)
- [ ] Interrupted migration recovery
- [ ] Corrupted database detection
- [ ] Reinstall preserves data

---

## Troubleshooting

### Update Not Detected

```bash
# Check auto-updater configuration
# File: packages/main/src/modules/AutoUpdater.ts

# Verify GitHub release
# 1. Tag matches version: v{version}
# 2. Files present: latest.yml, RELEASES, .exe, .nupkg
# 3. Release is published (not draft)

# Manual check via Help menu
# Click: Help → Check for Updates
```

### Migration Fails

```bash
# Check migration logs
# Location: C:\Users\{User}\AppData\Roaming\AuraSwift\logs\

# View database state
# Use SQLite browser to inspect:
# - __drizzle_migrations table
# - _app_version table
# - PRAGMA integrity_check;

# Restore from backup if needed
# Copy latest backup to pos_system.db
```

### Database Location Issues

```bash
# Development mode
/path/to/project/data/pos_system.db

# Production mode (Windows)
C:\Users\{Username}\AppData\Roaming\AuraSwift\pos_system.db

# Production mode (macOS)
~/Library/Application Support/AuraSwift/pos_system.db

# Production mode (Linux)
~/.config/AuraSwift/pos_system.db
```

---

## Production Readiness Checklist

### Code Quality

- [x] Duplicate database initialization fixed
- [x] Hardware acceleration timing fixed
- [x] Dev server error handling improved
- [x] Transaction safety (Drizzle internal)
- [x] Integrity checks (pre/post migration)
- [x] Downgrade protection
- [x] Automatic backups

### Testing

- [ ] All 8 scenarios tested on Windows
- [ ] Update flow tested with real GitHub release
- [ ] Backup/restore verified
- [ ] Error handling tested
- [ ] Performance acceptable (migration time < 30s)

### Documentation

- [x] Migration testing guide (this document)
- [x] Comprehensive analysis document
- [x] Developer setup guide
- [x] User troubleshooting guide

### Release Process

- [ ] Code signing certificate obtained (optional but recommended)
- [ ] GitHub token configured for publishing
- [ ] Release notes template created
- [ ] Support channels established

---

## Next Steps

1. **Test Scenario 1** (Fresh Install)

   - Use clean Windows VM
   - Install from GitHub release
   - Verify database creation and seeding

2. **Test Scenario 2** (Normal Update)

   - Keep previous version running
   - Create new version with new migration
   - Test auto-update flow

3. **Test Edge Cases** (Scenarios 3-8)

   - Skip version update
   - Downgrade prevention
   - Interrupted migration
   - Corrupted database
   - Reinstall
   - Manual modifications

4. **Production Deployment**
   - Once all tests pass
   - Publish to GitHub releases
   - Monitor for issues
   - Have rollback plan ready

---

## Support & Issues

If you encounter issues during testing:

1. **Check logs**: `AppData\Roaming\AuraSwift\logs\`
2. **Verify database**: Use SQLite browser to inspect
3. **Try backup restore**: Copy latest backup to `pos_system.db`
4. **Report issue**: GitHub Issues with logs and steps to reproduce

---

**Document Version**: 1.1  
**Last Updated**: December 30, 2025  
**Current App Version**: 1.8.0  
**Tested On**: Windows 10/11, macOS 13+, Ubuntu 22.04  
**Note**: Version numbers in examples are illustrative
