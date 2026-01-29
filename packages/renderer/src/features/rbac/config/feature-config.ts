/**
 * RBAC Feature Configuration
 *
 * Central configuration for the RBAC feature.
 * This is used by the navigation system and dashboard.
 */

import { lazy } from "react";
import { Shield } from "lucide-react";
import { RBAC_PERMISSIONS } from "./permissions";
import { RBAC_ROUTES } from "./navigation";
import type { FeatureConfig } from "@/features/dashboard/types/feature-config";
import type { ViewConfig } from "@/navigation/types";

/**
 * RBAC Feature Configuration for Dashboard
 */
export const rbacFeature: FeatureConfig = {
  id: "rbac-management",
  title: "RBAC Management",
  description: "Manage roles and permissions",
  icon: Shield,
  permissions: [RBAC_PERMISSIONS.MANAGE],
  category: "management",
  order: 2,
  actions: [
    {
      id: "role-permissions",
      label: "Role Management",
      icon: Shield,
      onClick: () => {}, // Will be injected by dashboard
      permissions: [RBAC_PERMISSIONS.MANAGE],
    },
    {
      id: "user-role-assignment",
      label: "User Role Assignment",
      icon: Shield,
      onClick: () => {},
      permissions: [RBAC_PERMISSIONS.MANAGE],
    },
  ],
};

/**
 * RBAC Views Registry
 *
 * All views for the RBAC feature are registered here.
 * This is spread into the main VIEW_REGISTRY.
 */
export const rbacViews: Record<string, ViewConfig> = {
  [RBAC_ROUTES.ROLE_MANAGEMENT]: {
    id: RBAC_ROUTES.ROLE_MANAGEMENT,
    level: "root",
    component: lazy(() => import("../views/role-management-view")),
    metadata: {
      title: "Role Management",
      description: "Manage RBAC roles",
    },
    permissions: [RBAC_PERMISSIONS.MANAGE],
    requiresAuth: true,
  },
  [RBAC_ROUTES.USER_ROLE_ASSIGNMENT]: {
    id: RBAC_ROUTES.USER_ROLE_ASSIGNMENT,
    level: "root",
    component: lazy(() => import("../views/user-role-assignment-view")),
    metadata: {
      title: "User Role Assignment",
      description: "Assign roles to users",
    },
    permissions: [RBAC_PERMISSIONS.MANAGE],
    requiresAuth: true,
  },
};
