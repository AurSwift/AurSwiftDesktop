# Permission System - Quick Start Guide

**For Developers** 📚

This guide provides quick examples for implementing permission checks in AuraSwift.

---

## Current State Summary

### ⚠️ CRITICAL ISSUES

1. **NO backend permission checks** - All IPC handlers are open!
2. **Frontend-only authorization** - Can be bypassed via DevTools
3. **Type inconsistency** - Frontend and backend use different permission formats
4. **No audit logging** - Can't track unauthorized access attempts

### 📊 Risk Assessment

| Area               | Status          | Risk        |
| ------------------ | --------------- | ----------- |
| IPC Handlers       | ❌ Unprotected  | 🔴 Critical |
| Frontend Routes    | ⚠️ Role-only    | 🟡 Medium   |
| Session Validation | ⚠️ Partial      | 🟡 Medium   |
| Audit Logging      | ❌ Missing      | 🟠 High     |
| Permission Types   | ❌ Inconsistent | 🟡 Medium   |

---

## Quick Fixes (Do This First!) 🚨

### 1. Add Permission Check to IPC Handler

**Before:**

```typescript
ipcMain.handle("users:delete", async (event, userId) => {
  return await db.users.deleteUser(userId);
});
```

**After:**

```typescript
ipcMain.handle("users:delete", async (event, sessionToken, targetUserId) => {
  if (!db) db = await getDatabase();

  // 1. Validate session
  const session = await db.sessions.getSessionByToken(sessionToken);
  if (!session) {
    return { success: false, message: "Invalid session" };
  }

  // 2. Get user
  const user = await db.users.getUserById(session.userId);
  if (!user) {
    return { success: false, message: "User not found" };
  }

  // 3. Check permission
  if (!user.permissions.includes("manage:users")) {
    return {
      success: false,
      message: "Unauthorized: You don't have permission to delete users",
    };
  }

  // 4. Perform action
  return await db.users.deleteUser(targetUserId);
});
```

### 2. Permission Constants

Create `packages/main/src/constants/permissions.ts`:

```typescript
export const PERMISSIONS = {
  // Sales
  SALES_READ: "read:sales",
  SALES_WRITE: "write:sales",

  // Inventory
  INVENTORY_MANAGE: "manage:inventory",

  // Users
  USERS_MANAGE: "manage:users",

  // Settings
  SETTINGS_MANAGE: "manage:settings",

  // Reports
  REPORTS_READ: "read:reports",

  // Analytics
  ANALYTICS_VIEW: "view:analytics",

  // Transactions
  TRANSACTIONS_OVERRIDE: "override:transactions",
} as const;

// Usage:
if (!user.permissions.includes(PERMISSIONS.USERS_MANAGE)) {
  return { success: false, message: "Unauthorized" };
}
```

### 3. Session Validation Helper

Create `packages/main/src/utils/authHelpers.ts`:

```typescript
import type { DatabaseManagers } from "../database/index.js";

export async function validateSession(db: DatabaseManagers, sessionToken: string) {
  const session = await db.sessions.getSessionByToken(sessionToken);

  if (!session) {
    return {
      valid: false,
      error: "Invalid session",
    };
  }

  if (new Date(session.expiresAt) < new Date()) {
    return {
      valid: false,
      error: "Session expired",
    };
  }

  const user = await db.users.getUserById(session.userId);

  if (!user || !user.isActive) {
    return {
      valid: false,
      error: "User not found or inactive",
    };
  }

  return {
    valid: true,
    user,
  };
}

export function hasPermission(user: any, requiredPermission: string): boolean {
  return user.permissions.includes(requiredPermission);
}

// Usage in IPC handler:
ipcMain.handle("users:delete", async (event, sessionToken, targetUserId) => {
  if (!db) db = await getDatabase();

  const auth = await validateSession(db, sessionToken);
  if (!auth.valid) {
    return { success: false, message: auth.error };
  }

  if (!hasPermission(auth.user, PERMISSIONS.USERS_MANAGE)) {
    return { success: false, message: "Unauthorized" };
  }

  return await db.users.deleteUser(targetUserId);
});
```

