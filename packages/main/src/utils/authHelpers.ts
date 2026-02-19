/**
 * Authentication and Authorization Helpers
 *
 * These utilities provide consistent session validation and permission checking
 * across all IPC handlers.
 *
 * Updated for RBAC: Permission checking now aggregates permissions from
 * multiple roles + direct grants instead of just checking user.permissions
 *
 * Usage:
 * ```typescript
 * ipcMain.handle("users:delete", async (event, sessionToken, targetUserId) => {
 *   const auth = await validateSessionAndPermission(
 *     db,
 *     sessionToken,
 *     PERMISSIONS.USERS_MANAGE
 *   );
 *
 *   if (!auth.success) {
 *     return { success: false, message: auth.message };
 *   }
 *
 *   // Proceed with operation using auth.user
 * });
 * ```
 */

import type { DatabaseManagers } from "../database/index.js";
import type { User } from "../database/schema.js";
import { getUserPermissions } from "./rbacHelpers.js";

import { getLogger } from "./logger.js";
const logger = getLogger("authHelpers");

// ============================================================================
// TYPES
// ============================================================================

export interface AuthValidationResult {
  success: boolean;
  message?: string;
  user?: User;
  code?: string;
}

export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
}

// ============================================================================
// SESSION VALIDATION
// ============================================================================

/**
 * Validate a session token and return the associated user
 *
 * @param db - Database instance
 * @param sessionToken - Session token to validate
 * @returns Validation result with user if successful
 */
export async function validateSession(
  db: DatabaseManagers,
  sessionToken: string | null | undefined
): Promise<AuthValidationResult> {
  // Check if token provided
  if (!sessionToken) {
    return {
      success: false,
      message: "Authentication required: No session token provided",
      code: "NO_SESSION",
    };
  }

  // Get session from database
  // Note: getSessionByToken() already filters expired sessions at the database level,
  // but we keep the explicit check below for defensive programming and clear error codes
  const session = await db.sessions.getSessionByToken(sessionToken);

  if (!session) {
    return {
      success: false,
      message: "Invalid session: Session not found or expired",
      code: "INVALID_SESSION",
    };
  }

  // Defensive check: Verify session hasn't expired
  // (getSessionByToken already filters expired sessions, but this provides explicit error code)
  if (new Date(session.expiresAt) < new Date()) {
    return {
      success: false,
      message: "Session expired: Please log in again",
      code: "SESSION_EXPIRED",
    };
  }

  // Get user from session
  const user = await db.users.getUserById(session.userId);

  if (!user) {
    return {
      success: false,
      message: "User not found",
      code: "USER_NOT_FOUND",
    };
  }

  // Check if user is active
  if (!user.isActive) {
    return {
      success: false,
      message: "User account is inactive",
      code: "USER_INACTIVE",
    };
  }

  return {
    success: true,
    user,
  };
}

// ============================================================================
// PERMISSION CHECKING (RBAC-enabled)
// ============================================================================

/**
 * Check if a user has a specific permission
 * RBAC: Aggregates permissions from all roles + direct grants
 *
 * @param db - Database managers (needed for RBAC permission resolution)
 * @param user - User object
 * @param requiredPermission - Permission to check (e.g., "manage:users")
 * @returns Whether user has the permission
 */
export async function hasPermission(
  db: DatabaseManagers,
  user: User,
  requiredPermission: string
): Promise<PermissionCheckResult> {
  logger.info(
    '[hasPermission] Checking permission "' +
      requiredPermission +
      '" for user ' +
      user.id
  );

  if (!user) {
    return {
      granted: false,
      reason: "User not provided",
    };
  }

  // Get aggregated permissions from RBAC system
  const userPermissions = await getUserPermissions(db, user.id);
  logger.info("[hasPermission] User " + user.id + " has permissions", {
    count: userPermissions.length,
    permissions: userPermissions,
  });

  // Check for exact match
  if (userPermissions.includes(requiredPermission)) {
    logger.info("[hasPermission] ✅ Exact match found: " + requiredPermission);
    return { granted: true };
  }

  // Check for wildcard permission (admin has all)
  if (userPermissions.includes("*:*")) {
    logger.info("[hasPermission] ✅ Wildcard *:* found - granting access");
    return { granted: true };
  }

  // Check for action wildcard (e.g., "manage:*" covers "manage:users")
  const [action, resource] = requiredPermission.split(":");
  if (userPermissions.includes(action + ":*")) {
    logger.info("[hasPermission] ✅ Action wildcard " + action + ":* found");
    return { granted: true };
  }

  // Check for resource wildcard (e.g., "*:users" covers "manage:users")
  if (userPermissions.includes("*:" + resource)) {
    logger.info(
      "[hasPermission] ✅ Resource wildcard *:" + resource + " found"
    );
    return { granted: true };
  }

  // Note: Admin fallback has been removed for security.
  // Admin users must have "*:*" permission in their role to access all resources.
  // This ensures proper RBAC enforcement and auditability.

  logger.info(
    "[hasPermission] ❌ Permission denied: " +
      requiredPermission +
      " for user " +
      user.id
  );
  return {
    granted: false,
    reason: "User lacks required permission: " + requiredPermission,
  };
}

