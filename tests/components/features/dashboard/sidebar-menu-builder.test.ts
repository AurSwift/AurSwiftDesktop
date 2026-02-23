import { describe, expect, it } from "vitest";
import { Settings, Shield, TrendingUp } from "lucide-react";
import type { FeatureConfig } from "@/features/dashboard/types/feature-config";
import { buildSidebarMenu } from "@/features/dashboard/shell/sidebar-menu-builder";
import type { SidebarFeatureVisibility } from "@/features/dashboard/shell/sidebar-menu.types";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import { SALES_ROUTES } from "@/features/sales/config/navigation";

function getVisibility(
  featureId: string,
  overrides: Partial<SidebarFeatureVisibility> = {},
): Record<string, SidebarFeatureVisibility> {
  return {
    [featureId]: {
      isVisible: true,
      canAccess: true,
      requiresUpgrade: false,
      ...overrides,
    },
  };
}

describe("buildSidebarMenu", () => {
  it("marks unmapped actions as disabled and activates mapped route action", () => {
    const feature: FeatureConfig = {
      id: "management-actions",
      title: "Inventory Actions",
      description: "Actions",
      icon: TrendingUp,
      permissions: [PERMISSIONS.INVENTORY_MANAGE],
      category: "actions",
      actions: [
        {
          id: "apply-discount",
          label: "Apply Discount",
          icon: TrendingUp,
        },
        {
          id: "sales-reports",
          label: "Sales Reports",
          icon: TrendingUp,
        },
      ],
    };

    const menu = buildSidebarMenu({
      features: [feature],
      visibilityByFeature: getVisibility(feature.id),
      hasAnyPermission: () => true,
      isPermissionsLoading: false,
      currentViewId: SALES_ROUTES.SALES_REPORTS,
      lastSelected: null,
    });

    expect(menu.groups).toHaveLength(1);
    const applyDiscount = menu.groups[0].items.find((item) => item.actionId === "apply-discount");
    const salesReports = menu.groups[0].items.find((item) => item.actionId === "sales-reports");

    expect(applyDiscount?.state).toBe("disabled");
    expect(applyDiscount?.disabledReason).toBe("Not available yet");
    expect(salesReports?.state).toBe("enabled");
    expect(salesReports?.isActive).toBe(true);
    expect(menu.groups[0].category).toBe("actions");
    expect(menu.activeGroupId).toBe("management-actions");
  });

  it("injects system settings extras and keeps them enabled when feature is accessible", () => {
    const feature: FeatureConfig = {
      id: "system-settings",
      title: "System Settings",
      description: "Settings",
      icon: Settings,
      permissions: [PERMISSIONS.SETTINGS_MANAGE],
      category: "settings",
      actions: [
        {
          id: "general-settings",
          label: "General Settings",
          icon: Settings,
        },
      ],
    };

    const menu = buildSidebarMenu({
      features: [feature],
      visibilityByFeature: getVisibility(feature.id),
      hasAnyPermission: () => true,
      isPermissionsLoading: false,
      currentViewId: "dashboard",
      lastSelected: null,
    });

    const ids = menu.groups[0].items.map((item) => item.actionId);
    expect(menu.groups[0].category).toBe("settings");
    expect(ids).toContain("show-license-info");
    expect(ids).not.toContain("change-pin");
    expect(ids).not.toContain("logout");
    expect(ids).not.toContain("quit-app");

    const licenseInfoItem = menu.groups[0].items.find(
      (item) => item.actionId === "show-license-info",
    );
    expect(licenseInfoItem?.state).toBe("enabled");
  });

  it("filters out actions when permission checks fail", () => {
    const feature: FeatureConfig = {
      id: "user-management",
      title: "User Management",
      description: "Users",
      icon: Shield,
      permissions: [PERMISSIONS.USERS_MANAGE],
      category: "management",
      actions: [
        {
          id: "manage-users",
          label: "Manage Users",
          icon: Shield,
          permissions: [PERMISSIONS.USERS_MANAGE],
        },
      ],
    };

    const menu = buildSidebarMenu({
      features: [feature],
      visibilityByFeature: getVisibility(feature.id),
      hasAnyPermission: () => false,
      isPermissionsLoading: false,
      currentViewId: "dashboard",
      lastSelected: null,
    });

    expect(menu.groups).toHaveLength(0);
  });

  it("disables all feature actions when feature requires upgrade", () => {
    const feature: FeatureConfig = {
      id: "advanced-reporting-analytics",
      title: "Reports",
      description: "Reports",
      icon: Shield,
      permissions: [PERMISSIONS.REPORTS_READ],
      category: "reports",
      actions: [
        {
          id: "sales-reports",
          label: "Sales Reports",
          icon: Shield,
        },
      ],
    };

    const menu = buildSidebarMenu({
      features: [feature],
      visibilityByFeature: getVisibility(feature.id, {
        canAccess: false,
        requiresUpgrade: true,
        upgradeMessage: "Upgrade to Professional",
      }),
      hasAnyPermission: () => true,
      isPermissionsLoading: false,
      currentViewId: "dashboard",
      lastSelected: null,
    });

    expect(menu.groups).toHaveLength(1);
    expect(menu.groups[0].items[0].state).toBe("disabled");
    expect(menu.groups[0].items[0].disabledReason).toBe("Upgrade to Professional");
  });

  it("keeps activeGroupId null when current route does not map to any action", () => {
    const feature: FeatureConfig = {
      id: "management-actions",
      title: "Inventory Actions",
      description: "Actions",
      icon: TrendingUp,
      permissions: [PERMISSIONS.INVENTORY_MANAGE],
      category: "actions",
      actions: [
        {
          id: "apply-discount",
          label: "Apply Discount",
          icon: TrendingUp,
        },
      ],
    };

    const menu = buildSidebarMenu({
      features: [feature],
      visibilityByFeature: getVisibility(feature.id),
      hasAnyPermission: () => true,
      isPermissionsLoading: false,
      currentViewId: "dashboard",
      lastSelected: null,
    });

    expect(menu.activeGroupId).toBeNull();
  });

  it("uses lastSelected fallback as active selection when route is ambiguous", () => {
    const feature: FeatureConfig = {
      id: "system-settings",
      title: "System Settings",
      description: "Settings",
      icon: Settings,
      permissions: [PERMISSIONS.SETTINGS_MANAGE],
      category: "settings",
      actions: [
        {
          id: "general-settings",
          label: "General Settings",
          icon: Settings,
        },
      ],
    };

    const menu = buildSidebarMenu({
      features: [feature],
      visibilityByFeature: getVisibility(feature.id),
      hasAnyPermission: () => true,
      isPermissionsLoading: false,
      currentViewId: "dashboard",
      lastSelected: {
        featureId: "system-settings",
        actionId: "show-license-info",
      },
    });

    const selected = menu.groups[0].items.find(
      (item) => item.actionId === "show-license-info",
    );
    expect(selected?.isActive).toBe(true);
    expect(menu.activeGroupId).toBe("system-settings");
  });
});
