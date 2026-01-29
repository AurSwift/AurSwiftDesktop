/**
 * Inventory Feature Configuration
 *
 * Central configuration for the inventory feature.
 * This is used by the navigation system and dashboard.
 *
 * NOTE: This file will be updated as views are migrated to the new structure.
 */

import { lazy } from "react";
import { Package } from "lucide-react";
import { INVENTORY_PERMISSIONS } from "./permissions";
import { INVENTORY_ROUTES } from "./navigation";
import type { FeatureConfig } from "@/features/dashboard/types/feature-config";
import type { ViewConfig } from "@/navigation/types";

// Reuse single lazy refs when same component backs multiple view ids
const LazyProductManagementView = lazy(() =>
  import("../views/product-management-view"),
);
const LazyBatchManagementView = lazy(() =>
  import("../views/batch-management-view"),
);

/**
 * Inventory Feature Configuration for Dashboard
 */
export const inventoryFeature: FeatureConfig = {
  id: "inventory",
  title: "Inventory Management",
  description: "Manage products, batches, and stock levels",
  icon: Package,
  permissions: [INVENTORY_PERMISSIONS.READ, INVENTORY_PERMISSIONS.MANAGE],
  category: "management",
  order: 1,
  actions: [
    {
      id: "view-products",
      label: "View Products",
      icon: Package,
      onClick: () => {}, // Will be injected by dashboard
      permissions: [INVENTORY_PERMISSIONS.READ],
    },
    {
      id: "manage-products",
      label: "Manage Products",
      icon: Package,
      onClick: () => {},
      permissions: [INVENTORY_PERMISSIONS.MANAGE],
    },
    {
      id: "manage-batches",
      label: "Manage Batches",
      icon: Package,
      onClick: () => {},
      permissions: [INVENTORY_PERMISSIONS.MANAGE_BATCHES],
    },
    {
      id: "manage-categories",
      label: "Manage Categories",
      icon: Package,
      onClick: () => {},
      permissions: [INVENTORY_PERMISSIONS.MANAGE_CATEGORIES],
    },
  ],
};

/**
 * View Registry for Inventory Feature
 *
 * All views in the inventory feature are registered here.
 * This is used by the navigation system.
 *
 * NOTE: These will be updated to use new view locations after migration.
 */
