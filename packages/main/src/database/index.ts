import { DBManager } from "./db-manager.js";
import { UserManager } from "./managers/userManager.js";
import { BusinessManager } from "./managers/businessManager.js";
import { SessionManager } from "./managers/sessionManager.js";
import { ProductManager } from "./managers/productManager.js";
import { CategoryManager } from "./managers/categoryManager.js";
import { InventoryManager } from "./managers/inventoryManager.js";
import { ScheduleManager } from "./managers/scheduleManager.js";
import { ShiftManager } from "./managers/shiftManager.js";
import { TransactionManager } from "./managers/transactionManager.js";
import { CashDrawerManager } from "./managers/cashDrawerManager.js";
import { ReportManager } from "./managers/reportManager.js";
import { AuditLogManager } from "./managers/auditLogManager.js";
import { DiscountManager } from "./managers/discountManager.js";

import { TimeTrackingManager } from "./managers/timeTrackingManager.js";
import { AuditManager } from "./managers/auditManager.js";
import { TimeTrackingReportManager } from "./managers/timeTrackingReportManager.js";
import { SettingsManager } from "./managers/settingsManager.js";
import { AgeVerificationManager } from "./managers/ageVerificationManager.js";
import { BatchManager } from "./managers/batchManager.js";
import { SupplierManager } from "./managers/supplierManager.js";
import { VatCategoryManager } from "./managers/vatCategoryManager.js";
import { ExpirySettingManager } from "./managers/expirySettingsManager.js";
import { ExpiryNotificationManager } from "./managers/expiryNotificationManager.js";
import { SalesUnitSettingManager } from "./managers/salesUnitSettingsManager.js";
import { StockMovementManager } from "./managers/stockMovementManager.js";
import { CartManager } from "./managers/cartManager.js";
import { SavedBasketManager } from "./managers/savedBasketManager.js";
import { RoleManager } from "./managers/roleManager.js";
import { UserRoleManager } from "./managers/userRoleManager.js";
import { UserPermissionManager } from "./managers/userPermissionManager.js";
import { TerminalManager } from "./managers/terminalManager.js";
import { BreakPolicyManager } from "./managers/breakPolicyManager.js";
import { initializeDrizzle, resetDrizzle } from "./drizzle.js";
import { getDatabaseInfo } from "./utils/dbInfo.js";
import { isDevelopmentMode } from "./utils/environment.js";
import {
  cleanupAllBackups,
  getBackupStorageInfo,
  logStorageInfo,
} from "./utils/backup-cleanup.js";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import * as schema from "./schema.js";
import { seedDefaultData } from "./seed.js";

import { getLogger } from "../utils/logger.js";
const logger = getLogger("index");

let dbManagerInstance: DBManager | null = null;
let managersInstance: DatabaseManagers | null = null;
let initializationPromise: Promise<DatabaseManagers> | null = null;

export interface DatabaseManagers {
  users: UserManager;
  businesses: BusinessManager;
  sessions: SessionManager;
  products: ProductManager;
  categories: CategoryManager;
  inventory: InventoryManager;
  schedules: ScheduleManager;
  shifts: ShiftManager;
  transactions: TransactionManager;
  cashDrawers: CashDrawerManager;
  reports: ReportManager;
  auditLogs: AuditLogManager;
  discounts: DiscountManager;

  timeTracking: TimeTrackingManager;
  audit: AuditManager;
  timeTrackingReports: TimeTrackingReportManager;
  settings: SettingsManager;
  ageVerification: AgeVerificationManager;
  batches: BatchManager;
  suppliers: SupplierManager;
  vatCategories: VatCategoryManager;
  expirySettings: ExpirySettingManager;
  expiryNotifications: ExpiryNotificationManager;
  salesUnitSettings: SalesUnitSettingManager;
  stockMovements: StockMovementManager;
  cart: CartManager;
  savedBaskets: SavedBasketManager;

  // RBAC managers
  roles: RoleManager;
  userRoles: UserRoleManager;
  userPermissions: UserPermissionManager;

  // Terminal management
  terminals: TerminalManager;

  // Break policy management
  breakPolicy: BreakPolicyManager;

  getDatabaseInfo: () => {
    path: string;
    mode: "development" | "production";
    exists: boolean;
    size?: number;
  };

