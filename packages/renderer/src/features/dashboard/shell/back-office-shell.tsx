import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import type {
  PlanId,
  ServerFeatureFlag,
} from "@/features/subscription/config/plan-features";
import { checkFeatureAccess } from "@/features/subscription/utils/feature-access";
import { useLicenseContext } from "@/features/license";
import { useUserPermissions } from "@/features/dashboard/hooks/use-user-permissions";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useAuth } from "@/shared/hooks";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { getDashboardFeaturesForRole } from "@/features/dashboard/utils/dashboard-features";
import { useOptionalDashboardActions } from "@/features/dashboard/context/dashboard-actions-context";
import { getLogger } from "@/shared/utils/logger";
import { buildSidebarMenu } from "./sidebar-menu-builder";
import { BackOfficeTopbar } from "./back-office-topbar";
import { BackOfficeSidebar } from "./back-office-sidebar";
import type {
  SidebarActionItem,
  SidebarFeatureVisibility,
  SidebarLayoutMode,
  SidebarSelection,
} from "./sidebar-menu.types";

const logger = getLogger("back-office-shell");

interface BackOfficeShellProps {
  currentViewId: string;
  currentViewTitle?: string;
  children: ReactNode;
}

function findSelectedItem(
  groups: ReturnType<typeof buildSidebarMenu>["groups"],
  selection: SidebarSelection | null,
): SidebarActionItem | null {
  if (!selection) return null;
  for (const group of groups) {
    for (const item of group.items) {
      if (
        item.featureId === selection.featureId &&
        item.actionId === selection.actionId
      ) {
        return item;
      }
    }
  }
  return null;
}

export function BackOfficeShell({
  currentViewId,
  currentViewTitle,
  children,
}: BackOfficeShellProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const dashboardActions = useOptionalDashboardActions();
  const {
    hasAnyPermission,
    hasAllPermissions,
    isLoading: isPermissionsLoading,
  } = useUserPermissions();
  const { licenseStatus, planId } = useLicenseContext();

  const [lastSelected, setLastSelected] = useState<SidebarSelection | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const role = user ? getUserRoleName(user) : undefined;

  const features = useMemo(() => {
    return [...getDashboardFeaturesForRole(role)].sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0),
    );
  }, [role]);

  const featureVisibility = useMemo(() => {
    const currentPlan =
      (planId as PlanId | null) || (licenseStatus?.planId as PlanId | null);
    const availableFeatures =
      (licenseStatus?.features as ServerFeatureFlag[]) || [];

    const visibilityMap: Record<string, SidebarFeatureVisibility> = {};

    for (const feature of features) {
      if (isPermissionsLoading) {
        visibilityMap[feature.id] = {
          isVisible: false,
          canAccess: false,
          requiresUpgrade: false,
        };
        continue;
      }

      const hasPermission =
        !feature.permissions || feature.permissions.length === 0
          ? true
          : feature.requiredAll
            ? hasAllPermissions(feature.permissions)
            : hasAnyPermission(feature.permissions);

      if (!hasPermission) {
        visibilityMap[feature.id] = {
          isVisible: false,
          canAccess: false,
          requiresUpgrade: false,
        };
        continue;
      }

      const subscriptionAccess = checkFeatureAccess(
        currentPlan,
        availableFeatures,
        feature.id,
      );

      visibilityMap[feature.id] = {
        isVisible: true,
        canAccess: subscriptionAccess.canAccess,
        requiresUpgrade: subscriptionAccess.requiresUpgrade,
        upgradeMessage:
          feature.upgradePrompt?.message ||
          subscriptionAccess.reason ||
          (subscriptionAccess.upgradePlan
            ? `Upgrade to ${subscriptionAccess.upgradePlan} plan`
            : undefined),
      };
    }

    return visibilityMap;
  }, [
    features,
    hasAllPermissions,
    hasAnyPermission,
    isPermissionsLoading,
    licenseStatus?.features,
    licenseStatus?.planId,
    planId,
  ]);

  const menu = useMemo(
    () =>
      buildSidebarMenu({
        features,
        visibilityByFeature: featureVisibility,
        hasAnyPermission,
        isPermissionsLoading,
        currentViewId,
        lastSelected,
      }),
    [
      currentViewId,
      featureVisibility,
      features,
      hasAnyPermission,
      isPermissionsLoading,
      lastSelected,
    ],
  );

  const layoutMode: SidebarLayoutMode = isMobile
    ? "mobile-drawer"
    : isSidebarCollapsed
      ? "collapsed"
      : "expanded";

  const handleSidebarToggle = useCallback(() => {
    if (isMobile) {
      setIsMobileDrawerOpen((previous) => !previous);
      return;
    }

    setIsSidebarCollapsed((previous) => !previous);
  }, [isMobile]);

  const handleSidebarActionClick = useCallback(
    (item: SidebarActionItem) => {
      if (item.state === "disabled") return;

      const selection = { featureId: item.featureId, actionId: item.actionId };
      setLastSelected(selection);

      if (!dashboardActions) {
        logger.warn("Dashboard actions are unavailable in current context");
        return;
      }

      dashboardActions.handleActionClick(item.featureId, item.actionId);

      if (isMobile) {
        setIsMobileDrawerOpen(false);
      }
    },
    [dashboardActions, isMobile],
  );

  const activeGroupId =
    menu.activeGroupId ||
    lastSelected?.featureId ||
    menu.groups[0]?.featureId ||
    null;

  const activeGroup =
    (activeGroupId &&
      menu.groups.find((group) => group.featureId === activeGroupId)) ||
    null;

  const selectedItem =
    findSelectedItem(menu.groups, menu.activeSelection) ||
    findSelectedItem(menu.groups, lastSelected);

  const breadcrumbItems = useMemo(() => {
    const items: string[] = [];

    if (user?.businessName) {
      items.push(user.businessName);
    } else {
      items.push("Back Office");
    }

    if (activeGroup?.label) {
      items.push(activeGroup.label);
    }

    if (selectedItem?.label) {
      items.push(selectedItem.label);
    } else if (currentViewTitle) {
      items.push(currentViewTitle);
    }

    return items;
  }, [activeGroup?.label, currentViewTitle, selectedItem?.label, user?.businessName]);

  return (
    <div className="flex h-dvh min-h-screen flex-col bg-background text-foreground">
      <BackOfficeTopbar
        currentViewTitle={currentViewTitle}
        breadcrumbItems={breadcrumbItems}
        onSidebarToggle={handleSidebarToggle}
        isMobile={isMobile}
      />

      <div className="flex min-h-0 flex-1">
        <BackOfficeSidebar
          groups={menu.groups}
          layoutMode={layoutMode}
          isMobileDrawerOpen={isMobileDrawerOpen}
          onMobileDrawerOpenChange={setIsMobileDrawerOpen}
          onActionClick={handleSidebarActionClick}
          onToggleSidebarCollapsed={() =>
            setIsSidebarCollapsed((previous) => !previous)
          }
        />

        <main className="min-h-0 flex-1 overflow-hidden bg-background">{children}</main>
      </div>
    </div>
  );
}