---

## Protection Checklist

Use this checklist for each IPC handler:

```typescript
ipcMain.handle("your:handler", async (event, sessionToken, ...args) => {
  // ✅ 1. Initialize database
  if (!db) db = await getDatabase();

  // ✅ 2. Validate session
  const session = await db.sessions.getSessionByToken(sessionToken);
  if (!session) return { success: false, message: "Invalid session" };

  // ✅ 3. Get user
  const user = await db.users.getUserById(session.userId);
  if (!user || !user.isActive) {
    return { success: false, message: "User not found" };
  }

  // ✅ 4. Check permission
  if (!user.permissions.includes("required:permission")) {
    return { success: false, message: "Unauthorized" };
  }

  // ✅ 5. Validate input (optional)
  // Zod schema validation here

  // ✅ 6. Perform action
  const result = await db.someManager.someMethod(...args);

  // ✅ 7. Log action (optional but recommended)
  await db.audit.logAction({
    userId: user.id,
    action: "action_name",
    resource: "resource_name",
    resourceId: result.id,
  });

  // ✅ 8. Return result
  return { success: true, data: result };
});
```

---

## IPC Handlers by Permission

Map each IPC handler to required permission:

### manage:users

```typescript
✅ auth:registerBusiness   - Anyone (public)
✅ auth:register           - Admin only
✅ auth:createUser         - Admin/Manager
🔴 users:getAll            - NEEDS: manage:users
🔴 users:getStaffUsers     - NEEDS: manage:users
🔴 users:updateUser        - NEEDS: manage:users
🔴 users:deleteUser        - NEEDS: manage:users
```

### manage:inventory

```typescript
🔴 products:create         - NEEDS: manage:inventory
🔴 products:update         - NEEDS: manage:inventory
🔴 products:delete         - NEEDS: manage:inventory
🔴 products:bulkCreate     - NEEDS: manage:inventory
🔴 categories:create       - NEEDS: manage:inventory
🔴 categories:update       - NEEDS: manage:inventory
🔴 categories:delete       - NEEDS: manage:inventory
```

### read:sales / write:sales

```typescript
🟡 transactions:create     - NEEDS: write:sales
🟡 transactions:getById    - NEEDS: read:sales (own) OR read:sales (all)
🟡 transactions:getAll     - NEEDS: read:sales
```

### override:transactions

```typescript
🔴 transactions:void       - NEEDS: override:transactions
🔴 transactions:refund     - NEEDS: override:transactions
```

### manage:settings

```typescript
🔴 settings:update         - NEEDS: manage:settings
🔴 business:update         - NEEDS: manage:settings
```

### read:reports

```typescript
🔴 reports:sales           - NEEDS: read:reports
🔴 reports:inventory       - NEEDS: read:reports
🔴 reports:users           - NEEDS: read:reports
```

**Legend:**

- ✅ Already has some protection
- 🟡 Has partial protection
- 🔴 NO PROTECTION - CRITICAL!

---

## Priority Implementation Order

### Week 1: Critical Fixes

1. **User Management** (manage:users)

   - [ ] `users:updateUser`
   - [ ] `users:deleteUser`
   - [ ] `users:getAll`

2. **Settings** (manage:settings)

   - [ ] `settings:update`
   - [ ] `business:update`

3. **Transaction Overrides** (override:transactions)
   - [ ] `transactions:void`
   - [ ] `transactions:refund`

### Week 2: Important Operations

4. **Inventory Management** (manage:inventory)

   - [ ] `products:delete`
   - [ ] `products:bulkDelete`
   - [ ] `categories:delete`

5. **Reports** (read:reports)
   - [ ] `reports:financial`
   - [ ] `reports:sales`

### Week 3: Remaining Handlers

6. **All Other IPC Handlers**
   - [ ] Review and add permission checks to remaining handlers

---

## Testing Your Changes

### 1. Manual Testing Checklist

