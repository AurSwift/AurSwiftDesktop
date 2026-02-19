/**
 * User Permission Manager
 *
 * Manages direct permission grants to users (outside of roles)
 * Allows fine-grained permission control and temporary access grants
 */

import type { DrizzleDB } from "../drizzle.js";
import type { UserPermission } from "../schema.js";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import * as schema from "../schema.js";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("userPermissionManager");

export class UserPermissionManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Grant a permission directly to a user
   */
  async grantPermission(
    userId: string,
    permission: string,
    grantedBy?: string,
    reason?: string,
    expiresAt?: Date
  ): Promise<UserPermission> {
    // Check if permission already exists
    const existing = this.getUserPermission(userId, permission);

    if (existing) {
      // Reactivate if inactive
      if (!existing.isActive) {
        return this.reactivatePermission(existing.id);
      }
      throw new Error("User already has this permission");
    }

    const permissionId = this.uuid.v4();
    const now = new Date();

    const [userPermission] = this.db
      .insert(schema.userPermissions)
      .values({
        id: permissionId,
        userId,
        permission,
        grantedBy: grantedBy || null,
        grantedAt: now,
        expiresAt: expiresAt || null,
        reason: reason || null,
        isActive: true,
      })
      .returning()
      .all();

    return userPermission;
  }

  /**
   * Revoke a permission from a user (soft delete)
   */
  revokePermission(userId: string, permission: string): UserPermission {
    const userPermission = this.getUserPermission(userId, permission);

    if (!userPermission) {
      throw new Error("User does not have this permission");
    }

    const [updated] = this.db
      .update(schema.userPermissions)
      .set({ isActive: false })
      .where(eq(schema.userPermissions.id, userPermission.id))
      .returning()
      .all();

    return updated;
  }

  /**
   * Remove a permission from a user (hard delete)
   */
  removePermission(userId: string, permission: string): void {
    const userPermission = this.getUserPermission(userId, permission);

    if (!userPermission) {
      throw new Error("User does not have this permission");
    }

    this.db
      .delete(schema.userPermissions)
      .where(eq(schema.userPermissions.id, userPermission.id))
      .run();
  }

  /**
   * Reactivate a revoked permission
   */
  reactivatePermission(permissionId: string): UserPermission {
    const [updated] = this.db
      .update(schema.userPermissions)
      .set({ isActive: true })
      .where(eq(schema.userPermissions.id, permissionId))
      .returning()
      .all();

    if (!updated) {
      throw new Error("User permission not found");
    }

    return updated;
  }

  /**
   * Get a specific user permission
   */
  getUserPermission(userId: string, permission: string): UserPermission | null {
    const userPermission = this.db
      .select()
      .from(schema.userPermissions)
      .where(
        and(
          eq(schema.userPermissions.userId, userId),
          eq(schema.userPermissions.permission, permission)
        )
      )
      .get();

    return userPermission || null;
  }

  /**
   * Get all direct permissions for a user (active only by default)
   */
  getActivePermissionsByUser(
    userId: string,
    includeExpired = false
  ): UserPermission[] {
    const conditions = [
      eq(schema.userPermissions.userId, userId),
      eq(schema.userPermissions.isActive, true),
    ];

    if (!includeExpired) {
      conditions.push(
        or(
          isNull(schema.userPermissions.expiresAt),
          sql`${schema.userPermissions.expiresAt} > ${new Date().getTime()}`
        )!
      );
    }

    return this.db
      .select()
      .from(schema.userPermissions)
      .where(and(...conditions))
      .orderBy(desc(schema.userPermissions.grantedAt))
      .all();
  }

  /**
   * Get all users with a specific direct permission
   */
  getUsersWithPermission(
    permission: string,
    activeOnly = true
  ): UserPermission[] {
    const conditions = [eq(schema.userPermissions.permission, permission)];

    if (activeOnly) {
      conditions.push(eq(schema.userPermissions.isActive, true));
    }

    return this.db
      .select()
      .from(schema.userPermissions)
      .where(and(...conditions))
      .all();
  }

  /**
   * Check if user has a specific direct permission
   */
  userHasPermission(userId: string, permission: string): boolean {
    const userPermission = this.db
      .select()
      .from(schema.userPermissions)
      .where(
        and(
          eq(schema.userPermissions.userId, userId),
          eq(schema.userPermissions.permission, permission),
          eq(schema.userPermissions.isActive, true)
        )
      )
      .get();

    if (!userPermission) return false;

    // Check expiration
    if (
      userPermission.expiresAt &&
      new Date(userPermission.expiresAt) < new Date()
    ) {
      return false;
    }

    return true;
  }

  /**
   * Check if user has any of the specified permissions
   */
  userHasAnyPermission(userId: string, permissions: string[]): boolean {
    return permissions.some((permission) =>
      this.userHasPermission(userId, permission)
    );
  }

  /**
   * Check if user has all of the specified permissions
   */
  userHasAllPermissions(userId: string, permissions: string[]): boolean {
    return permissions.every((permission) =>
      this.userHasPermission(userId, permission)
    );
  }

  /**
   * Grant temporary permission (with expiration)
   */
  async grantTemporaryPermission(
    userId: string,
    permission: string,
    expiresAt: Date,
    grantedBy?: string,
    reason?: string
  ): Promise<UserPermission> {
    return await this.grantPermission(
      userId,
      permission,
      grantedBy,
      reason,
      expiresAt
    );
  }

  /**
   * Bulk grant permissions to a user
   */
  async grantPermissions(
    userId: string,
    permissions: string[],
    grantedBy?: string,
    reason?: string
  ): Promise<UserPermission[]> {
    const granted: UserPermission[] = [];

    for (const permission of permissions) {
      try {
        const userPermission = await this.grantPermission(
          userId,
          permission,
          grantedBy,
          reason
        );
        granted.push(userPermission);
      } catch (error) {
        // Skip if already exists
        logger.warn(
          `Permission ${permission} already granted to user ${userId}`
        );
      }
    }

    return granted;
  }

  /**
   * Bulk revoke permissions from a user
   */
  revokePermissions(userId: string, permissions: string[]): UserPermission[] {
    const revoked: UserPermission[] = [];

    for (const permission of permissions) {
      try {
        const userPermission = this.revokePermission(userId, permission);
        revoked.push(userPermission);
      } catch (error) {
        // Skip if doesn't exist
        logger.warn(`Permission ${permission} not found for user ${userId}`);
      }
    }

    return revoked;
  }

  /**
   * Replace all user permissions with new set (atomic operation)
   */
  async replaceUserPermissions(
    userId: string,
    permissions: string[],
    grantedBy?: string,
    reason?: string
  ): Promise<UserPermission[]> {
    // Get existing permissions
    const existingPermissions = this.getActivePermissionsByUser(userId, true);

    // Deactivate all existing
    for (const existingPermission of existingPermissions) {
      this.db
        .update(schema.userPermissions)
        .set({ isActive: false })
        .where(eq(schema.userPermissions.id, existingPermission.id))
        .run();
    }

    // Grant new permissions
    return await this.grantPermissions(userId, permissions, grantedBy, reason);
  }

  /**
   * Clean up expired permissions
   */
  cleanupExpiredPermissions(): number {
    const now = new Date().getTime();

    const result = this.db
      .update(schema.userPermissions)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.userPermissions.isActive, true),
          sql`${schema.userPermissions.expiresAt} IS NOT NULL`,
          sql`${schema.userPermissions.expiresAt} < ${now}`
        )
      )
      .returning()
      .all();

    return result.length;
  }

  /**
   * Get permission count for a user
   */
  getUserPermissionCount(userId: string): number {
    const permissions = this.getActivePermissionsByUser(userId);
    return permissions.length;
  }

  /**
   * Get all direct permissions as strings for a user
   */
  getUserPermissionStrings(userId: string): string[] {
    const permissions = this.getActivePermissionsByUser(userId);
    return permissions.map((p) => p.permission);
  }
}
