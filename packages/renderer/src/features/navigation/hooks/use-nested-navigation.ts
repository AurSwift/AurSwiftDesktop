/**
 * Nested Navigation Hook
 *
 * Hook for nested view navigation within parent views.
 * Use this within parent views that contain nested views.
 */

import { useCallback } from "react";
import { useNavigationContext } from "../context/navigation-context";
import { getNestedViews, getView } from "../registry/view-registry";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("use-nested-navigation");

/**
 * Hook for nested view navigation
 *
 * Provides navigation functionality for nested views within a parent view.
 * Automatically validates that the target view is a child of the parent.
 *
 * @param parentViewId - ID of the parent view
 * @returns Nested navigation context
 *
 * @example
 * ```tsx
 * function ProductManagementView() {
 *   const { navigateTo, currentNestedView } = useNestedNavigation(
 *     "inventory:management"
 *   );
 *
 *   return (
 *     <div>
 *       <button onClick={() => navigateTo("inventory:management:products")}>
 *         View Products
 *       </button>
 *       {currentNestedView && <currentNestedView.component />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNestedNavigation(parentViewId: string) {
  const context = useNavigationContext();
  const nestedContext = context.getNestedNavigation(parentViewId);
  const nestedViews = getNestedViews(parentViewId);

  /**
   * Navigate to a nested view
   */
  const navigateToNested = useCallback(
    (viewId: string, params?: Record<string, unknown>) => {
      const view = getView(viewId);
      if (!view) {
        logger.warn(`View not found: ${viewId}`);
        return;
      }

      if (view.parentId !== parentViewId) {
        logger.warn(`View ${viewId} is not a nested view of ${parentViewId}`);
        return;
      }

      nestedContext.navigateTo(viewId, params);
    },
    [parentViewId, nestedContext]
  );

  const currentNestedView = nestedContext.state.currentView
    ? getView(nestedContext.state.currentView)
    : null;

  return {
    ...nestedContext,
    navigateTo: navigateToNested,
    nestedViews,
    currentNestedView,
    currentNestedViewId: nestedContext.state.currentView,
    currentNestedParams: nestedContext.state.viewParams,
  };
}