```markdown
## Test Cases for [Handler Name]

### Setup

- [ ] Create test users: admin, manager, cashier
- [ ] Get session tokens for each user

### Test 1: Admin Access

- [ ] Call handler with admin session
- [ ] ✅ Should succeed

### Test 2: Unauthorized Access

- [ ] Call handler with cashier session
- [ ] ❌ Should fail with "Unauthorized"

### Test 3: Invalid Session

- [ ] Call handler with fake session token
- [ ] ❌ Should fail with "Invalid session"

### Test 4: Expired Session

- [ ] Create session with past expiration
- [ ] ❌ Should fail with "Session expired"

### Test 5: Inactive User

- [ ] Deactivate user
- [ ] Call handler with their session
- [ ] ❌ Should fail with "User not found"
```

### 2. Automated Test Example

```typescript
// tests/integration/ipc/userManagement.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { ipcRenderer } from "electron";
import { createTestUser, createSession } from "../helpers";

describe("users:delete IPC Handler", () => {
  let adminUser, adminSession;
  let cashierUser, cashierSession;
  let targetUser;

  beforeEach(async () => {
    // Setup test users
    adminUser = await createTestUser({ role: "admin" });
    cashierUser = await createTestUser({ role: "cashier" });
    targetUser = await createTestUser({ role: "cashier" });

    adminSession = await createSession(adminUser.id);
    cashierSession = await createSession(cashierUser.id);
  });

  it("should allow admin to delete user", async () => {
    const result = await ipcRenderer.invoke("users:delete", adminSession, targetUser.id);

    expect(result.success).toBe(true);
  });

  it("should deny cashier from deleting user", async () => {
    const result = await ipcRenderer.invoke("users:delete", cashierSession, targetUser.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Unauthorized");
  });

  it("should reject invalid session", async () => {
    const result = await ipcRenderer.invoke("users:delete", "fake-session-token", targetUser.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid session");
  });
});
```

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Checking role instead of permission

```typescript
// BAD - Hardcoded role check
if (user.role !== "admin") {
  return { success: false, message: "Unauthorized" };
}

// GOOD - Permission check
if (!user.permissions.includes("manage:users")) {
  return { success: false, message: "Unauthorized" };
}
```

**Why?** Roles may change, permissions are more flexible.

### ❌ Mistake 2: Not validating session

```typescript
// BAD - Trusting userId from client
ipcMain.handle("users:delete", async (event, userId, targetUserId) => {
  // Client can send any userId!
});

// GOOD - Validate session first
ipcMain.handle("users:delete", async (event, sessionToken, targetUserId) => {
  const session = await validateSession(db, sessionToken);
  // ...
});
```

### ❌ Mistake 3: Forgetting to check user.isActive

```typescript
// BAD - Disabled users can still act
const user = await db.users.getUserById(session.userId);
if (!user) return { success: false };

// GOOD - Check if user is active
const user = await db.users.getUserById(session.userId);
if (!user || !user.isActive) {
  return { success: false, message: "User not found or inactive" };
}
```

### ❌ Mistake 4: Not logging security events

```typescript
// BAD - Silent failures
if (!hasPermission(user, "manage:users")) {
  return { success: false };
}

// GOOD - Log denied attempts
if (!hasPermission(user, "manage:users")) {
  await db.audit.logDeniedAction({
    userId: user.id,
    action: "delete",
    resource: "users",
    targetId: targetUserId,
  });
  return { success: false, message: "Unauthorized" };
}
```

---

## Frontend Permission Checks

### Current Problem

```typescript
// packages/renderer/src/shared/utils/auth.ts

// ❌ This function is WRONG!
// Database stores: ["read:sales", "write:sales"]
// But this expects: [{ action: "read", resource: "sales" }]
export function hasPermission(user: User, action: string, resource: string): boolean {
  return user.permissions.some((p) => (p.action === "*" || p.action === action) && (p.resource === "*" || p.resource === resource));
}
```

### Quick Fix

