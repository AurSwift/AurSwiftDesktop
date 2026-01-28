import { AnimatePresence } from "@/components/animate-presence";
import { type ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

interface ViewTransitionContainerProps {
  /**
   * The current active view key
   */
  currentView: string;
  
  /**
   * Map of view keys to their React components
   */
  views: Record<string, ReactNode>;
  
  /**
   * Default animation direction for dashboard view
   * @default "right"
   */
  defaultDirection?: "left" | "right";
  
  /**
   * Animation duration in seconds
   * @default 0.3
   */
  animationDuration?: number;
  
  /**
   * Additional CSS classes
   * @default "w-full"
   */
  className?: string;
  
  /**
   * Custom function to determine animation direction based on view
   * If provided, overrides defaultDirection logic
   */
  getDirection?: (view: string) => "left" | "right";
}

/**
 * Reusable container component for animated view transitions
 * 
 * Provides consistent slide animations between views using CSS animations
 * 
 * @example
 * ```tsx
 * const views = {
 *   "sales:new-transaction": <NewTransactionView />,
 *   "users:management": <UserManagementView />,
 * };
 * <ViewTransitionContainer currentView={currentView} views={views} />
 * ```
 */
export function ViewTransitionContainer({
  currentView,
  views,
  defaultDirection = "right",
  animationDuration = 0.3,
  className = "w-full",
  getDirection,
}: ViewTransitionContainerProps) {
  const determineDirection = (view: string): "left" | "right" => {
    if (getDirection) {
      return getDirection(view);
    }
    // Default logic: dashboard slides from right, others from left
    return view === "dashboard" ? defaultDirection : "left";
  };

  const direction = determineDirection(currentView);
  const exitAnimation = direction === "right" ? "slide-left-exit" : "slide-right-exit";
  const enterAnimationClass = direction === "right" ? "animate-slide-right" : "animate-slide-left";

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      <AnimatePresence
        mode="wait"
        exitAnimation={exitAnimation}
        exitDuration={animationDuration * 1000}
        className="w-full flex-1 min-h-0 flex flex-col"
      >
        <div
          key={currentView}
          className={cn("w-full flex-1 min-h-0 flex flex-col", className, enterAnimationClass)}
        >
          {views[currentView] || null}
        </div>
      </AnimatePresence>
    </div>
  );
}

