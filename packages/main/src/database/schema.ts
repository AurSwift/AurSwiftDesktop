// ============================================================================
// IMPORTS & TYPE DEFINITIONS
// ============================================================================

import {
  text,
  integer,
  real,
  unique,
  sqliteTableCreator,
  index as drizzleIndex,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { Permission } from "@app/shared/constants/permissions";

const createTable = sqliteTableCreator((name) => name);
const index = drizzleIndex;

// ============================================================================
// COMMON COLUMN DEFINITIONS
// ============================================================================

export const commonColumns = {
  // Internal ID for relationships (fast)
  id: integer("id", { mode: "number" })
    .primaryKey({ autoIncrement: true })
    .notNull(),

  // External ID for APIs, security (safe)
  // Note: unique() is defined per-table to allow custom constraint names
  publicId: text("public_id")
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),

  businessId: text("business_id").notNull(),
};

export const timestampColumns = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

// ============================================================================
// CORE SYSTEM TABLES
// ============================================================================

/**
 * Application-wide settings stored as key-value pairs
 */
export const appSettings = createTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  ...timestampColumns,
});

// ============================================================================
// LICENSE ACTIVATION TABLES
// ============================================================================

/**
 * License activation record - stores the activated license for this installation
 * Only one active license per installation at a time
 */
export const licenseActivation = createTable("license_activation", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),

  // License key from web dashboard (AUR-XXX-V2-XXXXXXXX-XX format)
  licenseKey: text("license_key").notNull().unique(),

  // Machine fingerprint hash for this installation
  machineIdHash: text("machine_id_hash").notNull(),

  // Terminal name set during activation
  terminalName: text("terminal_name").notNull().default("Terminal"),

  // Activation ID from server
  activationId: text("activation_id"),

  // Plan information
  planId: text("plan_id").notNull(), // 'basic', 'professional', 'enterprise'
  planName: text("plan_name").notNull(),
  maxTerminals: integer("max_terminals").notNull().default(1),

  // Features enabled by plan (JSON array)
  features: text("features", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),

  // Business info from license
  businessName: text("business_name"),

  // Status
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  subscriptionStatus: text("subscription_status").notNull().default("active"),

  // Expiration
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),

  // Timestamps
  activatedAt: integer("activated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  lastHeartbeat: integer("last_heartbeat", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  lastValidatedAt: integer("last_validated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),

  ...timestampColumns,
});

/**
 * License validation history - tracks validation attempts for debugging
 */
export const licenseValidationLog = createTable(
  "license_validation_log",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),

    // What happened
    action: text("action").notNull(), // 'activation', 'validation', 'heartbeat', 'deactivation'
    status: text("status").notNull(), // 'success', 'failed', 'offline'

    // Details
    licenseKey: text("license_key"),
    machineIdHash: text("machine_id_hash"),
    errorMessage: text("error_message"),
    serverResponse: text("server_response", { mode: "json" }),

    // Timestamp
    timestamp: integer("timestamp", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_license_validation_log_action").on(table.action),
    index("idx_license_validation_log_timestamp").on(table.timestamp),
  ]
);

// Type exports for license tables
export type LicenseActivation = InferSelectModel<typeof licenseActivation>;
export type InsertLicenseActivation = InferInsertModel<
  typeof licenseActivation
>;
export type LicenseValidationLog = InferSelectModel<
  typeof licenseValidationLog
>;
export type InsertLicenseValidationLog = InferInsertModel<
  typeof licenseValidationLog
>;

/**
 * Audit log for tracking all user actions and system events
 */
export const auditLogs = createTable("audit_logs", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resource_id: text("resource_id").notNull(),
  entity_type: text("entity_type"),
  entity_id: text("entity_id"),
  details: text("details"),
  ip_address: text("ip_address"),
  terminal_id: text("terminal_id").references(() => terminals.id),
  timestamp: integer("timestamp", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  ...timestampColumns,
});

// ============================================================================
// BUSINESS & USER MANAGEMENT
// ============================================================================

/**
 * Business/Organization entity - top-level tenant in multi-tenant system
 */
export const businesses = createTable("businesses", {
  id: text("id").primaryKey(),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  businessName: text("businessName").notNull(),
  ownerId: text("ownerId").notNull(),
  // Contact Information
  email: text("email").default(""),
  phone: text("phone").default(""),
  website: text("website").default(""),

  // Location
  address: text("address").default(""),
  country: text("country").notNull().default(""),
  city: text("city").notNull().default(""),
  postalCode: text("postalCode").default(""),

  // Business Identity
  vatNumber: text("vatNumber").unique().default(""),
  businessType: text("businessType", {
    enum: ["retail", "restaurant", "service", "wholesale", "other"],
  })
    .notNull()
    .default("retail"),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("UTC"),

  // Status & Metadata
  isActive: integer("isActive", { mode: "boolean" }).default(true),
  ...timestampColumns,
});

/**
 * Terminals/Devices authorized to access the system
 */
export const terminals = createTable(
  "terminals",
  {
    id: text("id").primaryKey(),
    business_id: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    name: text("name").notNull(), // e.g., "Front Counter 1"
    type: text("type", {
      enum: ["pos", "kiosk", "handheld", "kitchen_display", "server"],
    })
      .notNull()
      .default("pos"),

    status: text("status", {
      enum: ["active", "inactive", "maintenance", "decommissioned"],
    })
      .notNull()
      .default("active"),

    device_token: text("device_token").unique(), // For API authentication
    ip_address: text("ip_address"),
    mac_address: text("mac_address"),

    // Hardware configuration
    settings: text("settings", { mode: "json" }), // Printer, scanner, card reader config

    last_active_at: integer("last_active_at", { mode: "timestamp_ms" }),
    ...timestampColumns,
  },
  (table) => [
    index("terminals_business_idx").on(table.business_id),
    index("terminals_status_idx").on(table.status),
    index("terminals_token_idx").on(table.device_token),
  ]
);

/**
 * Roles - Define sets of permissions that can be assigned to users
 * Supports both system roles and custom business-specific roles
 */
export const roles = createTable(
  "roles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // 'cashier', 'manager', 'admin', 'custom_role'
    displayName: text("display_name").notNull(), // 'Cashier', 'Store Manager', 'Administrator'
    description: text("description"),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    permissions: text("permissions", { mode: "json" })
      .$type<Permission[]>()
      .notNull(),
    isSystemRole: integer("is_system_role", { mode: "boolean" }).default(false), // 1 for built-in roles
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    shiftRequired: integer("shift_required", { mode: "boolean" }).default(true), // NEW: Whether this role requires shifts for sales
    ...timestampColumns,
  },
  (table) => [
    index("idx_roles_business").on(table.businessId),
    index("idx_roles_name").on(table.name),
    unique("unique_role_name_per_business").on(table.businessId, table.name),
  ]
);

/**
 * User accounts with authentication and authorization
 */
export const users = createTable("users", {
  id: text("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  pinHash: text("pin_hash").notNull(),
  salt: text("salt").notNull(),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  businessName: text("businessName").notNull(),

  businessId: text("businessId")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),

  // RBAC fields
  primaryRoleId: text("primary_role_id").references(() => roles.id), // Main role for UI/display
  shiftRequired: integer("shift_required", { mode: "boolean" }), // NULL = auto-detect, 0 = no, 1 = yes
  activeRoleContext: text("active_role_context"), // For UI role switcher (optional)

  isActive: integer("isActive", { mode: "boolean" }).default(true),
  address: text("address").default(""),
  ...timestampColumns,
});

/**
 * User Roles - Junction table for many-to-many relationship between users and roles
 */
export const userRoles = createTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }), // Optional: temporary role
    isActive: integer("is_active", { mode: "boolean" }).default(true),
  },
  (table) => [
    unique("idx_user_roles_unique").on(table.userId, table.roleId),
    index("idx_user_roles_user").on(table.userId),
    index("idx_user_roles_role").on(table.roleId),
  ]
);

/**
 * User Permissions - Direct permission grants to users (outside of roles)
 */
export const userPermissions = createTable(
  "user_permissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(), // 'read:sales', 'write:sales', etc.
    grantedBy: text("granted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    grantedAt: integer("granted_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }), // Optional: temporary permission
    reason: text("reason"), // Why was this permission granted?
    isActive: integer("is_active", { mode: "boolean" }).default(true),
  },
  (table) => [
    unique("idx_user_permissions_unique").on(table.userId, table.permission),
    index("idx_user_permissions_user").on(table.userId),
  ]
);

/**
 * User session tokens for authentication
 * Desktop EPOS: Uses long-lived tokens with secure storage (Electron safeStorage)
 * No refresh tokens needed - simplified architecture for desktop apps
 */
export const sessions = createTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  token: text("token").unique().notNull(), // Session token (long-lived for desktop EPOS)
  expiresAt: text("expiresAt").notNull(), // Session expiry
  ...timestampColumns,
});

// ============================================================================
// PRODUCT CATALOG
// ============================================================================

/**
 * VAT/Tax categories for products and categories
 */
export const vatCategories = createTable(
  "vat_categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // e.g. "Standard", "Reduced", "Zero"
    ratePercent: real("rate_percent").notNull(), // e.g. 20.00
    code: text("code").notNull(), // e.g. "STD", "RED"
    description: text("description"),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    isDefault: integer("is_default", { mode: "boolean" }).default(false),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    ...timestampColumns,
  },
  (table) => [
    index("vat_business_idx").on(table.businessId),
    index("vat_code_idx").on(table.code),
  ]
);