export const inventoryViews: Record<string, ViewConfig> = {
  // Main product management view (will become inventory dashboard)
  [INVENTORY_ROUTES.DASHBOARD]: {
    id: INVENTORY_ROUTES.DASHBOARD,
    level: "root",
    component: LazyProductManagementView, // TODO: Replace with InventoryDashboardView after migration
    // Tracking: docs/TODO_TRACKING.md#3
    metadata: {
      title: "Inventory Dashboard",
      description: "Overview of inventory status",
    },
    permissions: [INVENTORY_PERMISSIONS.READ],
    requiresAuth: true,
  },

  // Product management (legacy route - will be mapped to new routes)
  [INVENTORY_ROUTES.PRODUCT_MANAGEMENT]: {
    id: INVENTORY_ROUTES.PRODUCT_MANAGEMENT,
    level: "root",
    component: lazy(() =>
      import("../wrappers/product-management-wrapper").then((m) => ({
        default: m.ProductManagementWrapper,
      })),
    ),
    metadata: {
      title: "Product Management",
      description: "Manage products and inventory",
    },
    permissions: [INVENTORY_PERMISSIONS.MANAGE],
    requiresAuth: true,
  },

  // Nested views within Product Management
  [INVENTORY_ROUTES.PRODUCT_DASHBOARD]: {
    id: INVENTORY_ROUTES.PRODUCT_DASHBOARD,
    level: "nested",
    parentId: INVENTORY_ROUTES.PRODUCT_MANAGEMENT,
    component: lazy(() => import("../views/inventory-dashboard-view")),
    metadata: {
      title: "Product Dashboard",
      breadcrumb: "Dashboard",
    },
    permissions: [INVENTORY_PERMISSIONS.READ],
    requiresAuth: true,
  },

  [INVENTORY_ROUTES.PRODUCT_LIST]: {
    id: INVENTORY_ROUTES.PRODUCT_LIST,
    level: "nested",
    parentId: INVENTORY_ROUTES.PRODUCT_MANAGEMENT,
    component: LazyProductManagementView, // Rendered internally
    metadata: {
      title: "Product List",
      breadcrumb: "Products",
    },
    permissions: [INVENTORY_PERMISSIONS.READ],
    requiresAuth: true,
  },

  [INVENTORY_ROUTES.PRODUCT_DETAILS_NESTED]: {
    id: INVENTORY_ROUTES.PRODUCT_DETAILS_NESTED,
    level: "nested",
    parentId: INVENTORY_ROUTES.PRODUCT_MANAGEMENT,
    component: lazy(() => import("../views/product-details-view")),
    metadata: {
      title: "Product Details",
      breadcrumb: "Details",
    },
    permissions: [INVENTORY_PERMISSIONS.READ],
    requiresAuth: true,
    defaultParams: { productId: null },
  },

  // Category management
  [INVENTORY_ROUTES.CATEGORY_MANAGEMENT]: {
    id: INVENTORY_ROUTES.CATEGORY_MANAGEMENT,
    level: "nested",
    parentId: INVENTORY_ROUTES.PRODUCT_MANAGEMENT,
    component: lazy(() => import("../views/category-management-view")),
    metadata: {
      title: "Category Management",
      breadcrumb: "Categories",
    },
    permissions: [INVENTORY_PERMISSIONS.MANAGE_CATEGORIES],
    requiresAuth: true,
  },

  // Batch management
  [INVENTORY_ROUTES.BATCH_MANAGEMENT]: {
    id: INVENTORY_ROUTES.BATCH_MANAGEMENT,
    level: "nested",
    parentId: INVENTORY_ROUTES.PRODUCT_MANAGEMENT,
    component: lazy(() =>
      import("../wrappers/batch-management-wrapper").then((m) => ({
        default: m.BatchManagementWrapper,
      })),
    ),
    metadata: {
      title: "Batch Management",
      breadcrumb: "Batches",
    },
    permissions: [INVENTORY_PERMISSIONS.READ],
    requiresAuth: true,
  },

  // Nested views within Batch Management
  [INVENTORY_ROUTES.BATCH_DASHBOARD]: {
    id: INVENTORY_ROUTES.BATCH_DASHBOARD,
    level: "nested",
    parentId: INVENTORY_ROUTES.BATCH_MANAGEMENT,
    component: LazyBatchManagementView, // Rendered internally
    metadata: {
      title: "Batch Dashboard",
      breadcrumb: "Dashboard",
    },
    permissions: [INVENTORY_PERMISSIONS.READ],
    requiresAuth: true,
  },

  [INVENTORY_ROUTES.BATCH_LIST]: {
    id: INVENTORY_ROUTES.BATCH_LIST,
    level: "nested",
    parentId: INVENTORY_ROUTES.BATCH_MANAGEMENT,
    component: LazyBatchManagementView, // Rendered internally
    metadata: {
      title: "Batch List",
      breadcrumb: "All Batches",
    },
    permissions: [INVENTORY_PERMISSIONS.READ],
    requiresAuth: true,
  },

  [INVENTORY_ROUTES.EXPIRY_ALERTS]: {
    id: INVENTORY_ROUTES.EXPIRY_ALERTS,
    level: "nested",
    parentId: INVENTORY_ROUTES.BATCH_MANAGEMENT,
    component: lazy(() =>
      import("../views/expiry-dashboard-view").then((m) => ({
        default: m.ExpiryDashboardView,
      })),
    ),
    metadata: {
      title: "Expiry Alerts",
      breadcrumb: "Alerts",
    },
    permissions: [INVENTORY_PERMISSIONS.READ],
    requiresAuth: true,
  },

  // Stock movement history
  [INVENTORY_ROUTES.STOCK_MOVEMENT_HISTORY]: {
    id: INVENTORY_ROUTES.STOCK_MOVEMENT_HISTORY,
    level: "nested",
    parentId: INVENTORY_ROUTES.PRODUCT_MANAGEMENT,
    component: lazy(() => import("../views/stock-movement-history-view")),
    metadata: {
      title: "Stock Movement History",
      breadcrumb: "History",
    },
    permissions: [INVENTORY_PERMISSIONS.VIEW_HISTORY],
    requiresAuth: true,
  },
};