/**
 * Check if user has ANY of the specified permissions
 * RBAC-enabled
 *
 * @param db - Database managers
 * @param user - User object
 * @param permissions - Array of permissions to check
 * @returns Whether user has at least one permission
 */
export async function hasAnyPermission(
  db: DatabaseManagers,
  user: User,
  permissions: string[]
): Promise<PermissionCheckResult> {
  for (const permission of permissions) {
    const result = await hasPermission(db, user, permission);
    if (result.granted) {
      return { granted: true };
    }
  }

  return {
    granted: false,
    reason: `User lacks any of required permissions: ${permissions.join(", ")}`,
  };
}

/**
 * Check if user has ALL of the specified permissions
 * RBAC-enabled
 *
 * @param db - Database managers
 * @param user - User object
 * @param permissions - Array of permissions to check
 * @returns Whether user has all permissions
 */
export async function hasAllPermissions(
  db: DatabaseManagers,
  user: User,
  permissions: string[]
): Promise<PermissionCheckResult> {
  for (const permission of permissions) {
    const result = await hasPermission(db, user, permission);
    if (!result.granted) {
      return {
        granted: false,
        reason: `User lacks required permission: ${permission}`,
      };
    }
  }

  return { granted: true };
}

// ============================================================================
// COMBINED VALIDATION
// ============================================================================

/**
 * Validate session AND check permission in one call
 * Most common use case for IPC handlers
 *
 * @param db - Database instance
 * @param sessionToken - Session token to validate
 * @param requiredPermission - Permission to check
 * @returns Validation result with user if successful
 */
