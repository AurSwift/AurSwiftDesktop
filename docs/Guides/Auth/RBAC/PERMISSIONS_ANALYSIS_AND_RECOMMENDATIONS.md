# Permission System Analysis & Recommendations

**Date:** November 26, 2025  
**Project:** AuraSwift POS System  
**Scope:** Complete analysis of permission and authorization implementation

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Implementation Analysis](#current-implementation-analysis)
3. [Security Vulnerabilities](#security-vulnerabilities)
4. [Architecture Issues](#architecture-issues)
5. [Best Practices Recommendations](#best-practices-recommendations)
6. [Proposed Solutions](#proposed-solutions)
7. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

### Current State
The AuraSwift POS system implements a **hybrid role-permission based access control (RBAC)** system. However, the implementation has several critical gaps and architectural issues that need immediate attention.

### Key Findings

#### ✅ Strengths
- Well-defined permission types in database schema
- Separation of authentication and session management
- Use of bcrypt for password hashing
- Session token-based authentication

#### ⚠️ Critical Issues
1. **No backend permission enforcement** - IPC handlers lack permission checks
2. **Frontend-only authorization** - Easily bypassable via IPC
3. **Missing permission middleware** - No centralized enforcement layer
4. **Inconsistent permission structure** - Mix of role-based and permission-based checks
5. **No audit trail for permission changes**
6. **Hardcoded permissions** - Not configurable or extensible

### Risk Level: **HIGH** 🔴
The current implementation is vulnerable to privilege escalation and unauthorized access through IPC manipulation.

---

## Current Implementation Analysis

### 1. Database Schema

**Location:** `packages/main/src/database/schema.ts`

#### Permission Definition
```typescript
export type Permission =
  | "read:sales"
  | "write:sales"
  | "read:reports"
  | "manage:inventory"
  | "manage:users"
  | "view:analytics"
  | "override:transactions"
  | "manage:settings";
```

**Issues:**
- ❌ Permissions are string unions, not structured objects
- ❌ No granular resource-level permissions (e.g., can't specify "read:sales:own" vs "read:sales:all")
- ❌ No hierarchical permission model
- ❌ Limited to 8 hardcoded permissions

#### User Schema
```typescript
export const users = createTable("users", {
  // ... other fields
  role: text("role", {
    enum: ["cashier", "supervisor", "manager", "admin", "owner"],
  }).notNull(),
  permissions: text("permissions", { mode: "json" })
    .$type<Permission[]>()
    .notNull(),
  // ...
});
```

**Issues:**
- ❌ Permissions stored as JSON array in database (not normalized)
- ❌ Role and permissions are separate but not properly linked
- ⚠️ No validation that permissions match role
- ⚠️ "supervisor" role defined in schema but not used in seed data

### 2. Permission Assignment (Seeding)

**Location:** `packages/main/src/database/seed.ts`

```typescript
// Admin permissions
const adminPermissions: Permission[] = [
  "manage:users",
  "manage:inventory",
  "manage:settings",
  "read:sales",
  "write:sales",
  "read:reports",
  "view:analytics",
  "override:transactions",
];

// Manager permissions
const managerPermissions: Permission[] = [
  "manage:users",
  "manage:inventory",
  "read:sales",
  "write:sales",
  "read:reports",
  "override:transactions",
];

// Cashier permissions
const cashierPermissions: Permission[] = ["read:sales", "write:sales"];
```

**Issues:**
- ❌ Hardcoded permission assignments
- ❌ No database table for role-permission mappings
- ❌ Can't modify role permissions without code changes
- ❌ No permission inheritance or groups

### 3. Frontend Permission Checking

**Location:** `packages/renderer/src/shared/utils/auth.ts`

```typescript
export function hasPermission(
  user: User,
  action: string,
  resource: string
): boolean {
  return user.permissions.some(
    (p) =>
      (p.action === "*" || p.action === action) &&
      (p.resource === "*" || p.resource === resource)
  );
}
```

**Analysis:**
- ✅ Wildcard support for actions and resources
- ❌ **But:** Permission format is inconsistent with database schema
  - Database uses: `["read:sales", "write:sales"]`
  - Function expects: `{ action: "read", resource: "sales" }`
- ❌ This function appears **UNUSED** in the codebase (only 1 definition, no calls)

### 4. Route Protection

**Location:** `packages/renderer/src/views/dashboard/index.tsx`

```typescript
const role = user.role as Role;
switch (role) {
  case "admin":
    return <AdminDashboard />;
  case "manager":
    return <ManagerDashboard />;
  case "cashier":
    return <CashierDashboard />;
  default:
    return <div>Unauthorized</div>;
}
```

**Issues:**
- ❌ Pure role-based routing - ignores permission array
- ❌ No fine-grained permission checks within views
- ❌ UI components don't check permissions before rendering

### 5. Backend Permission Enforcement

**Location:** `packages/main/src/appStore.ts` (IPC Handlers)

**Critical Finding:** ⚠️ **NO PERMISSION CHECKS IN IPC HANDLERS**

Example IPC handlers with no authorization:
```typescript
// User management - should require "manage:users" permission
ipcMain.handle("users:getAll", async (event, businessId) => {
  // No permission check!
  if (!db) db = await getDatabase();
  const users = db.users.getUsersByBusiness(businessId);
  // ...
});

// Product management - should require "manage:inventory" permission
ipcMain.handle("products:create", async (event, productData) => {
  // No permission check!
  if (!db) db = await getDatabase();
  return db.products.createProduct(productData);
});

// Settings management - should require "manage:settings" permission
ipcMain.handle("settings:update", async (event, key, value) => {
  // No permission check!
  if (!db) db = await getDatabase();
  return db.settings.setSetting(key, value);
});
```

### 6. Permission Type Inconsistency

**Frontend Type:** `packages/renderer/src/views/auth/types/auth.types.ts`
```typescript
export interface Permission {
  action: string;
  resource: string;
}
```

**Backend Type:** `packages/main/src/database/schema.ts`
```typescript
export type Permission =
  | "read:sales"
  | "write:sales"
  // ... string literals
```

**Issue:** ❌ Frontend and backend have completely different permission structures!

---

## Security Vulnerabilities

### 1. **CRITICAL: IPC Permission Bypass** 🔴

**Vulnerability:** Any authenticated user can call any IPC handler regardless of permissions.

**Attack Vector:**
```typescript
// In Electron renderer process (accessible via DevTools)
window.electron.ipcRenderer.invoke('users:delete', 'admin-user-id');
window.electron.ipcRenderer.invoke('products:deleteAll');
window.electron.ipcRenderer.invoke('settings:update', 'admin_email', 'attacker@evil.com');
```

**Impact:** Complete privilege escalation - cashier can perform admin actions.

**CVSS Score:** 9.1 (Critical)

### 2. **HIGH: Frontend-Only Authorization** 🔴

**Vulnerability:** All authorization logic is in the frontend, which is client-side code.

**Attack Vector:**
- Modify frontend code to bypass role checks
- Directly invoke IPC handlers from browser console
- Use Electron DevTools to manipulate React state

**Impact:** Unauthorized access to admin/manager features.

### 3. **MEDIUM: No Session Validation in IPC Handlers** 🟡

**Vulnerability:** Most IPC handlers don't verify the session token.

**Current State:**
```typescript
ipcMain.handle("auth:validateSession", async (event, token) => {
  // Only the auth:validateSession handler checks tokens
  // Other handlers assume authentication
});
```

**Impact:** Replay attacks, session hijacking.

### 4. **MEDIUM: No Audit Trail for Permission Changes** 🟡

**Vulnerability:** No tracking of who changed user permissions or roles.

**Impact:** Cannot investigate security incidents or compliance violations.

### 5. **LOW: Permission Enumeration** 🟢

**Vulnerability:** Permission list is exposed in user object returned to frontend.

**Impact:** Attacker knows exact permission boundaries.

---

## Architecture Issues

### 1. Inconsistent Permission Model

**Problem:** Mix of two incompatible permission models:

1. **String-literal model** (Backend/Database):
   ```typescript
   ["read:sales", "write:sales", "manage:inventory"]
   ```

2. **Object model** (Frontend types):
   ```typescript
   [
     { action: "read", resource: "sales" },
     { action: "write", resource: "sales" }
   ]
   ```

**Impact:**
- `hasPermission()` utility function is unusable
- Developers confused about correct format
- Type safety is compromised

### 2. No Permission Middleware Layer

**Problem:** No centralized enforcement point.

**Current State:**
```
User → IPC Call → Direct DB Access
```

**Should Be:**
```
User → IPC Call → Permission Middleware → DB Access
```

### 3. Tight Coupling of Roles and Permissions

**Problem:** Permissions are hardcoded per role during seeding.

**Limitations:**
- Can't customize permissions per user
- Can't add new roles without code changes
- Can't implement permission inheritance
- No support for temporary permission elevation

### 4. No Resource-Level Permissions

**Problem:** Permissions are action-based only, not resource-specific.

**Example:**
```typescript
// Current: Can read ALL sales
"read:sales"

// Needed: Can read only OWN sales
"read:sales:own"
"read:sales:branch"
"read:sales:all"
```

### 5. Missing Permission Features

**Not Implemented:**
- ❌ Permission groups/roles as composable entities
- ❌ Time-based permissions (temporary access)
- ❌ Conditional permissions (e.g., "only during shift")
- ❌ Permission delegation
- ❌ Resource ownership (e.g., "manager of this store")

---

## Best Practices Recommendations

### 1. **Implement Backend Permission Enforcement** 🔴 CRITICAL

**Principle:** Never trust the client. All authorization must happen on the backend.

**Implementation:**
```typescript
// IPC Permission Middleware
async function requirePermission(
  userId: string,
  requiredPermission: string
): Promise<boolean> {
  const user = await db.users.getUserById(userId);
  if (!user) return false;
  
  return user.permissions.includes(requiredPermission);
}

// Usage in IPC handlers
ipcMain.handle("users:delete", async (event, userId, targetUserId) => {
  if (!await requirePermission(userId, "manage:users")) {
    return { success: false, message: "Unauthorized" };
  }
  // Proceed with deletion
});
```

### 2. **Normalize Permission Schema** 🔴 CRITICAL

**Create proper database tables:**

```sql
-- Roles table
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Permissions table
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,       -- read, write, delete, manage
  resource TEXT NOT NULL,     -- sales, inventory, users
  scope TEXT DEFAULT 'all',   -- all, own, branch
  description TEXT,
  UNIQUE(action, resource, scope)
);

-- Role-Permission junction table
CREATE TABLE role_permissions (
  role_id TEXT REFERENCES roles(id),
  permission_id TEXT REFERENCES permissions(id),
  granted_at TIMESTAMP,
  granted_by TEXT REFERENCES users(id),
  PRIMARY KEY (role_id, permission_id)
);

-- User-specific permission overrides
CREATE TABLE user_permission_overrides (
  user_id TEXT REFERENCES users(id),
  permission_id TEXT REFERENCES permissions(id),
  granted BOOLEAN NOT NULL,   -- TRUE = grant, FALSE = revoke
  granted_at TIMESTAMP,
  granted_by TEXT REFERENCES users(id),
  expires_at TIMESTAMP,       -- Optional: time-limited permissions
  reason TEXT,
  PRIMARY KEY (user_id, permission_id)
);
```

### 3. **Implement Permission Service Layer** 🔴 CRITICAL

**Create centralized permission checking:**

```typescript
// packages/main/src/services/permissionService.ts

export class PermissionService {
  constructor(private db: DatabaseManagers) {}

  /**
   * Check if user has permission
   * Considers: role permissions + user overrides + expiration
   */
  async hasPermission(
    userId: string,
    action: string,
    resource: string,
    scope: string = 'all',
    context?: PermissionContext
  ): Promise<boolean> {
    const user = await this.db.users.getUserById(userId);
    if (!user || !user.isActive) return false;

    // Check user overrides first (deny overrides always win)
    const override = await this.getUserPermissionOverride(
      userId, action, resource, scope
    );
    if (override !== null) return override;

    // Check role permissions
    const rolePermissions = await this.getRolePermissions(user.role);
    return this.matchPermission(rolePermissions, action, resource, scope);
  }

  /**
   * Check multiple permissions (AND logic)
   */
  async hasAllPermissions(
    userId: string,
    permissions: PermissionRequirement[]
  ): Promise<boolean> {
    for (const perm of permissions) {
      if (!await this.hasPermission(
        userId, perm.action, perm.resource, perm.scope
      )) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check multiple permissions (OR logic)
   */
  async hasAnyPermission(
    userId: string,
    permissions: PermissionRequirement[]
  ): Promise<boolean> {
    for (const perm of permissions) {
      if (await this.hasPermission(
        userId, perm.action, perm.resource, perm.scope
      )) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all effective permissions for user
   */
  async getUserEffectivePermissions(
    userId: string
  ): Promise<Permission[]> {
    // Combine role permissions + user overrides
    // Filter expired permissions
    // Return sorted list
  }

  /**
   * Audit logging for permission checks
   */
  private async logPermissionCheck(
    userId: string,
    permission: string,
    granted: boolean,
    context?: any
  ): Promise<void> {
    await this.db.audit.logPermissionCheck({
      userId,
      permission,
      granted,
      context,
      timestamp: new Date(),
    });
  }
}

export interface PermissionRequirement {
  action: string;
  resource: string;
  scope?: string;
}

export interface PermissionContext {
  resourceId?: string;
  resourceOwnerId?: string;
  shiftId?: string;
  transactionId?: string;
}
```

### 4. **Implement IPC Permission Middleware** 🔴 CRITICAL

```typescript
// packages/main/src/middleware/ipcPermissionMiddleware.ts

interface PermissionConfig {
  action: string;
  resource: string;
  scope?: string;
  skipAuth?: boolean;
}

/**
 * Decorator for IPC handlers with permission checking
 */
export function requiresPermission(config: PermissionConfig) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const [event, userId, ...restArgs] = args;

      // Skip auth for specific handlers (like login)
      if (config.skipAuth) {
        return originalMethod.apply(this, args);
      }

      // Check permission
      const permissionService = new PermissionService(db);
      const hasPermission = await permissionService.hasPermission(
        userId,
        config.action,
        config.resource,
        config.scope
      );

      if (!hasPermission) {
        console.warn(
          `Permission denied: User ${userId} attempted ${config.action}:${config.resource}`
        );
        return {
          success: false,
          message: "Unauthorized: Insufficient permissions",
          code: "PERMISSION_DENIED",
        };
      }

      // Log the authorized action
      await db.audit.logAction({
        userId,
        action: config.action,
        resource: config.resource,
        timestamp: new Date(),
      });

      // Execute the original handler
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// Usage Example:
ipcMain.handle(
  "users:delete",
  requiresPermission({ action: "delete", resource: "users" }),
  async (event, userId, targetUserId) => {
    // Permission already checked by middleware
    return await db.users.deleteUser(targetUserId);
  }
);
```

### 5. **Implement Session-Based Authorization** 🟡 HIGH

**Add session validation to all IPC handlers:**

```typescript
// packages/main/src/middleware/sessionMiddleware.ts

export async function requiresAuthentication(
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>
) {
  return async (event: IpcMainInvokeEvent, ...args: any[]) => {
    // Extract session token from first argument
    const [sessionToken, ...restArgs] = args;

    if (!sessionToken) {
      return {
        success: false,
        message: "Authentication required",
        code: "NO_SESSION",
      };
    }

    // Validate session
    const session = await db.sessions.getSessionByToken(sessionToken);
    if (!session || new Date(session.expiresAt) < new Date()) {
      return {
        success: false,
        message: "Invalid or expired session",
        code: "INVALID_SESSION",
      };
    }

    // Add userId to args for downstream use
    const userId = session.userId;
    return handler(event, userId, ...restArgs);
  };
}

// Usage:
ipcMain.handle(
  "users:getAll",
  requiresAuthentication(async (event, userId, businessId) => {
    // userId is now validated and available
    // ...
  })
);
```

### 6. **Implement Resource Ownership Checks** 🟡 HIGH

```typescript
// packages/main/src/middleware/resourceOwnership.ts

export class ResourceOwnershipService {
  constructor(private db: DatabaseManagers) {}

  /**
   * Check if user owns or has access to a resource
   */
  async canAccessResource(
    userId: string,
    resourceType: string,
    resourceId: string,
    requiredAccess: "read" | "write" | "delete"
  ): Promise<boolean> {
    const user = await this.db.users.getUserById(userId);
    if (!user) return false;

    // Admins can access everything
    if (user.role === "admin") return true;

    // Check resource-specific ownership
    switch (resourceType) {
      case "transaction":
        return this.canAccessTransaction(userId, resourceId, requiredAccess);
      case "shift":
        return this.canAccessShift(userId, resourceId, requiredAccess);
      case "report":
        return this.canAccessReport(userId, resourceId, requiredAccess);
      default:
        return false;
    }
  }

  private async canAccessTransaction(
    userId: string,
    transactionId: string,
    access: string
  ): Promise<boolean> {
    const transaction = await this.db.transactions.getById(transactionId);
    if (!transaction) return false;

    // Check if transaction belongs to user's shift
    const shift = await this.db.shifts.getById(transaction.shiftId);
    return shift?.cashierId === userId;
  }

  // Similar methods for other resources...
}
```

### 7. **Add Comprehensive Audit Logging** 🟡 MEDIUM

```typescript
// Enhanced audit logging for security events

export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  permissionChecked: string;
  permissionGranted: boolean;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  result: "success" | "failure" | "denied";
  metadata?: any;
}

// Log all permission checks
await db.audit.logSecurityEvent({
  userId,
  action: "permission_check",
  resource: "users",
  permissionChecked: "manage:users",
  permissionGranted: false,
  result: "denied",
  metadata: { attemptedAction: "delete", targetUserId: "xyz" }
});
```

### 8. **Implement Permission Caching** 🟢 LOW

```typescript
// packages/main/src/services/permissionCache.ts

export class PermissionCache {
  private cache = new Map<string, CachedPermission>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async get(
    userId: string,
    permission: string
  ): Promise<boolean | null> {
    const key = `${userId}:${permission}`;
    const cached = this.cache.get(key);

    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.granted;
  }

  set(userId: string, permission: string, granted: boolean): void {
    const key = `${userId}:${permission}`;
    this.cache.set(key, {
      granted,
      timestamp: Date.now(),
    });
  }

  invalidateUser(userId: string): void {
    // Invalidate all cached permissions for user
    for (const [key] of this.cache) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

interface CachedPermission {
  granted: boolean;
  timestamp: number;
}
```

---

## Proposed Solutions

### Solution 1: Minimum Viable Security (Quick Fix) ⚡

**Timeline:** 1-2 days  
**Effort:** Low  
**Impact:** Addresses critical vulnerabilities

#### Implementation Steps:

1. **Add Permission Validation to Critical IPC Handlers**
   ```typescript
   // Add to ALL user management handlers
   if (!user.permissions.includes("manage:users")) {
     return { success: false, message: "Unauthorized" };
   }
   ```

2. **Create Permission Constants**
   ```typescript
   // packages/main/src/constants/permissions.ts
   export const PERMISSIONS = {
     SALES_READ: "read:sales",
     SALES_WRITE: "write:sales",
     INVENTORY_MANAGE: "manage:inventory",
     USERS_MANAGE: "manage:users",
     SETTINGS_MANAGE: "manage:settings",
     REPORTS_READ: "read:reports",
     ANALYTICS_VIEW: "view:analytics",
     TRANSACTIONS_OVERRIDE: "override:transactions",
   } as const;
   ```

3. **Add Session Validation**
   ```typescript
   // Validate session in each IPC handler
   const session = await db.sessions.getSessionByToken(token);
   if (!session) {
     return { success: false, message: "Invalid session" };
   }
   ```

4. **Enable Audit Logging**
   - Log all permission denials
   - Log all sensitive operations

#### Affected Files:
- `packages/main/src/appStore.ts` - Add checks to ~50 IPC handlers
- `packages/main/src/constants/permissions.ts` - New file
- `packages/main/src/database/managers/userManager.ts` - Add validation

---

### Solution 2: Comprehensive Permission System (Recommended) 🏆

**Timeline:** 1-2 weeks  
**Effort:** Medium-High  
**Impact:** Complete security overhaul

#### Phase 1: Database Schema (Days 1-2)

1. **Create New Tables**
   ```sql
   -- See "Normalize Permission Schema" section above
   ```

2. **Migrate Existing Permissions**
   ```typescript
   // Migration script to convert string[] to relational model
   ```

3. **Add Audit Tables**
   ```sql
   CREATE TABLE permission_audit (
     id TEXT PRIMARY KEY,
     user_id TEXT,
     action TEXT,
     permission TEXT,
     granted BOOLEAN,
     timestamp TIMESTAMP,
     context TEXT
   );
   ```

#### Phase 2: Permission Service (Days 3-4)

1. **Create `PermissionService`**
   - See "Implement Permission Service Layer" above

2. **Create `ResourceOwnershipService`**
   - Implement resource-level checks

3. **Add Unit Tests**
   ```typescript
   describe("PermissionService", () => {
     it("should grant permission when user has role permission", async () => {
       // Test cases
     });

     it("should deny permission when user override revokes access", async () => {
       // Test cases
     });

     it("should respect permission expiration", async () => {
       // Test cases
     });
   });
   ```

#### Phase 3: IPC Middleware (Days 5-6)

1. **Create Middleware Layer**
   ```typescript
   // See "Implement IPC Permission Middleware" above
   ```

2. **Apply to ALL IPC Handlers**
   - Systematically add `@requiresPermission` to each handler

3. **Add Session Middleware**
   ```typescript
   // See "Implement Session-Based Authorization" above
   ```

#### Phase 4: Frontend Updates (Days 7-8)

1. **Update Permission Utility**
   ```typescript
   // Make hasPermission() actually work with API response
   export function hasPermission(
     user: User,
     permission: string
   ): boolean {
     return user.permissions.some(p => 
       p === permission || p === "*:*"
     );
   }
   ```

2. **Create Permission Guard Components**
   ```typescript
   // packages/renderer/src/shared/components/permission-guard.tsx
   export function PermissionGuard({
     permission,
     fallback,
     children,
   }: PermissionGuardProps) {
     const { user } = useAuth();
     
     if (!user || !hasPermission(user, permission)) {
       return fallback || null;
     }
     
     return <>{children}</>;
   }

   // Usage:
   <PermissionGuard permission="manage:users">
     <DeleteUserButton />
   </PermissionGuard>
   ```

3. **Add Permission Hook**
   ```typescript
   export function usePermission(permission: string): boolean {
     const { user } = useAuth();
     return user ? hasPermission(user, permission) : false;
   }

   // Usage:
   const canManageUsers = usePermission("manage:users");
   ```

#### Phase 5: Documentation & Testing (Days 9-10)

1. **Document Permission System**
   - Permission list
   - Role definitions
   - API for checking permissions
   - Examples

2. **Integration Tests**
   ```typescript
   describe("Permission System E2E", () => {
     it("should prevent cashier from accessing admin endpoints", async () => {
       // Test full flow
     });
   });
   ```

3. **Security Testing**
   - Penetration testing checklist
   - Try to bypass permission checks
   - Test privilege escalation scenarios

---

### Solution 3: Enterprise-Grade RBAC (Future Enhancement) 🚀

**Timeline:** 4-6 weeks  
**Effort:** High  
**Impact:** Full-featured permission system

#### Additional Features:

1. **Dynamic Role Creation**
   - UI for creating custom roles
   - Permission picker interface
   - Role templates

2. **Permission Groups**
   ```typescript
   interface PermissionGroup {
     id: string;
     name: string;
     permissions: string[];
     description: string;
   }

   // Example: "Store Manager" group includes all sales + inventory permissions
   ```

3. **Conditional Permissions**
   ```typescript
   interface ConditionalPermission {
     permission: string;
     conditions: PermissionCondition[];
   }

   interface PermissionCondition {
     type: "time" | "location" | "shift_status" | "resource_owner";
     operator: "equals" | "contains" | "in";
     value: any;
   }

   // Example: "Can void transactions only during own shift"
   ```

4. **Permission Delegation**
   ```typescript
   // Manager can temporarily delegate approval permissions to cashier
   await permissionService.delegatePermission({
     fromUserId: managerId,
     toUserId: cashierId,
     permission: "override:transactions",
     expiresAt: endOfShift,
     reason: "Covering manager duties",
   });
   ```

5. **Multi-Tenant Permission Isolation**
   ```typescript
   // Ensure permissions are scoped to business/location
   interface ScopedPermission {
     permission: string;
     businessId: string;
     locationId?: string;
   }
   ```

6. **Permission Analytics Dashboard**
   - Who has what permissions
   - Permission usage statistics
   - Anomaly detection (unusual permission checks)
   - Compliance reporting

---

## Implementation Roadmap

### Immediate Actions (Week 1) - CRITICAL 🔴

1. **Day 1-2: Security Audit**
   - [ ] Document all IPC handlers
   - [ ] Identify which permissions each handler requires
   - [ ] Create security risk matrix

2. **Day 3-4: Quick Wins**
   - [ ] Add permission checks to top 10 most sensitive IPC handlers:
     - `users:delete`
     - `users:update`
     - `users:create`
     - `products:delete`
     - `products:update`
     - `transactions:void`
     - `transactions:refund`
     - `settings:update`
     - `shift:forceEnd`
     - `reports:financial`
   - [ ] Add session validation to all handlers

3. **Day 5: Testing**
   - [ ] Test permission enforcement
   - [ ] Verify cannot bypass via IPC
   - [ ] Document changes

### Short-Term (Weeks 2-3) - HIGH 🟡

1. **Week 2: Permission Service**
   - [ ] Create database schema for permissions
   - [ ] Implement `PermissionService`
   - [ ] Write unit tests
   - [ ] Migrate existing permissions to new schema

2. **Week 3: IPC Middleware**
   - [ ] Create middleware system
   - [ ] Apply to all IPC handlers
   - [ ] Add comprehensive audit logging
   - [ ] Integration testing

### Medium-Term (Month 2) - MEDIUM 🟢

1. **Frontend Permission System**
   - [ ] Fix `hasPermission()` utility
   - [ ] Create `PermissionGuard` component
   - [ ] Create `usePermission` hook
   - [ ] Update all views to use permission guards

2. **Resource Ownership**
   - [ ] Implement ownership service
   - [ ] Add scope-based permissions
   - [ ] Update database queries to filter by ownership

3. **Documentation**
   - [ ] Permission system architecture doc
   - [ ] Developer guide for adding new permissions
   - [ ] User guide for permission management
   - [ ] Security best practices

### Long-Term (Month 3+) - ENHANCEMENTS 🔵

1. **Dynamic Role Management**
   - [ ] UI for role creation
   - [ ] Permission management interface
   - [ ] Role templates

2. **Advanced Features**
   - [ ] Conditional permissions
   - [ ] Permission delegation
   - [ ] Time-based access
   - [ ] Permission analytics

3. **Compliance & Auditing**
   - [ ] Compliance reporting
   - [ ] Permission change history
   - [ ] Anomaly detection
   - [ ] Automated security scans

---

## Code Examples

### Example 1: Protecting an IPC Handler

**Before:**
```typescript
ipcMain.handle("users:delete", async (event, userId) => {
  if (!db) db = await getDatabase();
  return await db.users.deleteUser(userId);
});
```

**After (Quick Fix):**
```typescript
ipcMain.handle("users:delete", async (event, sessionToken, targetUserId) => {
  if (!db) db = await getDatabase();
  
  // Validate session
  const session = await db.sessions.getSessionByToken(sessionToken);
  if (!session) {
    return { success: false, message: "Invalid session" };
  }
  
  // Get user and check permission
  const user = await db.users.getUserById(session.userId);
  if (!user || !user.permissions.includes("manage:users")) {
    await db.audit.logDeniedAction({
      userId: user?.id,
      action: "delete",
      resource: "users",
      targetId: targetUserId,
    });
    return { success: false, message: "Unauthorized" };
  }
  
  // Audit the action
  await db.audit.logAction({
    userId: user.id,
    action: "delete",
    resource: "users",
    resourceId: targetUserId,
  });
  
  // Perform deletion
  return await db.users.deleteUser(targetUserId);
});
```

**After (With Middleware):**
```typescript
ipcMain.handle(
  "users:delete",
  requiresAuth(),
  requiresPermission("manage:users"),
  auditLog("delete", "users"),
  async (event, userId, targetUserId) => {
    // All checks already done by middleware
    if (!db) db = await getDatabase();
    return await db.users.deleteUser(targetUserId);
  }
);
```

### Example 2: Frontend Permission Guard

```typescript
// packages/renderer/src/views/dashboard/pages/admin/views/user-management-view.tsx

import { PermissionGuard } from "@/shared/components";
import { usePermission } from "@/shared/hooks";

export function UserManagementView() {
  const canManageUsers = usePermission("manage:users");
  const canDeleteUsers = usePermission("delete:users");

  return (
    <div>
      <h1>User Management</h1>
      
      {/* Show/hide based on permission */}
      <PermissionGuard permission="manage:users">
        <Button onClick={handleCreateUser}>
          Create User
        </Button>
      </PermissionGuard>

      <UserTable users={users}>
        {users.map(user => (
          <UserRow key={user.id} user={user}>
            {/* Conditionally render delete button */}
            {canDeleteUsers && (
              <Button onClick={() => handleDelete(user.id)}>
                Delete
              </Button>
            )}
          </UserRow>
        ))}
      </UserTable>

      {/* Show message if no permission */}
      <PermissionGuard 
        permission="manage:users"
        fallback={<NoAccessMessage />}
      >
        <SensitiveSettings />
      </PermissionGuard>
    </div>
  );
}
```

### Example 3: Resource Ownership Check

```typescript
// packages/main/src/services/permissionService.ts

export class PermissionService {
  async canAccessShift(
    userId: string,
    shiftId: string,
    action: "read" | "write" | "delete"
  ): Promise<boolean> {
    const user = await this.db.users.getUserById(userId);
    if (!user) return false;

    // Admins can access all shifts
    if (user.role === "admin") return true;

    // Managers can access all shifts in their business
    if (user.role === "manager" && action === "read") {
      const shift = await this.db.shifts.getById(shiftId);
      return shift?.businessId === user.businessId;
    }

    // Cashiers can only access their own shifts
    const shift = await this.db.shifts.getById(shiftId);
    if (action === "read") {
      return shift?.cashierId === userId;
    }

    // Writing/deleting requires manager or above
    if (action === "write" || action === "delete") {
      return user.role === "manager" || user.role === "admin";
    }

    return false;
  }
}

// Usage in IPC handler:
ipcMain.handle("shifts:end", async (event, userId, shiftId, endData) => {
  const permissionService = new PermissionService(db);
  
  if (!await permissionService.canAccessShift(userId, shiftId, "write")) {
    return { success: false, message: "Cannot end another cashier's shift" };
  }
  
  return await db.shifts.endShift(shiftId, endData);
});
```

---

## Testing Strategy

### 1. Unit Tests

```typescript
// tests/unit/main/permissionService.test.ts

describe("PermissionService", () => {
  let db: DatabaseManagers;
  let permissionService: PermissionService;

  beforeEach(async () => {
    db = await getTestDatabase();
    permissionService = new PermissionService(db);
  });

  describe("hasPermission", () => {
    it("should grant permission when user has role permission", async () => {
      const user = await createTestUser({ role: "admin" });
      const result = await permissionService.hasPermission(
        user.id,
        "manage",
        "users"
      );
      expect(result).toBe(true);
    });

    it("should deny permission when user lacks role permission", async () => {
      const user = await createTestUser({ role: "cashier" });
      const result = await permissionService.hasPermission(
        user.id,
        "manage",
        "users"
      );
      expect(result).toBe(false);
    });

    it("should respect user permission overrides (revoke)", async () => {
      const user = await createTestUser({ role: "admin" });
      
      // Revoke permission
      await db.userPermissions.revokePermission(
        user.id,
        "manage:users",
        "security_audit"
      );

      const result = await permissionService.hasPermission(
        user.id,
        "manage",
        "users"
      );
      expect(result).toBe(false);
    });

    it("should respect permission expiration", async () => {
      const user = await createTestUser({ role: "cashier" });
      
      // Grant temporary permission
      await db.userPermissions.grantTemporaryPermission(
        user.id,
        "override:transactions",
        new Date(Date.now() - 1000) // Expired 1 second ago
      );

      const result = await permissionService.hasPermission(
        user.id,
        "override",
        "transactions"
      );
      expect(result).toBe(false);
    });

    it("should match wildcard permissions", async () => {
      const user = await createTestUser({
        role: "admin",
        permissions: ["*:*"]
      });

      const result = await permissionService.hasPermission(
        user.id,
        "any_action",
        "any_resource"
      );
      expect(result).toBe(true);
    });
  });

  describe("Resource Ownership", () => {
    it("should allow cashier to access own shift", async () => {
      const user = await createTestUser({ role: "cashier" });
      const shift = await createTestShift({ cashierId: user.id });

      const result = await permissionService.canAccessShift(
        user.id,
        shift.id,
        "read"
      );
      expect(result).toBe(true);
    });

    it("should deny cashier access to other's shift", async () => {
      const user1 = await createTestUser({ role: "cashier" });
      const user2 = await createTestUser({ role: "cashier" });
      const shift = await createTestShift({ cashierId: user2.id });

      const result = await permissionService.canAccessShift(
        user1.id,
        shift.id,
        "read"
      );
      expect(result).toBe(false);
    });

    it("should allow manager to access all shifts in business", async () => {
      const manager = await createTestUser({
        role: "manager",
        businessId: "biz-1"
      });
      const cashier = await createTestUser({
        role: "cashier",
        businessId: "biz-1"
      });
      const shift = await createTestShift({
        cashierId: cashier.id,
        businessId: "biz-1"
      });

      const result = await permissionService.canAccessShift(
        manager.id,
        shift.id,
        "read"
      );
      expect(result).toBe(true);
    });
  });
});
```

### 2. Integration Tests

```typescript
// tests/integration/permissionEnforcement.test.ts

describe("IPC Permission Enforcement", () => {
  let db: DatabaseManagers;
  let adminUser: User;
  let managerUser: User;
  let cashierUser: User;
  let adminSession: string;
  let cashierSession: string;

  beforeEach(async () => {
    db = await getTestDatabase();
    
    adminUser = await createTestUser({ role: "admin" });
    managerUser = await createTestUser({ role: "manager" });
    cashierUser = await createTestUser({ role: "cashier" });
    
    adminSession = await db.sessions.createSession(adminUser.id);
    cashierSession = await db.sessions.createSession(cashierUser.id);
  });

  describe("User Management", () => {
    it("should allow admin to delete users", async () => {
      const targetUser = await createTestUser({ role: "cashier" });
      
      const result = await ipcRenderer.invoke(
        "users:delete",
        adminSession,
        targetUser.id
      );

      expect(result.success).toBe(true);
    });

    it("should deny cashier from deleting users", async () => {
      const targetUser = await createTestUser({ role: "cashier" });
      
      const result = await ipcRenderer.invoke(
        "users:delete",
        cashierSession,
        targetUser.id
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unauthorized");
    });

    it("should deny access with invalid session", async () => {
      const result = await ipcRenderer.invoke(
        "users:delete",
        "invalid-session-token",
        "user-id"
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_SESSION");
    });
  });

  describe("Audit Logging", () => {
    it("should log denied permission attempts", async () => {
      const targetUser = await createTestUser({ role: "cashier" });
      
      await ipcRenderer.invoke(
        "users:delete",
        cashierSession,
        targetUser.id
      );

      const auditLogs = await db.audit.getLogsByUser(cashierUser.id);
      const deniedLog = auditLogs.find(
        log => log.action === "delete" && log.resource === "users"
      );

      expect(deniedLog).toBeDefined();
      expect(deniedLog.result).toBe("denied");
    });
  });
});
```

### 3. Security Tests (Penetration Testing Checklist)

```markdown
## Permission System Security Checklist

### Authentication Bypass
- [ ] ✅ Cannot call IPC handlers without valid session
- [ ] ✅ Cannot reuse expired session tokens
- [ ] ✅ Cannot forge session tokens
- [ ] ✅ Session expires after timeout
- [ ] ✅ Session invalidated on logout

### Authorization Bypass
- [ ] ✅ Cannot access admin endpoints as cashier
- [ ] ✅ Cannot access manager endpoints as cashier
- [ ] ✅ Cannot modify permissions via IPC
- [ ] ✅ Cannot elevate own role via API
- [ ] ✅ Cannot access other users' data

### Resource Access
- [ ] ✅ Cashier can only access own shifts
- [ ] ✅ Cashier can only access own transactions
- [ ] ✅ Manager can access team's data but not other businesses
- [ ] ✅ Cannot access soft-deleted records

### Permission Tampering
- [ ] ✅ Cannot modify user permissions via frontend
- [ ] ✅ Cannot grant permissions without authorization
- [ ] ✅ Permission changes are audited
- [ ] ✅ Permission cache invalidates on user update

### IPC Security
- [ ] ✅ All sensitive IPC handlers require authentication
- [ ] ✅ All sensitive IPC handlers check permissions
- [ ] ✅ IPC handlers validate input data
- [ ] ✅ IPC handlers sanitize output data
- [ ] ✅ IPC handlers log security events

### Audit Trail
- [ ] ✅ Failed login attempts are logged
- [ ] ✅ Permission denials are logged
- [ ] ✅ Permission grants/revokes are logged
- [ ] ✅ Sensitive operations are logged
- [ ] ✅ Logs include context (IP, user agent, etc.)
```

---

## Compliance Considerations

### GDPR Compliance

1. **Right to Access**
   - Users can request their permission history
   - Audit logs show all data access

2. **Right to be Forgotten**
   - When deleting users, handle permission references
   - Anonymize audit logs

3. **Data Minimization**
   - Only log necessary permission check data
   - Don't log sensitive data in audit trail

### PCI DSS Compliance (Payment Card Industry)

For POS systems handling payments:

1. **Requirement 7: Restrict Access**
   - ✅ Implement role-based access control
   - ✅ Assign unique ID to each user
   - ✅ Default deny-all unless explicitly granted

2. **Requirement 10: Track and Monitor Access**
   - ✅ Audit trail for all access to cardholder data
   - ✅ Log permission changes
   - ✅ Implement automated audit log review

### SOX Compliance (Financial Reporting)

For businesses with financial reporting requirements:

1. **Access Controls**
   - ✅ Segregation of duties
   - ✅ Prevent users from initiating and approving transactions
   - ✅ Audit trail for financial data access

2. **Change Management**
   - ✅ Document permission changes
   - ✅ Approval workflow for role modifications

---

## Migration Guide

### Migrating from Current to New Permission System

#### Step 1: Backup Current State

```typescript
// scripts/migrate-permissions-backup.ts

export async function backupCurrentPermissions(db: DatabaseManagers) {
  const users = await db.users.getAllUsers();
  const backup = {
    timestamp: new Date().toISOString(),
    users: users.map(user => ({
      id: user.id,
      role: user.role,
      permissions: user.permissions,
    })),
  };

  await fs.writeFile(
    `backups/permissions-backup-${Date.now()}.json`,
    JSON.stringify(backup, null, 2)
  );

  console.log(`Backed up permissions for ${users.length} users`);
}
```

#### Step 2: Create New Permission Tables

```typescript
// Run migration
await db.runMigration("008_permission_system.sql");
```

#### Step 3: Seed Permission Data

```typescript
// scripts/migrate-permissions-seed.ts

export async function seedPermissions(db: DatabaseManagers) {
  // Create roles
  await db.roles.createRole({
    id: "role-admin",
    name: "admin",
    description: "System Administrator",
    isSystem: true,
  });

  await db.roles.createRole({
    id: "role-manager",
    name: "manager",
    description: "Store Manager",
    isSystem: true,
  });

  await db.roles.createRole({
    id: "role-cashier",
    name: "cashier",
    description: "Cashier",
    isSystem: true,
  });

  // Create permissions
  const permissions = [
    { action: "read", resource: "sales", scope: "all" },
    { action: "write", resource: "sales", scope: "all" },
    { action: "read", resource: "sales", scope: "own" },
    { action: "write", resource: "sales", scope: "own" },
    { action: "manage", resource: "inventory", scope: "all" },
    { action: "manage", resource: "users", scope: "all" },
    { action: "manage", resource: "settings", scope: "all" },
    { action: "read", resource: "reports", scope: "all" },
    { action: "view", resource: "analytics", scope: "all" },
    { action: "override", resource: "transactions", scope: "all" },
  ];

  for (const perm of permissions) {
    await db.permissions.createPermission(perm);
  }

  // Assign permissions to roles
  await db.rolePermissions.assignPermissionToRole(
    "role-admin",
    "*:*:*" // Admin gets all permissions
  );

  // Manager permissions
  const managerPermissions = [
    "read:sales:all",
    "write:sales:all",
    "manage:inventory:all",
    "manage:users:all",
    "read:reports:all",
    "override:transactions:all",
  ];
  for (const perm of managerPermissions) {
    await db.rolePermissions.assignPermissionToRole("role-manager", perm);
  }

  // Cashier permissions
  const cashierPermissions = [
    "read:sales:own",
    "write:sales:own",
  ];
  for (const perm of cashierPermissions) {
    await db.rolePermissions.assignPermissionToRole("role-cashier", perm);
  }
}
```

#### Step 4: Migrate User Permissions

```typescript
// scripts/migrate-permissions-users.ts

export async function migrateUserPermissions(db: DatabaseManagers) {
  const users = await db.users.getAllUsers();

  for (const user of users) {
    // Users now get permissions from their role
    // No need to copy permission array

    // If user had custom permissions beyond their role,
    // create user-specific overrides
    const rolePermissions = await db.rolePermissions.getPermissionsForRole(
      user.role
    );
    const userPermissions = user.permissions;

    // Find permissions user has that aren't in their role
    const extraPermissions = userPermissions.filter(
      perm => !rolePermissions.includes(perm)
    );

    if (extraPermissions.length > 0) {
      console.log(
        `User ${user.id} has ${extraPermissions.length} custom permissions`
      );
      
      for (const perm of extraPermissions) {
        await db.userPermissions.grantPermissionOverride(
          user.id,
          perm,
          "migration",
          "Migrated from old permission system"
        );
      }
    }
  }

  console.log(`Migrated permissions for ${users.length} users`);
}
```

#### Step 5: Test Migration

```typescript
// scripts/test-migration.ts

export async function testMigration(db: DatabaseManagers) {
  const permissionService = new PermissionService(db);

  // Test cases
  const tests = [
    {
      username: "admin",
      permission: "manage:users",
      expected: true,
    },
    {
      username: "cashier",
      permission: "manage:users",
      expected: false,
    },
    {
      username: "manager",
      permission: "override:transactions",
      expected: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const user = await db.users.getUserByUsername(test.username);
    const [action, resource] = test.permission.split(":");
    const result = await permissionService.hasPermission(
      user.id,
      action,
      resource
    );

    if (result === test.expected) {
      passed++;
      console.log(`✅ ${test.username} - ${test.permission}: PASS`);
    } else {
      failed++;
      console.log(
        `❌ ${test.username} - ${test.permission}: FAIL (expected ${test.expected}, got ${result})`
      );
    }
  }

  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}
```

#### Step 6: Deploy

```typescript
// scripts/deploy-permission-system.ts

export async function deployPermissionSystem() {
  const db = await getDatabase();

  console.log("🚀 Deploying new permission system...");

  try {
    // 1. Backup
    console.log("1️⃣ Backing up current permissions...");
    await backupCurrentPermissions(db);

    // 2. Create tables
    console.log("2️⃣ Creating new database tables...");
    await db.runMigration("008_permission_system.sql");

    // 3. Seed data
    console.log("3️⃣ Seeding permission data...");
    await seedPermissions(db);

    // 4. Migrate users
    console.log("4️⃣ Migrating user permissions...");
    await migrateUserPermissions(db);

    // 5. Test
    console.log("5️⃣ Testing migration...");
    const testsPassed = await testMigration(db);

    if (!testsPassed) {
      throw new Error("Migration tests failed");
    }

    console.log("✅ Permission system deployed successfully!");
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    console.log("Rolling back...");
    // Rollback logic here
    throw error;
  }
}
```

---

## Monitoring & Maintenance

### Key Metrics to Track

1. **Permission Check Performance**
   ```typescript
   // Log permission check duration
   const startTime = Date.now();
   const hasPermission = await permissionService.hasPermission(/*...*/);
   const duration = Date.now() - startTime;

   if (duration > 100) {
     console.warn(`Slow permission check: ${duration}ms`);
   }
   ```

2. **Permission Denial Rate**
   - Track how often permissions are denied
   - Alert if denial rate spikes (potential attack)

3. **Permission Cache Hit Rate**
   - Monitor cache effectiveness
   - Tune cache TTL based on hit rate

4. **Audit Log Growth**
   - Monitor audit log size
   - Implement log rotation/archival

### Health Checks

```typescript
// packages/main/src/services/permissionHealthCheck.ts

export class PermissionHealthCheck {
  constructor(private db: DatabaseManagers) {}

  async runHealthCheck(): Promise<HealthCheckResult> {
    const issues: string[] = [];

    // Check 1: All users have valid roles
    const usersWithInvalidRoles = await this.findUsersWithInvalidRoles();
    if (usersWithInvalidRoles.length > 0) {
      issues.push(
        `${usersWithInvalidRoles.length} users have invalid roles`
      );
    }

    // Check 2: No users with excessive permissions
    const usersWithExcessivePermissions =
      await this.findUsersWithExcessivePermissions();
    if (usersWithExcessivePermissions.length > 0) {
      issues.push(
        `${usersWithExcessivePermissions.length} users have excessive permissions`
      );
    }

    // Check 3: Permission cache is functioning
    const cacheHealth = await this.checkCacheHealth();
    if (!cacheHealth.healthy) {
      issues.push(`Permission cache unhealthy: ${cacheHealth.reason}`);
    }

    // Check 4: Audit logs are being written
    const auditHealth = await this.checkAuditHealth();
    if (!auditHealth.healthy) {
      issues.push(`Audit logging unhealthy: ${auditHealth.reason}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      timestamp: new Date(),
    };
  }
}
```

---

## Conclusion

### Summary of Recommendations

1. **Immediate (Critical)**
   - ✅ Add permission validation to all IPC handlers
   - ✅ Implement session-based authorization
   - ✅ Enable comprehensive audit logging
   - ✅ Fix permission type inconsistency

2. **Short-term (High Priority)**
   - ✅ Create normalized permission database schema
   - ✅ Implement `PermissionService` layer
   - ✅ Build IPC middleware system
   - ✅ Add resource-level permission checks

3. **Medium-term (Important)**
   - ✅ Fix frontend `hasPermission()` utility
   - ✅ Create permission guard components
   - ✅ Implement permission caching
   - ✅ Comprehensive testing and documentation

4. **Long-term (Enhancement)**
   - ✅ Dynamic role management UI
   - ✅ Conditional permissions
   - ✅ Permission delegation
   - ✅ Analytics and monitoring

### Expected Outcomes

After implementing these recommendations:

1. **Security**
   - ✅ Eliminate privilege escalation vulnerabilities
   - ✅ Prevent unauthorized access to sensitive operations
   - ✅ Complete audit trail for compliance

2. **Maintainability**
   - ✅ Centralized permission logic
   - ✅ Easy to add new permissions
   - ✅ Clear separation of concerns

3. **Scalability**
   - ✅ Support for custom roles
   - ✅ Flexible permission assignment
   - ✅ Multi-tenant ready

4. **User Experience**
   - ✅ Consistent permission enforcement
   - ✅ Clear error messages
   - ✅ Intuitive permission management UI

### Next Steps

1. **Review this document** with the development team
2. **Prioritize** recommendations based on business needs
3. **Create tickets** for each implementation phase
4. **Schedule security audit** after implementation
5. **Plan training** for developers on new permission system

---

## Appendix

### A. Permission List Reference

| Permission | Description | Roles |
|------------|-------------|-------|
| `read:sales` | View sales transactions | Cashier, Manager, Admin |
| `write:sales` | Create new sales transactions | Cashier, Manager, Admin |
| `read:reports` | View reports and analytics | Manager, Admin |
| `manage:inventory` | Add/edit/delete products | Manager, Admin |
| `manage:users` | Create/edit/delete users | Admin |
| `view:analytics` | Access analytics dashboard | Manager, Admin |
| `override:transactions` | Void/refund transactions | Manager, Admin |
| `manage:settings` | Change system settings | Admin |

### B. Role Hierarchy

```
admin (owner)
  ├─ All permissions
  └─ Can create other admins

manager
  ├─ Team management
  ├─ Inventory control
  ├─ Reports & analytics
  └─ Transaction overrides

supervisor (future)
  ├─ Limited team oversight
  └─ Transaction approvals

cashier
  ├─ Process sales
  └─ View own transactions
```

### C. Glossary

- **RBAC**: Role-Based Access Control
- **Permission**: A specific action on a specific resource
- **Role**: A collection of permissions
- **Principal**: The entity (user) requesting access
- **Resource**: The entity being accessed
- **Action**: The operation being performed
- **Scope**: The boundaries of access (own, team, all)
- **Permission Override**: User-specific permission grant/revoke
- **Audit Trail**: Chronological record of system activities

### D. References

- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [NIST RBAC Standard](https://csrc.nist.gov/projects/role-based-access-control)
- [PCI DSS Requirements](https://www.pcisecuritystandards.org/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)

---

**Document Version:** 1.0  
**Last Updated:** November 26, 2025  
**Author:** Security Audit Team  
**Review Status:** Pending Review

