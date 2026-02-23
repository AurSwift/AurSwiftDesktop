import { getFeatureMenuLabel } from "@/features/dashboard/config/feature-menu-labels";
import { SYSTEM_SETTINGS_EXTRA_ACTIONS } from "@/features/dashboard/config/system-settings-actions";
import type { FeatureConfig } from "@/features/dashboard/types/feature-config";
import { mapActionToView } from "@/features/navigation/utils/navigation-mapper";
import type {
  SidebarActionItem,
  SidebarFeatureVisibility,
  SidebarGroupConfig,
  SidebarMenuViewModel,
  SidebarSelection,
} from "./sidebar-menu.types";

interface BuildSidebarMenuInput {
  features: FeatureConfig[];
  visibilityByFeature: Record<string, SidebarFeatureVisibility>;
  hasAnyPermission: (permissions: string[]) => boolean;
  isPermissionsLoading: boolean;
  currentViewId: string;
  lastSelected: SidebarSelection | null;
}

const NON_ROUTE_HANDLED_ACTIONS = new Set([
  ...SYSTEM_SETTINGS_EXTRA_ACTIONS.map(
    ({ id }) => `system-settings:${id}`,
  ),
  "database-management:import-database",
  "database-management:backup-database",
  "database-management:empty-database",
]);

function toMappedViewId(
  mapped: ReturnType<typeof mapActionToView>,
): string | undefined {
  if (!mapped) return undefined;
  return typeof mapped === "string" ? mapped : mapped.viewId;
}

function isActionHandled(featureId: string, actionId: string): boolean {
  const mapped = mapActionToView(featureId, actionId);
  if (mapped) return true;
  return NON_ROUTE_HANDLED_ACTIONS.has(`${featureId}:${actionId}`);
}

function buildActionItem({
  featureId,
  actionId,
  label,
  icon,
  disabledReason,
  isActive,
}: {
  featureId: string;
  actionId: string;
  label: string;
  icon: SidebarActionItem["icon"];
  disabledReason?: string;
  isActive: boolean;
}): SidebarActionItem {
  return {
    key: `${featureId}:${actionId}`,
    featureId,
    actionId,
    label,
    icon,
    state: disabledReason ? "disabled" : "enabled",
    disabledReason,
    isActive,
  };
}

function withLastSelectedFallback(
  groups: SidebarGroupConfig[],
  fallback: SidebarSelection,
): SidebarGroupConfig[] {
  return groups.map((group) => {
    const items = group.items.map((item) => ({
      ...item,
      isActive:
        item.featureId === fallback.featureId && item.actionId === fallback.actionId,
    }));

    return {
      ...group,
      items,
      isActive: items.some((item) => item.isActive),
    };
  });
}

export function buildSidebarMenu({
  features,
  visibilityByFeature,
  hasAnyPermission,
  isPermissionsLoading,
  currentViewId,
  lastSelected,
}: BuildSidebarMenuInput): SidebarMenuViewModel {
  let activeSelection: SidebarSelection | null = null;

  let groups = features
    .map((feature) => {
      const visibility = visibilityByFeature[feature.id];
      if (!visibility?.isVisible) return null;

      const featureDisabledReason = !visibility.canAccess
        ? visibility.upgradeMessage || "Upgrade required to access this feature"
        : undefined;

      const featureItems: SidebarActionItem[] = feature.actions
        .map((action) => {
          if (
            isPermissionsLoading &&
            action.permissions &&
            action.permissions.length > 0
          ) {
            return null;
          }

          if (
            action.permissions &&
            action.permissions.length > 0 &&
            !hasAnyPermission(action.permissions)
          ) {
            return null;
          }

          const mappedViewId = toMappedViewId(mapActionToView(feature.id, action.id));
          const actionIsActive = mappedViewId === currentViewId;

          if (actionIsActive && !activeSelection) {
            activeSelection = { featureId: feature.id, actionId: action.id };
          }

          let disabledReason = featureDisabledReason;
          if (!disabledReason && !isActionHandled(feature.id, action.id)) {
            disabledReason = "Not available yet";
          }

          return buildActionItem({
            featureId: feature.id,
            actionId: action.id,
            label: action.label,
            icon: action.icon,
            disabledReason,
            isActive: actionIsActive,
          });
        })
        .filter(Boolean) as SidebarActionItem[];

      if (feature.id === "system-settings") {
        for (const extra of SYSTEM_SETTINGS_EXTRA_ACTIONS) {
          const mappedViewId = toMappedViewId(
            mapActionToView("system-settings", extra.id),
          );
          const actionIsActive = mappedViewId === currentViewId;

          if (actionIsActive && !activeSelection) {
            activeSelection = {
              featureId: "system-settings",
              actionId: extra.id,
            };
          }

          featureItems.push(
            buildActionItem({
              featureId: "system-settings",
              actionId: extra.id,
              label: extra.label,
              icon: extra.icon,
              disabledReason: featureDisabledReason,
              isActive: actionIsActive,
            }),
          );
        }
      }

      if (featureItems.length === 0) return null;

      return {
        featureId: feature.id,
        category: feature.category,
        label: getFeatureMenuLabel(feature),
        icon: feature.icon,
        items: featureItems,
        isActive: featureItems.some((item) => item.isActive),
        requiresUpgrade: visibility.requiresUpgrade,
        upgradeMessage: visibility.upgradeMessage,
      } satisfies SidebarGroupConfig;
    })
    .filter(Boolean) as SidebarGroupConfig[];

  if (!activeSelection && lastSelected) {
    const fallbackExists = groups.some((group) =>
      group.items.some(
        (item) =>
          item.featureId === lastSelected.featureId &&
          item.actionId === lastSelected.actionId,
      ),
    );

    if (fallbackExists) {
      groups = withLastSelectedFallback(groups, lastSelected);
      activeSelection = lastSelected;
    }
  }

  const activeGroupId = groups.find((group) => group.isActive)?.featureId || null;

  return {
    groups,
    activeSelection,
    activeGroupId,
  };
}