/**
 * Product categories with hierarchical support (self-referencing)
 * TypeScript limitation: self-referencing tables cause circular type inference
 * This is a known issue with Drizzle ORM - the code works correctly at runtime
 */
// @ts-ignore - Circular reference in self-referencing table
export const categories = createTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): any => categories.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    vatCategoryId: text("vat_category_id").references(() => vatCategories.id, {
      onDelete: "set null",
    }),
    vatOverridePercent: real("vat_override_percent"), // e.g. 0, 5, 20) or null
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0),
    color: text("color"), // For UI organization
    image: text("image"), // Category images
    isActive: integer("is_active", { mode: "boolean" }).default(true),

    // Age Restriction Fields (for category-level defaults)
    // Products can inherit from category or override with their own restriction
    ageRestrictionLevel: text("age_restriction_level", {
      enum: ["NONE", "AGE_16", "AGE_18", "AGE_21"],
    }).default("NONE"), // Default age restriction for products in this category
    requireIdScan: integer("require_id_scan", { mode: "boolean" }).default(
      false
    ),

    ...timestampColumns,
  },
  (table) => [
    index("categories_business_idx").on(table.businessId),
    index("categories_parent_idx").on(table.parentId),
    index("categories_vat_idx").on(table.vatCategoryId),
    // Ensure category names are unique within a business
    unique("category_name_business_unique").on(table.name, table.businessId),
  ]
);

/**
 * Products catalog with support for standard, weighted, and generic items
 */
export const products = createTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),

    // Pricing Structure
    basePrice: real("base_price").notNull(), // Standard price
    costPrice: real("cost_price").default(0),

    // Identifiers
    sku: text("sku").notNull(),
    barcode: text("barcode"), // More standard than PLU
    plu: text("plu"), // For scale integration

    // Media
    image: text("image"),

    // Classification
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),

    // Product Type System
    productType: text("product_type", {
      enum: ["STANDARD", "WEIGHTED", "GENERIC"],
    })
      .notNull()
      .default("STANDARD"),

    // Unit configuration
    salesUnit: text("sales_unit", {
      enum: ["PIECE", "KG", "GRAM", "LITRE", "ML", "PACK"],
    })
      .notNull()
      .default("PIECE"),

    // Scale integration
    usesScale: integer("uses_scale", { mode: "boolean" }).default(false),
    pricePerKg: real("price_per_kg"), // Specific to weighted items

    // Generic item behavior
    isGenericButton: integer("is_generic_button", { mode: "boolean" }).default(
      false
    ),
    genericDefaultPrice: real("generic_default_price"), // Suggested price for generic items

    // Inventory
    trackInventory: integer("track_inventory", { mode: "boolean" }).default(
      true
    ),
    // ⚠️ IMPORTANT: When requiresBatchTracking is true, stockLevel should be calculated
    // as SUM(currentQuantity) of all ACTIVE batches for this product.
    // This field serves as a cached value for performance but should be kept in sync.
    stockLevel: real("stock_level").default(0), // Use real for weighted items
    minStockLevel: real("min_stock_level").default(0),
    reorderPoint: real("reorder_point").default(0),

    // VAT
    vatCategoryId: text("vat_category_id").references(() => vatCategories.id, {
      onDelete: "set null",
    }),
    vatOverridePercent: real("vat_override_percent"), // e.g. 0, 5, 20) or null

    // Business
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    // Settings
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    allowPriceOverride: integer("allow_price_override", {
      mode: "boolean",
    }).default(false),
    allowDiscount: integer("allow_discount", { mode: "boolean" }).default(true),

    // Expiry Tracking Fields
    hasExpiry: integer("has_expiry", { mode: "boolean" }).default(false),
    shelfLifeDays: integer("shelf_life_days"), // Expected shelf life in days
    requiresBatchTracking: integer("requires_batch_tracking", {
      mode: "boolean",
    }).default(false),
    // FIFO/FEFO settings
    stockRotationMethod: text("stock_rotation_method", {
      enum: ["FIFO", "FEFO", "NONE"],
    }).default("FIFO"),

    // Age Restriction Fields
    ageRestrictionLevel: text("age_restriction_level", {
      enum: ["NONE", "AGE_16", "AGE_18", "AGE_21"],
    })
      .notNull()
      .default("NONE"),
    requireIdScan: integer("require_id_scan", { mode: "boolean" }).default(
      false
    ),
    restrictionReason: text("restriction_reason"), // e.g., "Alcoholic beverage", "Tobacco product"

    // Timestamps
    ...timestampColumns,
  },
  (table) => [
    index("products_business_idx").on(table.businessId),
    index("products_category_idx").on(table.categoryId),
    index("products_sku_idx").on(table.sku),
    index("products_barcode_idx").on(table.barcode),
    index("products_plu_idx").on(table.plu),
    index("products_type_idx").on(table.productType),
    index("products_age_restriction_idx").on(table.ageRestrictionLevel),
    // Ensure SKU is unique per business
    unique("product_sku_business_unique").on(table.sku, table.businessId),
  ]
);

/**
 * Discount rules and promotions
 */
export const discounts = createTable("discounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", {
    enum: ["percentage", "fixed_amount", "buy_x_get_y"],
  }).notNull(),
  value: real("value").notNull(),
  businessId: text("businessId")
    .notNull()
    .references(() => businesses.id),
  applicableTo: text("applicableTo", {
    enum: ["all", "category", "product", "transaction"],
  }).notNull(),
  categoryIds: text("categoryIds"),
  productIds: text("productIds"),
  buyQuantity: integer("buyQuantity"),
  getQuantity: integer("getQuantity"),
  getDiscountType: text("getDiscountType", {
    enum: ["free", "percentage", "fixed"],
  }),
  getDiscountValue: real("getDiscountValue"),
  minPurchaseAmount: real("minPurchaseAmount"),
  minQuantity: integer("minQuantity"),
  maxDiscountAmount: real("maxDiscountAmount"),
  startDate: text("startDate"),
  endDate: text("endDate"),
  isActive: integer("isActive", { mode: "boolean" }).default(true),
  usageLimit: integer("usageLimit"),
  usageCount: integer("usageCount").default(0),
  perCustomerLimit: integer("perCustomerLimit"),
  priority: integer("priority").default(0),
  daysOfWeek: text("daysOfWeek"),
  timeStart: text("timeStart"),
  timeEnd: text("timeEnd"),
  requiresCouponCode: integer("requiresCouponCode", {
    mode: "boolean",
  }).default(false),
  couponCode: text("couponCode"),
  combinableWithOthers: integer("combinableWithOthers", {
    mode: "boolean",
  }).default(true),
  ...timestampColumns,
  createdBy: text("createdBy")
    .notNull()
    .references(() => users.id),
});

// ============================================================================
// INVENTORY MANAGEMENT
// ============================================================================

/**
 * Suppliers for product traceability
 */
export const suppliers = createTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    ...timestampColumns,
  },
  (table) => [
    index("suppliers_business_idx").on(table.businessId),
    index("suppliers_name_idx").on(table.name),
  ]
);

/**
 * Product Batches/Lot Tracking (Core Table)
 * 🔥 KEY RELATIONSHIP: Product Stock = SUM(currentQuantity) of all ACTIVE batches
 * When selling, system should deduct from batches following FEFO (First-Expiry-First-Out)
 */
export const productBatches = createTable(
  "product_batches",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull(), // Supplier batch number or auto-generated
    manufacturingDate: integer("manufacturing_date", { mode: "timestamp_ms" }),
    expiryDate: integer("expiry_date", { mode: "timestamp_ms" }).notNull(),

    // Stock tracking per batch
    // ⚠️ CONSTRAINT: currentQuantity should never be negative
    // ⚠️ CONSTRAINT: currentQuantity <= initialQuantity (unless batch transfer occurred)
    initialQuantity: real("initial_quantity").notNull(),
    currentQuantity: real("current_quantity").notNull(),

    // Supplier information
    supplierId: text("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    purchaseOrderNumber: text("purchase_order_number"),
    costPrice: real("cost_price"), // Batch-specific cost

    // Status
    // ACTIVE: Batch has stock and hasn't expired
    // EXPIRED: Expiry date has passed (auto-updated by system)
    // SOLD_OUT: currentQuantity reached 0 (auto-updated by system)
    // REMOVED: Manually removed/wasted
    status: text("status", {
      enum: ["ACTIVE", "EXPIRED", "SOLD_OUT", "REMOVED"],
    })
      .notNull()
      .default("ACTIVE"),

    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    ...timestampColumns,
  },
  (table) => [
    index("batches_product_idx").on(table.productId),
    index("batches_expiry_idx").on(table.expiryDate),
    index("batches_status_idx").on(table.status),
    index("batches_business_idx").on(table.businessId),
    index("batches_number_idx").on(table.batchNumber),
    index("batches_supplier_idx").on(table.supplierId),
    // 🔥 CRITICAL: Composite index for FEFO queries (find oldest active batches first)
    // Used for: SELECT * FROM product_batches WHERE productId = ? AND status = 'ACTIVE' ORDER BY expiryDate ASC
    index("batches_product_status_expiry_idx").on(
      table.productId,
      table.status,
      table.expiryDate
    ),
    // Composite index for finding batches expiring soon (for notifications)
    index("batches_business_status_expiry_idx").on(
      table.businessId,
      table.status,
      table.expiryDate
    ),
    // Composite index for stock calculation queries (SUM currentQuantity by product)
    index("batches_product_status_quantity_idx").on(
      table.productId,
      table.status,
      table.currentQuantity
    ),
    // Ensure batch number is unique per product and business
    unique("batch_number_product_business_unique").on(
      table.batchNumber,
      table.productId,
      table.businessId
    ),
  ]
);

