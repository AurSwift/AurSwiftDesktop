/**
 * useQuickSellPages
 *
 * Loads and manages quick sell pages for a business. Handles initial load,
 * default initialization when no pages exist, reset page, and refetch.
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import type { QuickSellPageWithButtons } from "../types";

const logger = getLogger("use-quick-sell-pages");

export function useQuickSellPages(businessId: string | undefined) {
  const [pages, setPages] = useState<QuickSellPageWithButtons[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const initializeDefaultPages = useCallback(async () => {
    if (!businessId) return;

    try {
      logger.debug("Creating default pages...");
      const response = await window.quickSellAPI.initializeDefaults(businessId);

      if (response.success && response.pages) {
        setPages(response.pages);
        toast.success("Quick sell pages initialized");
      } else {
        throw new Error(
          (response as { message?: string }).message ||
            "Failed to initialize pages",
        );
      }
    } catch (error) {
      logger.error("Error initializing default pages:", error);
      toast.error("Failed to initialize quick sell pages");
    }
  }, [businessId]);

  const loadData = useCallback(async () => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      logger.debug("Loading quick sell pages for business:", businessId);

      const response = await window.quickSellAPI.getPages(businessId);

      if (response.success && response.pages && response.pages.length > 0) {
        setPages(response.pages);
        logger.debug("Loaded pages:", response.pages.length);
      } else {
        logger.debug("No pages found, initializing defaults");
        await initializeDefaultPages();
      }
    } catch (error) {
      logger.error("Error loading quick sell data:", error);
      toast.error("Failed to load quick sell configuration");
    } finally {
      setIsLoading(false);
    }
  }, [businessId, initializeDefaultPages]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetPage = useCallback(
    async (pageId: string, pageName: string) => {
      const confirmed = window.confirm(
        `Are you sure you want to reset "${pageName}" to unassigned buttons? This action cannot be undone.`,
      );

      if (!confirmed) return;

      try {
        const response = await window.quickSellAPI.resetPage(pageId);

        if (response.success) {
          await loadData();
          toast.success(`${pageName} has been reset`);
        } else {
          throw new Error(
            (response as { message?: string }).message ||
              "Failed to reset page",
          );
        }
      } catch (error) {
        logger.error("Error resetting page:", error);
        toast.error("Failed to reset page");
      }
    },
    [loadData],
  );

  return {
    pages,
    isLoading,
    refetch: loadData,
    resetPage,
    setPages,
  };
}
