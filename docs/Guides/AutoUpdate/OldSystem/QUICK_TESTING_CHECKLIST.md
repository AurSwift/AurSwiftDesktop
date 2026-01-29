# Quick Testing Checklist for GitHub Releases

## Pre-Release Checklist

```bash
# 1. Version is managed by semantic-release (automatic on push to main)
# Or manually update version:
npm version patch|minor|major

# 2. Build
npm run build

# 3. Package (creates installers)
npm run compile

# 4. Verify outputs
ls -la dist/*.exe dist/*.nupkg dist/RELEASES dist/latest.yml

# 5. Create GitHub Release
# Tag: v{version} (e.g., v1.7.0)
# Upload ALL files from dist/
# Publish (not draft)
```

---

## Scenario 1: Fresh Install ⭐ (MUST TEST)

**Setup**: Clean Windows VM or new user account

**Steps**:

1. Download `.exe` from GitHub releases
2. Run installer
3. Launch app

**Verify**:

- [ ] App launches
- [ ] Database created: `C:\Users\{User}\AppData\Roaming\AuraSwift\pos_system.db`
- [ ] Login works: `admin` / PIN `1234`
- [ ] Logs show: "All migrations completed successfully!"
- [ ] Logs show: "Database seeded successfully!"

**Expected Database**:

```sql
SELECT COUNT(*) FROM __drizzle_migrations; -- All migrations
SELECT * FROM _app_version; -- Current version
SELECT COUNT(*) FROM users; -- 3 users
```

---

## Scenario 2: Normal Update ⭐ (MUST TEST)

**Setup**: Previous version installed with test data

**Steps**:

1. Create test data (products, transactions)
2. Release new version with new migration
3. Wait for update notification or click Help → Check for Updates
4. Download and install
5. App restarts

**Verify**:

- [ ] Update downloaded successfully
- [ ] App version updated to new version
- [ ] Only new migration applied
- [ ] Test data preserved (products, transactions intact)
- [ ] No duplicate seeding
- [ ] New backup created

**Expected Database**:

```sql
SELECT * FROM __drizzle_migrations WHERE hash LIKE '%{new_migration}%'; -- New migration
SELECT * FROM _app_version; -- Updated to new version
SELECT COUNT(*) FROM products; -- Same count as before
SELECT COUNT(*) FROM transactions; -- Same count as before
```

---

## Scenario 3: Skip Version ⚠️ (RECOMMENDED)

**Setup**: Previous version installed, skip intermediate version

**Steps**:

