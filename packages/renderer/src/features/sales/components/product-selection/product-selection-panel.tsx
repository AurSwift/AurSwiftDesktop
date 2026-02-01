/**
 * Product selection panel component
 * Uses Quick Sell buttons exclusively for product/category selection
 * No traditional category grid or product grid - all interactions through quick sell buttons
 */

import { useCallback, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  Home,
  Package,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { QuickSellPanel } from "./quick-sell-panel";
import { Breadcrumb } from "./breadcrumb";
import type { Product } from "@/types/domain";
import type { Category } from "@/types/domain/category";
import type { BreadcrumbItem } from "@/types/ui";
import type {
  QuickSellPageWithButtons,
  QuickSellButtonWithDetails,
} from "@/features/quick-sell-config/types";

interface ProductSelectionPanelProps {
  products: Product[];
  categories: Category[];
  currentCategories: Category[];
  breadcrumb: BreadcrumbItem[];
  searchQuery: string;
  selectedWeightProductId: string | null;
  loading: boolean;
  error: string | null;
  lastClickTime: { productId: string; timestamp: number } | null;
  onProductClick: (product: Product) => void;
  onGenericItemClick?: (product: Product) => void;
  onCategoryClick: (category: Category, addToCart: boolean) => void;
  onBreadcrumbClick: (index: number) => void;
  onSetLastClickTime: (
    time: { productId: string; timestamp: number } | null,
  ) => void;
  onRetry: () => void;
  DOUBLE_CLICK_DELAY: number;
  /** Callback for loading more products (infinite scroll) */
  onLoadMore?: () => void;
  /** Whether there are more products to load */
  hasMore?: boolean;
  /** Whether more products are being loaded */
  isLoadingMore?: boolean;
  // Quick Sell Props
  /** Quick sell pages (only pages with assigned buttons) */
  quickSellPages?: QuickSellPageWithButtons[];
  /** Currently selected quick sell page index */
  quickSellPageIndex?: number;
  /** Handler for quick sell page change */
  onQuickSellPageChange?: (index: number) => void;
  /** Quick sell buttons for current page */
  quickSellButtons?: QuickSellButtonWithDetails[];
  /** Whether quick sell is loading */
  quickSellLoading?: boolean;
  /** Handler for quick sell product click - goes through product flow (batch, age, etc.) */
  onQuickSellProductClick?: (productId: string) => void;
}

/**
 * Category/Subcategory button with double-click detection
 * Single click: add to cart via price input
 * Double click: navigate into category
 */
function CategoryButton({
  category,
  onSingleClick,
  onDoubleClick,
  doubleClickDelay = 300,
}: {
  category: Category;
  onSingleClick: (category: Category) => void;
  onDoubleClick: (category: Category) => void;
  doubleClickDelay?: number;
}) {
  const lastClickTimeRef = useRef<number | null>(null);
  const singleClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleClick = useCallback(() => {
    const now = Date.now();
    const lastClick = lastClickTimeRef.current;

    if (lastClick && now - lastClick < doubleClickDelay) {
      // Double click detected - navigate into category
      if (singleClickTimeoutRef.current) {
        clearTimeout(singleClickTimeoutRef.current);
        singleClickTimeoutRef.current = null;
      }
      lastClickTimeRef.current = null;
      onDoubleClick(category);
    } else {
      // Potential single click - wait to see if it becomes a double click
      lastClickTimeRef.current = now;

      singleClickTimeoutRef.current = setTimeout(() => {
        if (lastClickTimeRef.current === now) {
          onSingleClick(category);
          lastClickTimeRef.current = null;
        }
      }, doubleClickDelay);
    }
  }, [category, doubleClickDelay, onSingleClick, onDoubleClick]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      handleClick();
    },
    [handleClick],
  );

  return (
    <button
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "relative flex flex-col items-center justify-center",
        "p-2 sm:p-3 shadow-md transition-all touch-manipulation overflow-hidden",
        "hover:scale-[1.02] active:scale-[0.98]",
        "min-h-[60px] sm:min-h-[72px] lg:min-h-20",
        "rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white",
      )}
    >
      <span className="font-semibold text-[10px] sm:text-xs lg:text-sm leading-tight text-center line-clamp-2 px-1">
        {category.name}
      </span>
    </button>
  );
}

/**
 * Product button - single click adds to cart
 */
function ProductButton({
  product,
  onClick,
}: {
  product: Product;
  onClick: (product: Product) => void;
}) {
  return (
    <button
      onClick={() => onClick(product)}
      className={cn(
        "relative flex flex-col items-center justify-center",
        "p-2 sm:p-3 shadow-md transition-all touch-manipulation overflow-hidden",
        "hover:scale-[1.02] active:scale-[0.98]",
        "min-h-[60px] sm:min-h-[72px] lg:min-h-20",
        "rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white",
      )}
    >
      <span className="font-semibold text-[10px] sm:text-xs lg:text-sm leading-tight text-center line-clamp-2 px-1">
        {product.name}
      </span>
    </button>
  );
}

