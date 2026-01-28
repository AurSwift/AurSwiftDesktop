/**
 * Route Mapper
 *
 * Maps legacy route names to new standardized route constants.
 * This provides backward compatibility while migrating to the new route system.
 */

import { RBAC_ROUTES } from "@/features/rbac/config/navigation";
import { USERS_ROUTES } from "@/features/users/config/navigation";
import { SALES_ROUTES } from "@/features/sales/config/navigation";
import { STAFF_ROUTES } from "@/features/staff/config/navigation";
import { SETTINGS_ROUTES } from "@/features/settings/config/navigation";

/**
 * Legacy to new route mapping
 * Maps old route identifiers to new standardized route constants
 */
export const LEGACY_ROUTE_MAP: Record<string, string> = {
  // RBAC legacy routes
  roleManagement: RBAC_ROUTES.ROLE_MANAGEMENT,
  userRoleAssignment: RBAC_ROUTES.USER_ROLE_ASSIGNMENT,

  // Users legacy routes
  userManagement: USERS_ROUTES.MANAGEMENT,

  // Sales legacy routes
  newTransaction: SALES_ROUTES.NEW_TRANSACTION,

  // Staff legacy routes
  staffSchedules: STAFF_ROUTES.SCHEDULES,
  cashierManagement: STAFF_ROUTES.MANAGE_CASHIERS,

  // Settings legacy routes
  generalSettings: SETTINGS_ROUTES.GENERAL,
} as const;

/**
 * Map a legacy route to its new route identifier
 *
 * @param routeId - Route identifier (legacy or new)
 * @returns New route identifier if mapping exists, otherwise returns original
 */
export function mapLegacyRoute(routeId: string): string {
  return LEGACY_ROUTE_MAP[routeId] || routeId;
}
