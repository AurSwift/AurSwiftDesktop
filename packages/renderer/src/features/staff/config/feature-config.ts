/**
 * Staff Feature Configuration
 *
 * Central configuration for the staff feature.
 * This is used by the navigation system and dashboard.
 */

import { lazy } from "react";
import { Users, Coffee } from "lucide-react";
import { STAFF_PERMISSIONS } from "./permissions";
import { STAFF_ROUTES } from "./navigation";
import type { FeatureConfig } from "@/features/dashboard/types/feature-config";
import type { ViewConfig } from "@/navigation/types";

/**
 * Staff Feature Configuration for Dashboard
 */
export const staffFeature: FeatureConfig = {
  id: "staff-management",
  title: "Staff Management",
  description: "Manage cashiers and staff schedules",
  icon: Users,
  permissions: [STAFF_PERMISSIONS.MANAGE],
  category: "management",
  order: 3,
  actions: [
    {
      id: "manage-cashiers",
      label: "Manage Cashiers",
      icon: Users,
      onClick: () => {}, // Will be injected by dashboard
      permissions: [STAFF_PERMISSIONS.MANAGE],
    },
    {
      id: "staff-schedules",
      label: "Staff Schedules",
      icon: Users,
      onClick: () => {},
      permissions: [STAFF_PERMISSIONS.MANAGE],
    },
    {
      id: "break-policies",
      label: "Break Policies",
      icon: Coffee,
      onClick: () => {},
      permissions: [STAFF_PERMISSIONS.MANAGE_BREAK_POLICIES],
    },
  ],
};

/**
 * Staff Views Registry
 *
 * All views for the staff feature are registered here.
 * This is spread into the main VIEW_REGISTRY.
 */
export const staffViews: Record<string, ViewConfig> = {
  [STAFF_ROUTES.MANAGE_CASHIERS]: {
    id: STAFF_ROUTES.MANAGE_CASHIERS,
    level: "root",
    component: lazy(() => import("../views/manage-cashier-view")),
    metadata: {
      title: "Cashier Management",
      description: "Manage cashiers",
    },
    permissions: [STAFF_PERMISSIONS.MANAGE],
    requiresAuth: true,
  },
  [STAFF_ROUTES.SCHEDULES]: {
    id: STAFF_ROUTES.SCHEDULES,
    level: "root",
    component: lazy(() => import("../views/staff-schedules-view")),
    metadata: {
      title: "Staff Schedules",
      description: "Manage staff schedules",
    },
    permissions: [
      STAFF_PERMISSIONS.MANAGE_SCHEDULES,
      STAFF_PERMISSIONS.MANAGE_CASHIER_SCHEDULES,
    ], // Allow both admins and managers
    requiresAuth: true,
  },
  [STAFF_ROUTES.BREAK_POLICIES]: {
    id: STAFF_ROUTES.BREAK_POLICIES,
    level: "root",
    component: lazy(() => import("../views/break-policy-settings-view")),
    metadata: {
      title: "Break Policies",
      description: "Configure break types and rules for staff",
    },
    permissions: [STAFF_PERMISSIONS.MANAGE_BREAK_POLICIES],
    requiresAuth: true,
  },

  [STAFF_ROUTES.TIME_REPORTS]: {
    id: STAFF_ROUTES.TIME_REPORTS,
    level: "root",
    component: lazy(() => import("../views/staff-time-reports-view")),
    metadata: {
      title: "Time & Break Reports",
      description: "Review staff shifts, breaks, and compliance",
    },
    // Allow both admins and managers (any-of)
    permissions: [
      STAFF_PERMISSIONS.MANAGE_SCHEDULES,
      STAFF_PERMISSIONS.MANAGE_CASHIER_SCHEDULES,
    ],
    requiresAuth: true,
  },

  [STAFF_ROUTES.TIME_CORRECTIONS]: {
    id: STAFF_ROUTES.TIME_CORRECTIONS,
    level: "root",
    component: lazy(() => import("../views/staff-time-corrections-view")),
    metadata: {
      title: "Time Corrections",
      description: "Audit and review time overrides and corrections",
    },
    // Allow both admins and managers (any-of)
    permissions: [
      STAFF_PERMISSIONS.MANAGE_SCHEDULES,
      STAFF_PERMISSIONS.MANAGE_CASHIER_SCHEDULES,
    ],
    requiresAuth: true,
  },
};
