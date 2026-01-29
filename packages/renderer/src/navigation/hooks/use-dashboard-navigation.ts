/**
 * Dashboard Navigation Hook
 *
 * Hook for dashboard-specific navigation.
 * Maps feature actions to views and provides navigation functionality.
 */

import { useCallback } from "react";
import { useNavigation } from "./use-navigation";
import { mapActionToView } from "../utils/navigation-mapper";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("use-dashboard-navigation");

/**
 * Hook for dashboard navigation
 *
 * Provides navigation functionality that maps feature actions to views.
 * Used by dashboard pages to handle feature card clicks.
 *
 * @returns Navigation handler function
 *
 * @example
 * ```tsx
 * function DashboardPage() {
 *   const handleActionClick = useDashboardNavigation();
 *
 *   return (
 *     <DashboardGrid
 *       features={FEATURE_REGISTRY}
 *       onActionClick={handleActionClick}
 *     />
 *   );
 * }
 * ```
 */
export function useDashboardNavigation() {
  const { navigateTo } = useNavigation();

  const handleActionClick = useCallback(
    (featureId: string, actionId: string) => {
      logger.info(`Action clicked: ${featureId} -> ${actionId}`);

      const mapped = mapActionToView(featureId, actionId);

      if (typeof mapped === "string") {
        logger.info(`Navigating to view: ${mapped}`);
        navigateTo(mapped);
      } else if (mapped?.viewId) {
        logger.info(`Navigating to view: ${mapped.viewId}`);
        navigateTo(mapped.viewId, mapped.params);
      } else {
        logger.warn(
          `No view mapping found for feature: ${featureId}, action: ${actionId}`
        );
        // Handle actions that don't map to views (e.g., modals, dialogs)
        // These can be handled by the dashboard page directly
      }
    },
    [navigateTo]
  );

  return handleActionClick;
}
