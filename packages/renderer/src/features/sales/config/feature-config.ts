/**
 * Sales Feature Configuration
 *
 * Central configuration for the sales feature.
 * This is used by the navigation system and dashboard.
 */

import { lazy } from "react";
import { ShoppingCart } from "lucide-react";
import { SALES_PERMISSIONS } from "./permissions";
import { SALES_ROUTES } from "./navigation";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import type { FeatureConfig } from "@/features/dashboard/types/feature-config";
import type { ViewConfig } from "@/navigation/types";

/**
 * Sales Feature Configuration for Dashboard
 */
export const salesFeature: FeatureConfig = {
  id: "sales",
  title: "Sales",
  description: "Process sales transactions",
  icon: ShoppingCart,
  permissions: [SALES_PERMISSIONS.READ, SALES_PERMISSIONS.WRITE],
  category: "actions",
  order: 0,
  actions: [
    {
      id: "new-sale",
      label: "New Sale",
      icon: ShoppingCart,
      onClick: () => {}, // Will be injected by dashboard
      permissions: [SALES_PERMISSIONS.WRITE],
    },
  ],
};

/**
 * Sales Views Registry
 *
 * All views for the sales feature are registered here.
 * This is spread into the main VIEW_REGISTRY.
 */
export const salesViews: Record<string, ViewConfig> = {
  [SALES_ROUTES.NEW_TRANSACTION]: {
    id: SALES_ROUTES.NEW_TRANSACTION,
    level: "root",
    component: lazy(() => import("../views/new-transaction-view")),
    metadata: {
      title: "New Transaction",
      description: "Create a new sale",
    },
    chrome: { showDashboardHeader: false },
    permissions: [SALES_PERMISSIONS.WRITE],
    requiresAuth: true,
  },
  [SALES_ROUTES.CASHIER_DASHBOARD]: {
    id: SALES_ROUTES.CASHIER_DASHBOARD,
    level: "root",
    component: lazy(() =>
      import("@/features/dashboard/views/cashier-dashboard-view"),
    ),
    metadata: {
      title: "Cashier Dashboard",
      description: "Cashier dashboard",
    },
    permissions: [SALES_PERMISSIONS.READ],
    requiresAuth: true,
  },
  [SALES_ROUTES.SALES_REPORTS]: {
    id: SALES_ROUTES.SALES_REPORTS,
    level: "root",
    component: lazy(() => import("../views/sales-reports-view")),
    metadata: {
      title: "Sales Reports",
      description: "Comprehensive sales analytics and reports",
    },
    permissions: [PERMISSIONS.REPORTS_READ],
    requiresAuth: true,
    defaultParams: { embeddedInDashboard: true },
  },
};
