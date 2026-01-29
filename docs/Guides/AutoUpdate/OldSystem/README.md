# Auto-Update & Migration Documentation

Complete documentation for AuraSwift's auto-update system with database migrations.

---

## 📋 Quick Start

| Document                                                               | Purpose                                     | Audience       |
| ---------------------------------------------------------------------- | ------------------------------------------- | -------------- |
| **[QUICK_TESTING_CHECKLIST.md](QUICK_TESTING_CHECKLIST.md)**           | Quick reference for testing releases        | Developers, QA |
| **[FIRST_RELEASE_TEST_PLAN.md](FIRST_RELEASE_TEST_PLAN.md)**           | Step-by-step guide for first release        | Developers, QA |
| **[CLIENT_RELEASE_TESTING_GUIDE.md](CLIENT_RELEASE_TESTING_GUIDE.md)** | Comprehensive testing guide (all scenarios) | Developers, QA |

---

## 📚 Documentation Index

### Testing Guides

#### 🚀 [QUICK_TESTING_CHECKLIST.md](QUICK_TESTING_CHECKLIST.md)

**Quick reference checklist for release testing**

- Pre-release checklist
- 8 testing scenarios with priorities
- Quick commands for database inspection
- Troubleshooting guide
- **Use this**: Before every release

#### 🎯 [FIRST_RELEASE_TEST_PLAN.md](FIRST_RELEASE_TEST_PLAN.md)

**Step-by-step guide for testing releases with database migrations**

- Phase 1: Build and test fresh install
- Phase 2: Create new version with migration
- Phase 3: Test auto-update flow
- Phase 4: Edge case testing
- Phase 5: Production checklist
- **Use this**: For testing releases with database changes

#### 📖 [CLIENT_RELEASE_TESTING_GUIDE.md](CLIENT_RELEASE_TESTING_GUIDE.md)

**Comprehensive guide covering all 8 scenarios**

- Scenario 1: Fresh Install (new client)
- Scenario 2: Normal Update (existing client)
- Scenario 3: Skip Version Update
- Scenario 4: Downgrade Prevention
- Scenario 5: Interrupted Migration
- Scenario 6: Corrupted Database Detection
- Scenario 7: Reinstall (keep data)
- Scenario 8: Manual Database Modification
- **Use this**: As complete reference for all testing scenarios

#### 📝 [CLIENT_MIGRATION_TESTING_PLAN.md](CLIENT_MIGRATION_TESTING_PLAN.md)

**Earlier version of testing plan**

- Similar to CLIENT_RELEASE_TESTING_GUIDE.md
- Kept for reference

### Technical Analysis

#### 🔬 [CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md](CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md)

**900+ line deep-dive into migration system** (⭐ Most comprehensive)

- Complete architecture overview
- All migration types analyzed (ADD, DROP, RENAME, etc.)
- Safety features explained
- Client update workflow
- Troubleshooting guide
- **Use this**: To understand how the system works internally

#### ⚙️ [MIGRATION_SAFETY_IMPLEMENTATION.md](MIGRATION_SAFETY_IMPLEMENTATION.md)

**Summary of implemented safety features**

- Transaction safety
- Integrity checks
- Downgrade protection
- Automatic backups
- Testing checklist
- **Use this**: Quick reference for safety features

#### 📊 [MIGRATION_REFACTOR_SUMMARY.md](MIGRATION_REFACTOR_SUMMARY.md)

**Summary of migration system refactor**

- Old approach vs new approach
- Drizzle ORM benefits
- Implementation details
- **Use this**: Historical context for refactoring decisions

### Auto-Update System

#### 🔄 [AUTO_UPDATE_GUIDE.md](AUTO_UPDATE_GUIDE.md)

**Guide for implementing auto-update with electron-updater**

- Setup instructions
- Configuration
- GitHub releases integration
- **Use this**: Initial setup reference

#### 🔍 [AUTO_UPDATE_FEATURE_IN_DETAIL.md](AUTO_UPDATE_FEATURE_IN_DETAIL.md)

**Detailed explanation of auto-update feature**