```typescript
// packages/renderer/src/shared/utils/auth.ts

/**
 * Check if user has permission
 * Permissions are stored as strings like "read:sales" or "manage:users"
 */
export function hasPermission(user: User, permission: string): boolean {
  if (!user || !user.permissions) return false;

  // Check exact match
  if (user.permissions.includes(permission)) {
    return true;
  }

  // Check wildcard
  if (user.permissions.includes("*:*")) {
    return true;
  }

  // Check partial wildcards (e.g., "manage:*")
  const [action, resource] = permission.split(":");
  if (user.permissions.includes(`${action}:*`)) {
    return true;
  }
  if (user.permissions.includes(`*:${resource}`)) {
    return true;
  }

  return false;
}

// Usage:
if (hasPermission(user, "manage:users")) {
  // Show delete button
}
```

### Permission Guard Component

```typescript
// packages/renderer/src/shared/components/permission-guard.tsx

import { useAuth } from "@/shared/hooks";
import { hasPermission } from "@/shared/utils/auth";

interface PermissionGuardProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({ permission, fallback = null, children }: PermissionGuardProps) {
  const { user } = useAuth();

  if (!user || !hasPermission(user, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage in component:
import { PermissionGuard } from "@/shared/components";

export function UserManagementView() {
  return (
    <div>
      <h1>Users</h1>

      <PermissionGuard permission="manage:users">
        <Button onClick={handleCreateUser}>Create New User</Button>
      </PermissionGuard>

      <UserTable>
        {users.map((user) => (
          <UserRow key={user.id}>
            {user.name}

            <PermissionGuard permission="manage:users">
              <Button onClick={() => handleDelete(user.id)}>Delete</Button>
            </PermissionGuard>
          </UserRow>
        ))}
      </UserTable>
    </div>
  );
}
```

### usePermission Hook

```typescript
// packages/renderer/src/shared/hooks/use-permission.ts

import { useAuth } from "./use-auth";
import { hasPermission } from "@/shared/utils/auth";

export function usePermission(permission: string): boolean {
  const { user } = useAuth();

  if (!user) return false;

  return hasPermission(user, permission);
}

// Usage:
export function UserManagementView() {
  const canManageUsers = usePermission("manage:users");
  const canDeleteUsers = usePermission("delete:users");

  return (
    <div>
      {canManageUsers && <Button onClick={handleCreate}>Create</Button>}

      {canDeleteUsers && <Button onClick={handleDelete}>Delete</Button>}
    </div>
  );
}
```

---

## Quick Reference Card

### Permission List

| Permission              | Description     | Who Has It              |
| ----------------------- | --------------- | ----------------------- |
| `read:sales`            | View sales data | Cashier, Manager, Admin |
| `write:sales`           | Create sales    | Cashier, Manager, Admin |
| `read:reports`          | View reports    | Manager, Admin          |
| `manage:inventory`      | Manage products | Manager, Admin          |
| `manage:users`          | Manage users    | Admin                   |
| `view:analytics`        | View analytics  | Manager, Admin          |
| `override:transactions` | Void/refund     | Manager, Admin          |
| `manage:settings`       | System settings | Admin                   |

### Role Permissions

**Admin:**

- All permissions (including future ones)

**Manager:**

- `read:sales`
- `write:sales`
- `read:reports`
- `manage:inventory`
- `manage:users` (can manage cashiers only)
- `view:analytics`
- `override:transactions`

**Cashier:**

- `read:sales` (own transactions only)
- `write:sales`

---

## Getting Help

### Documentation

- Full Analysis: `docs/PERMISSIONS_ANALYSIS_AND_RECOMMENDATIONS.md`
- Architecture: `docs/DATABASE_CONFIG.md`
- Audit Logs: `docs/LOGGING_BEST_PRACTICES.md`

### Examples

- IPC Handlers: `packages/main/src/appStore.ts`
- User Manager: `packages/main/src/database/managers/userManager.ts`
- Auth Utils: `packages/renderer/src/shared/utils/auth.ts`

### Testing

- Test Helpers: `tests/utils/test-helpers.ts`
- Integration Tests: `tests/integration/`
- E2E Tests: `tests/e2e.spec.ts`

---

**Last Updated:** November 26, 2025  
**Version:** 1.0
