/**
 * Feature Gate Component
 *
 * Wrapper component that conditionally renders children based on subscription access.
 * Shows upgrade badge when feature is unavailable.
 */

import type { ReactNode } from "react";
import { useFeatureAccess } from "../hooks/use-subscription-features";
import { UpgradeBadge } from "./upgrade-badge";

export interface FeatureGateProps {
  /**
   * Dashboard feature ID to check access for
   */
  featureId: string;

  /**
   * Children to render when feature is accessible
   */
  children: ReactNode;

  /**
   * Optional fallback content to show when feature is not accessible
   */
  fallback?: ReactNode;

  /**
   * If true, shows upgrade badge instead of hiding content
   */
  showUpgradeBadge?: boolean;

  /**
   * If true, shows children even when upgrade is required (with badge)
   */
  showWithBadge?: boolean;
}

/**
 * Feature gate component
 *
 * Conditionally renders children based on subscription feature access.
 * Can show upgrade badge or hide content entirely.
 */
export function FeatureGate({
  featureId,
  children,
  fallback,
  showUpgradeBadge = true,
  showWithBadge = false,
}: FeatureGateProps) {
  const access = useFeatureAccess(featureId);

  // If feature is accessible, render children
  if (access.canAccess) {
    return <>{children}</>;
  }

  // If requires upgrade and should show with badge, render children with badge
  if (access.requiresUpgrade && showWithBadge && showUpgradeBadge && access.upgradePlan) {
    return (
      <div className="relative">
        {children}
        <div className="absolute top-2 right-2 z-10">
          <UpgradeBadge
            message={access.reason || "This feature requires an upgrade"}
            planId={access.upgradePlan}
            size="sm"
          />
        </div>
      </div>
    );
  }

  // If upgrade badge should be shown (but not with content), show badge only
  if (access.requiresUpgrade && showUpgradeBadge && access.upgradePlan) {
    return (
      <UpgradeBadge
        message={access.reason || "This feature requires an upgrade"}
        planId={access.upgradePlan}
      />
    );
  }

  // Otherwise, show fallback or nothing
  return fallback ? <>{fallback}</> : null;
}
