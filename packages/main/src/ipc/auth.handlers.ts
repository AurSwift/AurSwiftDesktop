import { ipcMain, safeStorage } from "electron";
import { type DatabaseManagers, getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import type { User } from "../database/schema.js";
import {
  validateSession,
  validateSessionAndPermission,
  validateBusinessAccess,
  logAction,
} from "../utils/authHelpers.js";
import { invalidateUserPermissionCache } from "../utils/rbacHelpers.js";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
} from "../utils/rateLimiter.js";

const logger = getLogger("authHandlers");

// Check if encryption is available (done once at module load)
const isEncryptionAvailable = safeStorage.isEncryptionAvailable();

if (!isEncryptionAvailable) {
  logger.warn(
    "⚠️  Safe storage encryption not available on this platform! " +
      "Tokens will be stored in plaintext. Consider using a different encryption method."
  );
}

// Keys that should be encrypted
const ENCRYPTED_KEYS = ["token", "user", "refreshToken"];

// IMPORTANT: Don't cache database reference at module level!
// After database import, the old reference becomes stale (connection closed).
// Always use getDatabase() to get the current singleton instance.

export function registerAuthHandlers() {
  ipcMain.handle("auth:set", async (event, key: string, value: string) => {
    try {
      // Always get fresh database reference to avoid stale connection issues
      const db = await getDatabase();

      // Determine if this key should be encrypted
      const shouldEncrypt = ENCRYPTED_KEYS.includes(key);

      let storedValue = value;
      let isEncrypted = false;

      // Encrypt sensitive data if encryption is available
      if (shouldEncrypt && isEncryptionAvailable) {
        try {
          const buffer = safeStorage.encryptString(value);
          // Store as base64 to save in text field
          storedValue = buffer.toString("base64");
          isEncrypted = true;

          // Mark as encrypted for later decryption
          db.settings.setSetting(`${key}_encrypted`, "true");
        } catch (encryptError) {
          logger.error(
            `Failed to encrypt ${key}, storing in plaintext:`,
            encryptError
          );
          // Fallback to plaintext if encryption fails
          isEncrypted = false;
        }
      }

      // Store the value (encrypted or plaintext)
      db.settings.setSetting(key, storedValue);

      if (shouldEncrypt && !isEncrypted) {
        logger.warn(
          `⚠️  Storing ${key} in plaintext (encryption unavailable or failed)`
        );
      }

      return true;
    } catch (error) {
      logger.error("Error setting auth data:", error);
      return false;
    }
  });

  ipcMain.handle("auth:get", async (event, key: string) => {
    try {
      const db = await getDatabase();

      const value = db.settings.getSetting(key);

      if (!value) return null;

      // Check if this was encrypted
      const isEncrypted = db.settings.getSetting(`${key}_encrypted`) === "true";

      // Decrypt if needed
      if (isEncrypted && isEncryptionAvailable) {
        try {
          const buffer = Buffer.from(value, "base64");
          const decrypted = safeStorage.decryptString(buffer);
          return decrypted;
        } catch (decryptError) {
          logger.error(`Failed to decrypt ${key}:`, decryptError);
          // If decryption fails, return null (data is corrupted)
          return null;
        }
      }

      // Return plaintext value
      return value;
    } catch (error) {
      logger.error("Error getting auth data:", error);
      return null;
    }
  });

  ipcMain.handle("auth:delete", async (event, key: string) => {
    try {
      const db = await getDatabase();

      // Delete both the value and encryption marker
      db.settings.deleteSetting(key);
      db.settings.deleteSetting(`${key}_encrypted`);

      return true;
    } catch (error) {
      logger.error("Error deleting auth data:", error);
      return false;
    }
  });

  // Authentication API handlers
  ipcMain.handle("auth:register", async (event, userData) => {
    try {
      const db = await getDatabase();
      return await db.users.register(userData);
    } catch (error) {
      logger.error("Registration IPC error:", error);
      return {
        success: false,
        message: "Registration failed due to server error",
      };
    }
  });

  // Register business owner (automatically sets role to admin)
  ipcMain.handle("auth:registerBusiness", async (event, userData) => {
    try {
      const db = await getDatabase();
      // Business owners are automatically admin users
      const registrationData = {
        ...userData,
        role: "admin" as const,
      };

      return await db.users.register(registrationData);
    } catch (error) {
      logger.error("Business registration IPC error:", error);
      return {
        success: false,
        message: "Business registration failed due to server error",
      };
    }
  });

  ipcMain.handle("auth:login", async (event, credentials) => {
    try {
      const db = await getDatabase();

      // Rate limiting: Check if login attempts are allowed
      // For desktop EPOS: Use terminal ID + username combination
      // This prevents one compromised terminal from affecting others
      const username = credentials.username || "";
      const terminalId = credentials.terminalId || "unknown";
      const rateLimitCheck = checkRateLimit(username, "username", terminalId);

      if (!rateLimitCheck.allowed) {
        logger.warn(
          `[Login] Rate limit exceeded for username: ${username}. ` +
            `Locked until: ${
              rateLimitCheck.lockedUntil
                ? new Date(rateLimitCheck.lockedUntil).toISOString()
                : "N/A"
            }`
        );

        // Log rate limit event to application logs
        // Note: We can't log to audit trail without a userId (schema requires it)
        // Application logs are sufficient for security monitoring
        logger.warn(
          `[Login] Rate limit exceeded for username: ${username}. ` +
            `Remaining attempts: ${rateLimitCheck.remainingAttempts}, ` +
            `Locked until: ${
              rateLimitCheck.lockedUntil
                ? new Date(rateLimitCheck.lockedUntil).toISOString()
                : "N/A"
            }`
        );

        return {
          success: false,
          message:
            rateLimitCheck.message ||
            "Too many login attempts. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
          remainingAttempts: rateLimitCheck.remainingAttempts,
          resetAt: rateLimitCheck.resetAt,
          lockedUntil: rateLimitCheck.lockedUntil,
        };
      }

      // Perform login
      const loginResponse = await db.users.login(credentials);

      // 🔥 RBAC: Invalidate permission cache on login (clear any stale permissions)
      if (loginResponse.success && loginResponse.user) {
        // Clear rate limit on successful login (both terminal and username)
        clearRateLimit(username, "username", terminalId);

        invalidateUserPermissionCache(loginResponse.user.id);
        logger.info(
          `[Login] Cleared permission cache for user ${loginResponse.user.id}`
        );

        // Log successful login
        await logAction(
          db,
          loginResponse.user,
          "login",
          "session",
          loginResponse.token || "unknown",
          {
            method: "pin",
            rememberMe: credentials.rememberMe || false,
          }
        );
      } else {
        // Record failed attempt for rate limiting (both terminal and username)
        recordFailedAttempt(username, "username", terminalId);

        // Log failed login attempt to audit trail
        // Note: We can't log to audit trail without a userId (schema requires it)
        // Instead, we log to application logs which are sufficient for security monitoring
        logger.warn(
          `[Login] Failed login attempt for username: ${username}. Reason: ${loginResponse.message}`
        );
      }

      return loginResponse;
    } catch (error) {
      logger.error("Login IPC error:", error);
      return {
        success: false,
        message: "Login failed due to server error",
      };
    }
  });

  ipcMain.handle("auth:verifyPin", async (event, userId: string, pin: string) => {
    try {
      const db = await getDatabase();

      if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
        return { success: false, message: "User ID is required" };
      }
      if (!pin || typeof pin !== "string") {
        return { success: false, message: "PIN is required" };
      }

      const isValid = await db.users.verifyPinForUser(userId, pin);
      return { success: isValid, message: isValid ? "PIN verified" : "Invalid PIN" };
    } catch (error) {
      logger.error("Verify PIN IPC error:", error);
      return { success: false, message: "Verification failed" };
    }
  });

  ipcMain.handle("auth:refreshToken", async (event, refreshToken) => {
    try {
      const db = await getDatabase();

      // Validate refresh token format
      if (
        !refreshToken ||
        typeof refreshToken !== "string" ||
        refreshToken.trim().length === 0
      ) {
        logger.warn("[refreshToken] Invalid refresh token format provided");
        return {
          success: false,
          message: "Invalid refresh token",
          code: "INVALID_REFRESH_TOKEN",
        };
      }

      // Get session by token (refresh tokens not used in desktop EPOS)
      const session = db.sessions.getSessionByToken(refreshToken);

      if (!session) {
        logger.warn("[refreshToken] Invalid or expired token");
        return {
          success: false,
          message: "Invalid or expired token",
          code: "TOKEN_INVALID",
        };
      }

      // Get user to verify they're still active
      const user = db.users.getUserById(session.userId);

      if (!user) {
        return {
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND",
        };
      }

      if (!user.isActive) {
        return {
          success: false,
          message: "User account is inactive",
          code: "USER_INACTIVE",
        };
      }

      if (!session) {
        return {
          success: false,
          message: "Invalid or expired token",
          code: "TOKEN_INVALID",
        };
      }

      // Return user without sensitive fields
      const {
        passwordHash: _,
        pinHash: __,
        salt: ___,
        ...userWithoutSecrets
      } = user;

      logger.debug(
        `[refreshToken] Token validated successfully for user ${user.id}`
      );

      return {
        success: true,
        message: "Token validated successfully",
        user: userWithoutSecrets as User,
        token: session.token, // Return the same token
      };
    } catch (error) {
      logger.error("Token refresh IPC error:", error);
      return {
        success: false,
        message: "Token refresh failed",
        code: "REFRESH_ERROR",
      };
    }
  });

  ipcMain.handle("auth:validateSession", async (event, token) => {
    try {
      const db = await getDatabase();

      // Validate token format first
      if (!token || typeof token !== "string" || token.trim().length === 0) {
        logger.warn("[validateSession] Invalid token format provided");
        return {
          success: false,
          message: "Invalid session token",
          code: "INVALID_TOKEN_FORMAT",
        };
      }

      // Use RBAC-aware session validation
      const validation = await validateSession(db, token);

      if (!validation.success) {
        logger.debug(
          `[validateSession] Validation failed: ${validation.code} - ${validation.message}`
        );
        return {
          success: false,
          message: validation.message,
          code: validation.code,
        };
      }

      // Return user without sensitive fields
      const {
        passwordHash: _,
        pinHash: __,
        salt: ___,
        ...userWithoutSecrets
      } = validation.user!;

      logger.debug(
        `[validateSession] Session validated successfully for user ${
          validation.user!.id
        }`
      );
      return {
        success: true,
        message: "Session valid",
        user: userWithoutSecrets as User,
      };
    } catch (error) {
      logger.error("Session validation IPC error:", error);
      return {
        success: false,
        message: "Session validation failed",
        code: "VALIDATION_ERROR",
      };
    }
  });

  ipcMain.handle("auth:logout", async (event, token, options) => {
    try {
      const db = await getDatabase();

      // Use userManager.logout() which handles:
      // 1. Auto clock-out if user has active shift
      // 2. Session deletion
      // 3. Schedule status updates
      const logoutResponse = await db.users.logout(token, options);

      // Get user ID for cache invalidation
      const userId = logoutResponse.user?.id;
      if (userId) {
        // 🔥 RBAC: Invalidate permission cache on logout (security)
        invalidateUserPermissionCache(userId);
        logger.info(`[Logout] Cleared permission cache for user ${userId}`);

        // Log successful logout
        if (logoutResponse.success) {
          const user = db.users.getUserById(userId);
          if (user) {
            await logAction(db, user, "logout", "session", token, {
              method: "manual",
            });
          }
        }
      }

      return logoutResponse;
    } catch (error) {
      logger.error("Logout IPC error:", error);
      return {
        success: false,
        message: "Logout failed",
      };
    }
  });

  ipcMain.handle(
    "auth:getUserById",
    async (event, sessionTokenOrUserId: string, userId?: string) => {
      try {
        const db = await getDatabase();

        // 🔥 Handle both authenticated and public access patterns
        // Pattern 1: (sessionToken, userId) - authenticated access
        // Pattern 2: (userId) - public access (for login page clock-in)
        let sessionToken: string | undefined;
        let targetUserId: string;

        if (userId) {
          // Pattern 1: Authenticated access
          sessionToken = sessionTokenOrUserId;
          targetUserId = userId;

          // Validate session and permission
          const auth = await validateSessionAndPermission(
            db,
            sessionToken,
            PERMISSIONS.USERS_MANAGE
          );

          if (!auth.success) {
            return { success: false, message: auth.message, code: auth.code };
          }

          // Get user
          const user = db.users.getUserById(targetUserId);
          if (!user) {
            return { success: false, message: "User not found" };
          }

          // Validate business access (users can only access users from their business)
          const businessCheck = validateBusinessAccess(
            auth.user!,
            user.businessId
          );
          if (!businessCheck.success) {
            return {
              success: false,
              message: businessCheck.message,
              code: businessCheck.code,
            };
          }

          // Remove sensitive fields
          const {
            passwordHash: _,
            pinHash: __,
            salt: ___,
            ...userWithoutSecrets
          } = user;

          return {
            success: true,
            user: userWithoutSecrets as User,
          };
        } else {
          // Pattern 2: Public access (for login page - user accessing their own data for clock-in)
          targetUserId = sessionTokenOrUserId;

          // Get user (public access - no authentication required)
          const user = db.users.getUserById(targetUserId);
          if (!user) {
            return { success: false, message: "User not found" };
          }

          // Remove sensitive fields
          const {
            passwordHash: _,
            pinHash: __,
            salt: ___,
            email: ____, // Don't expose email on login page
            ...userWithoutSecrets
          } = user;

          return {
            success: true,
            user: userWithoutSecrets as User,
          };
        }
      } catch (error) {
        logger.error("Get user IPC error:", error);
        return {
          success: false,
          message: "Failed to get user",
        };
      }
    }
  );

  ipcMain.handle(
    "auth:updateUser",
    async (event, sessionToken, userId, updates) => {
      try {
        const db = await getDatabase();

        // Validate session and permission
        const auth = await validateSessionAndPermission(
          db,
          sessionToken,
          PERMISSIONS.USERS_MANAGE
        );

        if (!auth.success) {
          return { success: false, message: auth.message, code: auth.code };
        }

        // Get target user
        const targetUser = db.users.getUserById(userId);
        if (!targetUser) {
          return { success: false, message: "User not found" };
        }

        // Validate business access
        const businessCheck = validateBusinessAccess(
          auth.user!,
          targetUser.businessId
        );
        if (!businessCheck.success) {
          return {
            success: false,
            message: businessCheck.message,
            code: businessCheck.code,
          };
        }

        // Update user
        const result = await db.users.updateUserWithResponse(userId, updates);

        // Invalidate permission cache if roles/permissions changed
        if (updates.roleId || updates.primaryRoleId) {
          invalidateUserPermissionCache(userId);
          logger.info(
            `[UpdateUser] Invalidated permission cache for user ${userId} (role changed)`
          );
        }

        // Audit log
        await logAction(db, auth.user!, "update", "users", userId, {
          updates: Object.keys(updates),
        });

        return result;
      } catch (error) {
        logger.error("Update user IPC error:", error);
        return {
          success: false,
          message: "Update failed",
        };
      }
    }
  );

  ipcMain.handle("auth:deleteUser", async (event, sessionToken, userId) => {
    try {
      const db = await getDatabase();

      // Validate session and permission
      const auth = await validateSessionAndPermission(
        db,
        sessionToken,
        PERMISSIONS.USERS_MANAGE
      );

      if (!auth.success) {
        return { success: false, message: auth.message, code: auth.code };
      }

      // Prevent self-deletion
      if (auth.user!.id === userId) {
        return {
          success: false,
          message: "Cannot delete your own account",
          code: "SELF_DELETE_DENIED",
        };
      }

      // Get target user
      const targetUser = db.users.getUserById(userId);
      if (!targetUser) {
        return { success: false, message: "User not found" };
      }

      // Validate business access
      const businessCheck = validateBusinessAccess(
        auth.user!,
        targetUser.businessId
      );
      if (!businessCheck.success) {
        return {
          success: false,
          message: businessCheck.message,
          code: businessCheck.code,
        };
      }

      // Delete user
      const result = await db.users.deleteUserWithResponse(userId);

      // Invalidate permission cache
      invalidateUserPermissionCache(userId);

      // Audit log
      await logAction(db, auth.user!, "delete", "users", userId);

      return result;
    } catch (error) {
      logger.error("Delete user IPC error:", error);
      return {
        success: false,
        message: "Delete failed",
      };
    }
  });

  ipcMain.handle(
    "auth:getUsersByBusiness",
    async (event, sessionToken, businessId) => {
      try {
        const db = await getDatabase();

        // Validate session and permission
        const auth = await validateSessionAndPermission(
          db,
          sessionToken,
          PERMISSIONS.USERS_MANAGE
        );

        if (!auth.success) {
          return { success: false, message: auth.message, code: auth.code };
        }

        // Validate business access (users can only view users from their business)
        const businessCheck = validateBusinessAccess(auth.user!, businessId);
        if (!businessCheck.success) {
          return {
            success: false,
            message: businessCheck.message,
            code: businessCheck.code,
          };
        }

        return db.users.getUsersByBusinessWithResponse(businessId);
      } catch (error) {
        logger.error("Get users by business IPC error:", error);
        return {
          success: false,
          message: "Failed to get users",
        };
      }
    }
  );

  ipcMain.handle("auth:createUser", async (event, sessionToken, userData) => {
    try {
      const db = await getDatabase();

      // Validate session and permission
      const auth = await validateSessionAndPermission(
        db,
        sessionToken,
        PERMISSIONS.USERS_MANAGE
      );

      if (!auth.success) {
        return { success: false, message: auth.message, code: auth.code };
      }

      // Validate business access (users can only create users in their business)
      const businessCheck = validateBusinessAccess(
        auth.user!,
        userData.businessId
      );
      if (!businessCheck.success) {
        return {
          success: false,
          message: businessCheck.message,
          code: businessCheck.code,
        };
      }

      // Create user
      const result = await db.users.createUserForBusiness(userData);

      // Audit log
      if (result.success && result.user) {
        await logAction(db, auth.user!, "create", "users", result.user.id, {
          username: result.user.username,
          roleId: result.user.primaryRoleId,
        });
      }

      return result;
    } catch (error) {
      logger.error("Create user IPC error:", error);
      return {
        success: false,
        message: "Failed to create user",
      };
    }
  });

  ipcMain.handle(
    "auth:getAllActiveUsers",
    async (event, sessionToken?: string) => {
      try {
        const db = await getDatabase();

        // 🔥 SPECIAL CASE: Login page needs user list before authentication
        // If sessionToken is provided, validate and filter by business
        // If no sessionToken, return all active users (for login page)
        if (sessionToken) {
          // Validate session and permission (for authenticated requests)
          const auth = await validateSessionAndPermission(
            db,
            sessionToken,
            PERMISSIONS.USERS_MANAGE
          );

          if (!auth.success) {
            return { success: false, message: auth.message, code: auth.code };
          }

          // Get users from same business only (business isolation)
          const users = db.users
            .getAllActiveUsers()
            .filter((user: User) => user.businessId === auth.user!.businessId);

          // Remove sensitive fields
          const sanitizedUsers = users.map((user: User) => {
            const {
              passwordHash: _,
              pinHash: __,
              salt: ___,
              ...userWithoutSecrets
            } = user;
            return userWithoutSecrets;
          });

          return {
            success: true,
            users: sanitizedUsers,
          };
        } else {
          // Public access: Return all active users (for login page)
          // Only return safe fields (no sensitive data)
          const users = db.users.getAllActiveUsers();

          // Remove sensitive fields
          const sanitizedUsers = users.map((user: User) => {
            const {
              passwordHash: _,
              pinHash: __,
              salt: ___,
              email: ____, // Don't expose email on login page
              ...userWithoutSecrets
            } = user;
            return userWithoutSecrets;
          });

          return {
            success: true,
            users: sanitizedUsers,
          };
        }
      } catch (error) {
        logger.error("Get all active users IPC error:", error);
        return {
          success: false,
          message: "Failed to get active users",
        };
      }
    }
  );

  // Business Management IPC handlers
  ipcMain.handle(
    "auth:getBusinessById",
    async (event, sessionToken, businessId) => {
      try {
        const db = await getDatabase();

        // Validate session
        const sessionValidation = await validateSession(db, sessionToken);
        if (!sessionValidation.success) {
          return {
            success: false,
            message: sessionValidation.message,
            code: sessionValidation.code,
          };
        }

        // Get business
        const business = db.businesses.getBusinessById(businessId);
        if (!business) {
          return {
            success: false,
            message: "Business not found",
          };
        }

        // Validate business access (users can only view their own business)
        const businessCheck = validateBusinessAccess(
          sessionValidation.user!,
          businessId
        );
        if (!businessCheck.success) {
          return {
            success: false,
            message: businessCheck.message,
            code: businessCheck.code,
          };
        }

        return {
          success: true,
          business: business,
        };
      } catch (error) {
        logger.error("Get business IPC error:", error);
        return {
          success: false,
          message: "Failed to get business details",
        };
      }
    }
  );

  // ============================================================================
  // PIN MANAGEMENT HANDLERS
  // ============================================================================

  /**
   * Change PIN (self-service) - requires current PIN verification
   */
  ipcMain.handle(
    "auth:change-pin",
    async (event, sessionToken: string, currentPin: string, newPin: string) => {
      try {
        const db = await getDatabase();

        // Validate session (user must be logged in)
        const auth = await validateSession(db, sessionToken);
        if (!auth.success || !auth.user) {
          return { success: false, message: auth.message, code: auth.code };
        }

        // Change PIN using userManager
        const result = await db.users.changeUserPin(
          auth.user.id,
          currentPin,
          newPin
        );

        // Audit log
        if (result.success) {
          await logAction(db, auth.user, "change_pin", "users", auth.user.id, {
            method: "self_service",
          });
        }

        return result;
      } catch (error) {
        logger.error("Change PIN IPC error:", error);
        return {
          success: false,
          message: "Failed to change PIN",
        };
      }
    }
  );

  /**
   * Reset PIN (admin/manager action) - generates temporary PIN
   */
  ipcMain.handle(
    "auth:reset-pin",
    async (event, sessionToken: string, userId: string) => {
      try {
        const db = await getDatabase();

        // Validate session and permission
        const auth = await validateSessionAndPermission(
          db,
          sessionToken,
          PERMISSIONS.USERS_MANAGE
        );

        if (!auth.success || !auth.user) {
          return { success: false, message: auth.message, code: auth.code };
        }

        // Get target user
        const targetUser = db.users.getUserById(userId);
        if (!targetUser) {
          return { success: false, message: "User not found" };
        }

        // Validate business access
        const businessCheck = validateBusinessAccess(
          auth.user,
          targetUser.businessId
        );
        if (!businessCheck.success) {
          return {
            success: false,
            message: businessCheck.message,
            code: businessCheck.code,
          };
        }

        // Reset PIN using userManager
        const result = await db.users.resetUserPin(userId, auth.user.id);

        // Audit log
        if (result.success) {
          await logAction(db, auth.user, "reset_pin", "users", userId, {
            method: "admin_reset",
            resetBy: auth.user.id,
          });
        }

        return result;
      } catch (error) {
        logger.error("Reset PIN IPC error:", error);
        return {
          success: false,
          message: "Failed to reset PIN",
        };
      }
    }
  );

  /**
   * Set new PIN (for forced PIN change on first login)
   */
  ipcMain.handle(
    "auth:set-new-pin",
    async (event, sessionToken: string, newPin: string) => {
      try {
        const db = await getDatabase();

        // Validate session (user must be logged in)
        const auth = await validateSession(db, sessionToken);
        if (!auth.success || !auth.user) {
          return { success: false, message: auth.message, code: auth.code };
        }

        // Verify user is in requiresPinChange state
        if (!auth.user.requiresPinChange) {
          return {
            success: false,
            message: "PIN change not required for this user",
          };
        }

        // Validate new PIN format (4 digits)
        if (!/^\d{4}$/.test(newPin)) {
          return {
            success: false,
            message: "New PIN must be exactly 4 digits",
          };
        }

        // Update PIN
        const result = await db.users.updateUserPin(auth.user.id, newPin);
        if (!result.success) {
          return result;
        }

        // Clear requiresPinChange flag
        db.users.setRequiresPinChange(auth.user.id, false);

        // Audit log
        await logAction(db, auth.user, "set_new_pin", "users", auth.user.id, {
          method: "forced_change",
        });

        logger.info(
          `[setNewPin] User ${auth.user.id} completed forced PIN change`
        );

        return {
          success: true,
          message: "PIN set successfully",
        };
      } catch (error) {
        logger.error("Set new PIN IPC error:", error);
        return {
          success: false,
          message: "Failed to set new PIN",
        };
      }
    }
  );
}

