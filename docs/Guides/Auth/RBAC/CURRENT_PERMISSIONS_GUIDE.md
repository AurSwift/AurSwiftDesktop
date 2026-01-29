# Current Permissions System - Best Practices Guide

## Quick Reference

**Status:** ✅ Currently Implemented  
**Date:** November 27, 2025  
**Approach:** Single Role + Permission-Based Authorization

---

## Core Principle

> **Always check PERMISSIONS, never check ROLES**

```typescript
// ✅ GOOD: Permission-based
if (hasPermission(user, PERMISSIONS.SALES_WRITE).granted) {
  // Allow operation
}

// ❌ BAD: Role-based
if (user.role === "manager") {
  // Allow operation
}
```

---

## Current Architecture

```
USER
  │
  ├── role: "cashier" | "supervisor" | "manager" | "admin" | "owner"
  │
  └── permissions: ["read:sales", "write:sales", ...]
                   (Auto-assigned based on role)
```

---

## Permission Constants

**Location:** `packages/main/src/constants/permissions.ts`

### Available Permissions

| Permission                          | Description                 | Risk Level |
| ----------------------------------- | --------------------------- | ---------- |
| `PERMISSIONS.SALES_READ`            | View sales transactions     | Low        |
| `PERMISSIONS.SALES_WRITE`           | Create new sales            | Medium     |
| `PERMISSIONS.REPORTS_READ`          | View reports                | Low        |
| `PERMISSIONS.ANALYTICS_VIEW`        | View analytics dashboard    | Low        |
| `PERMISSIONS.INVENTORY_MANAGE`      | Manage products & stock     | High       |
| `PERMISSIONS.USERS_MANAGE`          | Create/edit/delete users    | Critical   |
| `PERMISSIONS.TRANSACTIONS_OVERRIDE` | Void, refund transactions   | High       |
| `PERMISSIONS.SETTINGS_MANAGE`       | Change system settings      | Critical   |
| `PERMISSIONS.ALL`                   | Wildcard (admin/owner only) | Critical   |

### Permission Groups by Role

```typescript
// Admin/Owner: All permissions
PERMISSION_GROUPS.ADMIN = ["*:*"];

// Manager: Most permissions except user management
PERMISSION_GROUPS.MANAGER = ["read:sales", "write:sales", "read:reports", "view:analytics", "manage:inventory", "manage:users", "override:transactions"];

// Supervisor: Sales + reports + override
PERMISSION_GROUPS.SUPERVISOR = ["read:sales", "write:sales", "read:reports", "override:transactions"];

// Cashier: Basic sales only
PERMISSION_GROUPS.CASHIER = ["read:sales", "write:sales"];
```

---

## Authorization Helpers

**Location:** `packages/main/src/utils/authHelpers.ts`

### 1. Validate Session + Permission (Most Common)

```typescript
import { validateSessionAndPermission } from "@/utils/authHelpers";
import { PERMISSIONS } from "@/constants/permissions";

// In IPC handler
ipcMain.handle("users:delete", async (event, sessionToken, userId) => {
  const auth = await validateSessionAndPermission(db, sessionToken, PERMISSIONS.USERS_MANAGE);

  if (!auth.success) {
    return { success: false, message: auth.message, code: auth.code };
  }

  // auth.user is now available and authorized
  const result = await db.users.deleteUser(userId);

  // Log the action
  await logAction(db, auth.user, "delete", "users", userId);

  return { success: true };
});
```

### 2. Check Permission Only

```typescript
import { hasPermission } from "@/utils/authHelpers";

const result = hasPermission(user, PERMISSIONS.INVENTORY_MANAGE);

if (result.granted) {
  // User has permission
} else {
  console.log(result.reason); // "User lacks required permission: manage:inventory"
}
```

### 3. Check Multiple Permissions (ANY)

