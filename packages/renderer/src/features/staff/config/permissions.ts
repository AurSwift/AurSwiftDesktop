/**
 * Staff Feature Permissions
 *
 * Centralized permission definitions for the staff feature.
 * These permissions are used for RBAC throughout the feature.
 */

import { PERMISSIONS } from "@app/shared/constants/permissions";

/**
 * Staff Feature Permissions
 *
 * Maps to the existing permission system while providing
 * feature-specific constants for better organization.
 */
export const STAFF_PERMISSIONS = {
  /** Manage staff (cashiers, managers) */
  MANAGE: PERMISSIONS.USERS_MANAGE, // "manage:users"

  /** Manage schedules for all staff */
  MANAGE_SCHEDULES: PERMISSIONS.SCHEDULES_MANAGE_ALL, // "manage:schedules:all"

  /** Manage schedules for cashiers only */
  MANAGE_CASHIER_SCHEDULES: PERMISSIONS.SCHEDULES_MANAGE_CASHIERS, // "manage:schedules:cashiers"

  /** Manage break policies (admin only) */
  MANAGE_BREAK_POLICIES: PERMISSIONS.SETTINGS_MANAGE, // "manage:settings" - uses settings permission for admin-only
} as const;

export type StaffPermission =
  (typeof STAFF_PERMISSIONS)[keyof typeof STAFF_PERMISSIONS];