- How electron-updater works
- Update flow diagrams
- Platform-specific details
- **Use this**: Deep understanding of auto-update mechanism

#### 📈 [IN_DETAIL_UPDATE_WORKFLOW.md](IN_DETAIL_UPDATE_WORKFLOW.md)

**Detailed update workflow from check to install**

- Step-by-step process
- User interactions
- Error handling
- **Use this**: Understanding complete update lifecycle

### Database Migration

#### 🗄️ [DATABASE_MIGRATION_BEST_PRACTICES.md](DATABASE_MIGRATION_BEST_PRACTICES.md)

**Best practices for database migrations**

- Migration naming conventions
- Testing strategies
- Common pitfalls
- **Use this**: Before creating new migrations

#### 📐 [DATABASE_SCHEMA_CHANGES_GUIDE.md](DATABASE_SCHEMA_CHANGES_GUIDE.md)

**Guide for making schema changes**

- Using Drizzle Kit
- Generating migrations
- Applying migrations
- **Use this**: When modifying database schema

---

## 🎯 Workflow Guide

### For Developers

#### Creating a New Release

```bash
# 1. Read the quick checklist
→ QUICK_TESTING_CHECKLIST.md

# 2. Create database changes (if needed)
→ DATABASE_SCHEMA_CHANGES_GUIDE.md

# 3. Follow step-by-step test plan
→ FIRST_RELEASE_TEST_PLAN.md

# 4. For comprehensive testing
→ CLIENT_RELEASE_TESTING_GUIDE.md
```

#### Understanding the System

```bash
# 1. Overview of migration system
→ CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md

# 2. Safety features
→ MIGRATION_SAFETY_IMPLEMENTATION.md

# 3. Auto-update mechanism
→ AUTO_UPDATE_FEATURE_IN_DETAIL.md
```

#### Troubleshooting Issues

```bash
# 1. Quick fixes
→ QUICK_TESTING_CHECKLIST.md (Troubleshooting section)

# 2. Detailed analysis
→ CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md (Troubleshooting section)

# 3. Best practices
→ DATABASE_MIGRATION_BEST_PRACTICES.md
```

---

## 🔑 Key Features

### Migration System

- ✅ **Automatic migrations** - Applied on app launch
- ✅ **Transaction safety** - Drizzle ORM internal transactions
- ✅ **Integrity checks** - Pre/post migration validation
- ✅ **Downgrade protection** - Prevents opening newer DB with older app
- ✅ **Automatic backups** - Created before each migration
- ✅ **Rollback support** - Automatic on failure

### Auto-Update System

- ✅ **electron-updater** - Industry-standard solution
- ✅ **GitHub Releases** - Simple hosting via semantic-release
- ✅ **Background downloads** - No interruption
- ✅ **Request timeout & retry** - 10s timeout, 3 retries with exponential backoff
- ✅ **Update check caching** - 15-minute cache to reduce network requests
- ✅ **Debouncing** - Prevents rapid update checks
- ✅ **Idle detection** - Checks during user activity
- ✅ **Release notes caching** - Last 5 versions cached
- ✅ **NSIS + Squirrel** - Windows installers
- ✅ **Delta updates** - Smaller download sizes
- ✅ **Performance metrics** - Tracks check/download duration, error rates

---

## 📖 Document Priorities

### Must Read (Before Release)

1. **QUICK_TESTING_CHECKLIST.md** - Essential for every release
2. **FIRST_RELEASE_TEST_PLAN.md** - For first-time testing
3. **MIGRATION_SAFETY_IMPLEMENTATION.md** - Understand safety features

### Recommended Reading

4. **CLIENT_RELEASE_TESTING_GUIDE.md** - Comprehensive scenarios
5. **CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md** - Deep understanding
6. **DATABASE_SCHEMA_CHANGES_GUIDE.md** - When modifying schema

### Reference Documentation

7. **AUTO_UPDATE_FEATURE_IN_DETAIL.md** - Auto-update deep-dive
8. **DATABASE_MIGRATION_BEST_PRACTICES.md** - Best practices
9. **IN_DETAIL_UPDATE_WORKFLOW.md** - Update workflow
10. **AUTO_UPDATE_GUIDE.md** - Initial setup
11. **MIGRATION_REFACTOR_SUMMARY.md** - Historical context
12. **CLIENT_MIGRATION_TESTING_PLAN.md** - Alternative testing guide