1. Have previous version running
2. Release intermediate version (don't install)
3. Release newer version
4. Update directly to newer version

**Verify**:

- [ ] All skipped migrations applied in order
- [ ] Version updated to latest
- [ ] Data preserved

---

## Scenario 4: Downgrade Prevention ⚠️ (RECOMMENDED)

**Setup**: Newer version installed

**Steps**:

1. Uninstall newer version (keep database)
2. Install older version
3. Launch app

**Verify**:

- [ ] Error dialog: "Cannot Open Database"
- [ ] Message: "Database requires newer version"
- [ ] App quits gracefully
- [ ] Database unchanged

---

## Scenario 5: Interrupted Migration 🔧 (OPTIONAL)

**Setup**: Previous version installed, large migration in new version

**Steps**:

1. Start update to new version
2. Kill process during migration
3. Restart app

**Verify**:

- [ ] Database integrity maintained
- [ ] Either rolled back OR retry succeeds
- [ ] No corruption

---

## Scenario 6: Corrupted Database 🔧 (OPTIONAL)

**Setup**: Manually corrupt database

**Steps**:

1. Close app
2. Edit `pos_system.db` in hex editor
3. Launch app

**Verify**:

- [ ] Corruption detected
- [ ] Error message shown
- [ ] App quits gracefully
- [ ] Backup available for restore

---

## Scenario 7: Reinstall 🔧 (OPTIONAL)

**Setup**: Current version installed with data

**Steps**:

1. Uninstall app (Control Panel)
2. Reinstall same version
3. Launch app

**Verify**:

- [ ] Database preserved
- [ ] No migrations applied (already current)
- [ ] Data intact (products, users, transactions)

---

## Scenario 8: Manual DB Modification 🔧 (OPTIONAL)

**Setup**: Current version with manual schema change

**Steps**:

1. Close app
2. Add column manually: `ALTER TABLE users ADD COLUMN test TEXT;`
3. Launch app
4. Update to newer version

**Verify**:

- [ ] If no conflict: Both changes active
- [ ] If conflict: Migration fails gracefully, rollback

---

## Priority Testing Order

### Minimum (Before Any Release)

1. ✅ **Scenario 1**: Fresh Install
2. ✅ **Scenario 2**: Normal Update

### Recommended (Before Production)

3. ⚠️ **Scenario 3**: Skip Version
4. ⚠️ **Scenario 4**: Downgrade Prevention

### Optional (Periodic Testing)

5. 🔧 **Scenario 5**: Interrupted Migration
6. 🔧 **Scenario 6**: Corrupted Database
7. 🔧 **Scenario 7**: Reinstall
8. 🔧 **Scenario 8**: Manual Modification

---

## Quick Commands

### Check Database Location

```bash
# Windows
echo %APPDATA%\AuraSwift\pos_system.db

# macOS
echo ~/Library/Application\ Support/AuraSwift/pos_system.db

# Linux
echo ~/.config/AuraSwift/pos_system.db
```

### Inspect Database

```bash
# Install SQLite browser
# Download from: https://sqlitebrowser.org/

# Open database
# File → Open Database → pos_system.db

# Run queries
SELECT * FROM __drizzle_migrations;
SELECT * FROM _app_version;
SELECT COUNT(*) FROM users;
```

### View Logs

```bash
# Windows
start %APPDATA%\AuraSwift\logs\

# macOS
open ~/Library/Logs/AuraSwift/

# Linux
xdg-open ~/.config/AuraSwift/logs/
```

### Force Check for Updates

```bash
# In app: Help menu → Check for Updates
# Automatic checks run periodically with idle detection
```

---

## Success Indicators

### Fresh Install

```
✅ Database initialized successfully
✅ All migrations completed successfully!
✅ Database seeded successfully!
```

### Update

```
✅ Update downloaded
✅ Only new migrations applied
✅ Database already seeded, skipping...
```

### Error (Safe)

```
❌ Database downgrade detected
❌ Database integrity check FAILED
❌ Migration failed: {reason}
🔄 Rolling back transaction...
```

---

## Troubleshooting

| Issue               | Solution                                  |
| ------------------- | ----------------------------------------- |
| Update not detected | Check GitHub release published, not draft |
| Migration fails     | Restore from backup in `backups/` folder  |
| Database locked     | Close all SQLite browser connections      |
| Permission denied   | Run as administrator (Windows)            |
| Backup not created  | Check disk space available                |

---

## Test Environment

### Recommended

- **Windows VM**: VirtualBox or VMware with Windows 10/11
- **Clean State**: Snapshot before each test for quick reset
- **Network**: Stable internet for GitHub downloads
- **Storage**: 10+ GB free space

### Quick VM Setup

```bash
# 1. Create Windows 10/11 VM
# 2. Install Chrome/Edge for downloads
# 3. Enable Windows Defender exceptions (for unsigned apps)
# 4. Take snapshot: "Clean Install"
# 5. For each test: Restore to "Clean Install"
```

---

## Report Template

```markdown
## Test Results - v{version}

**Date**: {date}
**Tester**: {name}
**Environment**: Windows {version} / macOS {version}

### Scenario 1: Fresh Install

- [ ] PASS / [ ] FAIL
- Notes: {any issues}

### Scenario 2: Normal Update

- [ ] PASS / [ ] FAIL
- Notes: {any issues}

### Additional Scenarios

- [ ] Scenario 3: {PASS/FAIL}
- [ ] Scenario 4: {PASS/FAIL}
- ...

### Issues Found

1. {Issue description}
   - Severity: Critical / High / Medium / Low
   - Steps to reproduce: {steps}

### Overall Status

- [ ] Ready for production
- [ ] Needs fixes before release
```

---

**Quick Reference**: See `CLIENT_RELEASE_TESTING_GUIDE.md` for detailed steps and expected outcomes.
