/**
 * Database Seeding
 * Seeds default data for new database installations
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import { getLogger } from "../utils/logger.js";

/**
 * Get logger, with fallback for non-Electron contexts
 */
function getSeedLogger() {
  try {
    // Try to import and use Electron logger
    const { getLogger } = require("../utils/logger.js");
    return getLogger("seed");
  } catch (error) {
    // Fallback to console logger if Electron is not available (e.g., CLI context)
    return {
      info: (...args: any[]) => console.log("[seed]", ...args),
      error: (...args: any[]) => console.error("[seed]", ...args),
      warn: (...args: any[]) => console.warn("[seed]", ...args),
      debug: (...args: any[]) => console.debug("[seed]", ...args),
    };
  }
}

// Permission groups for seeding default roles
const PERMISSION_GROUPS = {
  /** All permissions - for admin/owner role */
  ADMIN: [PERMISSIONS.ALL],
  /** Manager permissions */
  MANAGER: [
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.TRANSACTIONS_OVERRIDE,
  ],
  /** Cashier permissions */
  CASHIER: [PERMISSIONS.SALES_READ, PERMISSIONS.SALES_WRITE],
} as const;

export async function seedDefaultData(
  db: BetterSQLite3Database,
  schema: any,
  customLogger?: ReturnType<typeof getLogger>
): Promise<void> {
  const logger = customLogger || getSeedLogger();
  logger.info("🌱 Starting database seeding...");

  try {
    // Check if data already exists
    let existingBusinesses;
    let existingUsers;
    try {
      existingBusinesses = db.select().from(schema.businesses).all();
    } catch (error) {
      // Table might not exist yet, continue with seeding
      existingBusinesses = [];
    }

    try {
      existingUsers = db.select().from(schema.users).all();
    } catch (error) {
      existingUsers = [];
    }

    // Only skip seeding if BOTH businesses AND users exist
    // This fixes the case where businesses exist but users don't
    if (existingBusinesses.length > 0 && existingUsers.length > 0) {
      logger.info("✅ Database already seeded, skipping...");
      return;
    }

    // If businesses exist but no users, we have a problem - log it
    if (existingBusinesses.length > 0 && existingUsers.length === 0) {
      logger.warn(
        "⚠️ Database has businesses but NO users! Attempting to seed users..."
      );
    }

    const now = new Date();
    const businessId = uuidv4();
    const ownerId = uuidv4();

    // 1. Create default business
    logger.info("   📦 Creating default business...");
    db.insert(schema.businesses)
      .values({
        id: businessId,
        firstName: "Admin",
        lastName: "User",
        businessName: "aurswift Demo Store",
        ownerId: ownerId,
        email: "admin@aurswift.com",
        phone: "+1234567890",
        website: "https://aurswift.com",
        address: "123 Main Street",
        country: "United States",
        city: "New York",
        postalCode: "10001",
        vatNumber: null, // Use null instead of empty string to avoid unique constraint issues
        businessType: "retail",
        currency: "USD",
        timezone: "America/New_York",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // 2. Create default VAT categories
    logger.info("   💰 Creating default VAT categories...");
    const defaultVatCategories = [
      {
        name: "Standard Rate",
        code: "STD",
        ratePercent: 20.0,
        description: "Standard VAT rate",
        isDefault: true,
      },
      {
        name: "Reduced Rate",
        code: "RED",
        ratePercent: 5.0,
        description: "Reduced VAT rate",
        isDefault: false,
      },
      {
        name: "Zero Rate",
        code: "ZRO",
        ratePercent: 0.0,
        description: "Zero VAT rate",
        isDefault: false,
      },
    ];

    for (const vatCat of defaultVatCategories) {
      const vatId = uuidv4();
      db.insert(schema.vatCategories)
        .values({
          id: vatId,
          name: vatCat.name,
          code: vatCat.code,
          ratePercent: vatCat.ratePercent,
          description: vatCat.description,
          businessId: businessId,
          isDefault: vatCat.isDefault,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    // 3. Create default terminal
    logger.info("   🖥️  Creating default terminal...");
    const terminalId = uuidv4();
    db.insert(schema.terminals)
      .values({
        id: terminalId,
        business_id: businessId,
        name: "Main Counter",
        type: "pos",
        status: "active",
        device_token: uuidv4(),
        ip_address: "127.0.0.1",
        mac_address: null,
        settings: JSON.stringify({
          printer: { enabled: false },
          scanner: { enabled: false },
          scale: { enabled: false },
        }),
        last_active_at: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // 4. Create default roles
    logger.info("   👔 Creating default roles...");
    const adminRoleId = uuidv4();
    const managerRoleId = uuidv4();
    const cashierRoleId = uuidv4();

    db.insert(schema.roles)
      .values([
        {
          id: adminRoleId,
          name: "admin",
          displayName: "Administrator",
          description: "Full system access with all permissions",
          businessId: businessId,
          permissions: PERMISSION_GROUPS.ADMIN,
          isSystemRole: true,
          isActive: true,
          shiftRequired: false, // Admin doesn't require shifts
          createdAt: now,
          updatedAt: now,
        },
        {
          id: managerRoleId,
          name: "manager",
          displayName: "Store Manager",
          description: "Manage inventory, users, and view reports",
          businessId: businessId,
          permissions: PERMISSION_GROUPS.MANAGER,
          isSystemRole: true,
          isActive: true,
          shiftRequired: true, // Manager requires shifts
          createdAt: now,
          updatedAt: now,
        },
        {
          id: cashierRoleId,
          name: "cashier",
          displayName: "Cashier",
          description: "Process sales transactions",
          businessId: businessId,
          permissions: PERMISSION_GROUPS.CASHIER,
          isSystemRole: true,
          isActive: true,
          shiftRequired: true, // Cashier requires shifts
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    // 5. Create default users
    logger.info("   👤 Creating default users...");

    // Generate password hashes
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash("admin123", salt);
    const managerPasswordHash = await bcrypt.hash("manager123", salt);
    const cashierPasswordHash = await bcrypt.hash("cashier123", salt);

    // Generate PIN hashes (default PIN: 1234 for all)
    const defaultPin = "1234";
    const pinHash = await bcrypt.hash(defaultPin, salt);

    const adminUserId = ownerId; // Owner is the admin user
    const managerUserId = uuidv4();
    const cashierUserId = uuidv4();

    db.insert(schema.users)
      .values([
        {
          id: adminUserId,
          username: "MrAdmin",
          email: "mradmin@aurswift.com",
          passwordHash: adminPasswordHash,
          pinHash: pinHash,
          salt: salt,
          firstName: "Admin",
          lastName: "User",
          businessName: "aurswift Demo Store",
          businessId: businessId,
          primaryRoleId: adminRoleId,
          shiftRequired: false,
          activeRoleContext: null,
          isActive: true,
          address: "",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: managerUserId,
          username: "MrManager",
          email: "mrmanager@aurswift.com",
          passwordHash: managerPasswordHash,
          pinHash: pinHash,
          salt: salt,
          firstName: "Store",
          lastName: "Manager",
          businessName: "aurswift Demo Store",
          businessId: businessId,
          primaryRoleId: managerRoleId,
          shiftRequired: true,
          activeRoleContext: null,
          isActive: true,
          address: "",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: cashierUserId,
          username: "MrCashier",
          email: "mrcashier@aurswift.com",
          passwordHash: cashierPasswordHash,
          pinHash: pinHash,
          salt: salt,
          firstName: "John",
          lastName: "Cashier",
          businessName: "aurswift Demo Store",
          businessId: businessId,
          primaryRoleId: cashierRoleId,
          shiftRequired: true,
          activeRoleContext: null,
          isActive: true,
          address: "",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    // 6. Assign roles to users
    logger.info("   🔗 Assigning roles to users...");
    const adminUserRoleId = uuidv4();
    const managerUserRoleId = uuidv4();
    const cashierUserRoleId = uuidv4();

    db.insert(schema.userRoles)
      .values([
        {
          id: adminUserRoleId,
          userId: adminUserId,
          roleId: adminRoleId,
          assignedBy: adminUserId,
          assignedAt: now,
          expiresAt: null,
          isActive: true,
        },
        {
          id: managerUserRoleId,
          userId: managerUserId,
          roleId: managerRoleId,
          assignedBy: adminUserId,
          assignedAt: now,
          expiresAt: null,
          isActive: true,
        },
        {
          id: cashierUserRoleId,
          userId: cashierUserId,
          roleId: cashierRoleId,
          assignedBy: adminUserId,
          assignedAt: now,
          expiresAt: null,
          isActive: true,
        },
      ])
      .run();

    // Verify user_roles were created
    logger.info("   ✅ Verifying user_roles creation...");
    const verifyUserRoles = db
      .select()
      .from(schema.userRoles)
      .where(eq(schema.userRoles.userId, adminUserId))
      .all();
    logger.info(
      `   📊 Found ${verifyUserRoles.length} user_roles entries for admin user (${adminUserId})`
    );
    if (verifyUserRoles.length > 0) {
      logger.info(
        "   📋 Admin user_roles details:",
        JSON.stringify(
          verifyUserRoles.map((r) => ({
            id: r.id,
            userId: r.userId,
            roleId: r.roleId,
            isActive: r.isActive,
          })),
          null,
          2
        )
      );
    }

    logger.info("✅ Database seeding completed successfully!");
    logger.info("\n📋 Default Accounts Created:");
    logger.info("   👨‍💼 Admin:");
    logger.info("      Username: admin");
    logger.info("      Password: admin123");
    logger.info("      PIN: 1234");
    logger.info("\n   👔 Manager:");
    logger.info("      Username: manager");
    logger.info("      Password: manager123");
    logger.info("      PIN: 1234");
    logger.info("\n   💳 Cashier:");
    logger.info("      Username: cashier");
    logger.info("      Password: cashier123");
    logger.info("      PIN: 1234");
    logger.info("\n   🖥️  Terminal: Main Counter");
    logger.info("");
  } catch (error) {
    logger.error("❌ Database seeding failed:", error);
    throw error;
  }
}
