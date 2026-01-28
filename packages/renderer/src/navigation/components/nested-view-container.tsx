/**
 * Nested View Container
 *
 * Container for nested views within a parent view.
 * Handles navigation between child views.
 */

import { Suspense, useMemo } from "react";
import { useNestedNavigation } from "../hooks/use-nested-navigation";
import { getView } from "../registry/view-registry";
import {
  ViewLoadErrorBoundary,
  ViewLoadingFallback,
} from "@/components";
import { ViewTransitionContainer } from "@/components/view-transition-container";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("nested-view-container");

interface NestedViewContainerProps {
  /** Parent view ID */
  parentViewId: string;
  /** Default nested view ID to show if none is selected */
  defaultViewId?: string;
}

/**
 * Container for nested views within a parent view
 *
 * Handles navigation between child views and renders the current nested view.
 * Provides smooth transitions between nested views.
 *
 * @example
 * ```tsx
 * function ProductManagementView() {
 *   return (
 *     <div>
 *       <NestedViewContainer
 *         parentViewId="productManagement"
 *         defaultViewId="productDashboard"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function NestedViewContainer({
  parentViewId,
  defaultViewId,
}: NestedViewContainerProps) {
  const {
    currentNestedViewId,
    currentNestedView,
    currentNestedParams,
    goBack,
  } = useNestedNavigation(parentViewId);

  const viewId = currentNestedViewId || defaultViewId || "";

  const viewComponent = useMemo(() => {
    if (!viewId) {
      // No view selected and no default - return null or default view
      if (defaultViewId) {
        const defaultView = getView(defaultViewId);
        if (defaultView && defaultView.parentId === parentViewId) {
          const Component = defaultView.component;
          return (
            <ViewLoadErrorBoundary viewId={defaultViewId}>
              <Suspense fallback={<ViewLoadingFallback />}>
                <Component {...currentNestedParams} onBack={goBack} />
              </Suspense>
            </ViewLoadErrorBoundary>
          );
        }
      }
      return null;
    }

    if (!currentNestedView) {
      logger.warn(`Nested view not found: ${viewId}`);
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">View Not Found</h2>
            <p className="text-muted-foreground">
              The nested view "{viewId}" could not be found.
            </p>
          </div>
        </div>
      );
    }

    try {
      const Component = currentNestedView.component;
      return (
        <ViewLoadErrorBoundary viewId={viewId}>
          <Suspense fallback={<ViewLoadingFallback />}>
            <Component {...currentNestedParams} onBack={goBack} />
          </Suspense>
        </ViewLoadErrorBoundary>
      );
    } catch (error) {
      logger.error(`Error rendering nested view ${viewId}:`, error);
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Error Loading View</h2>
            <p className="text-muted-foreground">
              Failed to render nested view "{viewId}".
            </p>
          </div>
        </div>
      );
    }
  }, [viewId, currentNestedView, currentNestedParams, parentViewId, defaultViewId, goBack]);

  if (!viewId && !defaultViewId) {
    return null;
  }

  const displayViewId = viewId || defaultViewId || "";

  return (
    <ViewTransitionContainer
      currentView={displayViewId}
      views={{ [displayViewId]: viewComponent }}
    />
  );
}

