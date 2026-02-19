/**
 * Shift Requirement Resolver
 *
 * Determines if a user requires a shift to make sales based on their RBAC roles.
 * This enables dual-mode sales: admin/owner can make direct sales, while
 * cashier/manager require shift management.
 *
 * Resolution Priority:
 * 1. Explicit role configuration (role.shiftRequired)
 * 2. User's shiftRequired field (fallback for legacy users)
 * 3. Default: require shift (conservative security approach)
 */

import type { DatabaseManagers } from "../database/index.js";
import type { User } from "../database/schema.js";
import { getLogger } from "./logger.js";

const logger = getLogger("shiftRequirementResolver");

export interface ShiftRequirementResult {
  requiresShift: boolean;
  mode: "admin" | "cashier";
  reason: string;
}

export class ShiftRequirementResolver {
  /**
   * Resolve shift requirement for a user based on their RBAC roles
   *
   * @param user - User object
   * @param db - Database managers
   * @returns Shift requirement result with mode and reason
   */
  async resolve(
    user: User,
    db: DatabaseManagers
  ): Promise<ShiftRequirementResult> {
    logger.info(
      `[resolve] Resolving shift requirement for user ${user.id} (${user.username})`
    );

    try {
      // 1. Get user's active roles via RBAC
      const userRoles = db.userRoles.getActiveRolesByUser(user.id);
      logger.info(
        `[resolve] Found ${userRoles.length} active roles for user ${user.id}`
      );

      // 2. Check each role's shiftRequired field
      for (const userRole of userRoles) {
        const role = db.roles.getRoleById(userRole.roleId);
        if (!role) {
          logger.warn(
            `[resolve] Role ${userRole.roleId} not found, skipping`
          );
          continue;
        }

        logger.info(
          `[resolve] Checking role "${role.name}" (shiftRequired: ${role.shiftRequired})`
        );

        // If role has explicit shiftRequired configuration
        if (role.shiftRequired === false) {
          logger.info(
            `[resolve] ✅ Role "${role.name}" does not require shifts - admin mode`
          );
          return {
            requiresShift: false,
            mode: "admin",
            reason: `Role "${role.name}" does not require shifts`,
          };
        }

        if (role.shiftRequired === true) {
          logger.info(
            `[resolve] ✅ Role "${role.name}" requires shifts - cashier mode`
          );
          return {
            requiresShift: true,
            mode: "cashier",
            reason: `Role "${role.name}" requires shifts`,
          };
        }

        // If shiftRequired is null/undefined, continue checking other roles
        logger.info(
          `[resolve] Role "${role.name}" has no explicit shiftRequired setting, checking next role`
        );
      }

      // 3. Fallback to user's shiftRequired field (legacy support)
      if (user.shiftRequired !== null && user.shiftRequired !== undefined) {
        logger.info(
          `[resolve] Using user's shiftRequired field: ${user.shiftRequired}`
        );
        return {
          requiresShift: user.shiftRequired,
          mode: user.shiftRequired ? "cashier" : "admin",
          reason: "Based on user shiftRequired field (legacy)",
        };
      }

      // 4. Default: require shift (conservative security approach)
      logger.warn(
        `[resolve] ⚠️ No explicit shift requirement found, defaulting to require shift (conservative)`
      );
      return {
        requiresShift: true,
        mode: "cashier",
        reason: "Default: shift required for security (no explicit configuration found)",
      };
    } catch (error) {
      logger.error(
        `[resolve] Error resolving shift requirement for user ${user.id}:`,
        error
      );
      // On error, default to requiring shift (conservative)
      return {
        requiresShift: true,
        mode: "cashier",
        reason: `Error resolving shift requirement: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Quick check if user requires shift (returns boolean only)
   *
   * @param user - User object
   * @param db - Database managers
   * @returns true if shift is required, false otherwise
   */
  async requiresShift(user: User, db: DatabaseManagers): Promise<boolean> {
    const result = await this.resolve(user, db);
    return result.requiresShift;
  }
}

// Export singleton instance for convenience
export const shiftRequirementResolver = new ShiftRequirementResolver();