/**
 * Expiry Notification Settings per business
 */
export const expirySettings = createTable(
  "expiry_settings",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    // Notification thresholds (in days)
    criticalAlertDays: integer("critical_alert_days").notNull().default(3),
    warningAlertDays: integer("warning_alert_days").notNull().default(7),
    infoAlertDays: integer("info_alert_days").notNull().default(14),

    // Notification channels
    notifyViaEmail: integer("notify_via_email", { mode: "boolean" }).default(
      true
    ),
    notifyViaPush: integer("notify_via_push", { mode: "boolean" }).default(
      true
    ),
    notifyViaDashboard: integer("notify_via_dashboard", {
      mode: "boolean",
    }).default(true),

    // Auto-actions
    autoDisableExpired: integer("auto_disable_expired", {
      mode: "boolean",
    }).default(true),
    allowSellNearExpiry: integer("allow_sell_near_expiry", {
      mode: "boolean",
    }).default(false),
    nearExpiryThreshold: integer("near_expiry_threshold").default(2), // days

    // Recipients (JSON array of user IDs or roles)
    notificationRecipients: text("notification_recipients", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),

    ...timestampColumns,
  },
  (table) => [
    index("expiry_settings_business_idx").on(table.businessId),
    // Ensure one settings record per business
    unique("expiry_settings_business_unique").on(table.businessId),
  ]
);

/**
 * Sales Unit Settings per business
 */
export const salesUnitSettings = createTable(
  "sales_unit_settings",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    // Sales unit mode: "Fixed" or "Varying"
    salesUnitMode: text("sales_unit_mode", {
      enum: ["Fixed", "Varying"],
    })
      .notNull()
      .default("Varying"),

    // Fixed sales unit (only used when mode is "Fixed")
    fixedSalesUnit: text("fixed_sales_unit", {
      enum: ["PIECE", "KG", "GRAM", "LITRE", "ML", "PACK"],
    })
      .notNull()
      .default("KG"),

    ...timestampColumns,
  },
  (table) => [
    index("sales_unit_settings_business_idx").on(table.businessId),
    // Ensure one settings record per business
    unique("sales_unit_settings_business_unique").on(table.businessId),
  ]
);

/**
 * Expiry Notifications Log
 */
export const expiryNotifications = createTable(
  "expiry_notifications",
  {
    id: text("id").primaryKey(),
    productBatchId: text("product_batch_id")
      .notNull()
      .references(() => productBatches.id, { onDelete: "cascade" }),

    // Notification details
    notificationType: text("notification_type", {
      enum: ["INFO", "WARNING", "CRITICAL", "EXPIRED"],
    }).notNull(),
    daysUntilExpiry: integer("days_until_expiry").notNull(),
    message: text("message").notNull(),

    // Delivery status
    status: text("status", {
      enum: ["PENDING", "SENT", "DELIVERED", "FAILED", "ACKNOWLEDGED"],
    })
      .notNull()
      .default("PENDING"),

    // Channels attempted
    channels: text("channels", { mode: "json" })
      .$type<Array<"EMAIL" | "PUSH" | "DASHBOARD">>()
      .notNull()
      .default([]),

    // Acknowledgment
    acknowledgedBy: text("acknowledged_by").references(() => users.id),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }),

    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    ...timestampColumns,
  },
  (table) => [
    index("notifications_batch_idx").on(table.productBatchId),
    index("notifications_status_idx").on(table.status),
    index("notifications_scheduled_idx").on(table.scheduledFor),
    index("notifications_business_idx").on(table.businessId),
    index("notifications_type_idx").on(table.notificationType),
  ]
);

/**
 * Stock Movements with Batch Tracking
 * 🔥 IMPORTANT: All stock movements should update batch.currentQuantity accordingly
 * OUTBOUND movements should follow FEFO (deduct from oldest batch first)
 */
export const stockMovements = createTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // batchId: The primary batch affected by this movement
    // For OUTBOUND: batchId is the batch being deducted from
    // For INBOUND: batchId is the batch being added to (or null if creating new batch)
    batchId: text("batch_id").references(() => productBatches.id, {
      onDelete: "set null",
    }),
    movementType: text("movement_type", {
      enum: ["INBOUND", "OUTBOUND", "ADJUSTMENT", "TRANSFER", "WASTE"],
    }).notNull(),
    // ⚠️ For OUTBOUND/WASTE: quantity should be positive (system will subtract)
    // ⚠️ For INBOUND: quantity should be positive (system will add)
    quantity: real("quantity").notNull(),
    reason: text("reason"),
    reference: text("reference"), // Sale ID, PO number, transaction ID, etc.

    // Batch-specific movement (for transfers between batches)
    fromBatchId: text("from_batch_id").references(() => productBatches.id, {
      onDelete: "set null",
    }),
    toBatchId: text("to_batch_id").references(() => productBatches.id, {
      onDelete: "set null",
    }),

    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("movements_product_idx").on(table.productId),
    index("movements_batch_idx").on(table.batchId),
    index("movements_timestamp_idx").on(table.timestamp),
    index("movements_type_idx").on(table.movementType),
    index("movements_business_idx").on(table.businessId),
    // Composite index for batch movement history queries
    index("movements_batch_timestamp_idx").on(table.batchId, table.timestamp),
    // Composite index for product movement history queries
    index("movements_product_timestamp_idx").on(
      table.productId,
      table.timestamp
    ),
    // Index for reference lookups (e.g., find movements for a specific sale)
    index("movements_reference_idx").on(table.reference),
  ]
);

/**
 * Stock adjustments for manual inventory corrections
 */
export const stockAdjustments = createTable("stock_adjustments", {
  id: text("id").primaryKey(),
  productId: text("productId")
    .notNull()
    .references(() => products.id),
  type: text("type", {
    enum: ["add", "remove", "sale", "waste", "adjustment"],
  }).notNull(),
  quantity: real("quantity").notNull(),
  reason: text("reason"),
  note: text("note"),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  businessId: text("businessId")
    .notNull()
    .references(() => businesses.id),
  timestamp: text("timestamp").notNull(),
});

// ============================================================================
// CART MANAGEMENT
// ============================================================================

/**
 * Cart sessions - Active shopping carts before payment
 * Supports cart persistence, recovery, and multi-station operations
 */
export const cartSessions = createTable(
  "cart_sessions",
  {
    id: text("id").primaryKey(),
    cashierId: text("cashier_id")
      .notNull()
      .references(() => users.id),
    shiftId: text("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }), // Nullable for admin/owner mode
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id),
    terminal_id: text("terminal_id").references(() => terminals.id),

    // Session status
    status: text("status", {
      enum: ["ACTIVE", "COMPLETED", "CANCELLED", "SAVED"],
    })
      .notNull()
      .default("ACTIVE"),

    // Totals
    totalAmount: real("total_amount").default(0),
    taxAmount: real("tax_amount").default(0),

    // Age verification tracking (session-level)
    customerAgeVerified: integer("customer_age_verified", {
      mode: "boolean",
    }).default(false),
    verificationMethod: text("verification_method", {
      enum: ["NONE", "MANUAL", "SCAN", "OVERRIDE"],
    }).default("NONE"),
    verifiedBy: text("verified_by").references(() => users.id),

    // Timestamps
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    ...timestampColumns,
  },
  (table) => [
    index("cart_sessions_status_idx").on(table.status, table.cashierId),
    index("cart_sessions_created_idx").on(table.createdAt),
    index("cart_sessions_shift_idx").on(table.shiftId),
    index("cart_sessions_business_idx").on(table.businessId),
  ]
);

/**
 * Cart items - Individual items in a cart session
 * Supports both UNIT and WEIGHT item types, batch tracking, age restrictions, and scale integration
 */
