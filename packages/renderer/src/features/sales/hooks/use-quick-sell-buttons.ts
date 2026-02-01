/**
 * useQuickSellButtons Hook
 *
 * Manages quick sell button data fetching and interactions for the transaction view.
 * Filters out unassigned buttons and provides handlers for product/category actions.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/shared/hooks/use-auth";
import { getLogger } from "@/shared/utils/logger";
import type {
  QuickSellPageWithButtons,
  QuickSellButtonWithDetails,
} from "@/features/quick-sell-config/types";

const logger = getLogger("use-quick-sell-buttons");

/** Local storage key for persisting selected page */
const QUICK_SELL_PAGE_KEY = "quick-sell-selected-page";

export interface UseQuickSellButtonsReturn {
  /** All pages with their buttons (filtered to only assigned buttons) */
  pages: QuickSellPageWithButtons[];
  /** Currently selected page index */
  selectedPageIndex: number;
  /** Set the selected page index */
  setSelectedPageIndex: (index: number) => void;
  /** Buttons for the currently selected page (only assigned buttons) */
  currentButtons: QuickSellButtonWithDetails[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Reload data from server */
  reload: () => Promise<void>;
  /** Whether quick sell is enabled (has any configured buttons) */
  hasQuickSellButtons: boolean;
  /** Pages that have at least one assigned button */
  pagesWithButtons: QuickSellPageWithButtons[];
}

/**
 * Filter out unassigned buttons from a page
 */
function filterAssignedButtons(
  page: QuickSellPageWithButtons
): QuickSellPageWithButtons {
  return {
    ...page,
    buttons: page.buttons.filter(
      (button) =>
        button.linkType !== "unassigned" &&
        button.isActive &&
        (button.productId || button.categoryId)
    ),
  };
}

/**
 * Hook for managing quick sell buttons in the transaction view
 */
export function useQuickSellButtons(): UseQuickSellButtonsReturn {
  const { user } = useAuth();
  const [pages, setPages] = useState<QuickSellPageWithButtons[]>([]);
  const [selectedPageIndex, setSelectedPageIndexState] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load selected page from localStorage on mount
  useEffect(() => {
    const savedIndex = localStorage.getItem(QUICK_SELL_PAGE_KEY);
    if (savedIndex !== null) {
      const parsed = parseInt(savedIndex, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        setSelectedPageIndexState(parsed);
      }
    }
  }, []);

  // Save selected page to localStorage when changed
  const setSelectedPageIndex = useCallback((index: number) => {
    setSelectedPageIndexState(index);
    localStorage.setItem(QUICK_SELL_PAGE_KEY, index.toString());
  }, []);

  // Fetch quick sell pages and buttons
  const loadData = useCallback(async () => {
    if (!user?.businessId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await window.quickSellAPI.getPages(user.businessId);

      if (response.success && response.pages) {
        // Filter each page to only include assigned buttons
        const filteredPages = response.pages.map(filterAssignedButtons);
        setPages(filteredPages);
        logger.debug(
          `Loaded quick sell pages: ${filteredPages.length} with assigned buttons`
        );
      } else {
        // No pages configured - this is fine, just means quick sell is not set up
        setPages([]);
        logger.debug("No quick sell pages configured");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load quick sell buttons";
      logger.error("Error loading quick sell buttons:", err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.businessId]);

  // Load data on mount and when business changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter to only pages that have at least one assigned button
  const pagesWithButtons = useMemo(() => {
    return pages.filter((page) => page.buttons.length > 0);
  }, [pages]);

  // Get current page buttons (ensure selectedPageIndex is valid)
  const currentButtons = useMemo(() => {
    // Find the page at the selected index from pagesWithButtons
    if (pagesWithButtons.length === 0) return [];

    // Clamp the index to valid range
    const validIndex = Math.min(
      Math.max(0, selectedPageIndex),
      pagesWithButtons.length - 1
    );

    // If the stored index is invalid, update it
    if (validIndex !== selectedPageIndex) {
      setSelectedPageIndex(validIndex);
    }

    return pagesWithButtons[validIndex]?.buttons || [];
  }, [pagesWithButtons, selectedPageIndex, setSelectedPageIndex]);

  // Check if any quick sell buttons are configured
  const hasQuickSellButtons = useMemo(() => {
    return pagesWithButtons.length > 0;
  }, [pagesWithButtons]);

  return {
    pages,
    selectedPageIndex,
    setSelectedPageIndex,
    currentButtons,
    isLoading,
    error,
    reload: loadData,
    hasQuickSellButtons,
    pagesWithButtons,
  };
}