export async function validateSessionAndPermission(
  db: DatabaseManagers,
  sessionToken: string | null | undefined,
  requiredPermission: string
): Promise<AuthValidationResult> {
  // First validate session
  const sessionValidation = await validateSession(db, sessionToken);

  if (!sessionValidation.success) {
    return sessionValidation;
  }

  const { user } = sessionValidation;

  // Then check permission (RBAC-enabled)
  const permissionCheck = await hasPermission(db, user!, requiredPermission);

  if (!permissionCheck.granted) {
    // Log unauthorized attempt
    try {
      await db.audit.createAuditLog({
        userId: user!.id,
        action: "permission_denied",
        entityType: "user",
        entityId: user!.id,
        details: {
          permission: requiredPermission,
          reason: permissionCheck.reason,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      logger.error("Failed to log permission denial:", error);
    }

    return {
      success: false,
      message: "Unauthorized: Insufficient permissions",
      code: "PERMISSION_DENIED",
    };
  }

  return {
    success: true,
    user: user!,
  };
}

/**
 * Validate session AND check if user has ANY of the permissions
 *
 * @param db - Database instance
 * @param sessionToken - Session token to validate
 * @param permissions - Array of permissions (user needs at least one)
 * @returns Validation result with user if successful
 */
export async function validateSessionAndAnyPermission(
  db: DatabaseManagers,
  sessionToken: string | null | undefined,
  permissions: string[]
): Promise<AuthValidationResult> {
  const sessionValidation = await validateSession(db, sessionToken);

  if (!sessionValidation.success) {
    return sessionValidation;
  }

  const { user } = sessionValidation;
  const permissionCheck = await hasAnyPermission(db, user!, permissions);

  if (!permissionCheck.granted) {
    return {
      success: false,
      message: "Unauthorized: Insufficient permissions",
      code: "PERMISSION_DENIED",
    };
  }

  return {
    success: true,
    user: user!,
  };
}

// ============================================================================
// ROLE CHECKING (DEPRECATED - Use RBAC instead)
// ============================================================================

/**
 * Check if user has a specific role via RBAC
 *
 * @deprecated Use permission-based checks via hasPermission() instead!
 * @param db - Database managers
 * @param user - User object
 * @param roleName - Role name to check
 * @returns Whether user has the role
 */
export async function hasRole(
  db: DatabaseManagers,
  user: User,
  roleName: string
): Promise<boolean> {
  try {
    // Get all roles for the user with role details
    const userRolesWithDetails = db.userRoles.getRolesWithDetailsForUser(
      user.id
    );

    // If no roles found, check primaryRoleId as fallback
    if (userRolesWithDetails.length === 0 && user.primaryRoleId) {
      const primaryRole = db.roles.getRoleById(user.primaryRoleId);
      if (primaryRole && primaryRole.name === roleName) {
        return true;
      }
    }

    // Check if any of the user's roles match the required role name
    for (const userRoleWithDetails of userRolesWithDetails) {
      if (
        userRoleWithDetails.role &&
        userRoleWithDetails.role.name === roleName
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error("[hasRole] Error checking role:", error);
    return false;
  }
}

/**
 * Check if user has any of the specified roles via RBAC
 *
 * @deprecated Use permission-based checks via hasPermission() instead!
 * @param db - Database managers
 * @param user - User object
 * @param roleNames - Array of role names to check
 * @returns Whether user has any of the roles
 */
export async function hasAnyRole(
  db: DatabaseManagers,
  user: User,
  roleNames: string[]
): Promise<boolean> {
  try {
    // Get all roles for the user with role details
    const userRolesWithDetails = db.userRoles.getRolesWithDetailsForUser(
      user.id
    );

    // If no roles found, check primaryRoleId as fallback
    if (userRolesWithDetails.length === 0 && user.primaryRoleId) {
      const primaryRole = db.roles.getRoleById(user.primaryRoleId);
      if (primaryRole && roleNames.includes(primaryRole.name)) {
        return true;
      }
    }

    // Check if any of the user's roles match the required role names
    for (const userRoleWithDetails of userRolesWithDetails) {
      if (
        userRoleWithDetails.role &&
        roleNames.includes(userRoleWithDetails.role.name)
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error("[hasAnyRole] Error checking roles:", error);
    return false;
  }
}

// ============================================================================
// RESOURCE OWNERSHIP
// ============================================================================

/**
 * Check if user owns a resource or has permission to access it
 * RBAC-enabled
 *
 * @param db - Database managers
 * @param user - User object
 * @param resourceOwnerId - ID of the resource owner
 * @param overridePermission - Permission that allows access regardless of ownership
 * @returns Whether user can access the resource
 */
export async function canAccessResource(
  db: DatabaseManagers,
  user: User,
  resourceOwnerId: string,
  overridePermission?: string
): Promise<boolean> {
  // User owns the resource
  if (user.id === resourceOwnerId) {
    return true;
  }

  // User has override permission (check via RBAC)
  if (overridePermission) {
    const result = await hasPermission(db, user, overridePermission);
    if (result.granted) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user can access resources within their business
 *
 * @param user - User object
 * @param resourceBusinessId - Business ID of the resource
 * @returns Whether user can access the resource
 */
export function canAccessBusinessResource(
  user: User,
  resourceBusinessId: string
): boolean {
  return user.businessId === resourceBusinessId;
}

/**
 * Validate that user can access a business resource
 * Returns validation result with specific error codes
 *
 * @param user - User object
 * @param resourceBusinessId - Business ID of the resource (null/undefined for system resources)
 * @returns Validation result with success status and error code if denied
 */
export function validateBusinessAccess(
  user: User,
  resourceBusinessId: string | null | undefined
): AuthValidationResult {
  // Allow null businessId (system resources)
  if (!resourceBusinessId) {
    return { success: true };
  }

  if (user.businessId !== resourceBusinessId) {
    logger.warn(
      `[Security] Business access violation: User ${user.id} (business ${user.businessId}) ` +
        `attempted to access resource from business ${resourceBusinessId}`
    );

    return {
      success: false,
      message: "Access denied: Resource belongs to a different business",
      code: "BUSINESS_MISMATCH",
    };
  }

  return { success: true };
}

/**
 * Combined validation: session + permission + business access
 * Most comprehensive validation for resource access
 *
 * @param db - Database managers
 * @param sessionToken - Session token to validate
 * @param requiredPermission - Permission required to access resource
 * @param resourceBusinessId - Business ID of the resource (optional)
 * @returns Validation result with user if successful
 */
export async function validateSessionPermissionAndBusiness(
  db: DatabaseManagers,
  sessionToken: string | null | undefined,
  requiredPermission: string,
  resourceBusinessId?: string
): Promise<AuthValidationResult> {
  // First validate session and permission
  const auth = await validateSessionAndPermission(
    db,
    sessionToken,
    requiredPermission
  );

  if (!auth.success) {
    return auth;
  }

  // Then validate business access if businessId provided
  if (resourceBusinessId) {
    const businessCheck = validateBusinessAccess(
      auth.user!,
      resourceBusinessId
    );

    if (!businessCheck.success) {
      // Log security event to audit trail
      try {
        await db.audit.createAuditLog({
          userId: auth.user!.id,
          action: "business_access_denied",
          entityType: "session",
          entityId: resourceBusinessId,
          details: {
            userBusinessId: auth.user!.businessId,
            attemptedBusinessId: resourceBusinessId,
            permission: requiredPermission,
            timestamp: Date.now(),
          },
        });
      } catch (auditError) {
        // Don't fail validation if audit logging fails, but log it
        logger.error(
          "[validateSessionPermissionAndBusiness] Failed to log business access denial:",
          auditError
        );
      }

      return businessCheck;
    }
  }

  return auth;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log a successful action
 *
 * @param db - Database instance
 * @param user - User who performed the action
 * @param action - Action performed
 * @param resource - Resource type
 * @param resourceId - ID of the resource
 * @param details - Additional details
 */
export async function logAction(
  db: DatabaseManagers,
  user: User,
  action: string,
  resource: string,
  resourceId?: string,
  details?: any
): Promise<void> {
  try {
    await db.audit.createAuditLog({
      userId: user.id,
      action,
      entityType: "user",
      entityId: resourceId || user.id,
      details: { ...(details || {}), resource },
    });
  } catch (error) {
    logger.error("Failed to log action:", error);
  }
}

/**
 * Log a denied action attempt
 *
 * @param db - Database instance
 * @param userId - User ID who attempted the action
 * @param action - Action attempted
 * @param resource - Resource type
 * @param reason - Reason for denial
 */
export async function logDeniedAction(
  db: DatabaseManagers,
  userId: string,
  action: string,
  resource: string,
  reason: string
): Promise<void> {
  try {
    await db.audit.createAuditLog({
      userId,
      action: `denied_${action}`,
      entityType: "user",
      entityId: userId,
      details: {
        resource,
        reason,
        timestamp: Date.now(), // Use numeric timestamp
      },
    });
  } catch (error) {
    logger.error("Failed to log denied action:", error);
  }
}

// ============================================================================
// EXAMPLES
// ============================================================================

/*

EXAMPLE 1: Basic permission check
----------------------------------
ipcMain.handle("users:delete", async (event, sessionToken, targetUserId) => {
  if (!db) db = await getDatabase();
  
  const auth = await validateSessionAndPermission(
    db,
    sessionToken,
    PERMISSIONS.USERS_MANAGE
  );
  
  if (!auth.success) {
    return { success: false, message: auth.message, code: auth.code };
  }
  
  // User is authenticated and authorized
  const result = await db.users.deleteUser(targetUserId);
  
  // Log the action
  await logAction(
    db,
    auth.user!,
    "delete",
    "users",
    targetUserId
  );
  
  return { success: true, data: result };
});


EXAMPLE 2: Multiple permissions (any)
--------------------------------------
ipcMain.handle("reports:view", async (event, sessionToken, reportType) => {
  if (!db) db = await getDatabase();
  
  // User needs either "read:reports" OR "view:analytics"
  const auth = await validateSessionAndAnyPermission(
    db,
    sessionToken,
    [PERMISSIONS.REPORTS_READ, PERMISSIONS.ANALYTICS_VIEW]
  );
  
  if (!auth.success) {
    return { success: false, message: auth.message };
  }
  
  return { success: true, data: await generateReport(reportType) };
});


EXAMPLE 3: Resource ownership check
------------------------------------
ipcMain.handle("shifts:end", async (event, sessionToken, shiftId, endData) => {
  if (!db) db = await getDatabase();
  
  const sessionValidation = await validateSession(db, sessionToken);
  if (!sessionValidation.success) {
    return { success: false, message: sessionValidation.message };
  }
  
  const { user } = sessionValidation;
  const shift = await db.shifts.getById(shiftId);
  
  if (!shift) {
    return { success: false, message: "Shift not found" };
  }
  
  // Cashier can only end their own shift
  // Manager can end any shift
  const canAccess = canAccessResource(
    user!,
    shift.cashierId,
    PERMISSIONS.SALES_WRITE // Managers have this with wider scope
  );
  
  if (!canAccess) {
    await logDeniedAction(
      db,
      user!.id,
      "end",
      "shifts",
      "User can only end their own shift"
    );
    return { success: false, message: "Cannot end another user's shift" };
  }
  
  const result = await db.shifts.endShift(shiftId, endData);
  await logAction(db, user!, "end", "shifts", shiftId);
  
  return { success: true, data: result };
});


EXAMPLE 4: Public endpoint (no auth required)
----------------------------------------------
ipcMain.handle("auth:login", async (event, credentials) => {
  if (!db) db = await getDatabase();
  
  // No authentication needed for login!
  return await db.users.login(credentials);
});


EXAMPLE 5: Role-based check (when necessary)
---------------------------------------------
ipcMain.handle("admin:systemSettings", async (event, sessionToken) => {
  if (!db) db = await getDatabase();
  
  const sessionValidation = await validateSession(db, sessionToken);
  if (!sessionValidation.success) {
    return { success: false, message: sessionValidation.message };
  }
  
  const { user } = sessionValidation;
  
  // Only actual admin role can access system settings
  if (!hasRole(user!, "admin")) {
    return { success: false, message: "Admin access required" };
  }
  
  return { success: true, data: await getSystemSettings() };
});

*/
