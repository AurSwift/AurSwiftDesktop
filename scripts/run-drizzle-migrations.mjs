import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

function resolveFromDesktopRoot(p) {
  return path.resolve(process.cwd(), p);
}

const dbPath = resolveFromDesktopRoot(process.argv[2] || "./data/pos_system.db");
const migrationsFolder = resolveFromDesktopRoot(
  process.argv[3] || "./packages/main/src/database/migrations"
);

console.log(`DB: ${dbPath}`);
console.log(`Migrations: ${migrationsFolder}`);

const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

await migrate(db, { migrationsFolder });

const cols = sqlite
  .prepare("PRAGMA table_info(businesses)")
  .all()
  .map((r) => r.name);

const required = [
  "receipt_email_gmail_user",
  "receipt_email_gmail_app_password",
  "receipt_email_gmail_app_password_encrypted",
  "receipt_email_updated_at",
];

const missing = required.filter((c) => !cols.includes(c));
if (missing.length) {
  console.error("❌ Missing expected businesses columns:", missing);
  process.exitCode = 1;
} else {
  console.log("✅ businesses receipt email columns present");
}

sqlite.close();

