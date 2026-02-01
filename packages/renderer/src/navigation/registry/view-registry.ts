/**
 * Central View Registry
 *
 * Single source of truth for all views in the application.
 * Views are organized hierarchically with parent-child relationships.
 */

import type { ViewConfig } from "../types/navigation.types";
import { mapLegacyRoute } from "./route-mapper";
import { getLogger } from "@/shared/utils/logger";

// Import feature views
import { inventoryViews } from "@/features/inventory/config/feature-config";
import { settingsViews } from "@/features/settings/config/feature-config";
import { staffViews } from "@/features/staff/config/feature-config";
import { rbacViews } from "@/features/rbac/config/feature-config";
import { usersViews } from "@/features/users/config/feature-config";
import { salesViews } from "@/features/sales/config/feature-config";
import { quickSellViews } from "@/features/quick-sell-config/config/feature-config";

// Wrapper components that use navigation hook
import { DashboardPageWrapper } from "../components/dashboard-page-wrapper";

const logger = getLogger("view-registry");

/**
 * Central View Registry
 *
 * All views in the application are registered here with their configuration.
 * Views can be organized hierarchically using parentId.
 */
export const VIEW_REGISTRY: Record<string, ViewConfig> = {
  // ============================================================================
  // Root Level Views
  // ============================================================================
  dashboard: {
    id: "dashboard",
    level: "root",
    component: DashboardPageWrapper,
    metadata: {
      title: "Dashboard",
      description: "Main dashboard",
    },
    requiresAuth: true,
  },

  // ============================================================================
  // Sales/Transaction Views
  // Imported from sales feature config
  // ============================================================================
  ...salesViews,

  // ============================================================================
  // User Management Views
  // Imported from users feature config
  // ============================================================================
  ...usersViews,

  // ============================================================================
  // Inventory/Product Management Views (Hierarchical)
  // Imported from inventory feature config
  // ============================================================================
  ...inventoryViews,

  // ============================================================================
  // Settings Views
  // Imported from settings feature config
  // ============================================================================
  ...settingsViews,

  // ============================================================================
  // Quick Sell Config Views
  // Imported from quick-sell-config feature config
  // ============================================================================
  ...quickSellViews,

  // ============================================================================
  // Staff Management Views
  // Imported from staff feature config
  // ============================================================================
  ...staffViews,

  // ============================================================================
  // RBAC Views
  // Imported from RBAC feature config
  // ============================================================================
  ...rbacViews,
};

/**
 * Get view by ID
 *
 * Automatically maps legacy route names to new standardized routes.
 * This provides backward compatibility during the migration period.
 *
 * @param viewId - View identifier (supports both legacy and new route names)
 * @returns View configuration or undefined
 */
export function getView(viewId: string): ViewConfig | undefined {
  // Map legacy route to new route if applicable
  const mappedViewId = mapLegacyRoute(viewId);

  // Return the view config, using mapped ID if different from original
  const view = VIEW_REGISTRY[mappedViewId];

  // If we mapped a legacy route, log a deprecation warning in development
  if (
    mappedViewId !== viewId &&
    view &&
    process.env.NODE_ENV === "development"
  ) {
    logger.warn(
      `Deprecated route "${viewId}" has been mapped to "${mappedViewId}". Please update to use the new route constant.`,
    );
  }

  return view;
}

/**
 * Get all root-level views
 *
 * @returns Array of root view configurations
 */
export function getRootViews(): ViewConfig[] {
  return Object.values(VIEW_REGISTRY).filter((view) => view.level === "root");
}

/**
 * Get nested views for a parent view
 *
 * @param parentId - Parent view ID
 * @returns Array of nested view configurations
 */
export function getNestedViews(parentId: string): ViewConfig[] {
  return Object.values(VIEW_REGISTRY).filter(
    (view) => view.parentId === parentId,
  );
}

/**
 * Get view hierarchy path (breadcrumb trail)
 *
 * @param viewId - View identifier
 * @returns Array of view configurations from root to target view
 */
export function getViewHierarchy(viewId: string): ViewConfig[] {
  const hierarchy: ViewConfig[] = [];
  let currentView = getView(viewId);

  while (currentView) {
    hierarchy.unshift(currentView);
    if (currentView.parentId) {
      currentView = getView(currentView.parentId);
    } else {
      break;
    }
  }

  return hierarchy;
}

/**
 * Check if user can access view based on RBAC
 *
 * @param viewId - View identifier
 * @param userPermissions - User's permissions array
 * @param userRole - User's role name
 * @returns Whether user can access the view
 */
export function canAccessView(
  viewId: string,
  userPermissions: string[],
  userRole: string,
): boolean {
  const view = getView(viewId);
  if (!view) return false;

  // Check authentication requirement
  if (view.requiresAuth && !userPermissions.length && !userRole) {
    return false;
  }

  // Check role-based access
  if (view.roles && view.roles.length > 0) {
    if (!view.roles.includes(userRole)) {
      return false;
    }
  }

  // Check permission-based access
  if (view.permissions && view.permissions.length > 0) {
    // Check for wildcard permission (admin has all)
    if (userPermissions.includes("*:*")) return true;

    // Check for any matching permission
    const hasPermission = view.permissions.some((perm) => {
      // Exact match
      if (userPermissions.includes(perm)) return true;

      // Wildcard checks
      const [action, resource] = perm.split(":");
      if (action && resource) {
        // Action wildcard (e.g., "manage:*" covers "manage:users")
        if (userPermissions.includes(`${action}:*`)) return true;
        // Resource wildcard (e.g., "*:users" covers "manage:users")
        if (userPermissions.includes(`*:${resource}`)) return true;
      }

      return false;
    });

    if (!hasPermission) return false;
  }

  return true;
}