export const cartItems = createTable(
  "cart_items",
  {
    id: text("id").primaryKey(),
    cartSessionId: text("cart_session_id")
      .notNull()
      .references(() => cartSessions.id, { onDelete: "cascade" }),

    // Item source: either a product OR a category (for generic/category items)
    // At least one must be set - enforced at application level
    productId: text("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),

    // Item name (for category items or when product is deleted)
    itemName: text("item_name"), // Store name for category items or deleted products

    // Item type and quantity
    itemType: text("item_type", {
      enum: ["UNIT", "WEIGHT"],
    }).notNull(),
    quantity: integer("quantity"), // For UNIT items
    weight: real("weight"), // For WEIGHT items (kg)
    unitOfMeasure: text("unit_of_measure"), // 'kg', 'g', 'lb', etc.

    // Pricing
    unitPrice: real("unit_price").notNull(), // Price per unit/kg
    totalPrice: real("total_price").notNull(), // Calculated total
    taxAmount: real("tax_amount").notNull(),

    // Batch tracking (for expiry) - only for product items
    batchId: text("batch_id").references(() => productBatches.id, {
      onDelete: "set null",
    }),
    batchNumber: text("batch_number"),
    expiryDate: integer("expiry_date", { mode: "timestamp_ms" }),

    // Age restriction tracking
    ageRestrictionLevel: text("age_restriction_level", {
      enum: ["NONE", "AGE_16", "AGE_18", "AGE_21"],
    }).default("NONE"),
    ageVerified: integer("age_verified", { mode: "boolean" }).default(false),

    // Scale data (for weighted items audit)
    scaleReadingWeight: real("scale_reading_weight"),
    scaleReadingStable: integer("scale_reading_stable", {
      mode: "boolean",
    }).default(true),

    // Timestamps
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cart_items_session_idx").on(table.cartSessionId),
    index("cart_items_product_idx").on(table.productId),
    index("cart_items_category_idx").on(table.categoryId),
    index("cart_items_batch_idx").on(table.batchId),
    index("cart_items_type_idx").on(table.itemType),
  ]
);

/**
 * Saved Baskets - Carts saved for later retrieval via QR code
 * Allows customers to save their shopping cart and retrieve it later
 */
export const savedBaskets = createTable(
  "saved_baskets",
  {
    id: text("id").primaryKey(),
    basketCode: text("basket_code").notNull().unique(), // e.g. "BSK-ABC123"
    name: text("name").notNull(), // User-friendly name
    cartSessionId: text("cart_session_id")
      .notNull()
      .references(() => cartSessions.id, { onDelete: "cascade" }),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id),
    savedBy: text("saved_by")
      .notNull()
      .references(() => users.id), // User who saved the basket
    shiftId: text("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }), // Optional shift reference

    // Customer info (optional)
    customerEmail: text("customer_email"),
    notes: text("notes"),

    // Status and tracking
    status: text("status", {
      enum: ["active", "retrieved", "expired", "deleted"],
    })
      .notNull()
      .default("active"),

    savedAt: integer("saved_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    retrievedAt: integer("retrieved_at", { mode: "timestamp_ms" }),
    retrievedCount: integer("retrieved_count").notNull().default(0),

    ...timestampColumns,
  },
  (table) => [
    index("saved_baskets_code_idx").on(table.basketCode),
    index("saved_baskets_business_idx").on(table.businessId),
    index("saved_baskets_saved_by_idx").on(table.savedBy),
    index("saved_baskets_status_idx").on(table.status),
    index("saved_baskets_saved_at_idx").on(table.savedAt),
  ]
);

// ============================================================================
// SALES & TRANSACTIONS
// ============================================================================

/**
 * Sales transactions with support for refunds and voids
 */
// @ts-ignore - Circular reference in self-referencing table (for refunds)
export const transactions = createTable("transactions", {
  id: text("id").primaryKey(),
  shiftId: text("shiftId").references(() => shifts.id, {
    onDelete: "set null",
  }), // Nullable for admin/owner mode
  businessId: text("businessId")
    .notNull()
    .references(() => businesses.id),
  terminalId: text("terminal_id").references(() => terminals.id),
  type: text("type", { enum: ["sale", "refund", "void"] }).notNull(),
  subtotal: real("subtotal").notNull(),
  tax: real("tax").notNull(),
  total: real("total").notNull(),
  paymentMethod: text("paymentMethod", {
    enum: ["cash", "card", "mobile", "voucher", "split", "viva_wallet"],
  }).notNull(),
  cashAmount: real("cashAmount"),
  cardAmount: real("cardAmount"),
  status: text("status", {
    enum: ["completed", "voided", "pending"],
  }).notNull(),
  voidReason: text("voidReason"),
  customerId: text("customerId"),
  receiptNumber: text("receiptNumber").notNull(),
  timestamp: text("timestamp").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  // @ts-ignore - Self-reference: transactions.originalTransactionId -> transactions.id
  originalTransactionId: text("originalTransactionId").references(
    // @ts-ignore - Circular reference type inference
    () => transactions.id
  ),
  refundReason: text("refundReason"),
  refundMethod: text("refundMethod", {
    enum: ["original", "store_credit", "cash", "card"],
  }),
  managerApprovalId: text("managerApprovalId").references(() => users.id),
  isPartialRefund: integer("isPartialRefund", { mode: "boolean" }).default(
    false
  ),
  discountAmount: real("discountAmount").default(0),
  appliedDiscounts: text("appliedDiscounts"),
  // Viva Wallet transaction tracking
  vivaWalletTransactionId: text("viva_wallet_transaction_id"),
  vivaWalletTerminalId: text("viva_wallet_terminal_id"),
  // Currency for multi-currency support
  currency: text("currency").notNull().default("GBP"),
});

/**
 * Individual items within a transaction
 * Enhanced with fields from cart_items for complete audit trail
 */
export const transactionItems = createTable("transaction_items", {
  id: text("id").primaryKey(),
  transactionId: text("transactionId")
    .notNull()
    .references(() => transactions.id),
  // Item source: either a product OR a category (for generic/category items)
  // At least one must be set - enforced at application level
  productId: text("productId").references(() => products.id, {
    onDelete: "set null",
  }),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  productName: text("productName").notNull(),

  // Item type and quantity (from cart_items)
  itemType: text("item_type", {
    enum: ["UNIT", "WEIGHT"],
  }).notNull(),
  quantity: integer("quantity"), // For UNIT items
  weight: real("weight"), // For WEIGHT items (kg)
  unitOfMeasure: text("unit_of_measure"), // 'kg', 'g', 'lb', etc.

  // Pricing
  unitPrice: real("unitPrice").notNull(),
  totalPrice: real("totalPrice").notNull(),
  taxAmount: real("tax_amount").notNull(),
  refundedQuantity: integer("refundedQuantity").default(0),
  discountAmount: real("discountAmount").default(0),
  appliedDiscounts: text("appliedDiscounts"),

  // Batch info (for recalls/audits) - copied from cart_items
  batchId: text("batch_id").references(() => productBatches.id, {
    onDelete: "set null",
  }),
  batchNumber: text("batch_number"),
  expiryDate: integer("expiry_date", { mode: "timestamp_ms" }),

  // Age restriction info - copied from cart_items
  ageRestrictionLevel: text("age_restriction_level", {
    enum: ["NONE", "AGE_16", "AGE_18", "AGE_21"],
  }).default("NONE"),
  ageVerified: integer("age_verified", { mode: "boolean" }).default(false),

  // Reference to original cart item (if applicable)
  cartItemId: text("cart_item_id").references(() => cartItems.id, {
    onDelete: "set null",
  }),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

/**
 * Age Verification Records - Audit trail for age-restricted product sales
 */
export const ageVerificationRecords = createTable(
  "age_verification_records",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    transactionItemId: text("transaction_item_id").references(
      () => transactionItems.id,
      { onDelete: "set null" }
    ),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    // Verification method
    verificationMethod: text("verification_method", {
      enum: ["manual", "scan", "override"],
    }).notNull(),

    // Customer age information
    customerBirthdate: integer("customer_birthdate", { mode: "timestamp_ms" }), // Date of birth from ID or manual entry
    calculatedAge: integer("calculated_age"), // Calculated age at time of verification

    // ID scan data (if method was "scan")
    idScanData: text("id_scan_data", { mode: "json" }), // JSON data from ID scanner

    // Staff information
    verifiedBy: text("verified_by")
      .notNull()
      .references(() => users.id), // Staff member who verified
    managerOverrideId: text("manager_override_id").references(() => users.id), // Manager who approved override (if method was "override")
    overrideReason: text("override_reason"), // Reason for manager override

    // Business reference
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    // Verification timestamp
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),

    ...timestampColumns,
  },
  (table) => [
    index("age_verification_transaction_idx").on(table.transactionId),
    index("age_verification_transaction_item_idx").on(table.transactionItemId),
    index("age_verification_product_idx").on(table.productId),
    index("age_verification_verified_by_idx").on(table.verifiedBy),
    index("age_verification_business_idx").on(table.businessId),
    index("age_verification_verified_at_idx").on(table.verifiedAt),
    // Composite index for compliance reporting
    index("age_verification_business_date_idx").on(
      table.businessId,
      table.verifiedAt
    ),
  ]
);
/**
 * Cash drawer counts (mid-shift and end-shift)
 */
export const cashDrawerCounts = createTable(
  "cash_drawer_counts",
  {
    id: text("id").primaryKey(),
    business_id: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    shift_id: text("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    terminal_id: text("terminal_id").references(() => terminals.id),

    count_type: text("count_type", {
      enum: ["mid-shift", "end-shift"],
    }).notNull(),

    expected_amount: real("expected_amount").notNull(),
    counted_amount: real("counted_amount").notNull(),
    variance: real("variance").notNull(),

    notes: text("notes"),
    counted_by: text("counted_by")
      .notNull()
      .references(() => users.id),

    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("cash_drawer_counts_shift_idx").on(table.shift_id),
    index("cash_drawer_counts_business_idx").on(table.business_id),
    index("cash_drawer_counts_timestamp_idx").on(table.timestamp),
    index("cash_drawer_counts_counted_by_idx").on(table.counted_by),

    // Ensure only one end-shift count per shift
    unique("cash_drawer_counts_shift_type_unique").on(
      table.shift_id,
      table.count_type
    ),
  ]
);

// ============================================================================
// SHIFT MANAGEMENT
// ============================================================================

/**
 * Staff schedules for shift planning
 */
export const schedules = createTable("schedules", {
  id: text("id").primaryKey(),
  staffId: text("staffId")
    .notNull()
    .references(() => users.id),
  businessId: text("businessId")
    .notNull()
    .references(() => businesses.id),
  startTime: integer("start_time", { mode: "timestamp_ms" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp_ms" }),
  status: text("status", {
    enum: ["upcoming", "active", "completed", "missed"],
  }).notNull(),
  assignedRegister: text("assignedRegister"),
  notes: text("notes"),
  ...timestampColumns,
});

/**
 * Unified Shifts table for POS operations and time tracking
 * Uses clock events as source of truth for timing
 * Supports both cashier shifts (with cash drawer) and general employee shifts
 */
export const shifts = createTable(
  "shifts",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id),
    business_id: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    // Scheduling
    schedule_id: text("schedule_id").references(() => schedules.id, {
      onDelete: "set null",
    }),

    // Clock events (time tracking) - SOURCE OF TRUTH for timing
    clock_in_id: text("clock_in_id")
      .notNull()
      .references(() => clockEvents.id, { onDelete: "restrict" }),
    clock_out_id: text("clock_out_id").references(() => clockEvents.id, {
      onDelete: "restrict",
    }),

    // Shift status
    status: text("status", {
      enum: ["active", "ended", "pending_review"],
    })
      .notNull()
      .default("active"),

    // POS-specific data (nullable for non-POS shifts)
    terminal_id: text("terminal_id").references(() => terminals.id), // Terminal identifier
    starting_cash: real("starting_cash"), // Only for POS shifts, recorded at shift start

    // Sales totals (for POS shifts)
    total_sales: real("total_sales").default(0),
    total_transactions: integer("total_transactions").default(0),
    total_refunds: real("total_refunds").default(0),
    total_voids: real("total_voids").default(0),

    // Time tracking calculations
    // ⚠️ COMPUTED: Calculated from clockOut.timestamp - clockIn.timestamp - break_duration_seconds
    total_hours: real("total_hours"),
    regular_hours: real("regular_hours"),
    overtime_hours: real("overtime_hours"),

    // ⚠️ COMPUTED: SUM(duration_seconds) from breaks table
    break_duration_seconds: integer("break_duration_seconds").default(0),

    notes: text("notes"),
    ...timestampColumns,
  },
  (table) => [
    index("shifts_user_idx").on(table.user_id),
    index("shifts_business_idx").on(table.business_id),
    index("shifts_status_idx").on(table.status),
    index("shifts_schedule_idx").on(table.schedule_id),
    index("shifts_clock_in_idx").on(table.clock_in_id),
    index("shifts_clock_out_idx").on(table.clock_out_id),
    index("shifts_terminal_idx").on(table.terminal_id),

    // Compound indexes for common queries
    index("shifts_user_status_idx").on(table.user_id, table.status),
    index("shifts_business_created_idx").on(table.business_id, table.createdAt),
    index("shifts_user_created_idx").on(table.user_id, table.createdAt),

    // Unique constraints - each clock event can only be used once
    unique("shifts_clock_in_unique").on(table.clock_in_id),
    unique("shifts_clock_out_unique").on(table.clock_out_id),
  ]
);

// ============================================================================
// SHIFT VALIDATION & REPORTING
// ============================================================================

/**
 * Validation issue codes for shift validation system
 */
export const VALIDATION_ISSUE_CODES = {
  // Attendance issues
  LATE_CLOCK_IN: "LATE_CLOCK_IN",
  MISSED_CLOCK_OUT: "MISSED_CLOCK_OUT",
  SHIFT_OVERLAP: "SHIFT_OVERLAP",

  // Cash management issues
  CASH_VARIANCE_HIGH: "CASH_VARIANCE_HIGH",
  MISSING_END_SHIFT_COUNT: "MISSING_END_SHIFT_COUNT",
  MULTIPLE_END_SHIFT_COUNTS: "MULTIPLE_END_SHIFT_COUNTS",

  // Transaction issues
  VOIDED_TRANSACTION_NO_REASON: "VOIDED_TRANSACTION_NO_REASON",
  REFUND_WITHOUT_APPROVAL: "REFUND_WITHOUT_APPROVAL",
  SUSPICIOUS_DISCOUNT: "SUSPICIOUS_DISCOUNT",

  // Compliance issues
  MISSING_BREAK: "MISSING_BREAK",
  BREAK_TOO_SHORT: "BREAK_TOO_SHORT",
  BREAK_TOO_LONG: "BREAK_TOO_LONG",
  MISSED_REQUIRED_BREAK: "MISSED_REQUIRED_BREAK",
  LATE_BREAK_RETURN: "LATE_BREAK_RETURN",
  EXCESSIVE_OVERTIME: "EXCESSIVE_OVERTIME",
} as const;

/**
 * Individual validation issues found during shift validation
 */
export const shiftValidationIssues = createTable(
  "shift_validation_issues",
  {
    ...commonColumns,

    validationId: text("validation_id").notNull(),
    type: text("type", { enum: ["violation", "warning"] }).notNull(),
    message: text("message").notNull(),
    code: text("code").notNull(), // Machine-readable error code for programmatic handling
    severity: text("severity", {
      enum: ["low", "medium", "high", "critical"],
    }).default("medium"),

    // Additional context for the issue
    category: text("category", {
      enum: [
        "attendance",
        "cash_management",
        "transactions",
        "compliance",
        "system",
      ],
    }).notNull(),

    // Resolution tracking
    resolved: integer("resolved", { mode: "boolean" }).default(false),
    resolvedAt: text("resolved_at"),
    resolvedBy: text("resolved_by"), // userId
    resolutionNotes: text("resolution_notes"),

    // Additional metadata for debugging/fixing
    relatedEntityId: text("related_entity_id"), // e.g., transactionId, userId, etc.
    relatedEntityType: text("related_entity_type"), // e.g., 'transaction', 'user', 'cash_drawer_count'
    dataSnapshot: text("data_snapshot"), // JSON snapshot of relevant data at time of validation
  },
  (table) => [
    unique("shift_validation_issues_public_id_unique").on(table.publicId),
    index("validation_issues_validation_idx").on(table.validationId),
    index("validation_issues_type_idx").on(table.type),
    index("validation_issues_severity_idx").on(table.severity),
    index("validation_issues_category_idx").on(table.category),
    index("validation_issues_resolved_idx").on(table.resolved),
    index("validation_issues_business_idx").on(table.businessId),
    index("validation_issues_related_entity_idx").on(
      table.relatedEntityType,
      table.relatedEntityId
    ),

    // Composite index for common query patterns
    index("validation_issues_status_severity_idx").on(
      table.resolved,
      table.severity
    ),
  ]
);

/**
 * Shift validation results and aggregates
 */
export const shiftValidations = createTable(
  "shift_validations",
  {
    ...commonColumns,

    shiftId: text("shift_id").notNull(),
    valid: integer("valid", { mode: "boolean" }).notNull(),
    requiresReview: integer("requires_review", { mode: "boolean" }).notNull(),

    // Computed aggregates for quick access
    violationCount: integer("violation_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
    criticalIssueCount: integer("critical_issue_count").notNull().default(0),
    unresolvedIssueCount: integer("unresolved_issue_count")
      .notNull()
      .default(0),

    // Validation metadata
    validatedAt: text("validated_at"),
    validatedBy: text("validated_by"), // userId
    validationMethod: text("validation_method", {
      enum: ["auto", "manual"],
    }).default("auto"),

    // Resolution tracking
    resolution: text("resolution", {
      enum: ["approved", "rejected", "pending", "needs_review"],
    }).default("pending"),
    resolvedAt: text("resolved_at"),
    resolvedBy: text("resolved_by"), // userId
    resolutionNotes: text("resolution_notes"),
  },
  (table) => [
    unique("shift_validations_public_id_unique").on(table.publicId),
    index("shift_validations_shift_idx").on(table.shiftId),
    index("shift_validations_business_idx").on(table.businessId),
    index("shift_validations_valid_idx").on(table.valid),
    index("shift_validations_requires_review_idx").on(table.requiresReview),
    index("shift_validations_resolution_idx").on(table.resolution),
    index("shift_validations_unresolved_count_idx").on(
      table.unresolvedIssueCount
    ),

    // One validation record per shift
    unique("shift_validations_shift_unique").on(table.shiftId),
  ]
);

/**
 * Shift Report View - Materialized or computed
 */
export const shiftReports = sqliteTableCreator((name: string) => `pos_${name}`)(
  "shift_reports",
  {
    id: text("id").primaryKey(), // shiftId or generated ID
    businessId: text("business_id").notNull(),
    shiftId: text("shift_id").notNull(),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),

    // Sales metrics
    totalSales: real("total_sales").notNull().default(0),
    totalRefunds: real("total_refunds").notNull().default(0),
    totalVoids: real("total_voids").notNull().default(0),
    netSales: real("net_sales").notNull().default(0),
    transactionCount: integer("transaction_count").notNull().default(0),
    averageTransactionValue: real("average_transaction_value")
      .notNull()
      .default(0),

    // Cash management
    expectedCashAmount: real("expected_cash_amount").notNull().default(0),
    countedCashAmount: real("counted_cash_amount").notNull().default(0),
    cashVariance: real("cash_variance").notNull().default(0),

    // Timing metrics
    plannedStart: text("planned_start"),
    actualStart: text("actual_start").notNull(),
    plannedEnd: text("planned_end"),
    actualEnd: text("actual_end"),
    shiftDurationMinutes: integer("shift_duration_minutes")
      .notNull()
      .default(0),
    lateMinutes: integer("late_minutes").default(0),
    earlyMinutes: integer("early_minutes").default(0),

    // Timestamps
    reportGeneratedAt: text("report_generated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    periodCovered: text("period_covered").notNull(), // e.g., '2024-01-day', '2024-01-week'
  },
  (table: any) => [
    index("shift_report_view_shift_idx").on(table.shiftId),
    index("shift_report_view_business_idx").on(table.businessId),
    index("shift_report_view_user_idx").on(table.userId),
    index("shift_report_view_period_idx").on(table.periodCovered),
    index("shift_report_view_generated_at_idx").on(table.reportGeneratedAt),
  ]
);

/**
 * Attendance reports aggregated by period
 */
export const attendanceReports = createTable(
  "attendance_reports",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),

    // Period
    periodStartDate: text("period_start_date").notNull(),
    periodEndDate: text("period_end_date").notNull(),
    periodType: text("period_type", {
      enum: ["daily", "weekly", "monthly"],
    }).notNull(),

    // Shift metrics
    totalShifts: integer("total_shifts").notNull().default(0),
    completedShifts: integer("completed_shifts").notNull().default(0),
    incompleteShifts: integer("incomplete_shifts").notNull().default(0),

    // Hour calculations
    totalHours: real("total_hours").notNull().default(0),
    regularHours: real("regular_hours").notNull().default(0),
    overtimeHours: real("overtime_hours").notNull().default(0),

    // Compliance metrics
    lateClockIns: integer("late_clock_ins").notNull().default(0),
    missedClockOuts: integer("missed_clock_outs").notNull().default(0),
    tardinessMinutes: integer("tardiness_minutes").notNull().default(0),

    // Averages
    averageHoursPerShift: real("average_hours_per_shift").notNull().default(0),
    averageTardinessMinutes: real("average_tardiness_minutes")
      .notNull()
      .default(0),

    // Report metadata
    reportGeneratedAt: text("report_generated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    dataUpTo: text("data_up_to").notNull(), // Last data point included
  },
  (table) => [
    index("attendance_report_user_period_idx").on(
      table.userId,
      table.periodStartDate
    ),
    index("attendance_report_business_period_idx").on(
      table.businessId,
      table.periodType
    ),
    index("attendance_report_generated_at_idx").on(table.reportGeneratedAt),

    unique("attendance_report_unique").on(
      table.userId,
      table.periodStartDate,
      table.periodEndDate,
      table.businessId
    ),
  ]
);

// ============================================================================
// TIME TRACKING
// ============================================================================

/**
 * Clock in/out events for time tracking
 */
export const clockEvents = createTable(
  "clock_events",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    business_id: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    terminal_id: text("terminal_id")
      .notNull()
      .references(() => terminals.id),
    location_id: text("location_id"),

    // Link to scheduled shift (nullable - not all clock events are scheduled)
    schedule_id: text("schedule_id").references(() => schedules.id, {
      onDelete: "set null",
    }),

    type: text("type", { enum: ["in", "out"] }).notNull(),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),

    method: text("method", {
      enum: ["login", "manual", "auto", "manager"],
    }).notNull(),
    status: text("status", { enum: ["pending", "confirmed", "disputed"] })
      .notNull()
      .default("confirmed"),

    geolocation: text("geolocation"),
    ip_address: text("ip_address"),
    notes: text("notes"),
    ...timestampColumns,
  },
  (table) => [
    index("clock_events_user_idx").on(table.user_id),
    index("clock_events_business_idx").on(table.business_id),
    index("clock_events_timestamp_idx").on(table.timestamp),
    index("clock_events_type_idx").on(table.type),
    index("clock_events_status_idx").on(table.status),
    index("clock_events_schedule_idx").on(table.schedule_id),

    // Compound indexes for common queries
    index("clock_events_user_timestamp_idx").on(table.user_id, table.timestamp),
    index("clock_events_business_timestamp_idx").on(
      table.business_id,
      table.timestamp
    ),
  ]
);

/**
 * Break periods during shifts
 * Supports compliance tracking and scheduling
 */
export const breaks = createTable(
  "breaks",
  {
    id: text("id").primaryKey(),
    shift_id: text("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id),
    business_id: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    // Break type and timing
    type: text("type", { enum: ["meal", "rest", "other"] })
      .notNull()
      .default("rest"),
    start_time: integer("start_time", { mode: "timestamp_ms" }).notNull(),
    end_time: integer("end_time", { mode: "timestamp_ms" }),
    duration_seconds: integer("duration_seconds"), // Actual duration when completed
    is_paid: integer("is_paid", { mode: "boolean" }).default(false),

    // Status
    status: text("status", {
      enum: ["scheduled", "active", "completed", "cancelled", "missed"],
    })
      .notNull()
      .default("active"),

    // Compliance tracking
    is_required: integer("is_required", { mode: "boolean" }).default(false),
    required_reason: text("required_reason"), // e.g., "Labor law: 30min after 6 hours"
    minimum_duration_seconds: integer("minimum_duration_seconds"),

    // Scheduled vs actual
    scheduled_start: integer("scheduled_start", { mode: "timestamp_ms" }),
    scheduled_end: integer("scheduled_end", { mode: "timestamp_ms" }),

    // Violation tracking
    is_missed: integer("is_missed", { mode: "boolean" }).default(false),
    is_short: integer("is_short", { mode: "boolean" }).default(false), // Didn't meet minimum

    notes: text("notes"),
    ...timestampColumns,
  },
  (table) => [
    index("breaks_shift_idx").on(table.shift_id),
    index("breaks_user_idx").on(table.user_id),
    index("breaks_business_idx").on(table.business_id),
    index("breaks_status_idx").on(table.status),
    index("breaks_type_idx").on(table.type),
    index("breaks_start_time_idx").on(table.start_time),

    // Compound indexes
    index("breaks_shift_status_idx").on(table.shift_id, table.status),
    index("breaks_user_start_idx").on(table.user_id, table.start_time),
  ]
);

/**
 * Time corrections for manual adjustments to clock events
 */
export const timeCorrections = createTable(
  "time_corrections",
  {
    id: text("id").primaryKey(),
    clock_event_id: text("clock_event_id").references(() => clockEvents.id),
    shift_id: text("shift_id").references(() => shifts.id),

    // Allow break time corrections
    break_id: text("break_id").references(() => breaks.id),

    user_id: text("user_id")
      .notNull()
      .references(() => users.id),
    business_id: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    correction_type: text("correction_type", {
      enum: ["clock_time", "break_time", "manual_entry"],
    }).notNull(),

    original_time: integer("original_time", { mode: "timestamp_ms" }),
    corrected_time: integer("corrected_time", {
      mode: "timestamp_ms",
    }).notNull(),
    time_difference_seconds: integer("time_difference_seconds").notNull(),

    reason: text("reason").notNull(),
    requested_by: text("requested_by")
      .notNull()
      .references(() => users.id),
    approved_by: text("approved_by").references(() => users.id),

    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),

    ...timestampColumns,
  },
  (table) => [
    index("time_corrections_clock_event_idx").on(table.clock_event_id),
    index("time_corrections_shift_idx").on(table.shift_id),
    index("time_corrections_break_idx").on(table.break_id),
    index("time_corrections_user_idx").on(table.user_id),
    index("time_corrections_business_idx").on(table.business_id),
    index("time_corrections_status_idx").on(table.status),
  ]
);

// ============================================================================
// PRINTING
// ============================================================================

/**
 * Print jobs queue and status tracking
 */
export const printJobs = createTable("print_jobs", {
  jobId: text("job_id").primaryKey(),
  printerName: text("printer_name").notNull(),
  documentPath: text("document_path"),
  documentType: text("document_type", {
    enum: ["pdf", "image", "text", "raw"],
  }).notNull(),
  status: text("status", {
    enum: [
      "pending",
      "queued",
      "printing",
      "completed",
      "failed",
      "cancelled",
      "retrying",
    ],
  }).notNull(),
  options: text("options"),
  metadata: text("metadata"),
  createdBy: text("created_by").references(() => users.id),
  businessId: text("business_id").references(() => businesses.id),
  terminalId: text("terminal_id").references(() => terminals.id),
  createdAt: text("created_at").notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  lastRetryAt: text("last_retry_at"),
  retryCount: integer("retry_count").default(0),
  progress: integer("progress").default(0),
  pagesTotal: integer("pages_total"),
  pagesPrinted: integer("pages_printed"),
  error: text("error"),
});

/**
 * Print job retry history
 */
export const printJobRetries = createTable("print_job_retries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id")
    .notNull()
    .references(() => printJobs.jobId, { onDelete: "cascade" }),
  attempt: integer("attempt").notNull(),
  error: text("error").notNull(),
  timestamp: text("timestamp").notNull(),
  nextRetryAt: text("next_retry_at").notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

// ----------------------------------------------------------------------------
// Business & User Relations
// ----------------------------------------------------------------------------

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerId],
    references: [users.id],
  }),
  users: many(users),
  products: many(products),
  categories: many(categories),
  vatCategories: many(vatCategories),
  transactions: many(transactions),
  shifts: many(shifts),
  schedules: many(schedules),
  discounts: many(discounts),
  suppliers: many(suppliers),
  productBatches: many(productBatches),
  stockMovements: many(stockMovements),
  expirySettings: one(expirySettings),
  expiryNotifications: many(expiryNotifications),
  shiftValidations: many(shiftValidations),
  cashDrawerCounts: many(cashDrawerCounts),
  attendanceReports: many(attendanceReports),
  ageVerificationRecords: many(ageVerificationRecords),
  cartSessions: many(cartSessions),
  clockEvents: many(clockEvents),
  breaks: many(breaks),
  timeCorrections: many(timeCorrections),
  terminals: many(terminals),
}));

