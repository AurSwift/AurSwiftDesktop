/**
 * DashboardGrid Component
 *
 * Unified grid layout component for displaying dashboard features.
 * Automatically filters features based on user permissions and categories.
 */

import { useMemo, useCallback } from "react";
import { FeatureCard } from "./feature-card";
import { useUserPermissions } from "../hooks/use-user-permissions";
import type { FeatureConfig } from "../types/feature-config";
import type { FeatureCategory } from "../types/feature-config";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("dashboard-grid");

interface DashboardGridProps {
  features: FeatureConfig[];
  onActionClick?: (featureId: string, actionId: string) => void;
  categories?: FeatureCategory[];
  className?: string;
}

export function DashboardGrid({
  features,
  onActionClick,
  categories,
  className = "",
}: DashboardGridProps) {
  const { hasAnyPermission, hasAllPermissions } = useUserPermissions();

  // Memoize the action click handler to prevent unnecessary re-renders
  const handleActionClick = useCallback(
    (featureId: string, actionId: string) => {
      logger.debug(`Action clicked: ${featureId} -> ${actionId}`);
      if (onActionClick) {
        onActionClick(featureId, actionId);
      } else {
        logger.warn(`No onActionClick handler provided`);
      }
    },
    [onActionClick]
  );

  const visibleFeatures = useMemo(() => {
    return features
      .filter((feature) => {
        // Filter by category if specified
        if (
          categories &&
          categories.length > 0 &&
          !categories.includes(feature.category)
        ) {
          return false;
        }

        // Check visibility based on permissions
        if (feature.permissions && feature.permissions.length > 0) {
          return feature.requiredAll
            ? hasAllPermissions(feature.permissions)
            : hasAnyPermission(feature.permissions);
        }

        // If no permissions required, show the feature
        return true;
      })
      .sort((a, b) => (a.order || 999) - (b.order || 999));
  }, [features, categories, hasAnyPermission, hasAllPermissions]);

  if (visibleFeatures.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">
          No features available based on your permissions.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1 gap-4 sm:gap-6 ${className}`}
    >
      {visibleFeatures.map((feature) => {
        // Inject navigation handlers into feature actions
        const featureWithHandlers: FeatureConfig = {
          ...feature,
          actions: feature.actions.map((action) => ({
            ...action,
            onClick: () => {
              // Call the memoized handler
              handleActionClick(feature.id, action.id);
            },
          })),
        };

        return <FeatureCard key={feature.id} feature={featureWithHandlers} />;
      })}
    </div>
  );
}