  emptyAllTables(): Promise<any>;
  reseedDatabase(): Promise<void>;
}
export async function getDatabase(): Promise<DatabaseManagers> {
  // Return existing instance if already initialized
  if (managersInstance) {
    return managersInstance;
  }

  // If initialization is in progress, wait for it to complete
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization and store the promise to prevent concurrent initializations
  initializationPromise = (async (): Promise<DatabaseManagers> => {
    // Initialize database
    dbManagerInstance = new DBManager();
    await dbManagerInstance.initialize();

    const db = dbManagerInstance.getDb();

    // Initialize Drizzle ORM
    const drizzle = initializeDrizzle(db);

    // Seed database with default data if needed
    try {
      await seedDefaultData(drizzle as any, schema);
    } catch (error) {
      // Provide detailed error context for seeding failures
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error("❌ Database seeding failed:");
      logger.error(`   Error: ${errorMessage}`);
      if (errorStack) {
        logger.error(`   Stack: ${errorStack}`);
      }
      logger.error(
        "   ⚠️  Warning: Database may be partially initialized. Some default data may be missing.",
      );
      logger.error(
        "   💡 You may need to manually seed the database or restart the application.",
      );

      // Don't throw - allow app to continue even if seeding fails
      // This is intentional for production resilience, but we log detailed context
    }

    const bcryptWrapper = {
      hash: bcrypt.hash,
      compare: bcrypt.compare,
      genSalt: bcrypt.genSalt,
    };

    const uuid = { v4: uuidv4 };

    // Create all manager instances with drizzle support
    const sessions = new SessionManager(drizzle, uuid);
    const timeTracking = new TimeTrackingManager(drizzle, uuid);
    const schedules = new ScheduleManager(drizzle, uuid);
    const users = new UserManager(
      drizzle,
      bcryptWrapper,
      uuid,
      sessions,
      timeTracking,
      schedules,
    );
    const businesses = new BusinessManager(drizzle, uuid);
    const products = new ProductManager(drizzle, uuid);
    const categories = new CategoryManager(drizzle, uuid);
    const shifts = new ShiftManager(drizzle, uuid);
    const transactions = new TransactionManager(drizzle, uuid);
    const cashDrawers = new CashDrawerManager(drizzle, uuid);
    const reports = new ReportManager(drizzle);
    const auditLogs = new AuditLogManager(drizzle, uuid);
    const discounts = new DiscountManager(drizzle, uuid);
    const audit = new AuditManager(drizzle, uuid);
    const timeTrackingReports = new TimeTrackingReportManager(drizzle);
    const settings = new SettingsManager(drizzle);
    const ageVerification = new AgeVerificationManager(drizzle, uuid);
    const batches = new BatchManager(drizzle, uuid);
    const suppliers = new SupplierManager(drizzle, uuid);
    const vatCategories = new VatCategoryManager(drizzle, uuid);
    const expirySettings = new ExpirySettingManager(drizzle, uuid);
    const expiryNotifications = new ExpiryNotificationManager(drizzle, uuid);
    const salesUnitSettings = new SalesUnitSettingManager(drizzle, uuid);
    const stockMovements = new StockMovementManager(drizzle, uuid, batches);
    const inventory = new InventoryManager(drizzle, uuid, stockMovements);
    const cart = new CartManager(drizzle, uuid);
    const savedBaskets = new SavedBasketManager(drizzle, uuid);

    // Cleanup expired sessions on startup
    try {
      sessions.cleanupExpiredSessions();
    } catch (error) {
      logger.warn("Failed to cleanup expired sessions:", error);
    }

    // Cleanup old audit logs on startup (keep 90 days)
    try {
      auditLogs.cleanupOldLogs(90);
    } catch (error) {
      logger.warn("Failed to cleanup old audit logs:", error);
    }

    // Cleanup old database backups on startup
    try {
      const dbPath = dbManagerInstance.getDatabasePath();
      const dbInfo = getDatabaseInfo(dbPath);
      const isProduction = !isDevelopmentMode();

      // Get storage info and check for warnings
      const storageInfo = getBackupStorageInfo(dbInfo.path, 500); // 500 MB threshold

      if (storageInfo.exceedsThreshold || storageInfo.warnings.length > 0) {
        logger.warn("⚠️  Backup storage warnings detected:");
        logStorageInfo(storageInfo);
      }

      // Run cleanup
      cleanupAllBackups(dbInfo.path, undefined, isProduction);
    } catch (error) {
      logger.warn("Failed to cleanup old database backups:", error);
    }

    // RBAC managers
    const roles = new RoleManager(drizzle, uuid);
    const userRoles = new UserRoleManager(drizzle, uuid);
    const userPermissions = new UserPermissionManager(drizzle, uuid);

    // Terminal management
    const terminals = new TerminalManager(drizzle, uuid);

    // Break policy management
    const breakPolicy = new BreakPolicyManager(drizzle, uuid);

    managersInstance = {
      users,
      businesses,
      sessions,
      products,
      categories,
      inventory,
      schedules,
      shifts,
      transactions,
      cashDrawers,
      reports,
      auditLogs,
      discounts,

      timeTracking,
      audit,
      timeTrackingReports,
      settings,
      ageVerification,
      batches,
      suppliers,
      vatCategories,
      expirySettings,
      expiryNotifications,
      salesUnitSettings,
      stockMovements,
      cart,
      savedBaskets,

      // RBAC managers
      roles,
      userRoles,
      userPermissions,

      // Terminal management
      terminals,

      // Break policy management
      breakPolicy,

      // Database info methods
      getDatabaseInfo: () => {
        if (!dbManagerInstance) {
          throw new Error("Database not initialized");
        }
        const dbPath = dbManagerInstance.getDatabasePath();
        return getDatabaseInfo(dbPath);
      },
      emptyAllTables: async () => {
        if (!dbManagerInstance) {
          throw new Error("Database not initialized");
        }

        // Note: This operation is now allowed in production for database management purposes
        // A backup is always created before emptying via the IPC handler
        logger.warn(
          "⚠️ emptyAllTables called - this will delete all data except license info",
        );

        const rawDb = dbManagerInstance.getDb();

        try {
          logger.info("🗑️  Emptying all database tables...");

          // Disable foreign key constraints temporarily for faster deletion
          rawDb.prepare("PRAGMA foreign_keys = OFF").run();

          // Delete in order: child tables first, then parent tables
          // This order respects foreign key relationships
          //
          // ⚠️ IMPORTANT: The following tables are INTENTIONALLY EXCLUDED to preserve license:
          // - schema.licenseActivation (license data must persist across database resets)
          // - schema.licenseValidationLog (audit trail for license operations)
          // - schema.terminals (device authorization)
          //
          const tablesToEmpty = [
            // Child tables (with foreign keys) - delete first
            schema.printJobRetries,
            schema.printJobs,
            schema.attendanceReports,
            schema.shiftReports,
            schema.shiftValidationIssues,
            schema.shiftValidations,
            schema.timeCorrections,
            schema.breaks,
            schema.shifts,
            schema.clockEvents,
            schema.transactionItems,
            schema.transactions,
            schema.cashDrawerCounts,
            schema.schedules,
            schema.stockMovements,
            schema.expiryNotifications,
            schema.expirySettings,
            schema.productBatches,
            schema.stockAdjustments,
            schema.suppliers,
            schema.discounts,
            schema.auditLogs,
            schema.sessions,
            schema.userRoles,
            // Parent tables (referenced by others) - delete last
            schema.products,
            schema.categories,
            schema.vatCategories,
            schema.roles,
            schema.users,
            schema.businesses,
            // System tables (usually keep app_settings, but empty if requested)
            schema.appSettings,
          ];

          const tablesEmptied: string[] = [];
          let totalRowsDeleted = 0;

          for (const table of tablesToEmpty) {
            try {
              // Get table name for reporting
              const tableAny = table as any;
              const tableName =
                tableAny._?.name ||
                tableAny[Symbol.for("drizzle:Name")] ||
                "unknown";

              // Count rows before deletion
              const countResult = rawDb
                .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
                .get() as { count: number };
              const rowCount = countResult?.count || 0;

              // Use Drizzle's delete API - delete all rows from table
              await drizzle.delete(table);

              tablesEmptied.push(tableName);
              totalRowsDeleted += rowCount;
            } catch (error) {
              // Try to get table name for error reporting
              const tableAny = table as any;
              const tableName =
                tableAny._?.name ||
                tableAny[Symbol.for("drizzle:Name")] ||
                "unknown";
              logger.warn(
                `⚠️  Warning: Failed to empty table ${tableName}:`,
                error instanceof Error ? error.message : String(error),
              );
              // Continue with other tables even if one fails
            }
          }

          // Re-enable foreign key constraints
          rawDb.prepare("PRAGMA foreign_keys = ON").run();

          logger.info(
            `✅ Successfully emptied ${tablesEmptied.length} of ${tablesToEmpty.length} tables`,
          );
          return {
            success: true,
            tablesEmptied,
            rowsDeleted: totalRowsDeleted,
          };
        } catch (error) {
          // Re-enable foreign key constraints even on error
          try {
            rawDb.prepare("PRAGMA foreign_keys = ON").run();
          } catch {
            // Ignore errors when re-enabling
          }

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to empty all tables: ${errorMessage}`, {
            cause: error,
          });
        }
      },
      reseedDatabase: async () => {
        if (!dbManagerInstance) {
          throw new Error("Database not initialized");
        }

        // Note: This operation is now allowed in production for database management purposes
        // It creates default admin user and essential data after emptying
        logger.warn(
          "⚠️ reseedDatabase called - this will create default admin and seed data",
        );

        try {
          logger.info("🌱 Reseeding database with default data...");
          await seedDefaultData(drizzle as any, schema);
          logger.info("✅ Database reseeded successfully");
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(`❌ Failed to reseed database: ${errorMessage}`);
          throw new Error(`Failed to reseed database: ${errorMessage}`, {
            cause: error,
          });
        }
      },
    };

    return managersInstance as DatabaseManagers;
  })();

  return initializationPromise;
}

export function closeDatabase(): void {
  if (dbManagerInstance) {
    dbManagerInstance.close();
    dbManagerInstance = null;
    managersInstance = null;
    initializationPromise = null;
    // CRITICAL: Reset Drizzle singleton to prevent stale connection references
    // When the database file changes (like during import), we need a fresh Drizzle instance
    resetDrizzle();
  }
}

/**
 * Type Exports
 *
 * Note: Database schema types should be imported directly from "./schema.js"
 * Manager utility types should be imported directly from their respective manager files.
 *
 * This module only exports:
 * - DatabaseManagers interface (database manager instances)
 * - getDatabase() function
 * - closeDatabase() function
 */

// Re-export manager utility types for convenience
// These are commonly used across the application
export type {
  RefundItem,
  TransactionWithItems,
} from "./managers/transactionManager.js";