export const terminalsRelations = relations(terminals, ({ one, many }) => ({
  business: one(businesses, {
    fields: [terminals.business_id],
    references: [businesses.id],
  }),
  shifts: many(shifts),
  clockEvents: many(clockEvents),
  auditLogs: many(auditLogs),
  transactions: many(transactions),
  cartSessions: many(cartSessions),
  printJobs: many(printJobs),
  cashDrawerCounts: many(cashDrawerCounts),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.user_id],
    references: [users.id],
  }),
  terminal: one(terminals, {
    fields: [auditLogs.terminal_id],
    references: [terminals.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  business: one(businesses, {
    fields: [users.businessId],
    references: [businesses.id],
  }),
  primaryRole: one(roles, {
    fields: [users.primaryRoleId],
    references: [roles.id],
  }),
  userRoles: many(userRoles),
  userPermissions: many(userPermissions),
  sessions: many(sessions),
  auditLogs: many(auditLogs),
  shifts: many(shifts),
  schedules: many(schedules),
  transactions: many(transactions),
  stockAdjustments: many(stockAdjustments),
  stockMovements: many(stockMovements),
  discounts: many(discounts),
  printJobs: many(printJobs),
  cashDrawerCounts: many(cashDrawerCounts),
  clockEvents: many(clockEvents),
  breaks: many(breaks),
  timeCorrections: many(timeCorrections),
  timeCorrectionsRequested: many(timeCorrections, {
    relationName: "requestedBy",
  }),
  timeCorrectionsApproved: many(timeCorrections, {
    relationName: "approvedBy",
  }),
  ageVerificationsPerformed: many(ageVerificationRecords, {
    relationName: "verifiedBy",
  }),
  ageVerificationOverrides: many(ageVerificationRecords, {
    relationName: "managerOverride",
  }),
  cartSessions: many(cartSessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ----------------------------------------------------------------------------
// RBAC Relations
// ----------------------------------------------------------------------------

export const rolesRelations = relations(roles, ({ one, many }) => ({
  business: one(businesses, {
    fields: [roles.businessId],
    references: [businesses.id],
  }),
  userRoles: many(userRoles),
  primaryUsers: many(users),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
    relationName: "assignedBy",
  }),
}));

export const userPermissionsRelations = relations(
  userPermissions,
  ({ one }) => ({
    user: one(users, {
      fields: [userPermissions.userId],
      references: [users.id],
    }),
    grantedByUser: one(users, {
      fields: [userPermissions.grantedBy],
      references: [users.id],
      relationName: "grantedBy",
    }),
  })
);

// ----------------------------------------------------------------------------
// Product Catalog Relations
// ----------------------------------------------------------------------------

export const vatCategoriesRelations = relations(
  vatCategories,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [vatCategories.businessId],
      references: [businesses.id],
    }),
    categories: many(categories),
    products: many(products),
  })
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "parentCategory",
  }),
  children: many(categories, {
    relationName: "parentCategory",
  }),
  vatCategory: one(vatCategories, {
    fields: [categories.vatCategoryId],
    references: [vatCategories.id],
  }),
  business: one(businesses, {
    fields: [categories.businessId],
    references: [businesses.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  vatCategory: one(vatCategories, {
    fields: [products.vatCategoryId],
    references: [vatCategories.id],
  }),
  business: one(businesses, {
    fields: [products.businessId],
    references: [businesses.id],
  }),
  transactionItems: many(transactionItems),
  stockAdjustments: many(stockAdjustments),
  productBatches: many(productBatches),
  stockMovements: many(stockMovements),
  ageVerificationRecords: many(ageVerificationRecords),
  cartItems: many(cartItems),
}));

