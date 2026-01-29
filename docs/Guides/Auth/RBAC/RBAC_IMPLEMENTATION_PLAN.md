# Role-Based Access Control (RBAC) Implementation Plan

## Executive Summary

This document outlines the industry-standard Role-Based Access Control (RBAC) system implementation for AuraSwift POS. The design follows **NIST RBAC standards** and enterprise security best practices.

**Status:** 🚧 Implementation Plan  
**Date:** November 27, 2025  
**Version:** 2.0

---

## Current State Analysis

### ✅ What We Have (Good Foundation)

1. **Centralized Permissions** (`packages/main/src/constants/permissions.ts`)

   - Well-defined permission constants
   - Permission groups for roles
   - Helper functions for role-to-permission mapping

2. **Permission Validation** (`packages/main/src/utils/authHelpers.ts`)

   - `hasPermission()` with wildcard support
   - `validateSessionAndPermission()` for IPC handlers
   - Audit logging integration

3. **Database Schema**
   - `users.role` - Single role per user (enum)
   - `users.permissions` - JSON array of permissions
   - Proper foreign key relationships

### ⚠️ Current Limitations

1. **Single Role Per User**

   - Users can only have ONE role (cashier, manager, admin, etc.)
   - Real-world scenario: A manager who occasionally works as cashier needs two accounts

2. **Mixed Authorization Logic**

   - Some code checks roles: `if (user.role === "cashier")`
   - Some code checks permissions: `hasPermission(user, PERMISSIONS.SALES_WRITE)`
   - Inconsistent approach across codebase

3. **Shift Requirement Hardcoded to Roles**

   - `isShiftRequired()` checks role instead of permission/capability
   - Should be a user-level setting or capability

4. **No Permission Inheritance**
   - Managers manually get list of permissions
   - No hierarchical role structure

---

## Industry-Standard RBAC Architecture

### RBAC Model: Flat RBAC with Permission Aggregation

We'll implement **NIST Level 1 Flat RBAC** which is the industry standard for most applications:

```
┌─────────────────────────────────────────────────────────────┐
│                    RBAC ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────┘

USER
  │
  ├── Has many ROLES (user_roles junction table)
  │     │
  │     └── Each ROLE has many PERMISSIONS
  │
  └── Can have additional PERMISSIONS (direct assignment)


FINAL USER PERMISSIONS = ROLE PERMISSIONS ∪ DIRECT PERMISSIONS
```

### Key Principles

1. **Permission-Based Authorization** ✅

   - Code ALWAYS checks permissions, NEVER roles
   - Roles are just permission containers

2. **Multiple Roles Per User** ✅

   - Users can have multiple roles simultaneously
   - Permissions are aggregated from all roles

3. **Role Hierarchy** (Optional - Phase 2)

   - Admin inherits all Manager permissions
   - Manager inherits all Supervisor permissions

4. **Direct Permission Assignment** ✅

   - Ability to grant specific permissions to users
   - Override or supplement role permissions

5. **Shift Requirements as Capability** ✅
   - Not tied to role, but to user preference
   - Configurable per user

---

## Database Schema Changes

### Phase 1: Core RBAC Tables

#### 1. New `roles` Table

```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT NOT NULL UNIQUE,              -- 'cashier', 'manager', 'admin'
  display_name TEXT NOT NULL,             -- 'Cashier', 'Store Manager', 'Administrator'
  description TEXT,
  business_id TEXT NOT NULL,              -- Multi-tenant support
  permissions TEXT NOT NULL,              -- JSON array: ["read:sales", "write:sales"]
  is_system_role INTEGER DEFAULT 0,       -- 1 for built-in roles, 0 for custom
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX idx_roles_business ON roles(business_id);
CREATE INDEX idx_roles_name ON roles(name);
```

**Benefits:**

- ✅ Roles are now data, not hardcoded
- ✅ Businesses can create custom roles
- ✅ Easy permission management (update role, all users get new permissions)

#### 2. New `user_roles` Junction Table

```sql
CREATE TABLE user_roles (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_by TEXT,                       -- User ID who assigned this role
  assigned_at INTEGER NOT NULL,
  expires_at INTEGER,                     -- Optional: temporary role assignment
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_user_roles_unique ON user_roles(user_id, role_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
```

**Benefits:**

- ✅ Users can have multiple roles
- ✅ Audit trail (who assigned, when)
- ✅ Temporary role assignments (e.g., acting manager)

#### 3. New `user_permissions` Table (Direct Permissions)

