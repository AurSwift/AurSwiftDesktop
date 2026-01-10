/**
 * Feature Registry
 *
 * Central registry of all dashboard features.
 * This is the single source of truth for feature definitions.
 *
 * Features are automatically filtered based on user permissions.
 */

import {
  Users,
  Shield,
  Settings,
  Store,
  BarChart3,
  TrendingUp,
  ShoppingCart,
  ShoppingBag,
  Package,
  Upload,
  Download,
  Trash2,
  Calendar,
  Brain,
} from "lucide-react";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import type { FeatureConfig } from "../types/feature-config";
import type { ServerFeatureFlag } from "@/features/subscription/config/plan-features";

/**
 * Feature Registry
 *
 * All dashboard features with their permissions and actions.
 * Features are automatically shown/hidden based on user permissions.
 */
export const FEATURE_REGISTRY: FeatureConfig[] = [
  // ============================================================================
  // User Management
  // ============================================================================
  {
    id: "user-management",
    title: "User Management",
    description: "Manage staff and permissions",
    icon: Users,
    permissions: [PERMISSIONS.USERS_MANAGE],
    category: "management",
    order: 1,
    // Available to all plans (no subscription requirement)
    actions: [
      {
        id: "manage-users",
        label: "Manage Users",
        icon: Users,
        onClick: () => {}, // Will be injected by dashboard
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
      {
        id: "role-permissions",
        label: "Role Permissions",
        icon: Shield,
        onClick: () => {},
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
      {
        id: "user-role-assignment",
        label: "User Role Assignment",
        icon: Settings,
        onClick: () => {},
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
      {
        id: "staff-schedules",
        label: "Staff Schedules",
        icon: Calendar,
        onClick: () => {},
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
    ],
  },

  // ============================================================================
  // Management Actions
  // ============================================================================
  {
    id: "management-actions",
    title: "Inventory Actions",
    description: "Store operations and oversight",
    icon: ShoppingBag,
    permissions: [
      PERMISSIONS.SALES_WRITE,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.TRANSACTIONS_OVERRIDE,
      PERMISSIONS.USERS_MANAGE,
    ],
    category: "actions",
    order: 2,
    // Available to all plans (no subscription requirement)
    actions: [
      {
        id: "new-sale",
        label: "New Sale",
        icon: ShoppingCart,
        onClick: () => {},
        permissions: [PERMISSIONS.SALES_WRITE],
      },
      {
        id: "apply-discount",
        label: "Apply Discount",
        icon: TrendingUp,
        onClick: () => {},
        permissions: [PERMISSIONS.DISCOUNTS_APPLY],
      },
      {
        id: "manage-inventory",
        label: "Manage Inventory",
        icon: Package,
        onClick: () => {},
        permissions: [PERMISSIONS.INVENTORY_MANAGE],
      },
      {
        id: "sales-reports",
        label: "Sales Reports",
        icon: BarChart3,
        onClick: () => {},
        permissions: [PERMISSIONS.REPORTS_READ],
      },
    ],
  },

  // ============================================================================
  // System Settings
  // ============================================================================
  {
    id: "system-settings",
    title: "System Settings",
    description: "Configure system preferences",
    icon: Settings,
    permissions: [PERMISSIONS.SETTINGS_MANAGE],
    category: "settings",
    order: 3,
    // Available to all plans (no subscription requirement)
    actions: [
      {
        id: "general-settings",
        label: "General Settings",
        icon: Settings,
        onClick: () => {},
        permissions: [PERMISSIONS.SETTINGS_MANAGE],
      },
      {
        id: "store-configuration",
        label: "Terminal Configuration",
        icon: Store,
        onClick: () => {},
        permissions: [PERMISSIONS.SETTINGS_MANAGE],
      },
      {
        id: "security-settings",
        label: "Security Settings",
        icon: Shield,
        onClick: () => {},
        permissions: [PERMISSIONS.SETTINGS_MANAGE],
      },
    ],
  },

  // ============================================================================
  // Database Management
  // ============================================================================
  {
    id: "database-management",
    title: "DB Management",
    description: "Database backup and maintenance",
    icon: Download,
    permissions: [PERMISSIONS.SETTINGS_MANAGE], // Only admins typically have this
    category: "settings",
    order: 4,
    // Available to all plans (no subscription requirement)
    actions: [
      {
        id: "import-database",
        label: "Import Database",
        icon: Upload,
        onClick: () => {},
        permissions: [PERMISSIONS.SETTINGS_MANAGE],
      },
      {
        id: "backup-database",
        label: "Backup Database",
        icon: Download,
        onClick: () => {},
        permissions: [PERMISSIONS.SETTINGS_MANAGE],
      },
      {
        id: "empty-database",
        label: "Empty Database",
        icon: Trash2,
        onClick: () => {},
        permissions: [PERMISSIONS.SETTINGS_MANAGE],
        variant: "destructive",
      },
    ],
  },

  // ============================================================================
  // Quick Actions
  // ============================================================================
  {
    id: "quick-actions",
    title: "Quick Actions",
    description: "Common tasks",
    icon: ShoppingCart,
    permissions: [PERMISSIONS.SALES_WRITE, PERMISSIONS.USERS_MANAGE],
    category: "actions",
    order: 5,
    // Available to all plans (no subscription requirement)
    actions: [
      {
        id: "quick-new-sale",
        label: "New Sale",
        icon: ShoppingCart,
        onClick: () => {},
        permissions: [PERMISSIONS.SALES_WRITE],
        variant: "default",
      },
      {
        id: "quick-manage-users",
        label: "Manage Users",
        icon: Users,
        onClick: () => {},
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
    ],
  },

  // ============================================================================
  // Advanced Reporting & Analytics
  // ============================================================================
  {
    id: "advanced-reporting-analytics",
    title: "Advanced Reporting & Analytics",
    description: "Comprehensive business intelligence and analytics",
    icon: Brain,
    permissions: [PERMISSIONS.REPORTS_READ, PERMISSIONS.ANALYTICS_VIEW],
    category: "reports",
    order: 6,
    requiredPlan: "professional",
    requiredFeatures: ["advanced_reporting" as ServerFeatureFlag],
    upgradePrompt: {
      message:
        "Upgrade to Professional plan to access advanced reporting, analytics, and business intelligence features",
      planId: "professional",
    },
    actions: [
      {
        id: "sales-reports",
        label: "Sales Reports",
        icon: BarChart3,
        onClick: () => {},
        permissions: [PERMISSIONS.REPORTS_READ],
      },
      {
        id: "staff-reports",
        label: "Staff Reports",
        icon: Users,
        onClick: () => {},
        permissions: [PERMISSIONS.REPORTS_READ],
      },
      {
        id: "inventory-reports",
        label: "Inventory Reports",
        icon: Package,
        onClick: () => {},
        permissions: [PERMISSIONS.REPORTS_READ],
      },
      {
        id: "business-intelligence",
        label: "Business Intelligence",
        icon: Brain,
        onClick: () => {},
        permissions: [PERMISSIONS.ANALYTICS_VIEW],
      },
    ],
  },
];

/**
 * Get features by category
 *
 * @param category - Feature category to filter by
 * @returns Array of features in the specified category
 */
export function getFeaturesByCategory(
  category: FeatureConfig["category"]
): FeatureConfig[] {
  return FEATURE_REGISTRY.filter((feature) => feature.category === category);
}

/**
 * Get feature by ID
 *
 * @param id - Feature ID
 * @returns Feature configuration or undefined
 */
export function getFeatureById(id: string): FeatureConfig | undefined {
  return FEATURE_REGISTRY.find((feature) => feature.id === id);
}

/**
 * Get all feature IDs
 *
 * @returns Array of all feature IDs
 */
export function getAllFeatureIds(): string[] {
  return FEATURE_REGISTRY.map((feature) => feature.id);
}