export const discountsRelations = relations(discounts, ({ one }) => ({
  business: one(businesses, {
    fields: [discounts.businessId],
    references: [businesses.id],
  }),
  createdByUser: one(users, {
    fields: [discounts.createdBy],
    references: [users.id],
  }),
}));

// ----------------------------------------------------------------------------
// Inventory Relations
// ----------------------------------------------------------------------------

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  business: one(businesses, {
    fields: [suppliers.businessId],
    references: [businesses.id],
  }),
  batches: many(productBatches),
}));

export const productBatchesRelations = relations(
  productBatches,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productBatches.productId],
      references: [products.id],
    }),
    supplier: one(suppliers, {
      fields: [productBatches.supplierId],
      references: [suppliers.id],
    }),
    business: one(businesses, {
      fields: [productBatches.businessId],
      references: [businesses.id],
    }),
    notifications: many(expiryNotifications),
    movements: many(stockMovements),
    fromMovements: many(stockMovements, {
      relationName: "fromBatch",
    }),
    toMovements: many(stockMovements, {
      relationName: "toBatch",
    }),
  })
);

export const expirySettingsRelations = relations(expirySettings, ({ one }) => ({
  business: one(businesses, {
    fields: [expirySettings.businessId],
    references: [businesses.id],
  }),
}));