export function ProductSelectionPanel({
  products,
  categories,
  currentCategories,
  breadcrumb,
  searchQuery,
  selectedWeightProductId,
  loading,
  error,
  lastClickTime,
  onProductClick,
  onGenericItemClick,
  onCategoryClick,
  onBreadcrumbClick,
  onSetLastClickTime,
  onRetry,
  DOUBLE_CLICK_DELAY,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  // Quick Sell Props
  quickSellPages = [],
  quickSellPageIndex = 0,
  onQuickSellPageChange,
  quickSellButtons = [],
  quickSellLoading = false,
  onQuickSellProductClick,
}: ProductSelectionPanelProps) {
  // Check if quick sell has any buttons configured
  const hasQuickSell =
    quickSellPages.length > 0 &&
    quickSellButtons.length > 0 &&
    onQuickSellProductClick;

  // Check if we're inside a category (navigated via double-click)
  // breadcrumb[0] is always "All Categories", so length > 1 means we're inside a category
  const isInsideCategory = breadcrumb.length > 1;

  // Handle category single click - add to cart (shows price input modal)
  const handleCategorySingleClick = useCallback(
    (category: Category) => {
      onCategoryClick(category, true); // addToCart = true
    },
    [onCategoryClick],
  );

  // Handle category double click - navigate into category (uses existing category system)
  const handleCategoryDoubleClick = useCallback(
    (category: Category) => {
      onCategoryClick(category, false); // addToCart = false = navigate
    },
    [onCategoryClick],
  );

  // Handle category single click by ID (for Quick Sell buttons)
  const handleCategorySingleClickById = useCallback(
    async (categoryId: string) => {
      let category = categories.find((c) => c.id === categoryId);

      if (!category && window.categoryAPI) {
        try {
          const response = await window.categoryAPI.getById(categoryId);
          if (response.success && response.category) {
            category = response.category;
          }
        } catch (error) {
          console.error("Failed to fetch category:", error);
        }
      }

      if (category) {
        handleCategorySingleClick(category);
      }
    },
    [categories, handleCategorySingleClick],
  );

  // Handle category double click by ID (for Quick Sell buttons)
  const handleCategoryDoubleClickById = useCallback(
    async (categoryId: string) => {
      let category = categories.find((c) => c.id === categoryId);

      if (!category && window.categoryAPI) {
        try {
          const response = await window.categoryAPI.getById(categoryId);
          if (response.success && response.category) {
            category = response.category;
          }
        } catch (error) {
          console.error("Failed to fetch category:", error);
        }
      }

      if (category) {
        handleCategoryDoubleClick(category);
      }
    },
    [categories, handleCategoryDoubleClick],
  );

  // Go back to root (Quick Sell view)
  const handleBackToRoot = useCallback(() => {
    onBreadcrumbClick(0); // Click on "All Categories" to go back to root
  }, [onBreadcrumbClick]);

  return (
    <Card className="bg-white border-slate-200 flex-1 flex flex-col shadow-sm overflow-hidden">
      {/* Header with breadcrumb when inside a category */}
      {isInsideCategory && (
        <CardHeader className="bg-slate-50 py-2 px-3 sm:px-6">
          <Breadcrumb
            breadcrumb={breadcrumb}
            onBreadcrumbClick={onBreadcrumbClick}
          />
        </CardHeader>
      )}

      <CardContent
        className={cn(
          "px-3 sm:px-6 flex-1 flex flex-col min-h-0 overflow-hidden",
          isInsideCategory ? "pt-2" : "pt-3",
        )}
      >
        {loading || quickSellLoading ? (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-slate-400" />
            <span className="ml-2 text-xs sm:text-sm text-slate-600">
              Loading...
            </span>
          </div>
        ) : error && !hasQuickSell && !isInsideCategory ? (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-red-500 mb-3 sm:mb-4" />
            <p className="text-red-600 mb-3 sm:mb-4 text-sm sm:text-base">
              Failed to load products
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="min-h-11 h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
            >
              Retry
            </Button>
          </div>
        ) : isInsideCategory ? (
          /* Category View - show currentCategories (subcategories) and products */
          <div className="flex flex-col h-full">
            {currentCategories.length === 0 && products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">
                  No items in this category
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToRoot}
                  className="mt-4"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back to Quick Sell
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                  {/* Subcategories first */}
                  {currentCategories.map((subcat) => (
                    <CategoryButton
                      key={subcat.id}
                      category={subcat}
                      onSingleClick={handleCategorySingleClick}
                      onDoubleClick={handleCategoryDoubleClick}
                      doubleClickDelay={DOUBLE_CLICK_DELAY}
                    />
                  ))}
                  {/* Then products */}
                  {products.map((product) => (
                    <ProductButton
                      key={product.id}
                      product={product}
                      onClick={onProductClick}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : hasQuickSell ? (
          /* Quick Sell Buttons View (at root level) */
          <div className="flex flex-col h-full">
            <QuickSellPanel
              pages={quickSellPages}
              selectedPageIndex={quickSellPageIndex}
              onPageChange={onQuickSellPageChange || (() => {})}
              buttons={quickSellButtons}
              isLoading={quickSellLoading}
              onProductClick={onQuickSellProductClick!}
              onCategorySingleClick={handleCategorySingleClickById}
              onCategoryDoubleClick={handleCategoryDoubleClickById}
              doubleClickDelay={DOUBLE_CLICK_DELAY}
              breadcrumb={breadcrumb}
              onBreadcrumbClick={onBreadcrumbClick}
              className="flex-1"
            />
          </div>
        ) : (
          /* No Quick Sell Configured - show empty state */
          <QuickSellPanel
            pages={[]}
            selectedPageIndex={0}
            onPageChange={() => {}}
            buttons={[]}
            isLoading={false}
            onProductClick={() => {}}
            onCategorySingleClick={() => {}}
            onCategoryDoubleClick={() => {}}
            breadcrumb={breadcrumb}
            onBreadcrumbClick={onBreadcrumbClick}
            className="flex-1"
          />
        )}
      </CardContent>
    </Card>
  );
}