---

## 🧪 Testing Scenarios Summary

| Scenario         | Priority      | Database State | Expected Outcome                    |
| ---------------- | ------------- | -------------- | ----------------------------------- |
| 1. Fresh Install | ⭐ **MUST**   | New            | All migrations applied, data seeded |
| 2. Normal Update | ⭐ **MUST**   | Existing       | Only new migrations, data preserved |
| 3. Skip Version  | ⚠️ **SHOULD** | Existing       | Multiple migrations applied         |
| 4. Downgrade     | ⚠️ **SHOULD** | Newer          | Blocked with error                  |
| 5. Interrupted   | 🔧 Optional   | In-progress    | Rollback or retry                   |
| 6. Corrupted DB  | 🔧 Optional   | Corrupted      | Detected, backup suggested          |
| 7. Reinstall     | 🔧 Optional   | Existing       | No changes, data preserved          |
| 8. Manual Mod    | 🔧 Optional   | Modified       | Conflict detection                  |

---

## 🛠️ Quick Commands

### Build & Release

```bash
# Version is managed by semantic-release (automatic on push to main)
# Or manually bump:
npm version patch|minor|major

# Build
npm run build

# Package (creates installers)
npm run compile

# Publish to GitHub (automatic via semantic-release)
# Or manually: Upload dist/* files to GitHub Releases
```

### Database Inspection

```bash
# Check migrations
SELECT * FROM __drizzle_migrations;

# Check version
SELECT * FROM _app_version;

# Check integrity
PRAGMA integrity_check;
```

### Testing

```bash
# Fresh install test
# Download installer from GitHub releases
# Run on clean Windows VM

# Update test
# Install previous version, then update to latest
# Verify data preserved and migrations applied
```

---

## 📞 Support

### Issues During Testing

1. Check **QUICK_TESTING_CHECKLIST.md** - Troubleshooting section
2. Check **CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md** - Issue Resolution
3. Check database logs: `AppData\Roaming\AuraSwift\logs\`
4. Restore from backup: `AppData\Roaming\AuraSwift\backups\`

### Creating New Migrations

1. Read **DATABASE_SCHEMA_CHANGES_GUIDE.md**
2. Follow **DATABASE_MIGRATION_BEST_PRACTICES.md**
3. Test with **FIRST_RELEASE_TEST_PLAN.md**

---

## 🔄 Version History

| Version | Date       | Changes                            |
| ------- | ---------- | ---------------------------------- |
| 1.0     | 2025-11-12 | Initial documentation suite        |
| 1.1     | 2025-12-30 | Updated with current implementation details |
| -       | -          | - Fixed version references (current: 1.8.0) |
| -       | -          | - Updated AutoUpdater features |
| -       | -          | - Updated migration system details |

---

## 📝 Contributing

When updating this documentation:

1. Keep guides practical and actionable
2. Include real examples and commands
3. Test all procedures before documenting
4. Update this README when adding new docs

---

## 🎓 Learning Path

### Beginner (Just Starting)

1. Read: **AUTO_UPDATE_GUIDE.md**
2. Read: **DATABASE_SCHEMA_CHANGES_GUIDE.md**
3. Follow: **FIRST_RELEASE_TEST_PLAN.md**

### Intermediate (Regular Releases)

1. Use: **QUICK_TESTING_CHECKLIST.md**
2. Reference: **CLIENT_RELEASE_TESTING_GUIDE.md**
3. Understand: **MIGRATION_SAFETY_IMPLEMENTATION.md**

### Advanced (Deep Understanding)

1. Study: **CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md**
2. Study: **AUTO_UPDATE_FEATURE_IN_DETAIL.md**
3. Master: **DATABASE_MIGRATION_BEST_PRACTICES.md**

---

**Documentation Suite Version**: 1.1  
**Last Updated**: December 30, 2025  
**Current App Version**: 1.8.0  
**Maintained By**: AuraSwift Development Team