export const salesUnitSettingsRelations = relations(
  salesUnitSettings,
  ({ one }) => ({
    business: one(businesses, {
      fields: [salesUnitSettings.businessId],
      references: [businesses.id],
    }),
  })
);

export const expiryNotificationsRelations = relations(
  expiryNotifications,
  ({ one }) => ({
    batch: one(productBatches, {
      fields: [expiryNotifications.productBatchId],
      references: [productBatches.id],
    }),
    acknowledgedByUser: one(users, {
      fields: [expiryNotifications.acknowledgedBy],
      references: [users.id],
    }),
    business: one(businesses, {
      fields: [expiryNotifications.businessId],
      references: [businesses.id],
    }),
  })
);

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  batch: one(productBatches, {
    fields: [stockMovements.batchId],
    references: [productBatches.id],
  }),
  fromBatch: one(productBatches, {
    fields: [stockMovements.fromBatchId],
    references: [productBatches.id],
    relationName: "fromBatch",
  }),
  toBatch: one(productBatches, {
    fields: [stockMovements.toBatchId],
    references: [productBatches.id],
    relationName: "toBatch",
  }),
  user: one(users, {
    fields: [stockMovements.userId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [stockMovements.businessId],
    references: [businesses.id],
  }),
}));

export const stockAdjustmentsRelations = relations(
  stockAdjustments,
  ({ one }) => ({
    product: one(products, {
      fields: [stockAdjustments.productId],
      references: [products.id],
    }),
    user: one(users, {
      fields: [stockAdjustments.userId],
      references: [users.id],
    }),
    business: one(businesses, {
      fields: [stockAdjustments.businessId],
      references: [businesses.id],
    }),
  })
);

// ----------------------------------------------------------------------------
// Sales & Transaction Relations
// ----------------------------------------------------------------------------

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    shift: one(shifts, {
      fields: [transactions.shiftId],
      references: [shifts.id],
    }),
    business: one(businesses, {
      fields: [transactions.businessId],
      references: [businesses.id],
    }),
    originalTransaction: one(transactions, {
      fields: [transactions.originalTransactionId],
      references: [transactions.id],
      relationName: "original",
    }),
    refunds: many(transactions, {
      relationName: "original",
    }),
    managerApproval: one(users, {
      fields: [transactions.managerApprovalId],
      references: [users.id],
    }),
    items: many(transactionItems),
    ageVerifications: many(ageVerificationRecords),
  })
);

export const transactionItemsRelations = relations(
  transactionItems,
  ({ one, many }) => ({
    transaction: one(transactions, {
      fields: [transactionItems.transactionId],
      references: [transactions.id],
    }),
    product: one(products, {
      fields: [transactionItems.productId],
      references: [products.id],
    }),
    batch: one(productBatches, {
      fields: [transactionItems.batchId],
      references: [productBatches.id],
    }),
    cartItem: one(cartItems, {
      fields: [transactionItems.cartItemId],
      references: [cartItems.id],
    }),
    ageVerifications: many(ageVerificationRecords),
  })
);

// ----------------------------------------------------------------------------
// Cart Relations
// ----------------------------------------------------------------------------

export const cartSessionsRelations = relations(
  cartSessions,
  ({ one, many }) => ({
    cashier: one(users, {
      fields: [cartSessions.cashierId],
      references: [users.id],
    }),
    shift: one(shifts, {
      fields: [cartSessions.shiftId],
      references: [shifts.id],
    }),
    business: one(businesses, {
      fields: [cartSessions.businessId],
      references: [businesses.id],
    }),
    verifiedByUser: one(users, {
      fields: [cartSessions.verifiedBy],
      references: [users.id],
      relationName: "cartVerifiedBy",
    }),
    items: many(cartItems),
  })
);

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cartSession: one(cartSessions, {
    fields: [cartItems.cartSessionId],
    references: [cartSessions.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  batch: one(productBatches, {
    fields: [cartItems.batchId],
    references: [productBatches.id],
  }),
}));

export const ageVerificationRecordsRelations = relations(
  ageVerificationRecords,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [ageVerificationRecords.transactionId],
      references: [transactions.id],
    }),
    transactionItem: one(transactionItems, {
      fields: [ageVerificationRecords.transactionItemId],
      references: [transactionItems.id],
    }),
    product: one(products, {
      fields: [ageVerificationRecords.productId],
      references: [products.id],
    }),
    verifiedByUser: one(users, {
      fields: [ageVerificationRecords.verifiedBy],
      references: [users.id],
      relationName: "verifiedBy",
    }),
    managerOverride: one(users, {
      fields: [ageVerificationRecords.managerOverrideId],
      references: [users.id],
      relationName: "managerOverride",
    }),
    business: one(businesses, {
      fields: [ageVerificationRecords.businessId],
      references: [businesses.id],
    }),
  })
);