```sql
CREATE TABLE user_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,               -- 'read:sales', 'write:sales'
  granted_by TEXT,                        -- User ID who granted this
  granted_at INTEGER NOT NULL,
  expires_at INTEGER,                     -- Optional: temporary permission
  reason TEXT,                            -- Why was this granted?
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_user_permissions_unique ON user_permissions(user_id, permission);
CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
```

**Benefits:**

- ✅ Grant specific permissions without changing roles
- ✅ Temporary elevated access
- ✅ Audit trail

#### 4. Update `users` Table

```sql
-- Add new columns
ALTER TABLE users ADD COLUMN primary_role_id TEXT;
ALTER TABLE users ADD COLUMN shift_required INTEGER DEFAULT NULL;  -- NULL = auto-detect, 0 = no, 1 = yes
ALTER TABLE users ADD COLUMN active_role_context TEXT;            -- For UI role switcher (optional)

-- Keep existing columns for backward compatibility during migration
-- users.role (deprecated but not removed yet)
-- users.permissions (deprecated but not removed yet)
```

**Migration Strategy:**

1. Create new tables
2. Migrate existing data to new structure
3. Run dual-write period (update both old and new schema)
4. Switch reads to new schema
5. Remove old columns after validation

---

## New Permission Resolution Logic

### Algorithm: Aggregate User Permissions

```typescript
/**
 * Get all effective permissions for a user
 * Aggregates from: roles + direct permissions
 *
 * @param userId - User ID
 * @returns Array of permission strings
 */
async function getUserPermissions(userId: string): Promise<string[]> {
  const permissions = new Set<string>();

  // 1. Get permissions from all assigned roles
  const userRoles = await db.userRoles.getActiveRolesByUser(userId);

  for (const userRole of userRoles) {
    const role = await db.roles.getRoleById(userRole.roleId);

    if (role && role.isActive) {
      // Add all role permissions
      for (const permission of role.permissions) {
        permissions.add(permission);
      }
    }
  }

  // 2. Get direct permissions assigned to user
  const directPermissions = await db.userPermissions.getActivePermissionsByUser(userId);

  for (const perm of directPermissions) {
    if (perm.isActive && (!perm.expiresAt || new Date(perm.expiresAt) > new Date())) {
      permissions.add(perm.permission);
    }
  }

  return Array.from(permissions);
}
```

### Updated `hasPermission()` Function

```typescript
/**
 * Check if user has a permission (checks aggregated permissions)
 *
 * @param userId - User ID
 * @param requiredPermission - Permission to check
 * @returns Permission check result
 */
async function hasPermission(userId: string, requiredPermission: string): Promise<PermissionCheckResult> {
  // Get all user permissions (cached for performance)
  const userPermissions = await getUserPermissions(userId);

  // Check for exact match
  if (userPermissions.includes(requiredPermission)) {
    return { granted: true };
  }

  // Check for wildcard permission (*:*)
  if (userPermissions.includes("*:*")) {
    return { granted: true };
  }

  // Check for action wildcard (manage:*)
  const [action, resource] = requiredPermission.split(":");
  if (userPermissions.includes(`${action}:*`)) {
    return { granted: true };
  }

  // Check for resource wildcard (*:sales)
  if (userPermissions.includes(`*:${resource}`)) {
    return { granted: true };
  }

  return {
    granted: false,
    reason: `User lacks required permission: ${requiredPermission}`,
  };
}
```

---

## Shift Requirement as User Capability

### New Approach: User-Level Configuration

Instead of hardcoding shift requirements to roles, make it configurable per user:

```typescript
// Database schema
users.shift_required: INTEGER (NULL | 0 | 1)
  - NULL: Auto-detect based on primary role (backward compatibility)
  - 0: Shift NOT required (manual override)
  - 1: Shift REQUIRED (manual override)

// Logic
function isShiftRequired(user: User): boolean {
  // Explicit user preference takes precedence
  if (user.shiftRequired !== null) {
    return user.shiftRequired === 1;
  }

  // Fallback: auto-detect based on primary role
  const rolesRequiringShift = ["cashier", "supervisor"];
  const primaryRole = await db.roles.getRoleById(user.primaryRoleId);

  return rolesRequiringShift.includes(primaryRole?.name || "");
}
```

**Benefits:**

- ✅ Admin can optionally enforce shift on themselves
- ✅ Manager can work as cashier with shift enforcement
- ✅ Flexible per-user configuration
- ✅ Backward compatible (NULL = auto-detect)

---

## Implementation Phases

### Phase 1: Core RBAC Foundation (Week 1-2) 🎯 HIGH PRIORITY

#### Tasks

1. **Create Migration**

   - [ ] Create `roles` table
   - [ ] Create `user_roles` junction table
   - [ ] Create `user_permissions` table
   - [ ] Add new columns to `users` table