```typescript
import { hasAnyPermission } from "@/utils/authHelpers";

const result = hasAnyPermission(user, [PERMISSIONS.REPORTS_READ, PERMISSIONS.ANALYTICS_VIEW]);

if (result.granted) {
  // User has at least one permission
}
```

### 4. Check Multiple Permissions (ALL)

```typescript
import { hasAllPermissions } from "@/utils/authHelpers";

const result = hasAllPermissions(user, [PERMISSIONS.SALES_WRITE, PERMISSIONS.INVENTORY_MANAGE]);

if (result.granted) {
  // User has all permissions
}
```

---

## Shift Requirement Logic

### Current Implementation (Role-Based)

**Location:** `packages/main/src/database/managers/transactionManager.ts`

```typescript
isShiftRequired(user: User): boolean {
  return ["cashier", "supervisor"].includes(user.role);
}
```

**Frontend:** `packages/renderer/src/views/dashboard/pages/cashier/views/new-transaction/hooks/use-payment.ts`

```typescript
const shiftRequired = ["cashier", "supervisor"].includes(userRole);
```

### How It Works

| Role       | Shift Required? | Can Make Sales Without Shift? |
| ---------- | --------------- | ----------------------------- |
| cashier    | ✅ YES          | ❌ NO                         |
| supervisor | ✅ YES          | ❌ NO                         |
| manager    | ❌ NO           | ✅ YES                        |
| admin      | ❌ NO           | ✅ YES                        |
| owner      | ❌ NO           | ✅ YES                        |

---

## Common Patterns

### Pattern 1: Create Operation (Requires Permission)

```typescript
ipcMain.handle("products:create", async (event, sessionToken, productData) => {
  const auth = await validateSessionAndPermission(db, sessionToken, PERMISSIONS.INVENTORY_MANAGE);

  if (!auth.success) {
    return { success: false, message: auth.message };
  }

  const product = await db.products.create(productData);
  await logAction(db, auth.user, "create", "products", product.id);

  return { success: true, data: product };
});
```

### Pattern 2: Read Operation (Multiple Permission Options)

```typescript
ipcMain.handle("reports:sales", async (event, sessionToken) => {
  // User needs EITHER read:reports OR view:analytics
  const auth = await validateSessionAndAnyPermission(db, sessionToken, [PERMISSIONS.REPORTS_READ, PERMISSIONS.ANALYTICS_VIEW]);

  if (!auth.success) {
    return { success: false, message: auth.message };
  }

  const report = await generateSalesReport();
  return { success: true, data: report };
});
```

### Pattern 3: Resource Ownership Check

```typescript
ipcMain.handle("shifts:end", async (event, sessionToken, shiftId) => {
  const sessionValidation = await validateSession(db, sessionToken);
  if (!sessionValidation.success) {
    return { success: false, message: sessionValidation.message };
  }

  const { user } = sessionValidation;
  const shift = await db.shifts.getById(shiftId);

  // Cashiers can only end their own shift
  // Managers can end any shift (they have broader permissions)
  const canAccess = canAccessResource(
    user,
    shift.cashierId,
    PERMISSIONS.TRANSACTIONS_OVERRIDE // Managers have this
  );

  if (!canAccess) {
    await logDeniedAction(db, user.id, "end", "shifts", "Not shift owner");
    return { success: false, message: "Cannot end another user's shift" };
  }

  const result = await db.shifts.endShift(shiftId);
  await logAction(db, user, "end", "shifts", shiftId);

  return { success: true, data: result };
});
```

### Pattern 4: Public Endpoint (No Auth)

```typescript
ipcMain.handle("auth:login", async (event, credentials) => {
  // No authentication needed for login!
  return await db.users.login(credentials);
});
```

---

## Error Codes

