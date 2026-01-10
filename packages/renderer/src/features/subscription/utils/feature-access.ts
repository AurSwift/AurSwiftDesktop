/**
 * Feature Access Utilities
 *
 * Core utility functions for checking feature access based on subscription plans.
 */

import type { PlanId, ServerFeatureFlag } from "../config/plan-features";
import {
  canPlanAccessFeature,
  getMinimumPlanForFeature,
  getUpgradePlanForFeature,
  getRequiredFeaturesForDashboardFeature,
} from "../config/plan-features";

/**
 * Result of a feature access check
 */
export interface FeatureAccessResult {
  canAccess: boolean;
  requiresUpgrade: boolean;
  requiredPlan: PlanId | null;
  upgradePlan: PlanId | null;
  missingFeatures: ServerFeatureFlag[];
  reason?: string;
}

/**
 * Check if a user can access a dashboard feature based on their subscription
 *
 * @param planId - Current plan ID (null if no plan)
 * @param availableFeatures - Features available to the user
 * @param featureId - Dashboard feature ID to check
 * @returns FeatureAccessResult with access information
 */
export function checkFeatureAccess(
  planId: PlanId | null,
  availableFeatures: ServerFeatureFlag[],
  featureId: string
): FeatureAccessResult {
  const requiredPlan = getMinimumPlanForFeature(featureId);
  const upgradePlan = getUpgradePlanForFeature(featureId, planId);
  const requiredFeatures = getRequiredFeaturesForDashboardFeature(featureId);

  // Feature is available to all plans
  if (!requiredPlan) {
    return {
      canAccess: true,
      requiresUpgrade: false,
      requiredPlan: null,
      upgradePlan: null,
      missingFeatures: [],
    };
  }

  // No plan - cannot access
  if (!planId) {
    return {
      canAccess: false,
      requiresUpgrade: true,
      requiredPlan,
      upgradePlan: requiredPlan,
      missingFeatures: requiredFeatures,
      reason: "No active subscription. Please subscribe to access this feature.",
    };
  }

  // Check if all required features are available
  const hasAllFeatures = canPlanAccessFeature(
    planId,
    availableFeatures,
    featureId
  );

  if (hasAllFeatures) {
    return {
      canAccess: true,
      requiresUpgrade: false,
      requiredPlan,
      upgradePlan: null,
      missingFeatures: [],
    };
  }

  // Missing some features - need upgrade
  const missingFeatures = requiredFeatures.filter(
    (feature) => !availableFeatures.includes(feature)
  );

  return {
    canAccess: false,
    requiresUpgrade: true,
    requiredPlan,
    upgradePlan: upgradePlan || requiredPlan,
    missingFeatures,
    reason: `This feature requires ${requiredPlan} plan. Upgrade to access ${featureId}.`,
  };
}

/**
 * Get required plan for a feature
 */
export function getRequiredPlanForFeature(
  featureId: string
): PlanId | null {
  return getMinimumPlanForFeature(featureId);
}

/**
 * Get upgrade plan for a feature (wrapper to avoid naming conflict)
 */
export function getFeatureUpgradePlan(
  featureId: string,
  currentPlan: PlanId | null
): PlanId | null {
  return getUpgradePlanForFeature(featureId, currentPlan);
}

/**
 * Check if a feature flag is available
 */
export function hasFeatureFlag(
  availableFeatures: ServerFeatureFlag[],
  feature: ServerFeatureFlag
): boolean {
  return availableFeatures.includes(feature);
}

/**
 * Check if all required feature flags are available
 */
export function hasAllFeatureFlags(
  availableFeatures: ServerFeatureFlag[],
  requiredFeatures: ServerFeatureFlag[]
): boolean {
  if (requiredFeatures.length === 0) {
    return true; // No requirements = always available
  }

  return requiredFeatures.every((feature) =>
    availableFeatures.includes(feature)
  );
}
