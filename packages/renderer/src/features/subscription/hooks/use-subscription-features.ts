/**
 * Subscription Feature Hooks
 *
 * React hooks for checking subscription-based feature access.
 */

import { useMemo } from "react";
import { useLicenseContext } from "@/features/license";
import type { ServerFeatureFlag, PlanId } from "../config/plan-features";
import {
  checkFeatureAccess,
  hasFeatureFlag,
  hasAllFeatureFlags,
  type FeatureAccessResult,
} from "../utils/feature-access";

/**
 * Hook to check if user has a specific subscription feature flag
 *
 * @param featureFlag - Feature flag to check
 * @returns boolean indicating if feature is available
 */
export function useHasSubscriptionFeature(
  featureFlag: ServerFeatureFlag
): boolean {
  const { licenseStatus } = useLicenseContext();

  return useMemo(() => {
    if (!licenseStatus?.features) {
      return false;
    }

    // Convert feature flags from server (strings) to ServerFeatureFlag type
    const availableFeatures = licenseStatus.features as ServerFeatureFlag[];

    return hasFeatureFlag(availableFeatures, featureFlag);
  }, [licenseStatus?.features, featureFlag]);
}

/**
 * Hook to check if user can access a dashboard feature
 *
 * @param featureId - Dashboard feature ID to check
 * @returns FeatureAccessResult with access information
 */
export function useCanAccessFeature(
  featureId: string
): FeatureAccessResult {
  const { licenseStatus, planId } = useLicenseContext();

  return useMemo(() => {
    // Convert planId string to PlanId type
    const currentPlanId =
      (planId as PlanId | null) || (licenseStatus?.planId as PlanId | null);

    // Get available features from license status
    const availableFeatures =
      (licenseStatus?.features as ServerFeatureFlag[]) || [];

    return checkFeatureAccess(currentPlanId, availableFeatures, featureId);
  }, [licenseStatus, planId, featureId]);
}

/**
 * Hook to get comprehensive feature access information
 *
 * @param featureId - Dashboard feature ID to check
 * @returns FeatureAccessResult with full access details
 */
export function useFeatureAccess(
  featureId: string
): FeatureAccessResult {
  return useCanAccessFeature(featureId);
}

/**
 * Hook to check if all required feature flags are available
 *
 * @param requiredFeatures - Array of required feature flags
 * @returns boolean indicating if all features are available
 */
export function useHasAllFeatureFlags(
  requiredFeatures: ServerFeatureFlag[]
): boolean {
  const { licenseStatus } = useLicenseContext();

  return useMemo(() => {
    if (!licenseStatus?.features || requiredFeatures.length === 0) {
      return requiredFeatures.length === 0; // No requirements = always true
    }

    const availableFeatures = licenseStatus.features as ServerFeatureFlag[];

    return hasAllFeatureFlags(availableFeatures, requiredFeatures);
  }, [licenseStatus?.features, requiredFeatures]);
}

/**
 * Hook to get current plan ID
 *
 * @returns Current plan ID or null
 */
export function useCurrentPlan(): PlanId | null {
  const { planId, licenseStatus } = useLicenseContext();

  return useMemo(() => {
    const currentPlanId =
      (planId as PlanId | null) || (licenseStatus?.planId as PlanId | null);

    // Validate plan ID
    if (currentPlanId === "basic" || currentPlanId === "professional") {
      return currentPlanId;
    }

    return null;
  }, [planId, licenseStatus?.planId]);
}

/**
 * Hook to get available feature flags
 *
 * @returns Array of available feature flags
 */
export function useAvailableFeatures(): ServerFeatureFlag[] {
  const { licenseStatus } = useLicenseContext();

  return useMemo(() => {
    if (!licenseStatus?.features) {
      return [];
    }

    return licenseStatus.features as ServerFeatureFlag[];
  }, [licenseStatus?.features]);
}
