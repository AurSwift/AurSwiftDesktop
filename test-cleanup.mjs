/**
 * Test script to demonstrate backup cleanup
 * This simulates what happens when the app runs cleanup
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, readdirSync, statSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");

console.log("\n📊 Current Backup Storage Analysis");
console.log("=".repeat(80));

// Analyze current state
function analyzeBackups() {
  const patterns = {
    "Migration backups": /^aurswift-backup-\d{8}-\d{6}\.db$/,
    "Repair backups": /^aurswift-repair-backup-\d{8}-\d{6}\.db$/,
    "Fresh start backups": /^aurswift-fresh-start-backup-\d{8}-\d{6}\.db$/,
    "Path migration backups": /^aurswift-path-migration-backup-\d+\.db$/,
    "Empty operation backups":
      /^pos_system-backup-before-empty-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.db$/,
    "Import operation backups":
      /^pos_system-backup-before-import-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.db$/,
    "Old database files": /^pos_system\.db\.old\.\d+$/,
    "WAL files": /\.(db-wal|db-shm)$/,
  };

  let totalSize = 0;
  let totalFiles = 0;
  const results = {};

  // Scan root data directory
  if (existsSync(dataDir)) {
    const files = readdirSync(dataDir);

    for (const [type, pattern] of Object.entries(patterns)) {
      const matching = files.filter((f) => pattern.test(f));
      let typeSize = 0;

      for (const file of matching) {
        try {
          const stats = statSync(join(dataDir, file));
          if (stats.isFile()) {
            typeSize += stats.size;
          }
        } catch (err) {
          // Ignore
        }
      }

      if (matching.length > 0) {
        results[type] = {
          count: matching.length,
          size: typeSize,
          files: matching,
        };
        totalSize += typeSize;
        totalFiles += matching.length;
      }
    }
  }

  // Scan backups directory
  const backupsDir = join(dataDir, "backups");
  if (existsSync(backupsDir)) {
    const files = readdirSync(backupsDir);

    for (const [type, pattern] of Object.entries(patterns)) {
      if (
        type.includes("operation") ||
        type.includes("Old") ||
        type.includes("WAL")
      )
        continue;

      const matching = files.filter((f) => pattern.test(f));
      let typeSize = 0;

      for (const file of matching) {
        try {
          const stats = statSync(join(backupsDir, file));
          if (stats.isFile()) {
            typeSize += stats.size;
          }
        } catch (err) {
          // Ignore
        }
      }

      if (matching.length > 0) {
        results[type] = results[type] || { count: 0, size: 0, files: [] };
        results[type].count += matching.length;
        results[type].size += typeSize;
        results[type].files.push(...matching);
        totalSize += typeSize;
        totalFiles += matching.length;
      }
    }
  }

  return { results, totalSize, totalFiles };
}

const { results, totalSize, totalFiles } = analyzeBackups();

console.log(
  `\n📁 Total: ${totalFiles} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`,
);

console.log("Breakdown by type:");
for (const [type, info] of Object.entries(results)) {
  const sizeMB = (info.size / 1024 / 1024).toFixed(2);
  console.log(`  • ${type}: ${info.count} files (${sizeMB} MB)`);
}

console.log("\n📋 Retention Policies (Development Mode):");
console.log("  • Migration backups: Keep 5 newest");
console.log("  • Repair backups: Keep 3 newest");
console.log("  • Fresh start backups: Keep 3 newest");
console.log("  • Path migration backups: Keep 3 newest");
console.log("  • Empty operation backups: Keep 3 newest");
console.log("  • Import operation backups: Keep 3 newest");
console.log("  • Old database files: Keep files from last 7 days");

console.log("\n🧹 Expected Cleanup Results:");
let wouldDelete = 0;
let wouldFree = 0;

for (const [type, info] of Object.entries(results)) {
  let retention;
  let useAgeBased = false;

  switch (type) {
    case "Migration backups":
      retention = 5;
      break;
    case "Empty operation backups":
    case "Import operation backups":
    case "Repair backups":
    case "Fresh start backups":
    case "Path migration backups":
      retention = 3;
      break;
    case "Old database files":
      retention = 7; // days
      useAgeBased = true;
      break;
    case "WAL files":
      // These will be cleaned if their parent DB is gone
      retention = 0;
      break;
    default:
      retention = 3;
  }

  let toDelete = 0;
  let toFree = 0;

  if (useAgeBased && type === "Old database files") {
    const cutoffTime = Date.now() - retention * 24 * 60 * 60 * 1000;
    for (const file of info.files) {
      try {
        const stats = statSync(join(dataDir, file));
        if (stats.mtimeMs < cutoffTime) {
          toDelete++;
          toFree += stats.size;
        }
      } catch (err) {
        // Ignore
      }
    }
  } else if (info.count > retention) {
    toDelete = info.count - retention;
    // Approximate size (assuming oldest files)
    toFree = (info.size / info.count) * toDelete;
  }

  if (toDelete > 0) {
    console.log(
      `  • ${type}: Will delete ${toDelete}/${info.count} files (~${(toFree / 1024 / 1024).toFixed(2)} MB)`,
    );
    wouldDelete += toDelete;
    wouldFree += toFree;
  } else {
    console.log(`  • ${type}: All ${info.count} files within retention policy`);
  }
}

if (wouldDelete > 0) {
  console.log(
    `\n✨ Total to be freed: ${wouldDelete} files, ~${(wouldFree / 1024 / 1024).toFixed(2)} MB`,
  );
} else {
  console.log(
    "\n✅ All files are within retention policies - no cleanup needed",
  );
}

console.log("\n⚠️  WARNING THRESHOLDS:");
const threshold = 500; // MB
if (totalSize / 1024 / 1024 > threshold) {
  console.log(
    `  ❌ Total backup size (${(totalSize / 1024 / 1024).toFixed(2)} MB) exceeds threshold (${threshold} MB)`,
  );
} else {
  console.log(
    `  ✅ Total backup size (${(totalSize / 1024 / 1024).toFixed(2)} MB) is below threshold (${threshold} MB)`,
  );
}

for (const [type, info] of Object.entries(results)) {
  if (info.count > 20) {
    console.log(`  ⚠️  ${type}: ${info.count} files (consider cleanup)`);
  }
}

console.log("\n" + "=".repeat(80));
console.log("This cleanup will run automatically:");
console.log("  1. On application startup");
console.log("  2. After database migrations");
console.log("  3. After empty/import operations (for those specific types)");
console.log(
  "\nYou can also trigger it manually via IPC: database:cleanup-backups",
);
console.log("=".repeat(80) + "\n");
