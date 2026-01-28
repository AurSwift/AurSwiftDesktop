/**
 * Navigation Container
 *
 * Main navigation container component.
 * Renders the current view based on navigation state.
 */

import { Suspense, useMemo } from "react";
import { useNavigation } from "../hooks/use-navigation";
import { getView } from "../registry/view-registry";
import {
  ViewLoadErrorBoundary,
  ViewLoadingFallback,
} from "@/components";
import { ViewTransitionContainer } from "@/components/view-transition-container";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("navigation-container");

/**
 * Main navigation container
 *
 * Renders the current view based on navigation state.
 * Handles view transitions and parameter passing.
 *
 * @example
 * ```tsx
 * <NavigationProvider>
 *   <NavigationContainer />
 * </NavigationProvider>
 * ```
 */
export function NavigationContainer() {
  const { currentViewId, currentParams, goBack } = useNavigation();
  const view = getView(currentViewId);

  const viewComponent = useMemo(() => {
    if (!view) {
      logger.error(`View not found: ${currentViewId}`);
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">View Not Found</h2>
            <p className="text-muted-foreground">
              The view "{currentViewId}" could not be found.
            </p>
          </div>
        </div>
      );
    }

    try {
      const Component = view.component;
      // Merge default params with current params and add onBack for views that need it
      const mergedParams = {
        ...view.defaultParams,
        ...currentParams,
        onBack: goBack, // Add onBack prop for backward compatibility
      };
      return (
        <ViewLoadErrorBoundary viewId={currentViewId}>
          <Suspense fallback={<ViewLoadingFallback />}>
            <Component {...mergedParams} />
          </Suspense>
        </ViewLoadErrorBoundary>
      );
    } catch (error) {
      logger.error(`Error rendering view ${currentViewId}:`, error);
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Error Loading View</h2>
            <p className="text-muted-foreground">
              Failed to render view "{currentViewId}".
            </p>
          </div>
        </div>
      );
    }
  }, [view, currentViewId, currentParams, goBack]);

  if (!view) {
    return null;
  }

  return (
    <ViewTransitionContainer
      currentView={currentViewId}
      views={{ [currentViewId]: viewComponent }}
    />
  );
}