// ----------------------------------------------------------------------------
// Shift Management Relations
// ----------------------------------------------------------------------------

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  staff: one(users, {
    fields: [schedules.staffId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [schedules.businessId],
    references: [businesses.id],
  }),
  shifts: many(shifts),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  user: one(users, {
    fields: [shifts.user_id],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [shifts.business_id],
    references: [businesses.id],
  }),
  schedule: one(schedules, {
    fields: [shifts.schedule_id],
    references: [schedules.id],
  }),
  clockIn: one(clockEvents, {
    fields: [shifts.clock_in_id],
    references: [clockEvents.id],
    relationName: "clockIn",
  }),
  clockOut: one(clockEvents, {
    fields: [shifts.clock_out_id],
    references: [clockEvents.id],
    relationName: "clockOut",
  }),
  breaks: many(breaks),
  transactions: many(transactions),
  cartSessions: many(cartSessions),
  cashDrawerCounts: many(cashDrawerCounts),
  shiftValidations: one(shiftValidations),
  shiftReports: one(shiftReports, {
    fields: [shifts.id],
    references: [shiftReports.shiftId],
  }),
  terminal: one(terminals, {
    fields: [shifts.terminal_id],
    references: [terminals.id],
  }),
}));

export const cashDrawerCountsRelations = relations(
  cashDrawerCounts,
  ({ one }) => ({
    shift: one(shifts, {
      fields: [cashDrawerCounts.shift_id],
      references: [shifts.id],
    }),
    countedByUser: one(users, {
      fields: [cashDrawerCounts.counted_by],
      references: [users.id],
    }),
    business: one(businesses, {
      fields: [cashDrawerCounts.business_id],
      references: [businesses.id],
    }),
    terminal: one(terminals, {
      fields: [cashDrawerCounts.terminal_id],
      references: [terminals.id],
    }),
  })
);

// ----------------------------------------------------------------------------
// Shift Validation & Reporting Relations
// ----------------------------------------------------------------------------

export const shiftValidationsRelations = relations(
  shiftValidations,
  ({ one, many }) => ({
    issues: many(shiftValidationIssues),
    shiftReport: one(shiftReports, {
      fields: [shiftValidations.shiftId],
      references: [shiftReports.shiftId],
    }),
  })
);

export const shiftValidationIssuesRelations = relations(
  shiftValidationIssues,
  ({ one }) => ({
    validation: one(shiftValidations, {
      fields: [shiftValidationIssues.validationId],
      references: [shiftValidations.id],
    }),
  })
);

export const shiftReportsRelations = relations(shiftReports, ({ one }) => ({
  shift: one(shifts, {
    fields: [shiftReports.shiftId],
    references: [shifts.id],
  }),
}));

export const attendanceReportsRelations = relations(
  attendanceReports,
  ({ one }) => ({
    user: one(users, {
      fields: [attendanceReports.userId],
      references: [users.id],
    }),
    business: one(businesses, {
      fields: [attendanceReports.businessId],
      references: [businesses.id],
    }),
  })
);

// ----------------------------------------------------------------------------
// Time Tracking Relations
// ----------------------------------------------------------------------------

export const clockEventsRelations = relations(clockEvents, ({ one, many }) => ({
  user: one(users, {
    fields: [clockEvents.user_id],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [clockEvents.business_id],
    references: [businesses.id],
  }),
  clockInShifts: many(shifts, {
    relationName: "clockIn",
  }),
  clockOutShifts: many(shifts, {
    relationName: "clockOut",
  }),

  corrections: many(timeCorrections),
  terminal: one(terminals, {
    fields: [clockEvents.terminal_id],
    references: [terminals.id],
  }),
}));

// timeShiftsRelations removed - table merged into shifts

export const breaksRelations = relations(breaks, ({ one }) => ({
  shift: one(shifts, {
    fields: [breaks.shift_id],
    references: [shifts.id],
  }),
  user: one(users, {
    fields: [breaks.user_id],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [breaks.business_id],
    references: [businesses.id],
  }),
}));

export const timeCorrectionsRelations = relations(
  timeCorrections,
  ({ one }) => ({
    clockEvent: one(clockEvents, {
      fields: [timeCorrections.clock_event_id],
      references: [clockEvents.id],
    }),
    shift: one(shifts, {
      fields: [timeCorrections.shift_id],
      references: [shifts.id],
    }),
    user: one(users, {
      fields: [timeCorrections.user_id],
      references: [users.id],
    }),
    business: one(businesses, {
      fields: [timeCorrections.business_id],
      references: [businesses.id],
    }),
    requestedByUser: one(users, {
      fields: [timeCorrections.requested_by],
      references: [users.id],
      relationName: "requestedBy",
    }),
    approvedByUser: one(users, {
      fields: [timeCorrections.approved_by],
      references: [users.id],
      relationName: "approvedBy",
    }),
  })
);

// ----------------------------------------------------------------------------
// Printing Relations
// ----------------------------------------------------------------------------

export const printJobsRelations = relations(printJobs, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [printJobs.createdBy],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [printJobs.businessId],
    references: [businesses.id],
  }),
  terminal: one(terminals, {
    fields: [printJobs.terminalId],
    references: [terminals.id],
  }),
  retries: many(printJobRetries),
}));

export const printJobRetriesRelations = relations(
  printJobRetries,
  ({ one }) => ({
    job: one(printJobs, {
      fields: [printJobRetries.jobId],
      references: [printJobs.jobId],
    }),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// RBAC types
export type Role = InferSelectModel<typeof roles>;
export type NewRole = InferInsertModel<typeof roles>;
export type UserRole = InferSelectModel<typeof userRoles>;
export type NewUserRole = InferInsertModel<typeof userRoles>;
export type UserPermission = InferSelectModel<typeof userPermissions>;
export type NewUserPermission = InferInsertModel<typeof userPermissions>;

// Category types
export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

// VatCategory types
export type VatCategory = InferSelectModel<typeof vatCategories>;
export type NewVatCategory = InferInsertModel<typeof vatCategories>;

// Business types
export type Business = InferSelectModel<typeof businesses>;
export type NewBusiness = InferInsertModel<typeof businesses>;

// User types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Product types
export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;

// Cart types
export type CartSession = InferSelectModel<typeof cartSessions>;
export type NewCartSession = InferInsertModel<typeof cartSessions>;
export type CartItem = InferSelectModel<typeof cartItems>;
export type NewCartItem = InferInsertModel<typeof cartItems>;
export type SavedBasket = InferSelectModel<typeof savedBaskets>;
export type NewSavedBasket = InferInsertModel<typeof savedBaskets>;

// Transaction types
export type Transaction = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>;
export type TransactionItem = InferSelectModel<typeof transactionItems>;
export type NewTransactionItem = InferInsertModel<typeof transactionItems>;

// Age Verification types
export type AgeVerificationRecord = InferSelectModel<
  typeof ageVerificationRecords
>;
export type NewAgeVerificationRecord = InferInsertModel<
  typeof ageVerificationRecords
>;

// Audit types
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

// Discount types
export type Discount = InferSelectModel<typeof discounts>;
export type NewDiscount = InferInsertModel<typeof discounts>;

// Stock Adjustment types
export type StockAdjustment = InferSelectModel<typeof stockAdjustments>;
export type NewStockAdjustment = InferInsertModel<typeof stockAdjustments>;

// Schedule types
export type Schedule = InferSelectModel<typeof schedules>;
export type NewSchedule = InferInsertModel<typeof schedules>;

// Shift types
export type Shift = InferSelectModel<typeof shifts>;
export type NewShift = InferInsertModel<typeof shifts>;

// Terminal types
export type Terminal = InferSelectModel<typeof terminals>;
export type NewTerminal = InferInsertModel<typeof terminals>;

// Session types
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

// Cash Drawer Count types
export type CashDrawerCount = InferSelectModel<typeof cashDrawerCounts>;
export type NewCashDrawerCount = InferInsertModel<typeof cashDrawerCounts>;

// Time Tracking types
export type ClockEvent = InferSelectModel<typeof clockEvents>;
export type NewClockEvent = InferInsertModel<typeof clockEvents>;

export type Break = InferSelectModel<typeof breaks>;
export type NewBreak = InferInsertModel<typeof breaks>;
export type TimeCorrection = InferSelectModel<typeof timeCorrections>;
export type NewTimeCorrection = InferInsertModel<typeof timeCorrections>;

// Product Expiry Tracking Types
export type ProductBatch = InferSelectModel<typeof productBatches>;
export type NewProductBatch = InferInsertModel<typeof productBatches>;
export type Supplier = InferSelectModel<typeof suppliers>;
export type NewSupplier = InferInsertModel<typeof suppliers>;
export type ExpirySetting = InferSelectModel<typeof expirySettings>;
export type NewExpirySetting = InferInsertModel<typeof expirySettings>;

export type SalesUnitSetting = InferSelectModel<typeof salesUnitSettings>;
export type NewSalesUnitSetting = InferInsertModel<typeof salesUnitSettings>;
export type ExpiryNotification = InferSelectModel<typeof expiryNotifications>;
export type NewExpiryNotification = InferInsertModel<
  typeof expiryNotifications
>;
export type StockMovement = InferSelectModel<typeof stockMovements>;
export type NewStockMovement = InferInsertModel<typeof stockMovements>;

// ============================================================================
// APP VERSION TABLE (Preserve existing table)
// ============================================================================

export const _app_version = createTable("_app_version", {
  version: text("version").primaryKey().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
