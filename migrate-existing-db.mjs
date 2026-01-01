#!/usr/bin/env node
/**
 * Database Migration Helper
 *
 * This script helps you integrate an existing database with the new
 * environment-aware database system and copy data between databases.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function showUsage() {
  console.log("🗄️  Database Migration Helper\n");
  console.log("Usage:");
  console.log(
    "  node migrate-existing-db.mjs <command> [source-path] [target-path]"
  );
  console.log();
  console.log("Commands:");
  console.log(
    "  check <path>     - Check if database file is valid and accessible"
  );
  console.log("  copy-to-dev <path>  - Copy database to development location");
  console.log("  copy-to-prod <path> - Copy database to production location");
  console.log(
    "  copy-data <source> <target> - Copy data from source DB to target DB"
  );
  console.log("  show-paths       - Show all database path locations");
  console.log("  help            - Show this help message");
  console.log();
  console.log("Examples:");
  console.log("  node migrate-existing-db.mjs check /path/to/old/database.db");
  console.log(
    "  node migrate-existing-db.mjs copy-to-dev /path/to/old/database.db"
  );
  console.log("  node migrate-existing-db.mjs copy-data /old/db.db /new/db.db");
  console.log(
    "  POS_DB_PATH='/old/db.db' npm start  # Use custom path directly"
  );
}

function checkDatabase(dbPath) {
  console.log(`🔍 Checking database: ${dbPath}\n`);

  if (!fs.existsSync(dbPath)) {
    console.log("❌ Database file does not exist");
    return false;
  }

  console.log("✅ Database file exists");

  const stats = fs.statSync(dbPath);
  console.log(`📁 File size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`📅 Last modified: ${stats.mtime.toLocaleString()}`);

  try {
    fs.accessSync(dbPath, fs.constants.R_OK);
    console.log("✅ Database file is readable");
  } catch (err) {
    console.log("❌ Database file is not readable");
    console.log(`   Error: ${err.message}`);
    return false;
  }

  try {
    fs.accessSync(dbPath, fs.constants.W_OK);
    console.log("✅ Database file is writable");
  } catch (err) {
    console.log("⚠️  Database file is read-only");
  }

  return true;
}

function getProductionDbPath() {
  const userHome = process.env.HOME || process.env.USERPROFILE || "/tmp";
  let userDataPath;

  if (process.platform === "win32") {
    userDataPath = path.join(userHome, "AppData", "Roaming");
  } else if (process.platform === "darwin") {
    userDataPath = path.join(userHome, "Library", "Application Support");
  } else {
    userDataPath = path.join(userHome, ".config");
  }

  return path.join(userDataPath, "aurswift", "pos_system.db");
}

function getDevelopmentDbPath() {
  return path.join(__dirname, "data", "pos_system.db");
}

function showPaths() {
  console.log("📍 Database Path Locations:\n");

  console.log("Development:");
  console.log(`  ${getDevelopmentDbPath()}`);
  console.log();

  console.log("Production:");
  console.log(`  ${getProductionDbPath()}`);
  console.log();

  console.log("Custom (using environment variable):");
  console.log("  export POS_DB_PATH='/your/custom/path.db'");
  console.log("  npm start");
}

function copyDatabase(sourcePath, targetPath, targetType) {
  console.log(`📋 Copying database to ${targetType} location...\n`);
  console.log(`Source: ${sourcePath}`);
  console.log(`Target: ${targetPath}`);

  if (!checkDatabase(sourcePath)) {
    return false;
  }

  console.log();

  // Create target directory if it doesn't exist
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    console.log(`📁 Creating directory: ${targetDir}`);
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Check if target already exists
  if (fs.existsSync(targetPath)) {
    console.log("⚠️  Target database already exists!");
    console.log("   Creating backup...");
    const backupPath = `${targetPath}.backup.${Date.now()}`;
    fs.copyFileSync(targetPath, backupPath);
    console.log(`   Backup created: ${backupPath}`);
  }

  try {
    fs.copyFileSync(sourcePath, targetPath);
    console.log("✅ Database copied successfully!");
    console.log();
    console.log("Next steps:");
    console.log(
      `  npm start  # Start the application with ${targetType} database`
    );
    return true;
  } catch (error) {
    console.log("❌ Failed to copy database");
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function copyDatabaseData(sourceDbPath, targetDbPath) {
  console.log(`🔄 Copying data between databases...\n`);
  console.log(`Source: ${sourceDbPath}`);
  console.log(`Target: ${targetDbPath}`);

  // Check both databases exist
  if (!checkDatabase(sourceDbPath)) {
    console.log("❌ Source database check failed");
    return false;
  }

  if (!checkDatabase(targetDbPath)) {
    console.log("❌ Target database check failed");
    return false;
  }

  try {
    // Import better-sqlite3 dynamically
    const Database = require("better-sqlite3");

    console.log("\n📂 Opening databases...");
    const sourceDb = new Database(sourceDbPath, { readonly: true });
    const targetDb = new Database(targetDbPath);

    // Validate schema compatibility
    console.log("🔍 Validating schema compatibility...");
    const sourceTables = sourceDb
      .prepare(
        `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all();
    const targetTables = targetDb
      .prepare(
        `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all();

    const sourceTableNames = new Set(sourceTables.map((t) => t.name));
    const targetTableNames = new Set(targetTables.map((t) => t.name));

    // Check if all source tables exist in target
    const missingTables = [...sourceTableNames].filter(
      (name) => !targetTableNames.has(name)
    );

    if (missingTables.length > 0) {
      console.log("⚠️  Warning: Source has tables not in target:");
      missingTables.forEach((name) => console.log(`   - ${name}`));
      console.log(
        "\n❓ Continue anyway? These tables will be skipped. (Press Ctrl+C to cancel)"
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // Get list of tables from source database
    console.log("🔍 Analyzing source database structure...");
    const tables = sourceDb
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `
      )
      .all();

    console.log(`📊 Found ${tables.length} tables to copy:`);
    tables.forEach((table) => console.log(`   - ${table.name}`));

    // Begin transaction for data copying
    const transaction = targetDb.transaction(() => {
      const errors = [];
      const copiedTables = [];

      for (const table of tables) {
        const tableName = table.name;

        // Skip if table doesn't exist in target
        if (!targetTableNames.has(tableName)) {
          console.log(`\n⏭️  Skipping table: ${tableName} (not in target)`);
          continue;
        }

        console.log(`\n📋 Copying table: ${tableName}`);

        try {
          // Get all data from source table
          const sourceData = sourceDb
            .prepare(`SELECT * FROM ${tableName}`)
            .all();

          if (sourceData.length === 0) {
            console.log(`   ⚪ Table ${tableName} is empty - skipping`);
            continue;
          }

          // Clear target table first (optional - you might want to merge instead)
          console.log(`   🧹 Clearing existing data in target table...`);
          targetDb.prepare(`DELETE FROM ${tableName}`).run();

          // Get column names from the first row
          const columns = Object.keys(sourceData[0]);
          const placeholders = columns.map(() => "?").join(", ");
          const columnNames = columns.join(", ");

          // Prepare insert statement
          const insertStmt = targetDb.prepare(
            `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`
          );

          // Insert all data
          let insertedCount = 0;
          for (const row of sourceData) {
            const values = columns.map((col) => row[col]);
            insertStmt.run(values);
            insertedCount++;
          }

          console.log(`   ✅ Copied ${insertedCount} records`);
          copiedTables.push({ name: tableName, count: insertedCount });
        } catch (error) {
          const errorMsg = `Error copying table ${tableName}: ${error.message}`;
          console.log(`   ⚠️  ${errorMsg}`);
          errors.push(errorMsg);
          // Throw to rollback transaction if critical table fails
          throw new Error(`Critical error during data copy: ${errorMsg}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(`Data copy failed with ${errors.length} error(s)`);
      }
    });

    console.log("\n🚀 Starting data copy transaction...");
    transaction();

    // Close databases
    sourceDb.close();
    targetDb.close();

    console.log("\n✅ Database data copy completed successfully!");
    console.log("\nNext steps:");
    console.log("  1. Verify the data in your target database");
    console.log("  2. Test your application with the updated database");
    console.log("  3. Create a backup if everything looks good");

    return true;
  } catch (error) {
    console.log("\n❌ Data copy failed:");
    console.log(`   Error: ${error.message}`);

    if (
      error.code === "MODULE_NOT_FOUND" &&
      error.message.includes("better-sqlite3")
    ) {
      console.log("\n💡 Solution: Install better-sqlite3 in the main package:");
      console.log("   cd packages/main && npm install better-sqlite3");
    }

    return false;
  }
}

// Main execution
async function main() {
  const [, , command, sourcePath, targetPath] = process.argv;

  switch (command) {
    case "check":
      if (!sourcePath) {
        console.log("❌ Please provide the path to your database file");
        console.log(
          "   Example: node migrate-existing-db.mjs check /path/to/database.db"
        );
        process.exit(1);
      }
      checkDatabase(sourcePath);
      break;

    case "copy-to-dev":
      if (!sourcePath) {
        console.log("❌ Please provide the path to your database file");
        console.log(
          "   Example: node migrate-existing-db.mjs copy-to-dev /path/to/database.db"
        );
        process.exit(1);
      }
      copyDatabase(sourcePath, getDevelopmentDbPath(), "development");
      break;

    case "copy-to-prod":
      if (!sourcePath) {
        console.log("❌ Please provide the path to your database file");
        console.log(
          "   Example: node migrate-existing-db.mjs copy-to-prod /path/to/database.db"
        );
        process.exit(1);
      }
      copyDatabase(sourcePath, getProductionDbPath(), "production");
      break;

    case "copy-data":
      if (!sourcePath || !targetPath) {
        console.log("❌ Please provide both source and target database paths");
        console.log(
          "   Example: node migrate-existing-db.mjs copy-data /source/db.db /target/db.db"
        );
        process.exit(1);
      }
      await copyDatabaseData(sourcePath, targetPath);
      break;

    case "show-paths":
      showPaths();
      break;

    case "help":
    case "--help":
    case "-h":
      showUsage();
      break;

    default:
      console.log("❌ Unknown command or missing arguments\n");
      showUsage();
      process.exit(1);
  }
}

// Run the main function
main().catch(console.error);
