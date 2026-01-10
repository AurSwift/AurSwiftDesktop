/**
 * Subscription Plan Feature Mapping
 *
 * This file defines the mapping between subscription plans and their features.
 * Features use an additive model where Professional includes all Basic features.
 *
 * Feature flags match the server definitions in web/lib/license/validator.ts
 */

export type PlanId = "basic" | "professional";

/**
 * Feature flags from server (matches web/lib/license/validator.ts)
 */
export type ServerFeatureFlag =
  | "single_terminal"
  | "multi_terminal"
  | "basic_reporting"
  | "advanced_reporting"
  | "product_management"
  | "sales_processing"
  | "receipt_printing"
  | "inventory_management"
  | "employee_management"
  | "batch_tracking"
  | "expiry_tracking";

/**
 * Base features available to Basic plan
 */
const BASIC_PLAN_FEATURES: ServerFeatureFlag[] = [
  "single_terminal",
  "basic_reporting",
  "product_management",
  "sales_processing",
  "receipt_printing",
];

/**
 * Additional features available to Professional plan
 * (Professional includes all Basic features + these additional ones)
 */
const PROFESSIONAL_ADDITIONAL_FEATURES: ServerFeatureFlag[] = [
  "multi_terminal",
  "advanced_reporting",
  "inventory_management",
  "employee_management",
  "batch_tracking",
  "expiry_tracking",
];

/**
 * Plan feature hierarchy (additive model)
 * Professional plan includes all Basic features
 */
export const PLAN_FEATURES: Record<PlanId, ServerFeatureFlag[]> = {
  basic: [...BASIC_PLAN_FEATURES],
  professional: [
    ...BASIC_PLAN_FEATURES, // Includes all basic features
    ...PROFESSIONAL_ADDITIONAL_FEATURES, // Plus professional features
  ],
};

/**
 * Map dashboard feature IDs to required server feature flags
 * Empty array means feature is available to all plans
 */
export const FEATURE_REQUIREMENTS: Record<string, ServerFeatureFlag[]> = {
  // User Management - Available to all (permission-based only)
  "user-management": [],

  // Management Actions - Available to all (basic operations)
  "management-actions": [],

  // System Settings - Available to all
  "system-settings": [],

  // Database Management - Available to all (permission-based only)
  "database-management": [],

  // Quick Actions - Available to all
  "quick-actions": [],

  // Advanced Reports - Professional only
  "advanced-reports": ["advanced_reporting"],

  // Advanced Reporting & Analytics - Professional only (ONLY Professional feature)
  "advanced-reporting-analytics": ["advanced_reporting"],

  // Inventory Management - Professional only
  "inventory-management": ["inventory_management"],

  // Batch Tracking - Professional only
  "batch-tracking": ["batch_tracking"],

  // Expiry Tracking - Professional only
  "expiry-tracking": ["expiry_tracking"],
};

/**
 * Get all features for a plan (additive model)
 */
export function getPlanFeatures(planId: PlanId): ServerFeatureFlag[] {
  return PLAN_FEATURES[planId] || PLAN_FEATURES.basic;
}

/**
 * Check if a plan has a specific feature
 */
export function planHasFeature(
  planId: PlanId,
  feature: ServerFeatureFlag
): boolean {
  return getPlanFeatures(planId).includes(feature);
}

/**
 * Get required feature flags for a dashboard feature
 */
export function getRequiredFeaturesForDashboardFeature(
  featureId: string
): ServerFeatureFlag[] {
  return FEATURE_REQUIREMENTS[featureId] || [];
}

/**
 * Check if a dashboard feature requires specific plan features
 */
export function dashboardFeatureRequiresPlan(featureId: string): boolean {
  const requiredFeatures = getRequiredFeaturesForDashboardFeature(featureId);
  return requiredFeatures.length > 0;
}

/**
 * Get minimum plan required for a dashboard feature
 * Returns null if feature is available to all plans
 */
export function getMinimumPlanForFeature(featureId: string): PlanId | null {
  const requiredFeatures = getRequiredFeaturesForDashboardFeature(featureId);

  if (requiredFeatures.length === 0) {
    return null; // Available to all plans
  }

  // Check if feature requires professional-only features
  const requiresProfessional = requiredFeatures.some((feature) =>
    PROFESSIONAL_ADDITIONAL_FEATURES.includes(feature)
  );

  if (requiresProfessional) {
    return "professional";
  }

  // Default to basic for features that require basic-only features
  return "basic";
}

/**
 * Check if a plan can access a dashboard feature
 * Uses additive model: Professional plan includes all Basic features
 */
export function canPlanAccessFeature(
  planId: PlanId | null,
  availableFeatures: ServerFeatureFlag[],
  featureId: string
): boolean {
  // If no plan, cannot access any features
  if (!planId) {
    return false;
  }

  const requiredFeatures = getRequiredFeaturesForDashboardFeature(featureId);

  // If no requirements, feature is available to all
  if (requiredFeatures.length === 0) {
    return true;
  }

  // Get all features that the plan should have (additive model)
  const planFeatures = getPlanFeatures(planId);

  // For additive model: Professional includes all Basic features
  // So we check against plan features, not just what server sent
  // This handles the case where server only sends professional features
  // but professional plan should have all basic features too
  const allAvailableFeatures = [
    ...new Set([...availableFeatures, ...planFeatures]),
  ];

  // Check if all required features are available
  return requiredFeatures.every((feature) =>
    allAvailableFeatures.includes(feature)
  );
}

/**
 * Get upgrade plan for a feature
 * Returns the plan to upgrade to, or null if already on highest plan
 */
export function getUpgradePlanForFeature(
  featureId: string,
  currentPlan: PlanId | null
): PlanId | null {
  const minPlan = getMinimumPlanForFeature(featureId);

  // Feature available to all, no upgrade needed
  if (!minPlan) {
    return null;
  }

  // Current plan is higher or equal to minimum required
  if (currentPlan === "professional" || currentPlan === minPlan) {
    return null;
  }

  // Need to upgrade to minimum required plan
  return minPlan;
}
