# Backup Cleanup System - Quick Reference

## 🎯 What Was Implemented

A comprehensive backup cleanup system that automatically manages all database backup files with configurable retention policies.

---

## 📊 Current Status (Your System)

### Before Implementation

- ❌ 18+ backup files accumulating indefinitely
- ❌ ~440 MB of backup storage
- ❌ No cleanup for operation backups
- ❌ No cleanup for .old files in root directory

### After Implementation

- ✅ Automatic cleanup on startup
- ✅ All 7 backup types managed
- ✅ Configurable retention policies
- ✅ Storage monitoring with warnings
- ✅ Manual cleanup option

---

## 🔧 Retention Policies

| Backup Type              | Keep                | Strategy     |
| ------------------------ | ------------------- | ------------ |
| Migration backups        | 10 (prod) / 5 (dev) | Newest files |
| Repair backups           | 3                   | Newest files |
| Fresh start backups      | 3                   | Newest files |
| Path migration backups   | 3                   | Newest files |
| Empty operation backups  | 3                   | Newest files |
| Import operation backups | 3                   | Newest files |
| Old database files       | 7 days              | Age-based    |

---

## ⚡ Automatic Cleanup

Runs automatically:

1. **On app startup** - cleans all backup types
2. **After migrations** - cleans all backup types
3. **After empty operation** - cleans empty backups
4. **After import operation** - cleans import backups

---

## 🎛️ Manual Cleanup (IPC)

### Cleanup Backups

```typescript
// Handler: database:cleanup-backups

// Basic cleanup (uses default policies)
ipcRenderer.invoke("database:cleanup-backups");

// Dry run (preview without deleting)
ipcRenderer.invoke("database:cleanup-backups", { dryRun: true });

// Custom retention
ipcRenderer.invoke("database:cleanup-backups", {
  customPolicy: {
    emptyOperation: 5, // Keep 5 instead of 3
    oldDatabases: 14, // Keep 14 days instead of 7
  },
});
```

### Get Storage Info

```typescript
// Handler: database:backup-storage-info

const info = await ipcRenderer.invoke("database:backup-storage-info");
// Returns: { totalSize, totalSizeMB, totalCount, backupsByType, warnings, exceedsThreshold }
```

---

## 🚨 Storage Monitoring

### Thresholds

- **500 MB** - Total backup size warning
- **20 files** - Per-type file count warning

### Warnings on Startup

- Logs warnings if thresholds exceeded
- Provides breakdown by backup type
- Suggests running cleanup

---

## 📁 File Locations

### Development

```
desktop/data/
├── pos_system.db                           # Main database
├── pos_system-backup-before-empty-*.db     # Empty operation backups
├── pos_system-backup-before-import-*.db    # Import operation backups
├── pos_system.db.old.*                     # Old database files
└── backups/
    ├── aurswift-backup-*.db                # Migration backups
    ├── aurswift-repair-backup-*.db         # Repair backups
    ├── aurswift-fresh-start-backup-*.db    # Fresh start backups
    └── aurswift-path-migration-backup-*.db # Path migration backups
```

### Production

- **macOS**: `~/Library/Application Support/aurswift/`
- **Windows**: `C:\Users\<Username>\AppData\Roaming\AuraSwift\`
- **Linux**: `~/.config/aurswift/`

---

## 🛠️ Implementation Files

- **Core**: `packages/main/src/database/utils/backup-cleanup.ts`
- **Integration**: `packages/main/src/database/index.ts`
- **Migrator**: `packages/main/src/database/drizzle-migrator.ts`
- **IPC Handlers**: `packages/main/src/ipc/db.handler.ts`
- **Docs**: `desktop/docs/Guides/Database/DATA_FOLDER_FILE_SCENARIOS.md`

---

## ✨ Key Features

1. **Automatic Cleanup** - Runs on startup and after operations
2. **Smart Retention** - Count-based and age-based strategies
3. **Orphaned File Cleanup** - Removes WAL/SHM files
4. **Storage Monitoring** - Warnings when thresholds exceeded
5. **Manual Control** - IPC handlers for on-demand cleanup
6. **Dry Run Mode** - Preview changes before deleting
7. **Error Handling** - Robust, non-blocking error handling
8. **Comprehensive Logging** - Detailed logs for troubleshooting

---

## 🎯 Next App Startup

When you next start the app, it will:

1. Scan all backup files
2. Check against retention policies
3. Delete files exceeding retention (likely 6-8 old files)
4. Free approximately 50-100 MB of space
5. Log detailed cleanup results

---

## 📖 Full Documentation

See `BACKUP_CLEANUP_IMPLEMENTATION.md` for complete details.
