Here's a comprehensive expiry management system for your POS using best practices:

## 🏗️ **Expiry Management Schema Design**

### 1. **Batch/Lot Tracking Table** (Core Table)

```typescript
export const productBatches = createTable(
  "product_batches",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull(), // Supplier batch number
    manufacturingDate: integer("manufacturing_date", { mode: "timestamp_ms" }),
    expiryDate: integer("expiry_date", { mode: "timestamp_ms" }).notNull(),

    // Stock tracking per batch
    initialQuantity: real("initial_quantity").notNull(),
    currentQuantity: real("current_quantity").notNull(),

    // Supplier information
    supplierId: text("supplier_id").references(() => suppliers.id),
    purchaseOrderNumber: text("purchase_order_number"),
    costPrice: real("cost_price"), // Batch-specific cost

    // Status
    status: text("status", {
      enum: ["ACTIVE", "EXPIRED", "SOLD_OUT", "REMOVED"],
    })
      .notNull()
      .default("ACTIVE"),

    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => Date.now()),
  },
  (table) => ({
    productIdx: index("batches_product_idx").on(table.productId),
    expiryIdx: index("batches_expiry_idx").on(table.expiryDate),
    statusIdx: index("batches_status_idx").on(table.status),
    businessIdx: index("batches_business_idx").on(table.businessId),
    batchNumberIdx: index("batches_number_idx").on(table.batchNumber),
  })
);
```

### 2. **Expiry Notification Settings Table**

```typescript
export const expirySettings = createTable("expiry_settings", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),

  // Notification thresholds (in days)
  criticalAlertDays: integer("critical_alert_days").notNull().default(3),
  warningAlertDays: integer("warning_alert_days").notNull().default(7),
  infoAlertDays: integer("info_alert_days").notNull().default(14),

  // Notification channels
  notifyViaEmail: integer("notify_via_email", { mode: "boolean" }).default(true),
  notifyViaPush: integer("notify_via_push", { mode: "boolean" }).default(true),
  notifyViaDashboard: integer("notify_via_dashboard", { mode: "boolean" }).default(true),

  // Auto-actions
  autoDisableExpired: integer("auto_disable_expired", { mode: "boolean" }).default(true),
  allowSellNearExpiry: integer("allow_sell_near_expiry", { mode: "boolean" }).default(false),
  nearExpiryThreshold: integer("near_expiry_threshold").default(2), // days

  // Recipients (JSON array of user IDs or roles)
  notificationRecipients: text("notification_recipients", { mode: "json" }).$type<string[]>().notNull().default([]),

  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => Date.now()),
});
```

### 3. **Expiry Notifications Log Table**

```typescript
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
    channels: text("channels", { mode: "json" }).$type<Array<"EMAIL" | "PUSH" | "DASHBOARD">>().notNull().default([]),

    // Acknowledgment
    acknowledgedBy: text("acknowledged_by").references(() => users.id),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }),

    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    batchIdx: index("notifications_batch_idx").on(table.productBatchId),
    statusIdx: index("notifications_status_idx").on(table.status),
    scheduledIdx: index("notifications_scheduled_idx").on(table.scheduledFor),
    businessIdx: index("notifications_business_idx").on(table.businessId),
  })
);
```

### 4. **Suppliers Table** (For Traceability)

```typescript
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
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => Date.now()),
  },
  (table) => ({
    businessIdx: index("suppliers_business_idx").on(table.businessId),
    nameIdx: index("suppliers_name_idx").on(table.name),
  })
);
```

## 🔄 **Updated Products Schema Additions**

```typescript
// Add these fields to your existing products table
export const products = createTable("products", {
  // ... your existing fields

  // 🔥 NEW: Expiry-related fields
  hasExpiry: integer("has_expiry", { mode: "boolean" }).default(false),
  shelfLifeDays: integer("shelf_life_days"), // Expected shelf life
  requiresBatchTracking: integer("requires_batch_tracking", { mode: "boolean" }).default(false),

  // FIFO/FEFO settings
  stockRotationMethod: text("stock_rotation_method", {
    enum: ["FIFO", "FEFO", "NONE"],
  }).default("FIFO"),

  // ... rest of your fields
});
```

## 🎯 **Business Logic Implementation**

### 5. **Stock Movement with Batch Tracking**

```typescript
export const stockMovements = createTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchId: text("batch_id").references(() => productBatches.id),
    movementType: text("movement_type", {
      enum: ["INBOUND", "OUTBOUND", "ADJUSTMENT", "TRANSFER", "WASTE"],
    }).notNull(),
    quantity: real("quantity").notNull(),
    reason: text("reason"),
    reference: text("reference"), // Sale ID, PO number, etc.

    // Batch-specific movement
    fromBatchId: text("from_batch_id").references(() => productBatches.id),
    toBatchId: text("to_batch_id").references(() => productBatches.id),

    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    productIdx: index("movements_product_idx").on(table.productId),
    batchIdx: index("movements_batch_idx").on(table.batchId),
    timestampIdx: index("movements_timestamp_idx").on(table.timestamp),
  })
);
```

## 🚀 **Notification Workflow**

### **Types for Notification Logic**

```typescript
// Type definitions for your application
export type ExpiryNotification = {
  batchId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  currentQuantity: number;
  notificationType: "INFO" | "WARNING" | "CRITICAL" | "EXPIRED";
};

export type NotificationPreference = {
  channels: Array<"EMAIL" | "PUSH" | "DASHBOARD">;
  thresholds: {
    info: number; // days
    warning: number; // days
    critical: number; // days
  };
  recipients: string[]; // user IDs or roles
};
```

## 💡 **Key Features This System Provides:**

1. **Proactive Alerts** - Notifications at multiple thresholds (14, 7, 3 days)
2. **Batch Tracking** - Trace products to specific batches
3. **Supplier Management** - Contact suppliers about soon-to-expire stock
4. **FIFO/FEFO Compliance** - Automatic stock rotation
5. **Multi-channel Notifications** - Email, push, dashboard alerts
6. **Acknowledgment Tracking** - Ensure alerts are acted upon
7. **Customizable Thresholds** - Per-business settings
8. **Expiry Analytics** - Reports on waste, expiry patterns

## 🔧 **Implementation Tips:**

- Run a daily cron job to check for expiring batches
- Use database views for expiry dashboards
- Implement batch-wise stock depletion (FIFO/FEFO)
- Add expiry reports to your management dashboard
- Consider integration with your ordering system to reduce overstocking

This system will give your clients complete visibility and control over product expiry with proactive notifications to minimize waste.