2. **Create Database Managers**

   - [ ] `RoleManager` - CRUD for roles
   - [ ] `UserRoleManager` - Assign/revoke roles
   - [ ] `UserPermissionManager` - Grant/revoke direct permissions

3. **Seed System Roles**

   - [ ] Create default roles: admin, manager, supervisor, cashier
   - [ ] Assign permissions to each role (from PERMISSION_GROUPS)

4. **Data Migration**

   - [ ] Migrate existing users to new schema
   - [ ] Map old `users.role` to `user_roles` entries
   - [ ] Create corresponding role records

5. **Update Permission Checking**

   - [ ] Implement new `getUserPermissions()` function
   - [ ] Update `hasPermission()` to use aggregated permissions
   - [ ] Add permission caching for performance

6. **Testing**
   - [ ] Unit tests for permission aggregation
   - [ ] Integration tests for role assignment
   - [ ] Migration validation tests

### Phase 2: Frontend Integration (Week 3)

#### Tasks

1. **User Management UI**

   - [ ] Role assignment interface
   - [ ] Multi-role selection UI
   - [ ] Permission viewer
   - [ ] Direct permission assignment

2. **Role Management UI**

   - [ ] Create custom roles
   - [ ] Edit role permissions
   - [ ] Role usage reports

3. **User Profile Enhancements**
   - [ ] Show all assigned roles
   - [ ] Display effective permissions
   - [ ] Shift requirement toggle

### Phase 3: Advanced Features (Week 4+)

#### Tasks

1. **Role Hierarchy** (Optional)

   - [ ] Add `parent_role_id` to roles table
   - [ ] Implement permission inheritance
   - [ ] Hierarchical permission resolution

2. **Temporal Permissions**

   - [ ] Honor `expires_at` on user_roles
   - [ ] Auto-cleanup expired assignments
   - [ ] Notification before expiry

3. **Permission Analytics**
   - [ ] Most-used permissions dashboard
   - [ ] Permission usage audit
   - [ ] Unused permission detection

---

## Code Migration Examples

### Before (Current)

```typescript
// ❌ BAD: Checking roles directly
if (user.role === "cashier") {
  return { success: false, message: "Cashiers cannot access this" };
}

// ❌ BAD: Hardcoded shift logic
const shiftRequired = ["cashier", "supervisor"].includes(user.role);

// ✅ GOOD: Already using permissions (keep this!)
const auth = await validateSessionAndPermission(db, sessionToken, PERMISSIONS.SALES_WRITE);
```

### After (RBAC)

```typescript
// ✅ ALWAYS check permissions, never roles
const hasAccess = await hasPermission(user.id, PERMISSIONS.INVENTORY_MANAGE);
if (!hasAccess.granted) {
  return { success: false, message: "Insufficient permissions" };
}

// ✅ User-specific shift requirement
const shiftRequired = await isShiftRequired(user);

// ✅ Permission-based authorization (same as before!)
const auth = await validateSessionAndPermission(db, sessionToken, PERMISSIONS.SALES_WRITE);
```

---

## Security Considerations

### 1. Permission Caching

**Problem:** Querying permissions on every request is expensive

**Solution:** Cache user permissions in session

```typescript
// When user logs in, cache their permissions
const permissions = await getUserPermissions(userId);
await redis.set(`user:${userId}:permissions`, JSON.stringify(permissions), 3600);

// On permission check, use cache
const cachedPermissions = await redis.get(`user:${userId}:permissions`);

// Invalidate cache when:
// - User roles change
// - User permissions change
// - Role permissions change
```

### 2. Audit Logging

**Log all permission changes:**

```typescript
// When assigning role
await db.audit.log({
  userId: adminId,
  action: "assign_role",
  entityType: "user_role",
  entityId: userRoleId,
  details: {
    targetUserId,
    roleId,
    roleName,
  },
});

// When granting permission
await db.audit.log({
  userId: adminId,
  action: "grant_permission",
  entityType: "user_permission",
  entityId: userPermissionId,
  details: {
    targetUserId,
    permission,
    reason,
  },
});
```

### 3. Least Privilege Principle

**Default to minimal permissions:**

```typescript
// New cashier should only get cashier role
const cashierRole = await db.roles.getRoleByName("cashier");
await db.userRoles.assignRole(userId, cashierRole.id);

// NOT: Give them admin accidentally
// ❌ await db.userRoles.assignRole(userId, adminRoleId);
```

---

## API Design

### New IPC Handlers

