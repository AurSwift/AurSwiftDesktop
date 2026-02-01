/**
 * Quick Sell Button Component
 *
 * Individual button for quick product/category selection in the transaction view.
 * Renders with configured color, shape, and displays product/category info.
 *
 * Click behavior:
 * - Product buttons: Single click triggers product flow (age verification, batch, etc.)
 * - Category buttons: Single click adds to cart (price input), double click navigates into category
 */

import { useRef, useCallback } from "react";
import { cn } from "@/shared/utils/cn";

import type {
  QuickSellButtonWithDetails,
  ButtonShape,
} from "@/features/quick-sell-config/types";

interface QuickSellButtonProps {
  /** Button configuration and data */
  button: QuickSellButtonWithDetails;
  /** Handler for product button click */
  onProductClick: (productId: string) => void;
  /** Handler for category single click - adds to cart via price input */
  onCategorySingleClick: (categoryId: string) => void;
  /** Handler for category double click - navigates into category */
  onCategoryDoubleClick: (categoryId: string) => void;
  /** Double click delay in ms */
  doubleClickDelay?: number;
  /** Optional additional className */
  className?: string;
}

/**
 * Get border radius class based on button shape
 */
function getShapeClasses(shape: ButtonShape): string {
  switch (shape) {
    case "pill":
      return "rounded-full";
    case "rounded":
      return "rounded-xl";
    case "rectangle":
    default:
      return "rounded-lg";
  }
}

export function QuickSellButton({
  button,
  onProductClick,
  onCategorySingleClick,
  onCategoryDoubleClick,
  doubleClickDelay = 300,
  className,
}: QuickSellButtonProps) {
  const isProduct = button.linkType === "product" && button.product;
  const isCategory = button.linkType === "category" && button.category;

  // Track last click for double-click detection (category buttons only)
  const lastClickTimeRef = useRef<number | null>(null);
  const singleClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle click with double-click detection for categories
  const handleClick = useCallback(() => {
    if (isProduct && button.productId) {
      // Product buttons - direct click, goes through product flow
      onProductClick(button.productId);
    } else if (isCategory && button.categoryId) {
      // Category buttons - detect single vs double click
      const now = Date.now();
      const lastClick = lastClickTimeRef.current;

      if (lastClick && now - lastClick < doubleClickDelay) {
        // Double click detected - navigate into category
        // Clear the pending single click timeout
        if (singleClickTimeoutRef.current) {
          clearTimeout(singleClickTimeoutRef.current);
          singleClickTimeoutRef.current = null;
        }
        lastClickTimeRef.current = null;
        onCategoryDoubleClick(button.categoryId);
      } else {
        // Potential single click - wait to see if it becomes a double click
        lastClickTimeRef.current = now;

        // Schedule single click action after delay
        singleClickTimeoutRef.current = setTimeout(() => {
          // If still valid (not cleared by double click), execute single click
          if (lastClickTimeRef.current === now) {
            onCategorySingleClick(button.categoryId!);
            lastClickTimeRef.current = null;
          }
        }, doubleClickDelay);
      }
    }
  }, [
    isProduct,
    isCategory,
    button.productId,
    button.categoryId,
    doubleClickDelay,
    onProductClick,
    onCategorySingleClick,
    onCategoryDoubleClick,
  ]);

  // Handle touch for mobile double-tap
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent ghost clicks
      handleClick();
    },
    [handleClick],
  );

  // Determine display label
  const displayLabel =
    button.label ||
    (isProduct
      ? button.product?.name
      : isCategory
        ? button.category?.name
        : "");

  return (
    <button
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      className={cn(
        // Base styles
        "relative flex flex-col items-center justify-center",
        "p-2 sm:p-3 shadow-md transition-all touch-manipulation overflow-hidden",
        "hover:scale-[1.02] active:scale-[0.98]",
        // Responsive sizing
        "min-h-[60px] sm:min-h-[72px] lg:min-h-20",
        // Shape
        getShapeClasses(button.shape),
        className,
      )}
      style={{
        backgroundColor: button.color,
        color: button.textColor,
      }}
    >
      {/* Label */}
      <span className="font-semibold text-[10px] sm:text-xs lg:text-sm leading-tight text-center line-clamp-2 px-1">
        {displayLabel}
      </span>
    </button>
  );
}
