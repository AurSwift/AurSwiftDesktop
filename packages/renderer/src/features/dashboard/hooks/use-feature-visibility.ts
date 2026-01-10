/**
 * useFeatureVisibility Hook
 * 
 * Hook for determining if a feature should be visible based on user permissions
 * and subscription plan. Returns comprehensive access information.
 */

import { useMemo } from "react";
import { useUserPermissions } from "./use-user-permissions";
import { useFeatureAccess } from "@/features/subscription";
import type { FeatureConfig } from "../types/feature-config";
import type { PlanId } from "@/features/subscription/config/plan-features";

/**
 * Upgrade information for features requiring upgrade
 */
export interface UpgradeInfo {
  message: string;
  planId: PlanId;
}

/**
 * Comprehensive feature access information
 */
export interface FeatureVisibilityResult {
  isVisible: boolean; // Should feature be shown in UI (based on permissions)
  canAccess: boolean; // Can user actually use the feature (permissions + subscription)
  requiresUpgrade: boolean; // Does feature require subscription upgrade
  upgradeInfo?: UpgradeInfo; // Upgrade prompt information
}

/**
 * Check if a feature should be visible and accessible based on permissions and subscription
 * 
 * @param feature - Feature configuration to check
 * @returns FeatureVisibilityResult with comprehensive access information
 */
export function useFeatureVisibility(
  feature: FeatureConfig
): FeatureVisibilityResult {
  const { hasAnyPermission, hasAllPermissions, isLoading } = useUserPermissions();
  const subscriptionAccess = useFeatureAccess(feature.id);

  return useMemo(() => {
    // Don't show features while loading permissions
    if (isLoading) {
      return {
        isVisible: false,
        canAccess: false,
        requiresUpgrade: false,
      };
    }

    // Check permissions first
    const hasPermission =
      !feature.permissions || feature.permissions.length === 0
        ? true // No permissions required = always visible
        : feature.requiredAll
        ? hasAllPermissions(feature.permissions)
        : hasAnyPermission(feature.permissions);

    // If no permission, feature is not visible
    if (!hasPermission) {
      return {
        isVisible: false,
        canAccess: false,
        requiresUpgrade: false,
      };
    }

    // Feature is visible based on permissions
    // Now check subscription access
    const canAccess = hasPermission && subscriptionAccess.canAccess;
    const requiresUpgrade = subscriptionAccess.requiresUpgrade;

    // Build upgrade info from feature config or subscription check
    let upgradeInfo: UpgradeInfo | undefined;
    if (requiresUpgrade && subscriptionAccess.upgradePlan) {
      upgradeInfo = feature.upgradePrompt || {
        message:
          subscriptionAccess.reason ||
          `This feature requires ${subscriptionAccess.upgradePlan} plan`,
        planId: subscriptionAccess.upgradePlan,
      };
    }

    return {
      isVisible: hasPermission, // Show if has permission (even if needs upgrade)
      canAccess,
      requiresUpgrade,
      upgradeInfo,
    };
  }, [
    isLoading,
    hasAnyPermission,
    hasAllPermissions,
    feature.permissions,
    feature.requiredAll,
    feature.id,
    feature.upgradePrompt,
    subscriptionAccess,
  ]);
}

/**
 * Simplified hook for backward compatibility
 * Returns just boolean visibility (shows feature even if requires upgrade)
 * 
 * @param feature - Feature configuration to check
 * @returns Whether the feature should be visible
 * @deprecated Use useFeatureVisibility() for comprehensive access info
 */
export function useIsFeatureVisible(feature: FeatureConfig): boolean {
  const result = useFeatureVisibility(feature);
  return result.isVisible;
}

