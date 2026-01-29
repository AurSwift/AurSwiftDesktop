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
    PERMISSIONS.TRANSACTIONS_OVERRIDE,
    PERMISSIONS.SCHEDULES_MANAGE_CASHIERS, // Access to staff schedules only
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

    // 8. Seed default break policies
    logger.info("   ☕ Creating default break policies...");
    try {
      await seedDefaultBreakPolicies(db, schema, businessId, logger);
    } catch (breakPolicyError) {
      logger.warn(
        "⚠️ Could not seed break policies (non-fatal):",
        breakPolicyError
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

/**
 * Seed default break policies for a business
 * UK-compliant defaults: 6 hours max consecutive work, 20 min required break
 */
async function seedDefaultBreakPolicies(
  db: BetterSQLite3Database,
  schema: any,
  businessId: string,
  logger: any
): Promise<void> {
  // Check if break types already exist for this business
  const existingBreakTypes = db
    .select()
    .from(schema.breakTypeDefinitions)
    .where(eq(schema.breakTypeDefinitions.business_id, businessId))
    .all();

  if (existingBreakTypes.length > 0) {
    logger.info("   ✅ Break policies already exist, skipping...");
    return;
  }

  const now = new Date();

  // Create default break types
  const breakTypes = [
    {
      publicId: uuidv4(),
      business_id: businessId,
      name: "Tea Break",
      code: "tea",
      description: "Short tea or coffee break",
      default_duration_minutes: 15,
      min_duration_minutes: 10,
      max_duration_minutes: 20,
      is_paid: true,
      is_required: false,
      counts_as_worked_time: true,
      icon: "coffee",
      color: "#8B4513",
      sort_order: 1,
      is_active: true,
      createdAt: now,
    },
    {
      publicId: uuidv4(),
      business_id: businessId,
      name: "Meal Break",
      code: "meal",
      description: "Main meal break (lunch/dinner)",
      default_duration_minutes: 30,
      min_duration_minutes: 30,
      max_duration_minutes: 60,
      is_paid: false,
      is_required: true,
      counts_as_worked_time: false,
      allowed_window_start: "11:00",
      allowed_window_end: "15:00",
      icon: "utensils",
      color: "#2E7D32",
      sort_order: 2,
      is_active: true,
      createdAt: now,
    },
    {
      publicId: uuidv4(),
      business_id: businessId,
      name: "Rest Break",
      code: "rest",
      description: "Short rest break",
      default_duration_minutes: 10,
      min_duration_minutes: 5,
      max_duration_minutes: 15,
      is_paid: true,
      is_required: false,
      counts_as_worked_time: true,
      icon: "pause",
      color: "#1565C0",
      sort_order: 3,
      is_active: true,
      createdAt: now,
    },
    {
      publicId: uuidv4(),
      business_id: businessId,
      name: "Other",
      code: "other",
      description: "Other break type",
      default_duration_minutes: 15,
      min_duration_minutes: 5,
      max_duration_minutes: 30,
      is_paid: false,
      is_required: false,
      counts_as_worked_time: false,
      icon: "clock",
      color: "#757575",
      sort_order: 4,
      is_active: true,
      createdAt: now,
    },
  ];

  // Insert break types
  const insertedBreakTypes: { id: number; code: string }[] = [];
  for (const bt of breakTypes) {
    const result = db.insert(schema.breakTypeDefinitions).values(bt).run();
    insertedBreakTypes.push({
      id: Number(result.lastInsertRowid),
      code: bt.code,
    });
  }

  // Create default policy
  const policyResult = db
    .insert(schema.breakPolicies)
    .values({
      publicId: uuidv4(),
      business_id: businessId,
      name: "Default Policy",
      description: "Working Time Directive compliant break policy",
      max_consecutive_hours: 6,
      warn_before_required_minutes: 30,
      auto_enforce_breaks: false,
      allow_skip_break: false,
      require_manager_override: true,
      is_active: true,
      is_default: true,
      createdAt: now,
    })
    .run();

  const policyId = Number(policyResult.lastInsertRowid);

  // Create policy rules based on shift length
  const getBreakTypeId = (code: string) =>
    insertedBreakTypes.find((bt) => bt.code === code)?.id;

  const rules = [
    // Short shifts (4-6 hours): 1 tea, 1 rest
    {
      policy_id: policyId,
      break_type_id: getBreakTypeId("tea"),
      min_shift_hours: 4,
      max_shift_hours: 6,
      allowed_count: 1,
      is_mandatory: false,
      priority: 1,
    },
    {
      policy_id: policyId,
      break_type_id: getBreakTypeId("rest"),
      min_shift_hours: 4,
      max_shift_hours: 6,
      allowed_count: 1,
      is_mandatory: false,
      priority: 2,
    },
    // Medium shifts (6-8 hours): 1 tea, 1 mandatory meal, 1 rest
    {
      policy_id: policyId,
      break_type_id: getBreakTypeId("tea"),
      min_shift_hours: 6,
      max_shift_hours: 8,
      allowed_count: 1,
      is_mandatory: false,
      priority: 1,
    },
    {
      policy_id: policyId,
      break_type_id: getBreakTypeId("meal"),
      min_shift_hours: 6,
      max_shift_hours: 8,
      allowed_count: 1,
      is_mandatory: true, // UK law: break required after 6 hours
      earliest_after_hours: 4,
      priority: 2,
    },
    {
      policy_id: policyId,
      break_type_id: getBreakTypeId("rest"),
      min_shift_hours: 6,
      max_shift_hours: 8,
      allowed_count: 1,
      is_mandatory: false,
      priority: 3,
    },
    // Long shifts (8+ hours): 2 tea, 1 mandatory meal, 2 rest
    {
      policy_id: policyId,
      break_type_id: getBreakTypeId("tea"),
      min_shift_hours: 8,
      max_shift_hours: null,
      allowed_count: 2,
      is_mandatory: false,
      priority: 1,
    },
    {
      policy_id: policyId,
      break_type_id: getBreakTypeId("meal"),
      min_shift_hours: 8,
      max_shift_hours: null,
      allowed_count: 1,
      is_mandatory: true,
      earliest_after_hours: 4,
      latest_before_end_hours: 2,
      priority: 2,
    },
    {
      policy_id: policyId,
      break_type_id: getBreakTypeId("rest"),
      min_shift_hours: 8,
      max_shift_hours: null,
      allowed_count: 2,
      is_mandatory: false,
      priority: 3,
    },
  ];

  // Insert rules
  for (const rule of rules) {
    if (rule.break_type_id) {
      db.insert(schema.breakPolicyRules)
        .values({
          publicId: uuidv4(),
          ...rule,
          createdAt: now,
        })
        .run();
    }
  }

  logger.info(
    `   ✅ Created ${breakTypes.length} break types, 1 policy, ${rules.length} rules`
  );
}
