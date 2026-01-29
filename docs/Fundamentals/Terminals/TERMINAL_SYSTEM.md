# Terminal System Documentation

## Overview

The Terminal system in AuraSwift represents physical or logical devices/workstations that are authorized to access the POS system. Terminals are used to track which device performed transactions, manage hardware configurations, and support multi-station operations.

### Quick Answer: Windows EPOS + iPhone Payment Terminal

**If you have:**

- **Windows PC** running AuraSwift EPOS software
- **iPhone** with Viva Wallet terminal app for card payments

**Then:**

- ✅ **Windows PC = POS Terminal** (stored in `terminals` table)

  - This is the workstation running your EPOS software
  - Used to track which device performed sales, shifts, etc.
  - Type: `"pos"` or `"server"`

- ✅ **iPhone with Viva Wallet = Payment Terminal** (stored in VivaWallet config)
  - This is the device that processes card payments
  - Discovered via network scanning
  - Used only for payment processing

**They are separate but work together:**

- POS Terminal (Windows PC) handles the EPOS operations
- Payment Terminal (iPhone) handles card payment processing
- They communicate over the network during checkout

## Table of Contents

1. [Database Schema](#database-schema)
2. [Terminal Types](#terminal-types)
3. [Terminal Status](#terminal-status)
4. [Relationships](#relationships)
5. [Usage Patterns](#usage-patterns)
6. [Hardware Configuration](#hardware-configuration)
7. [VivaWallet Integration](#vivawallet-integration)
8. [Best Practices](#best-practices)

---

## Database Schema

### Table Definition

The `terminals` table is defined in `packages/main/src/database/schema.ts`:

```typescript
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
  (table) => [index("terminals_business_idx").on(table.business_id), index("terminals_status_idx").on(table.status), index("terminals_token_idx").on(table.device_token)]
);
```

### Schema Fields

| Field            | Type        | Required | Description                                                                    |
| ---------------- | ----------- | -------- | ------------------------------------------------------------------------------ |
| `id`             | `text`      | Yes      | Primary key (UUID)                                                             |
| `business_id`    | `text`      | Yes      | Foreign key to `businesses` table                                              |
| `name`           | `text`      | Yes      | Human-readable name (e.g., "Front Counter 1")                                  |
| `type`           | `enum`      | Yes      | Terminal type (see [Terminal Types](#terminal-types))                          |
| `status`         | `enum`      | Yes      | Terminal status (see [Terminal Status](#terminal-status))                      |
| `device_token`   | `text`      | No       | Unique token for API authentication                                            |
| `ip_address`     | `text`      | No       | Network IP address of the terminal                                             |
| `mac_address`    | `text`      | No       | MAC address for device identification                                          |
| `settings`       | `json`      | No       | Hardware configuration (see [Hardware Configuration](#hardware-configuration)) |
| `last_active_at` | `timestamp` | No       | Last time the terminal was active                                              |
| `created_at`     | `timestamp` | Yes      | Record creation timestamp                                                      |
| `updated_at`     | `timestamp` | Yes      | Last update timestamp                                                          |

### Indexes

- **`terminals_business_idx`**: Index on `business_id` for fast business-based queries
- **`terminals_status_idx`**: Index on `status` for filtering by status
- **`terminals_token_idx`**: Unique index on `device_token` for authentication lookups

---

## Terminal Types

Terminals can be one of the following types:

| Type              | Description                     | Use Case                                       |
| ----------------- | ------------------------------- | ---------------------------------------------- |
| `pos`             | Standard Point of Sale terminal | Main checkout counter, cash register           |
| `kiosk`           | Self-service kiosk              | Customer self-checkout stations                |
| `handheld`        | Mobile/handheld device          | Floor sales, table service, inventory scanning |
| `kitchen_display` | Kitchen display system          | Order display for kitchen staff                |
| `server`          | Server/backend terminal         | Administrative tasks, reporting                |

**Default Type**: `pos`

---

## Terminal Status

Terminals can have the following statuses:

| Status           | Description                     | Behavior                                           |
| ---------------- | ------------------------------- | -------------------------------------------------- |
| `active`         | Terminal is operational         | Can process transactions, accept connections       |
| `inactive`       | Terminal is disabled            | Cannot process transactions, but data is preserved |
| `maintenance`    | Terminal is under maintenance   | Temporarily unavailable, maintenance mode          |
| `decommissioned` | Terminal is permanently removed | Historical record only, cannot be reactivated      |

**Default Status**: `active`

---

## Relationships

### Foreign Key Relationships

Terminals are referenced by the following tables:

#### 1. **Transactions** (`transactions.terminal_id`)

- **Relationship**: Optional (nullable)
- **Purpose**: Track which terminal processed each transaction
- **Usage**: Reporting, audit trails, terminal-specific sales analysis

```typescript
terminalId: text("terminal_id").references(() => terminals.id),
```

#### 2. **Cart Sessions** (`cart_sessions.terminal_id`)

- **Relationship**: Optional (nullable)
- **Purpose**: Associate active shopping carts with specific terminals
- **Usage**: Multi-station cart management, cart recovery

```typescript
terminal_id: text("terminal_id").references(() => terminals.id),
```

#### 3. **Shifts** (`shifts.terminal_id`)

- **Relationship**: Optional (nullable)
- **Purpose**: Track which terminal a shift is associated with
- **Usage**: Terminal-specific shift reporting, cash drawer management

```typescript
terminal_id: text("terminal_id").references(() => terminals.id),
```

#### 4. **Clock Events** (`clock_events.terminal_id`)

- **Relationship**: Required (not null)
- **Purpose**: Record which terminal was used for clock in/out
- **Usage**: Attendance tracking, location-based time tracking

```typescript
terminal_id: text("terminal_id")
  .notNull()
  .references(() => terminals.id),
```

#### 5. **Cash Drawer Counts** (`cash_drawer_counts.terminal_id`)

- **Relationship**: Optional (nullable)
- **Purpose**: Associate cash counts with specific terminals
- **Usage**: Terminal-specific cash reconciliation

```typescript
terminal_id: text("terminal_id").references(() => terminals.id),
```

#### 6. **Audit Logs** (`audit_logs.terminal_id`)

- **Relationship**: Optional (nullable)
- **Purpose**: Track which terminal performed audit actions
- **Usage**: Security auditing, compliance reporting

```typescript
terminal_id: text("terminal_id").references(() => terminals.id),
```

#### 7. **Print Jobs** (`print_jobs.terminal_id`)

- **Relationship**: Optional (nullable)
- **Purpose**: Associate print jobs with terminals
- **Usage**: Terminal-specific printer management

```typescript
terminalId: text("terminal_id").references(() => terminals.id),
```

### Business Relationship

- **Parent**: `businesses` (many-to-one)
- **Cascade Delete**: When a business is deleted, all associated terminals are deleted
- **Multi-tenancy**: Each terminal belongs to exactly one business

---

## Usage Patterns

### 1. Transaction Tracking

Terminals are used to track which device processed each transaction:

```typescript
// Creating a transaction with terminal reference
const transaction = {
  // ... other fields
  terminalId: currentTerminal.id,
  businessId: business.id,
  // ...
};
```

**Benefits**:

- Terminal-specific sales reporting
- Device-level performance metrics
- Troubleshooting transaction issues
- Multi-location tracking

### 2. Shift Management

Terminals are associated with shifts to track which workstation a user is operating:

```typescript
// Creating a shift with terminal
const shift = {
  user_id: userId,
  business_id: businessId,
  terminal_id: terminalId, // Optional
  clock_in_id: clockInEvent.id,
  // ...
};
```

**Use Cases**:

- Terminal-specific shift reports
- Cash drawer assignment per terminal
- Workstation productivity tracking

### 3. Cart Session Management

Cart sessions can be associated with terminals for multi-station operations:

```typescript
// Creating a cart session
const cartSession = {
  cashierId: userId,
  businessId: businessId,
  terminal_id: terminalId, // Optional
  // ...
};
```

**Benefits**:

- Cart recovery by terminal
- Multi-station cart management
- Terminal-specific cart analytics

### 4. Clock Events

Every clock in/out event must be associated with a terminal:

```typescript
// Creating a clock event
const clockEvent = {
  user_id: userId,
  business_id: businessId,
  terminal_id: terminalId, // Required
  type: "in" | "out",
  // ...
};
```

**Purpose**:

- Location-based attendance tracking
- Terminal usage analytics
- Compliance reporting

### 5. Default Terminal Seeding

On database initialization, a default terminal is created:

```typescript
// From packages/main/src/database/seed.ts
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
```

---

## Hardware Configuration

The `settings` field stores JSON configuration for terminal hardware:

### Settings Structure

```typescript
interface TerminalSettings {
  printer?: {
    enabled: boolean;
    name?: string;
    type?: "thermal" | "office";
    // ... printer-specific config
  };
  scanner?: {
    enabled: boolean;
    type?: "barcode" | "qr";
    // ... scanner-specific config
  };
  scale?: {
    enabled: boolean;
    port?: string;
    baudRate?: number;
    // ... scale-specific config
  };
  cardReader?: {
    enabled: boolean;
    type?: "viva_wallet" | "other";
    // ... card reader config
  };
}
```

### Example Settings

```json
{
  "printer": {
    "enabled": true,
    "name": "Thermal Printer",
    "type": "thermal"
  },
  "scanner": {
    "enabled": true,
    "type": "barcode"
  },
  "scale": {
    "enabled": true,
    "port": "COM3",
    "baudRate": 9600
  },
  "cardReader": {
    "enabled": true,
    "type": "viva_wallet"
  }
}
```

---

## VivaWallet Integration

### Important Distinction: POS Terminals vs Payment Terminals

There are **two different types of terminals** in the system:

#### 1. **POS Terminals** (AuraSwift Terminals)

- **Definition**: Workstations/devices that run the EPOS software
- **Stored in**: `terminals` database table
- **Purpose**: Track which workstation performed POS operations
- **Example**: Windows PC running AuraSwift, tablet running POS app

#### 2. **Payment Terminals** (VivaWallet Terminals)

- **Definition**: Devices that process card payments
- **Stored in**: VivaWallet configuration (separate from database)
- **Purpose**: Handle card payment transactions
- **Example**: iPhone with Viva Wallet app, dedicated payment terminal hardware

### Real-World Scenario

**Example Setup:**

- **Windows PC** running AuraSwift EPOS software
- **iPhone** with Viva Wallet terminal app for card payments

**In this scenario:**

1. **Windows PC = POS Terminal**

   ```typescript
   // This would be a record in the terminals table
   {
     id: "pos-terminal-1",
     name: "Main Counter - Windows PC",
     type: "pos",
     business_id: "business-123",
     ip_address: "192.168.1.50", // Windows PC IP
     mac_address: "AA:BB:CC:DD:EE:FF",
     settings: {
       printer: { enabled: true },
       // ... other POS hardware config
     }
   }
   ```

2. **iPhone with Viva Wallet = Payment Terminal**
   ```typescript
   // This would be in VivaWallet configuration
   {
     id: "viva-terminal-1",
     name: "iPhone Payment Terminal",
     ipAddress: "192.168.1.100", // iPhone IP on same network
     port: 8080,
     terminalType: "device-based",
     deviceInfo: {
       platform: "ios",
       deviceModel: "iPhone 14",
       osVersion: "17.0"
     },
     paymentCapabilities: {
       supportsNFC: true,
       supportsTap: true,
       // ...
     }
   }
   ```

### How They Work Together

1. **Customer checkout happens on Windows PC (POS Terminal)**

   - Cashier enters items in AuraSwift
   - Transaction is created with `terminal_id` = Windows PC terminal ID

2. **Payment processing happens on iPhone (Payment Terminal)**

   - AuraSwift sends payment request to iPhone via network
   - iPhone processes card payment using Viva Wallet app
   - Payment result is sent back to Windows PC

3. **Transaction is recorded**
   - Transaction record includes `terminal_id` = Windows PC (POS terminal)
   - Payment details reference the VivaWallet payment terminal

### Terminal Discovery

The VivaWallet service discovers payment terminals on the local network:

```typescript
// From packages/main/src/services/vivaWallet/terminal-discovery.ts
interface Terminal {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  status: "online" | "offline" | "busy";
  terminalType: "dedicated" | "device-based";
  deviceInfo?: {
    platform: "android" | "ios" | "paydroid";
    deviceModel?: string;
    osVersion?: string;
  };
  // ... VivaWallet-specific properties
}
```

### Payment Terminal Types

VivaWallet payment terminals can be:

- **Dedicated Terminals**: Physical payment terminal hardware
- **Device-based Terminals**: Mobile devices (iPhone, Android) acting as payment terminals

### Linking POS and Payment Terminals

While they're separate systems, you can link them through configuration:

```typescript
// POS Terminal settings can reference payment terminal
{
  id: "pos-terminal-1",
  name: "Main Counter",
  settings: {
    cardReader: {
      enabled: true,
      type: "viva_wallet",
      paymentTerminalId: "viva-terminal-1", // Link to VivaWallet terminal
      ipAddress: "192.168.1.100"
    }
  }
}
```

**Key Points:**

- ✅ **POS Terminal** = The workstation running your EPOS software (Windows PC)
- ✅ **Payment Terminal** = The device processing card payments (iPhone with Viva Wallet)
- ✅ They work together but are tracked separately
- ✅ One POS terminal can use multiple payment terminals
- ✅ Multiple POS terminals can share the same payment terminal

---

## Best Practices

### 1. Terminal Naming

Use descriptive, consistent naming:

- ✅ Good: `"Front Counter 1"`, `"Drive-Through Window"`, `"Handheld #3"`
- ❌ Bad: `"Terminal"`, `"POS"`, `"Device 1"`

### 2. Terminal Status Management

- Set terminals to `maintenance` when performing updates
- Use `inactive` for temporarily disabled terminals
- Only use `decommissioned` when permanently removing terminals
- Update `last_active_at` when terminals are used

### 3. Multi-Station Operations

- Assign unique terminals for each physical workstation
- Use terminal IDs to track device-specific operations
- Maintain terminal-specific hardware configurations

### 4. Security

- Use `device_token` for API authentication
- Store sensitive configuration in `settings` JSON field
- Validate terminal access based on `business_id`

### 5. Network Configuration

- Store `ip_address` for network-based services (VivaWallet, printers)
- Use `mac_address` for device identification
- Keep network information updated

### 6. Hardware Settings

- Store hardware configuration in `settings` JSON field
- Validate settings structure before saving
- Provide defaults for missing settings

### 7. Terminal Lifecycle

1. **Create**: When setting up a new workstation
2. **Activate**: Set status to `active` when ready
3. **Maintain**: Set to `maintenance` during updates
4. **Deactivate**: Set to `inactive` if temporarily disabled
5. **Decommission**: Set to `decommissioned` when permanently removed

---

## TypeScript Types

### Terminal Type

```typescript
export type Terminal = InferSelectModel<typeof terminals>;
export type NewTerminal = InferInsertModel<typeof terminals>;
```

### Usage Example

```typescript
import type { Terminal, NewTerminal } from "@app/main/src/database/schema";

// Creating a new terminal
const newTerminal: NewTerminal = {
  id: uuidv4(),
  business_id: businessId,
  name: "Front Counter 1",
  type: "pos",
  status: "active",
  device_token: uuidv4(),
  ip_address: "192.168.1.100",
  settings: JSON.stringify({
    printer: { enabled: true },
  }),
};

// Querying terminals
const terminal: Terminal = await db.query.terminals.findFirst({
  where: eq(terminals.id, terminalId),
});
```

---

## Database Relations

### Terminal Relations

```typescript
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
```

---

## Migration Notes

### Initial Migration

The terminals table is created in migration `0000_friendly_sunset_bain.sql`:

```sql
CREATE TABLE `terminals` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `name` text NOT NULL,
  `type` text DEFAULT 'pos' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `device_token` text,
  `ip_address` text,
  `mac_address` text,
  `settings` text,
  `last_active_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`)
    ON UPDATE no action ON DELETE cascade
);
```

---

## Summary

Terminals are a core component of the AuraSwift POS system, providing:

1. **Device Tracking**: Identify which device performed each operation
2. **Multi-Station Support**: Enable multiple workstations per business
3. **Hardware Configuration**: Store device-specific settings
4. **Audit Trail**: Track terminal usage for compliance
5. **Reporting**: Terminal-specific analytics and reporting
6. **Integration**: Support for payment terminals (VivaWallet) and other hardware

Terminals are referenced throughout the system in transactions, shifts, cart sessions, clock events, and more, making them essential for multi-device POS operations.