| Code                        | Message                                       | When It Happens                 |
| --------------------------- | --------------------------------------------- | ------------------------------- |
| `NO_SESSION`                | "No session token provided"                   | Missing sessionToken parameter  |
| `INVALID_SESSION`           | "Session not found"                           | Token doesn't exist in database |
| `SESSION_EXPIRED`           | "Session expired: Please log in again"        | Token is past expiration date   |
| `USER_INACTIVE`             | "User account is inactive"                    | User account is disabled        |
| `PERMISSION_DENIED`         | "Unauthorized: Insufficient permissions"      | User lacks required permission  |
| `SHIFT_REQUIRED`            | "Shift is required for your role"             | Cashier has no active shift     |
| `SHIFT_OWNERSHIP_VIOLATION` | "You can only use your own shift"             | Cashier using wrong shift       |
| `SHIFT_INACTIVE`            | "Cannot create transaction on inactive shift" | Shift status is "ended"         |

---

## Frontend Usage

### Get Session Token

```typescript
const sessionToken = await window.authStore.get("token");
```

### Make Authenticated API Call

```typescript
const response = await window.transactionAPI.createFromCart(sessionToken, {
  cartSessionId,
  shiftId, // Optional for admin/manager
  businessId,
  paymentMethod: "cash",
  receiptNumber,
});

if (!response.success) {
  if (response.code === "SESSION_EXPIRED") {
    // Redirect to login
  } else if (response.code === "PERMISSION_DENIED") {
    toast.error("You don't have permission for this action");
  } else {
    toast.error(response.message);
  }
}
```

### Check User Role for UI (Display Only)

```typescript
const userDataStr = await window.authStore.get("user");
const userData = JSON.parse(userDataStr);

// ✅ OK: Use role for UI decisions (show/hide buttons)
if (userData.role === "admin") {
  // Show admin menu
}

// ❌ BAD: Don't use role for authorization
// Backend will still check permissions!
```

---

## Audit Logging

### Log Successful Action

```typescript
await logAction(
  db,
  user,
  "create", // action
  "transactions", // resource type
  transaction.id, // resource ID
  {
    // additional details
    shiftId: data.shiftId || "none",
    total: data.total,
    paymentMethod: data.paymentMethod,
  }
);
```

### Log Denied Action

```typescript
await logDeniedAction(
  db,
  userId,
  "delete", // action attempted
  "users", // resource type
  "Insufficient permissions" // reason
);
```

---

## Best Practices Checklist

### ✅ DO

- Always use `validateSessionAndPermission()` in IPC handlers
- Import permission constants from `PERMISSIONS`
- Check permissions, not roles
- Log all sensitive operations
- Return consistent error codes
- Use descriptive permission denial messages

### ❌ DON'T

- Don't hardcode permission strings: `"manage:users"` ❌
- Don't check `user.role === "manager"` for authorization ❌
- Don't skip session validation ❌
- Don't forget to log actions ❌
- Don't expose internal error details to frontend ❌

---

## Migration Path to Full RBAC

When ready to implement full RBAC (multi-role support), see:

- 📄 `docs/Permissions/RBAC_IMPLEMENTATION_PLAN.md`

**The current system is designed to make that migration easy:**

1. Code already checks permissions ✅
2. Permission constants are centralized ✅
3. Helper functions are abstracted ✅
4. Just need to change how permissions are resolved (from single role → from multiple roles)

---

## Summary

**Current System:**

- ✅ Single role per user
- ✅ Permissions auto-assigned based on role
- ✅ Permission-based authorization in code
- ✅ Centralized permission constants
- ✅ Comprehensive helper functions
- ✅ Full audit logging

**Key Takeaway:**

> Code checks **PERMISSIONS**, not roles. Roles just determine which permissions a user gets.

---

**Document Version:** 1.0  
**Last Updated:** November 27, 2025  
**Related Documents:**

- `RBAC_IMPLEMENTATION_PLAN.md` - Future multi-role system
- `packages/main/src/constants/permissions.ts` - Permission definitions
- `packages/main/src/utils/authHelpers.ts` - Authorization helpers
