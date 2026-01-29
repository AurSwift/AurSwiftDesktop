/**
 * Users Feature Configuration
 *
 * Central configuration for the users feature.
 * This is used by the navigation system and dashboard.
 */

import { lazy } from "react";
import { Users } from "lucide-react";
import { USERS_PERMISSIONS } from "./permissions";
import { USERS_ROUTES } from "./navigation";
import type { FeatureConfig } from "@/features/dashboard/types/feature-config";
import type { ViewConfig } from "@/navigation/types";

/**
 * Users Feature Configuration for Dashboard
 */
export const usersFeature: FeatureConfig = {
  id: "user-management",
  title: "User Management",
  description: "Manage staff users",
  icon: Users,
  permissions: [USERS_PERMISSIONS.MANAGE],
  category: "management",
  order: 1,
  actions: [
    {
      id: "manage-users",
      label: "Manage Users",
      icon: Users,
      onClick: () => {}, // Will be injected by dashboard
      permissions: [USERS_PERMISSIONS.MANAGE],
    },
  ],
};

/**
 * Users Views Registry
 *
 * All views for the users feature are registered here.
 * This is spread into the main VIEW_REGISTRY.
 */
export const usersViews: Record<string, ViewConfig> = {
  [USERS_ROUTES.MANAGEMENT]: {
    id: USERS_ROUTES.MANAGEMENT,
    level: "root",
    component: lazy(() => import("../views/user-management-view")),
    metadata: {
      title: "User Management",
      description: "Manage staff users",
    },
    permissions: [USERS_PERMISSIONS.MANAGE],
    requiresAuth: true,
  },
};
