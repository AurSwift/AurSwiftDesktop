# Complete Auto-Update Workflow for AuraSwift

## 📋 Table of Contents

1. [Overview](#overview)
2. [What Happens When You Push to Main](#what-happens-when-you-push-to-main)
3. [The Update Installation Process](#the-update-installation-process)
4. [Database Migration During Updates](#database-migration-during-updates)
5. [Files Replaced vs Preserved](#files-replaced-vs-preserved)
6. [Complete Workflow Diagram](#complete-workflow-diagram)
7. [Testing Update Scenarios](#testing-update-scenarios)

**📚 Related Documentation:**

- **[Database Schema Changes Guide](./DATABASE_SCHEMA_CHANGES_GUIDE.md)** - Detailed analysis of how different DB changes work during updates (adding/removing tables, columns, relationships, etc.)

---

## 🎯 Overview

AuraSwift uses **electron-updater** with **GitHub Releases** to deliver automatic updates. When you push changes to the main branch and create a new release, users with older versions automatically receive and install the update.

### Key Principle: **Non-Destructive Updates**

> ⚠️ **CRITICAL UNDERSTANDING:**  
> Auto-updates replace **application code and assets** but **PRESERVE user data** including:
>
> - Database files
> - User preferences
> - Configuration files
> - Any data stored in `userData` directory

### 🔑 **Quick Answer: What Gets Replaced?**

```
┌───────────────────────────────────────────────────────────────────┐
│  REPLACED ⟳ (Old Version DELETED, New Version Installed)        │
├───────────────────────────────────────────────────────────────────┤
│  ✓ AuraSwift.exe (the executable)                                │
│  ✓ package.json (version number changes: 3.0.0 → 3.2.0)         │
│  ✓ resources/app.asar (ALL your source code - TypeScript/React)  │
│  ✓ node_modules/ (ALL dependencies)                              │
│  ✓ assets/ (icons, images, static files)                         │
│  ✓ Everything in Program Files\AuraSwift\                        │
│                                                                   │
│  In short: THE ENTIRE APPLICATION IS REPLACED!                   │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│  PRESERVED ✓ (Never Touched by Updates)                          │
├───────────────────────────────────────────────────────────────────┤
│  ✓ pos_system.db (YOUR DATABASE - with all business data)        │
│  ✓ config.json (user settings/preferences)                       │
│  ✓ logs/ (application logs)                                      │
│  ✓ Everything in AppData\Roaming\AuraSwift\                      │
│                                                                   │
│  In short: ALL USER DATA IS SAFE!                                │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│  WHAT HAPPENS TO OLD VERSION?                                     │
├───────────────────────────────────────────────────────────────────┤
│  ❌ Old v3.0.0 files are COMPLETELY DELETED                       │
│  ❌ Old source code is GONE                                       │
│  ❌ Old dependencies are REMOVED                                  │
│  ❌ No rollback capability (unless you implement it)              │
│                                                                   │
│  The installer REPLACES everything, like a clean fresh install   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🚀 What Happens When You Push to Main

### Step 1: Code Push & Release Creation

```bash
# You push code changes to GitHub
git add .
git commit -m "feat: Added new discount feature with database migration"
git push origin main

# GitHub Actions automatically:
# 1. Detects the push
# 2. Runs CI/CD pipeline
# 3. Builds the application
# 4. Creates a GitHub Release
# 5. Uploads installer files
```

### Step 2: GitHub Actions Build Process

**File:** `.github/workflows/ci.yml`

The build process uses:
- **semantic-release** for automatic versioning and GitHub releases
- **electron-builder** for creating installers
- **GitHub Actions** for CI/CD

```yaml
# GitHub Actions automatically:
- name: Build Application
  run: npm run compile
  # This compiles TypeScript, bundles code, creates installers

- name: Semantic Release
  run: npx semantic-release
  # This automatically:
  #   - Analyzes commits (conventional commits)
  #   - Bumps version
  #   - Generates CHANGELOG.md
  #   - Creates GitHub Release
  #   - Uploads installers:
  #     - AuraSwift-{version}-Windows-x64.exe (NSIS installer)
  #     - AuraSwift-{version}-win-x64.exe (Squirrel installer)
  #     - latest.yml (update metadata file)
  #     - RELEASES (Squirrel manifest)
```

### Step 3: Release Artifacts Created

After build completes, GitHub Releases contains:

```
Release v{version}
├── AuraSwift-{version}-Windows-x64.exe  (NSIS installer - full app)
├── AuraSwift-{version}-win-x64.exe      (Squirrel installer)
├── AuraSwift-{version}-win-x64-full.nupkg (Squirrel package - full app)
├── AuraSwift-{version}-win-x64-delta.nupkg (Squirrel delta - only changes)
├── latest.yml                            (Update metadata)
├── RELEASES                              (Squirrel metadata)
└── CHANGELOG.md                          (Release notes - auto-generated)
```

**Key File: `latest.yml`**

```yaml
version: {version}
files:
  - url: AuraSwift-{version}-Windows-x64.exe
    sha512: abc123...
    size: 85401234
releaseDate: "2025-12-30T10:30:00.000Z"
path: AuraSwift-{version}-Windows-x64.exe
sha512: abc123...
releaseNotes: |
  - Auto-generated from conventional commits
  - Database migration details
  - Bug fixes and improvements
```

---

## 🔄 The Update Installation Process

### User's Computer: Update Detection & Installation

```
┌─────────────────────────────────────────────────────────────────┐
│  USER'S COMPUTER (Running AuraSwift v3.0.0)                     │
└─────────────────────────────────────────────────────────────────┘

Step 1: Auto-Update Check (Every 4 hours + on app start)
┌────────────────────────────────────────────────────────────────┐
│ AuraSwift v3.0.0 Running                                       │
│                                                                │
│ AutoUpdater.ts:                                                │
│   ├─ Checks: https://github.com/Sam231221/AuraSwift/releases  │
│   ├─ Fetches: latest.yml                                      │
│   ├─ Compares: Current (3.0.0) vs Available (3.2.0)           │
│   └─ Decision: UPDATE AVAILABLE! ✅                            │
└────────────────────────────────────────────────────────────────┘

Step 2: Update Available Dialog
┌────────────────────────────────────────────────────────────────┐
│  🎉 Update Available                                           │
│                                                                │
│  A new version of AuraSwift is available!                      │
│                                                                │
│  Current version: 3.0.0                                        │
│  New version: 3.2.0                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        │
│  What's New:                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        │
│  • Added discount system with buy-X-get-Y support              │
│  • Database migration: Added discounts table                   │
│  • Improved transaction processing                             │
│  • Bug fixes and performance improvements                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        │
│                                                                │
│  [Download Now]  [View Release Notes]  [Remind Me Later]      │
└────────────────────────────────────────────────────────────────┘

Step 3: Download Update (User clicks "Download Now")
┌────────────────────────────────────────────────────────────────┐
│ 📥 Downloading Update...                                       │
│                                                                │
│ electron-updater downloads to TEMP directory:                  │
│                                                                │
│ Windows:                                                       │
│ C:\Users\Username\AppData\Local\Temp\auraswift-updater\       │
│   └─ AuraSwift-Setup-3.2.0.exe                                │
│                                                                │
│ Download happens in background, app remains usable             │
│ Progress: ████████████░░░░░░░░ 65%                           │
└────────────────────────────────────────────────────────────────┘

Step 4: Download Complete - Install Prompt
┌────────────────────────────────────────────────────────────────┐
│  ✅ Update Ready to Install                                    │
│                                                                │
│  AuraSwift 3.2.0 has been downloaded and is ready to install!  │
│                                                                │
│  The application will restart to complete the installation.    │
│  All your data and settings will be preserved.                 │
│                                                                │
│  [Restart Now]  [Restart Later]                                │
└────────────────────────────────────────────────────────────────┘

Step 5: Installation Process (User clicks "Restart Now")
┌────────────────────────────────────────────────────────────────┐
│ 🔄 Installing Update...                                        │
│                                                                │
│ 1. AuraSwift v3.0.0 shuts down gracefully                      │
│    ├─ Closes all windows                                      │
│    ├─ Saves current state                                     │
│    └─ Closes database connections                             │
│                                                                │
│ 2. Installer runs automatically                                │
│    ├─ Executes: AuraSwift-Setup-3.2.0.exe /S /UPDATE          │
│    └─ Silent update mode (no UI prompts)                      │
│                                                                │
│ 3. Installation performs:                                      │
│    ├─ REPLACES application code in:                           │
│    │   C:\Program Files\AuraSwift\                            │
│    │   ├─ AuraSwift.exe ⟳                                     │
│    │   ├─ resources/app.asar ⟳                                │
│    │   ├─ node_modules ⟳                                      │
│    │   └─ assets/ ⟳                                           │
│    │                                                           │
│    └─ PRESERVES user data in:                                 │
│        C:\Users\Username\AppData\Roaming\AuraSwift\           │
│        ├─ pos_system.db ✓ (KEPT)                              │
│        ├─ config.json ✓ (KEPT)                                │
│        └─ logs/ ✓ (KEPT)                                      │
│                                                                │
│ 4. AuraSwift v3.2.0 starts automatically                       │
│    ├─ Loads existing database                                 │
│    ├─ Runs database migrations                                │
│    └─ User sees updated app with all their data intact        │
└────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Migration During Updates

### How Database Changes Are Handled

Your `database.ts` file contains migration logic that runs **every time the app starts**:

```typescript
// From your database.ts file
private initializeTables() {
  // First create businesses table (no foreign keys)
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (...)
  `);

  // Migration: Add new columns if they don't exist
  try {
    this.db.exec(`ALTER TABLE businesses ADD COLUMN address TEXT DEFAULT '';`);
  } catch (error) {
    // Column might already exist, ignore error
  }

  // ... more tables and migrations
}
```

### Update Scenario Example

**Scenario:** You add a new discount system in v3.2.0

#### Before Update (v3.0.0 Database):

```
Database: pos_system.db
├─ businesses table
├─ users table
├─ products table
├─ transactions table
└─ (no discounts table)
```

#### Your Code Changes:

```typescript
// In database.ts - ADD THIS
this.db.exec(`
  CREATE TABLE IF NOT EXISTS discounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    // ... more columns
  )
`);

// ADD discount columns to transactions table
try {
  this.db.exec(`ALTER TABLE transactions ADD COLUMN discountAmount REAL DEFAULT 0;`);
} catch (error) {
  // Already exists, ignore
}
```

#### What Happens During Update:

```
1. User has AuraSwift v3.0.0 running
   └─ Database: pos_system.db (with old schema)

2. Update downloads and installs v3.2.0
   ├─ Application code replaced
   └─ Database file UNCHANGED (still in AppData)

3. AuraSwift v3.2.0 starts
   ├─ Loads existing database: pos_system.db
   ├─ Runs initializeTables()
   │   ├─ CREATE TABLE IF NOT EXISTS... (tables already exist, skipped)
   │   └─ ALTER TABLE... (adds new columns to existing tables)
   │
   └─ Result: Database updated with new schema, ALL OLD DATA PRESERVED! ✅
```

#### After Update (v3.2.0 Database):

```
Database: pos_system.db (SAME FILE, UPDATED SCHEMA)
├─ businesses table ✓ (existing data preserved)
├─ users table ✓ (existing data preserved)
├─ products table ✓ (existing data preserved)
├─ transactions table ✓ (existing data + new discountAmount column)
└─ discounts table ✓ (NEW, empty)
```

### Migration Best Practices

```typescript
// ✅ GOOD: Use CREATE TABLE IF NOT EXISTS
this.db.exec(`
  CREATE TABLE IF NOT EXISTS new_table (
    id TEXT PRIMARY KEY,
    // ...
  )
`);

// ✅ GOOD: Use ALTER TABLE with try-catch
try {
  this.db.exec(`ALTER TABLE existing_table ADD COLUMN new_column TEXT;`);
} catch (error) {
  // Column already exists, that's fine
}

// ✅ GOOD: Add indexes if they don't exist
this.db.exec(`CREATE INDEX IF NOT EXISTS idx_name ON table(column);`);

// ❌ BAD: Don't use DROP TABLE (destroys user data!)
// this.db.exec(`DROP TABLE users;`); // NEVER DO THIS!

// ❌ BAD: Don't recreate tables without preserving data
// this.db.exec(`CREATE TABLE users (...)`); // Will fail if exists!
```

---

## 📁 Files Replaced vs Preserved

### Critical Question: Does auto-updater replace ALL files?

**Answer: NO! Only application code is replaced. User data is preserved.**

### Directory Structure & Update Behavior

> ⚠️ **CRITICAL:** The installer COMPLETELY REPLACES the application directory.  
> The old version is **DELETED** and the new version is installed fresh.

```
WINDOWS EXAMPLE:

C:\Program Files\AuraSwift\               ← APPLICATION DIRECTORY (ENTIRE FOLDER REPLACED!)
├─ AuraSwift.exe                          ← REPLACED ⟳ (old exe deleted, new installed)
├─ package.json                           ← REPLACED ⟳ (YES! Old deleted, new installed)
├─ LICENSE                                ← REPLACED ⟳
├─ resources/
│  ├─ app.asar                            ← REPLACED ⟳ (ALL source code - old deleted!)
│  └─ app-update.yml                      ← REPLACED ⟳
├─ node_modules/                          ← REPLACED ⟳ (ALL dependencies reinstalled)
│  ├─ better-sqlite3/                     ← REPLACED ⟳
│  ├─ electron/                           ← REPLACED ⟳
│  └─ (all other packages)                ← REPLACED ⟳
├─ assets/
│  ├─ icons/                              ← REPLACED ⟳
│  └─ images/                             ← REPLACED ⟳
└─ locales/                               ← REPLACED ⟳

────────────────────────────────────────────────────────────────────────────
UPDATE PROCESS:
1. Installer detects: "AuraSwift already installed at C:\Program Files\AuraSwift"
2. DELETES: Everything in C:\Program Files\AuraSwift\*
3. INSTALLS: Fresh copy of new version
4. Result: Old version COMPLETELY GONE, new version in its place
────────────────────────────────────────────────────────────────────────────

C:\Users\Username\AppData\Roaming\AuraSwift\  ← USER DATA DIRECTORY (NEVER TOUCHED!)
├─ pos_system.db                          ← PRESERVED ✓ (your database - UNTOUCHED)
├─ pos_system.db-wal                      ← PRESERVED ✓ (SQLite journal)
├─ pos_system.db-shm                      ← PRESERVED ✓ (SQLite shared mem)
├─ config.json                            ← PRESERVED ✓ (if you create it)
├─ logs/                                  ← PRESERVED ✓
│  ├─ main.log
│  └─ renderer.log
└─ Preferences                            ← PRESERVED ✓ (Electron settings)

C:\Users\Username\AppData\Local\AuraSwift\    ← TEMP/CACHE DIRECTORY
├─ Cache/                                 ← MAY BE CLEARED
└─ temp/                                  ← MAY BE CLEARED
```

### macOS Example:

```
/Applications/AuraSwift.app/              ← APPLICATION BUNDLE
└─ Contents/
   ├─ MacOS/AuraSwift                     ← REPLACED ⟳
   ├─ Resources/
   │  └─ app.asar                         ← REPLACED ⟳
   └─ Frameworks/                         ← REPLACED ⟳

~/Library/Application Support/AuraSwift/  ← USER DATA DIRECTORY
├─ pos_system.db                          ← PRESERVED ✓
├─ config.json                            ← PRESERVED ✓
└─ logs/                                  ← PRESERVED ✓
```

### Why This Separation Matters

```typescript
// Your code in database.ts
private getDatabasePath(): string {
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

  if (isDev) {
    // Development: In project directory (gets replaced with new code)
    return path.join(__dirname, "..", "..", "..", "data", "pos_system.db");
  } else {
    // Production: In user data directory (NEVER replaced by updates)
    const userDataPath = app.getPath("userData");
    return path.join(userDataPath, "AuraSwift", "pos_system.db");
  }
}
```

**Key Insight:**  
The `app.getPath("userData")` directory is **specifically designed** by Electron to persist across updates!

---

## �️ What Happens to the Old Version?

### **The Old Version is COMPLETELY DELETED**

When you update from v3.0.0 to v3.2.0:

```
BEFORE UPDATE:
┌─────────────────────────────────────────────────────────────┐
│ C:\Program Files\AuraSwift\                                 │
├─ AuraSwift.exe              (v3.0.0 - 82 MB)                │
├─ package.json               (version: "3.0.0")              │
├─ resources/app.asar         (contains old source code)      │
│  ├─ database.ts             (no discount table code)        │
│  ├─ main/index.ts           (v3.0.0 logic)                  │
│  └─ renderer/               (old React components)          │
└─ node_modules/              (old dependency versions)       │
└─────────────────────────────────────────────────────────────┘

DURING UPDATE (Installer Running):
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Check for existing installation                     │
│   ✓ Found: C:\Program Files\AuraSwift\                     │
│                                                             │
│ STEP 2: Close running application                           │
│   ✓ AuraSwift.exe terminated                                │
│                                                             │
│ STEP 3: DELETE old version                                  │
│   🗑️ Deleting: C:\Program Files\AuraSwift\AuraSwift.exe   │
│   🗑️ Deleting: C:\Program Files\AuraSwift\resources\*     │
│   🗑️ Deleting: C:\Program Files\AuraSwift\node_modules\*  │
│   🗑️ Deleting: (everything except user data)              │
│   ✓ Old version REMOVED                                    │
│                                                             │
│ STEP 4: INSTALL new version                                 │
│   📦 Extracting: AuraSwift-Setup-3.2.0.exe                 │
│   ✓ Installing new files...                                │
│                                                             │
│ STEP 5: Update registry                                     │
│   ✓ Version: 3.0.0 → 3.2.0                                 │
│   ✓ Uninstall info updated                                 │
└─────────────────────────────────────────────────────────────┘

AFTER UPDATE:
┌─────────────────────────────────────────────────────────────┐
│ C:\Program Files\AuraSwift\                                 │
├─ AuraSwift.exe              (v3.2.0 - 85 MB) ← NEW!         │
├─ package.json               (version: "3.2.0") ← NEW!       │
├─ resources/app.asar         (contains NEW source code)      │
│  ├─ database.ts             (has discount table migration)  │
│  ├─ main/index.ts           (v3.2.0 logic)                  │
│  └─ renderer/               (NEW React components)          │
└─ node_modules/              (NEW dependency versions)       │
└─────────────────────────────────────────────────────────────┘

USER DATA (COMPLETELY UNTOUCHED):
┌─────────────────────────────────────────────────────────────┐
│ C:\Users\Username\AppData\Roaming\AuraSwift\               │
├─ pos_system.db              (SAME FILE - all data intact!)  │
├─ config.json                (SAME FILE)                     │
└─ logs/                      (SAME FILES)                    │
└─────────────────────────────────────────────────────────────┘
```

### **Important Points:**

1. **Old .exe is deleted** - The v3.0.0 executable is completely removed
2. **Old package.json is deleted** - No trace of old version number in app directory
3. **Old app.asar is deleted** - All old source code is gone
4. **Old node_modules is deleted** - Old dependencies are removed
5. **New versions are installed fresh** - Like a clean install, but app knows it's an update
6. **User data survives** - Because it's in a different directory that installer never touches!

### **Windows Registry Changes:**

```
Before Update:
HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\AuraSwift
├─ DisplayName: "AuraSwift"
├─ DisplayVersion: "3.0.0"          ← OLD VERSION
├─ InstallLocation: "C:\Program Files\AuraSwift\"
└─ UninstallString: "..."

After Update:
HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\AuraSwift
├─ DisplayName: "AuraSwift"
├─ DisplayVersion: "3.2.0"          ← UPDATED!
├─ InstallLocation: "C:\Program Files\AuraSwift\"
└─ UninstallString: "..."
```

### **Can You Rollback to Old Version?**

**Short answer: NO (not automatically)**

- ❌ Old version files are deleted during update
- ❌ No built-in rollback mechanism
- ❌ User would need to manually download and install older version

**If you need rollback capability:**

```typescript
// You could implement a backup strategy before major updates:
async function backupCurrentVersion() {
  const appPath = app.getAppPath();
  const backupPath = path.join(app.getPath("userData"), "backups", "v3.0.0");

  // Copy current app.asar to backup location
  await fs.copy(path.join(appPath, "app.asar"), path.join(backupPath, "app.asar"));
}
```

But typically, **forward-only updates** are the standard for Electron apps.

---

## 📦 Understanding app.asar - Your Entire App in One File

### **What Gets Bundled into app.asar:**

```
app.asar (v3.2.0) - 45 MB compressed archive
├─ package.json                    ← Your package.json
├─ packages/
│  ├─ main/
│  │  └─ src/
│  │     ├─ index.ts (compiled)    ← Main process code
│  │     ├─ database.ts (compiled) ← Database logic
│  │     ├─ modules/               ← All modules
│  │     └─ services/              ← All services
│  ├─ renderer/
│  │  └─ dist/
│  │     ├─ index.html
│  │     ├─ assets/
│  │     └─ (compiled React app)   ← Your UI
│  └─ preload/
│     └─ dist/
│        └─ (compiled preload)
└─ node_modules/                   ← Some dependencies (bundled)
   ├─ better-sqlite3/
   ├─ bcryptjs/
   └─ (others)
```

### **During Update: app.asar Replacement:**

```
OLD app.asar (v3.0.0):
  Contains:
  ├─ database.ts (without discount migrations)
  ├─ No DiscountDialog.tsx
  └─ package.json shows "3.0.0"

        ↓ DELETED ↓

NEW app.asar (v3.2.0):
  Contains:
  ├─ database.ts (WITH discount migrations!)
  ├─ DiscountDialog.tsx (NEW file!)
  └─ package.json shows "3.2.0"
```

**This is why your new migration code runs** - because the entire compiled source is replaced!

---

## �📊 Complete Workflow Diagram

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    COMPLETE UPDATE WORKFLOW                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DEVELOPMENT (Your Computer)                               │
└─────────────────────────────────────────────────────────────────────┘

1. Make code changes (e.g., add discount system)
   ├─ Edit: packages/main/src/database.ts
   │   └─ Add: discounts table migration
   ├─ Edit: packages/renderer/src/components/DiscountDialog.tsx
   │   └─ Add: Discount UI
   └─ Test locally: npm run dev

2. Commit and push to GitHub
   $ git add .
   $ git commit -m "feat: Added discount system"
   $ git push origin main

┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2: CI/CD (GitHub Actions)                                    │
└─────────────────────────────────────────────────────────────────────┘

3. GitHub Actions triggered
   ├─ Checkout code
   ├─ Install dependencies: npm ci
   ├─ Build TypeScript: npm run build
   ├─ Package with electron-builder
   │   ├─ Creates: AuraSwift-Setup-3.2.0.exe (Windows)
   │   ├─ Creates: AuraSwift-3.2.0.dmg (macOS)
   │   └─ Creates: metadata files (latest.yml, RELEASES)
   └─ Create GitHub Release v3.2.0
       └─ Upload all artifacts

4. GitHub Release Published
   URL: https://github.com/Sam231221/AuraSwift/releases/tag/v3.2.0
   ├─ AuraSwift-Setup-3.2.0.exe (85 MB)
   ├─ latest.yml (metadata)
   └─ CHANGELOG.md (release notes)

┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 3: AUTO-UPDATE (User's Computer)                             │
└─────────────────────────────────────────────────────────────────────┘

5. User's AuraSwift v3.0.0 detects update

   TIME: 4 hours after last check OR on app startup

   AutoUpdater.ts:
   ├─ GET https://github.com/.../releases/latest.yml
   ├─ Parse: version = 3.2.0
   ├─ Compare: current (3.0.0) < available (3.2.0)
   └─ Emit: "update-available" event

6. Show update dialog to user

   ┌─────────────────────────────────────────────────┐
   │  🎉 Update Available                            │
   │                                                 │
   │  AuraSwift 3.2.0 is available!                  │
   │  Release Notes: [Shows CHANGELOG.md]            │
   │                                                 │
   │  [Download Now]  [View Notes]  [Remind Later]   │
   └─────────────────────────────────────────────────┘

7. User clicks "Download Now"

   electron-updater:
   ├─ Downloads to: %TEMP%\auraswift-updater\
   │   └─ AuraSwift-Setup-3.2.0.exe
   ├─ Verifies SHA512 checksum
   └─ Emit: "update-downloaded" event

8. Show install prompt

   ┌─────────────────────────────────────────────────┐
   │  ✅ Update Ready to Install                     │
   │                                                 │
   │  [Restart Now]  [Restart Later]                 │
   └─────────────────────────────────────────────────┘

9. User clicks "Restart Now"

   electron-updater:
   └─ Calls: autoUpdater.quitAndInstall()

┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 4: INSTALLATION (Silent, Automatic)                          │
└─────────────────────────────────────────────────────────────────────┘

10. App shutdown sequence

    AuraSwift v3.0.0:
    ├─ Triggers: app.on("before-quit")
    ├─ Closes all windows
    ├─ Closes database connections
    └─ Exits process

11. Installer executes automatically

    Command: AuraSwift-Setup-3.2.0.exe /S /UPDATE

    NSIS Installer:
    ├─ Detects: Update mode (existing installation found)
    ├─ Preserves: User data directory
    │   └─ DOES NOT TOUCH: %APPDATA%\AuraSwift\
    ├─ Replaces: Application directory
    │   ├─ DELETE: C:\Program Files\AuraSwift\*
    │   └─ INSTALL: New files from v3.2.0
    └─ Updates: Registry entries (uninstall info)

12. AuraSwift v3.2.0 starts automatically

    Electron:
    ├─ Launches: C:\Program Files\AuraSwift\AuraSwift.exe
    └─ Command: --updated (from installer)

┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 5: POST-UPDATE (Database Migration)                          │
└─────────────────────────────────────────────────────────────────────┘

13. App initialization

    index.ts:
    ├─ app.whenReady()
    └─ DatabaseManager.initialize()

14. Database migration executes

    database.ts → initializeTables():

    ├─ Check for database at:
    │   └─ C:\Users\Username\AppData\Roaming\AuraSwift\pos_system.db
    │
    ├─ Database found! (v3.0.0 schema)
    │   └─ Contains: businesses, users, products, transactions
    │
    ├─ Run migrations:
    │   ├─ CREATE TABLE IF NOT EXISTS businesses ✓ (already exists, skip)
    │   ├─ CREATE TABLE IF NOT EXISTS users ✓ (already exists, skip)
    │   ├─ CREATE TABLE IF NOT EXISTS products ✓ (already exists, skip)
    │   ├─ CREATE TABLE IF NOT EXISTS transactions ✓ (already exists, skip)
    │   │
    │   ├─ CREATE TABLE IF NOT EXISTS discounts ✓ (NEW! Created)
    │   │
    │   ├─ ALTER TABLE transactions ADD COLUMN discountAmount ✓ (Added)
    │   └─ ALTER TABLE transactions ADD COLUMN appliedDiscounts ✓ (Added)
    │
    └─ Result: Database updated to v3.2.0 schema with ALL DATA INTACT! ✅

15. App fully operational

    AuraSwift v3.2.0:
    ├─ Shows main window
    ├─ User sees all their previous data:
    │   ├─ Products ✓
    │   ├─ Transactions ✓
    │   ├─ Users ✓
    │   └─ Settings ✓
    ├─ New features available:
    │   └─ Discount system now works!
    └─ User continues working seamlessly

┌─────────────────────────────────────────────────────────────────────┐
│  SUMMARY: What Got Replaced vs Preserved                            │
└─────────────────────────────────────────────────────────────────────┘

REPLACED (Application Code):
├─ ⟳ AuraSwift.exe (new version)
├─ ⟳ resources/app.asar (new compiled code)
├─ ⟳ All TypeScript → JavaScript (compiled)
├─ ⟳ React components (compiled)
├─ ⟳ Assets (icons, images)
└─ ⟳ node_modules (dependencies)

PRESERVED (User Data):
├─ ✓ pos_system.db (DATABASE FILE - UNTOUCHED!)
├─ ✓ pos_system.db-wal (SQLite journal)
├─ ✓ pos_system.db-shm (SQLite shared memory)
├─ ✓ config.json (if exists)
├─ ✓ logs/ (application logs)
└─ ✓ Preferences (Electron settings)

DATABASE CHANGES:
└─ Schema updated via migrations (ALTER TABLE, CREATE TABLE IF NOT EXISTS)
   ├─ Existing data: PRESERVED ✓
   ├─ New columns: ADDED with defaults ✓
   └─ New tables: CREATED empty ✓
```

---

## 🧪 Testing Update Scenarios

### Test Case 1: Fresh Install → Update

```bash
# Step 1: Build old version (v3.0.0)
git checkout v3.0.0
npm run build
npm run release

# Step 2: Install v3.0.0 in VirtualBox
# - Install AuraSwift-Setup-3.0.0.exe
# - Create some test data (products, transactions)
# - Note database location: %APPDATA%\AuraSwift\pos_system.db

# Step 3: Build new version (v3.2.0) with database changes
git checkout main
# Edit database.ts - add discount table migration
npm run build
npm run release

# Step 4: User updates in VirtualBox
# - AuraSwift v3.0.0 running
# - AutoUpdater detects v3.2.0
# - Downloads and installs
# - Verify:
#   ✓ App updated to v3.2.0
#   ✓ All previous data still exists
#   ✓ New discount features work
#   ✓ Database has new schema
```

### Test Case 2: Database Migration Verification

```sql
-- Before update (v3.0.0)
.tables
-- Output: businesses users products transactions

.schema transactions
-- No discountAmount column

-- After update (v3.2.0)
.tables
-- Output: businesses users products transactions discounts

.schema transactions
-- Has: discountAmount REAL DEFAULT 0
-- Has: appliedDiscounts TEXT

SELECT COUNT(*) FROM products;
-- Output: 50 (all previous products still there!)
```

### Test Case 3: Rollback Scenario

If update fails or user wants to rollback:

```bash
# User can manually install older version
# Database downgrade handling:

# Your code should handle unknown columns gracefully:
try {
  const transaction = db.prepare(`
    SELECT id, total, discountAmount FROM transactions WHERE id = ?
  `).get(txId);
} catch (error) {
  // If discountAmount doesn't exist in older version, use 0
  const transaction = db.prepare(`
    SELECT id, total, 0 as discountAmount FROM transactions WHERE id = ?
  `).get(txId);
}
```

---

## 🔐 Security & Integrity

### Update Verification

```typescript
// electron-updater automatically verifies:
{
  "version": "3.2.0",
  "files": [
    {
      "url": "AuraSwift-Setup-3.2.0.exe",
      "sha512": "abc123...", // ← Verified before install
      "size": 85401234
    }
  ]
}
```

- ✅ SHA512 checksum verified
- ✅ Code signature verified (if configured)
- ✅ Download from official GitHub releases only
- ✅ HTTPS encrypted download

---

## 📝 Best Practices for Database Changes

### 1. Always Use Safe Migrations

```typescript
// ✅ ALWAYS use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS new_table (...)

// ✅ ALWAYS wrap ALTER TABLE in try-catch
try {
  ALTER TABLE existing_table ADD COLUMN new_column TEXT DEFAULT '';
} catch (error) {
  // Column exists, that's fine
}

// ✅ ALWAYS provide DEFAULT values for new columns
ADD COLUMN status TEXT DEFAULT 'active'
ADD COLUMN count INTEGER DEFAULT 0
```

### 2. Test Migrations Thoroughly

```typescript
// Create a test database with old schema
// Apply migrations
// Verify:
// - Old data preserved
// - New columns added
// - Constraints working
// - Indexes created
```

### 3. Document Breaking Changes

```markdown
## v3.2.0 Release Notes

### Database Changes

- Added `discounts` table for promotional discounts
- Added `discountAmount` column to `transactions` table
- Added `appliedDiscounts` JSON column to `transactions` table

### Migration Notes

- Existing transactions will have `discountAmount = 0`
- No action required from users
- Database updated automatically on first launch
```

### 4. Consider Backup Strategy

```typescript
// Before major schema changes, create backup
async function backupDatabase() {
  const dbPath = getDatabasePath();
  const backupPath = `${dbPath}.backup.${Date.now()}`;

  await fs.copyFile(dbPath, backupPath);
  console.log(`Database backed up to: ${backupPath}`);
}
```

---

## ❓ FAQ

### Q: What if the database migration fails?

**A:** The app should handle it gracefully:

```typescript
try {
  this.initializeTables();
  console.log("✅ Database migration successful");
} catch (error) {
  console.error("❌ Database migration failed:", error);
  // Show error dialog to user
  // Offer to restore backup or contact support
}
```

### Q: Can I force users to update?

**A:** Yes, with conditional logic:

```typescript
const currentVersion = app.getVersion();
const minimumVersion = "3.0.0";

if (compareVersions(currentVersion, minimumVersion) < 0) {
  dialog.showMessageBox({
    type: "error",
    title: "Update Required",
    message: "This version is no longer supported. Please update.",
    buttons: ["Update Now"],
  });
  // Force update download
}
```

### Q: What about database schema conflicts?

**A:** Use version tracking:

```typescript
// Store schema version in database
this.db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  )
`);

const currentSchemaVersion = 5; // Increment with each schema change
const dbVersion = this.db.prepare("SELECT version FROM schema_version").get();

if (!dbVersion || dbVersion.version < currentSchemaVersion) {
  // Run migrations
  this.runMigration(dbVersion?.version || 0, currentSchemaVersion);
}
```

---

## ✅ Conclusion

**Key Takeaways:**

1. ✅ Auto-updates **REPLACE application code**
2. ✅ Auto-updates **PRESERVE user data** (database, configs)
3. ✅ Database migrations run **automatically on first launch** after update
4. ✅ Use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` with try-catch
5. ✅ Test updates thoroughly in VirtualBox or similar environment
6. ✅ Users get seamless updates with zero data loss

**The Magic Formula:**

```
New App Code + Old Database + Safe Migrations = Seamless Update ✨
```

Your users will never lose data during updates, as long as you follow safe migration practices!
