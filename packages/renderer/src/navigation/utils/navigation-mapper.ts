/**
 * Navigation Mapper
 *
 * Maps feature actions to view IDs for navigation.
 * Centralizes the mapping between dashboard feature actions and views.
 */

import { USERS_ROUTES } from "@/features/users/config/navigation";
import { RBAC_ROUTES } from "@/features/rbac/config/navigation";
import { SALES_ROUTES } from "@/features/sales/config/navigation";
import { STAFF_ROUTES } from "@/features/staff/config/navigation";
import { SETTINGS_ROUTES } from "@/features/settings/config/navigation";

export type MappedViewTarget =
  | string
  | {
      viewId: string;
      params?: Record<string, unknown>;
    };

/**
 * Map feature ID and action ID to view ID
 *
 * Uses route constants where available for type safety and maintainability.
 * Legacy route names are automatically mapped by the view registry.
 *
 * @param featureId - Feature identifier
 * @param actionId - Action identifier
 * @returns View ID or undefined if no mapping exists
 */
export function mapActionToView(
  featureId: string,
  actionId: string
): MappedViewTarget | undefined {
  const mapping: Record<string, Record<string, MappedViewTarget>> = {
    "user-management": {
      "manage-users": USERS_ROUTES.MANAGEMENT,
      "role-permissions": RBAC_ROUTES.ROLE_MANAGEMENT,
      "user-role-assignment": RBAC_ROUTES.USER_ROLE_ASSIGNMENT,
      "staff-schedules": STAFF_ROUTES.SCHEDULES,
      "break-policies": STAFF_ROUTES.BREAK_POLICIES,
    },
    "staff-management": {
      "manage-cashiers": STAFF_ROUTES.MANAGE_CASHIERS,
      "staff-schedules": STAFF_ROUTES.SCHEDULES,
      "break-policies": STAFF_ROUTES.BREAK_POLICIES,
    },
    "management-actions": {
      "new-sale": SALES_ROUTES.NEW_TRANSACTION,
      "manage-inventory": "productManagement", // Legacy route - automatically mapped by route mapper
      "sales-reports": SALES_ROUTES.SALES_REPORTS,
      "manage-users": USERS_ROUTES.MANAGEMENT,
      "staff-schedules": STAFF_ROUTES.SCHEDULES,
    },
    "quick-actions": {
      "quick-new-sale": SALES_ROUTES.NEW_TRANSACTION,
      "quick-manage-users": USERS_ROUTES.MANAGEMENT,
    },
    "system-settings": {
      "general-settings": SETTINGS_ROUTES.GENERAL,
      "store-configuration": SETTINGS_ROUTES.STORE_CONFIGURATION,
      "break-policies": STAFF_ROUTES.BREAK_POLICIES,
    },
    "time-breaks": {
      "time-break-reports": STAFF_ROUTES.TIME_REPORTS,
      "break-policies": STAFF_ROUTES.BREAK_POLICIES,
    },
  };

  return mapping[featureId]?.[actionId];
}

/**
 * Check if an action maps to a view
 *
 * @param featureId - Feature identifier
 * @param actionId - Action identifier
 * @returns Whether the action maps to a view
 */
export function hasViewMapping(featureId: string, actionId: string): boolean {
  return mapActionToView(featureId, actionId) !== undefined;
}
