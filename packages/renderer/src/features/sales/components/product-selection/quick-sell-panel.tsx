/**
 * Quick Sell Panel Component
 *
 * Displays configured quick sell buttons in a responsive grid.
 * Integrates with the transaction view for rapid product/category selection.
 *
 * Responsive grid sizing:
 * - Mobile (< 640px): 3 columns
 * - sm (640px+): 4 columns
 * - lg (1024px+): 5 columns
 * - xl (1280px+): 6 columns
 */

import { cn } from "@/shared/utils/cn";
import { Loader2, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { Breadcrumb } from "./breadcrumb";
import { QuickSellButton } from "./quick-sell-button";
import type { BreadcrumbItem } from "@/types/ui";
import type {
  QuickSellPageWithButtons,
  QuickSellButtonWithDetails,
} from "@/features/quick-sell-config/types";

interface QuickSellPanelProps {
  /** Pages with buttons (only pages with assigned buttons) */
  pages: QuickSellPageWithButtons[];
  /** Currently selected page index */
  selectedPageIndex: number;
  /** Handler for page selection change */
  onPageChange: (index: number) => void;
  /** Buttons for the current page */
  buttons: QuickSellButtonWithDetails[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Handler for product button click */
  onProductClick: (productId: string) => void;
  /** Handler for category single click - adds to cart via price input */
  onCategorySingleClick: (categoryId: string) => void;
  /** Handler for category double click - navigates into category */
  onCategoryDoubleClick: (categoryId: string) => void;
  /** Double click delay in ms */
  doubleClickDelay?: number;
  /** Breadcrumb navigation items */
  breadcrumb: BreadcrumbItem[];
  /** Handler for breadcrumb click */
  onBreadcrumbClick: (index: number) => void;
  /** Optional additional className */
  className?: string;
}

/**
 * Empty state component when no quick sell buttons are configured
 */
function QuickSellEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center h-full">
      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        <Zap className="w-8 h-8 text-amber-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-2">
        Quick Sell Not Configured
      </h3>
      <p className="text-sm text-slate-500 max-w-xs mb-4">
        Set up quick sell buttons to enable fast product selection from this
        screen.
      </p>
    </div>
  );
}

export function QuickSellPanel({
  pages,
  selectedPageIndex,
  onPageChange,
  buttons,
  isLoading,
  onProductClick,
  onCategorySingleClick,
  onCategoryDoubleClick,
  doubleClickDelay = 300,
  breadcrumb,
  onBreadcrumbClick,
  className,
}: QuickSellPanelProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">
          Loading quick sell...
        </span>
      </div>
    );
  }

  // No buttons configured - show empty state
  if (buttons.length === 0 && pages.length === 0) {
    return <QuickSellEmptyState />;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Breadcrumb Navigation */}
      <div className="mb-3 shrink-0">
        <Breadcrumb
          breadcrumb={breadcrumb}
          onBreadcrumbClick={onBreadcrumbClick}
        />
      </div>

      {/* Button Grid - responsive columns, scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
          {/* Show Back button if not on main page */}
          {pages.length > 1 && selectedPageIndex > 0 && (
            <button
              onClick={() => onPageChange(selectedPageIndex - 1)}
              className={cn(
                "relative flex flex-col items-center justify-center",
                "p-2 sm:p-3 shadow-md transition-all touch-manipulation overflow-hidden",
                "hover:scale-[1.02] active:scale-[0.98]",
                "min-h-[60px] sm:min-h-[72px] lg:min-h-20",
                "rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 text-white",
              )}
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-80" />
              <span className="font-semibold text-[10px] sm:text-xs lg:text-sm leading-tight text-center line-clamp-2 px-1">
                Back
              </span>
            </button>
          )}

          {/* Product/Category buttons */}
          {buttons.map((button) => (
            <QuickSellButton
              key={button.id}
              button={button}
              onProductClick={onProductClick}
              onCategorySingleClick={onCategorySingleClick}
              onCategoryDoubleClick={onCategoryDoubleClick}
              doubleClickDelay={doubleClickDelay}
            />
          ))}

          {/* Show More button if there are more pages */}
          {pages.length > 1 && selectedPageIndex < pages.length - 1 && (
            <button
              onClick={() => onPageChange(selectedPageIndex + 1)}
              className={cn(
                "relative flex flex-col items-center justify-center",
                "p-2 sm:p-3 shadow-md transition-all touch-manipulation overflow-hidden",
                "hover:scale-[1.02] active:scale-[0.98]",
                "min-h-[60px] sm:min-h-[72px] lg:min-h-20",
                "rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 text-white",
              )}
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-80" />
              <span className="font-semibold text-[10px] sm:text-xs lg:text-sm leading-tight text-center line-clamp-2 px-1">
                More
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