```typescript
// Role Management
ipcMain.handle("roles:list", async (event, sessionToken, businessId) => {
  const auth = await validateSessionAndPermission(db, sessionToken, PERMISSIONS.USERS_MANAGE);
  if (!auth.success) return auth;

  return await db.roles.getRolesByBusiness(businessId);
});

ipcMain.handle("roles:create", async (event, sessionToken, roleData) => {
  const auth = await validateSessionAndPermission(db, sessionToken, PERMISSIONS.USERS_MANAGE);
  if (!auth.success) return auth;

  return await db.roles.createRole(roleData);
});

// User Role Assignment
ipcMain.handle("users:assignRole", async (event, sessionToken, userId, roleId) => {
  const auth = await validateSessionAndPermission(db, sessionToken, PERMISSIONS.USERS_MANAGE);
  if (!auth.success) return auth;

  return await db.userRoles.assignRole(userId, roleId, auth.user.id);
});

ipcMain.handle("users:revokeRole", async (event, sessionToken, userId, roleId) => {
  const auth = await validateSessionAndPermission(db, sessionToken, PERMISSIONS.USERS_MANAGE);
  if (!auth.success) return auth;

  return await db.userRoles.revokeRole(userId, roleId);
});

// User Permissions
ipcMain.handle("users:getPermissions", async (event, sessionToken, userId) => {
  const auth = await validateSession(db, sessionToken);
  if (!auth.success) return auth;

  // Users can view their own permissions, or admin can view any
  if (auth.user.id !== userId) {
    const canManage = await hasPermission(auth.user.id, PERMISSIONS.USERS_MANAGE);
    if (!canManage.granted) {
      return { success: false, message: "Unauthorized" };
    }
  }

  const permissions = await getUserPermissions(userId);
  return { success: true, data: permissions };
});
```

---

## Benefits of This Approach

### For Solo Operators

- ✅ Can have multiple roles (manager + cashier)
- ✅ Flexible shift enforcement based on preference
- ✅ No need for multiple accounts

### For Enterprise

- ✅ Custom roles per business
- ✅ Fine-grained permission control
- ✅ Temporary access grants (acting manager)
- ✅ Comprehensive audit trail

### For Developers

- ✅ Consistent permission checking across codebase
- ✅ Easy to add new permissions
- ✅ Clear separation: roles define permissions, code checks permissions
- ✅ Database-driven (no hardcoded role logic)

### For Security

- ✅ Follows NIST RBAC standards
- ✅ Least privilege principle
- ✅ Audit trail for all permission changes
- ✅ Permission caching for performance

---

## Migration Checklist

### Database Migration

- [ ] Run migration to create new tables
- [ ] Seed system roles
- [ ] Migrate existing users to user_roles
- [ ] Validate data integrity

### Code Migration

- [ ] Update `hasPermission()` to use aggregated permissions
- [ ] Update `isShiftRequired()` to check user preference
- [ ] Remove all direct role checks (replace with permission checks)
- [ ] Update IPC handlers to use new permission system

### Frontend Migration

- [ ] Update user management forms
- [ ] Add role assignment UI
- [ ] Update permission display
- [ ] Add shift requirement toggle

### Testing

- [ ] Unit tests for permission aggregation
- [ ] Integration tests for role assignment
- [ ] E2E tests for user workflows
- [ ] Security audit

---

## Backward Compatibility

### Transition Period

During migration, support both old and new systems:

```typescript
// Get user permissions (supports both schemas)
async function getUserPermissions(user: User): Promise<string[]> {
  // NEW: Multi-role RBAC
  if (user.primaryRoleId) {
    return await getPermissionsFromRBAC(user.id);
  }

  // OLD: Single role + permissions array (fallback)
  return user.permissions || getPermissionsForRole(user.role);
}
```

### Deprecation Timeline

1. **Week 1-2:** Deploy new RBAC tables, dual-write
2. **Week 3-4:** Migrate all users, test new system
3. **Week 5:** Switch reads to new schema
4. **Week 6+:** Monitor, fix issues
5. **Week 8:** Remove old columns (after validation)

---

## Summary

This RBAC implementation follows industry best practices:

1. ✅ **Permission-based authorization** (not role-based)
2. ✅ **Multiple roles per user**
3. ✅ **Centralized permission management**
4. ✅ **Direct permission grants** (granular control)
5. ✅ **User-level capabilities** (shift requirements)
6. ✅ **Comprehensive audit trail**
7. ✅ **NIST RBAC compliant**

**Next Steps:** Review this plan, approve schema changes, and begin Phase 1 implementation.

---

**Document Version:** 2.0  
**Last Updated:** November 27, 2025  
**Author:** Development Team  
**Status:** 📋 Awaiting Approval
