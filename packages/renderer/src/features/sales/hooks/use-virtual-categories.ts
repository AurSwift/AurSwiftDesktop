/**
 * Hook for managing virtual/lazy-loaded categories
 *
 * Loads category children on-demand rather than loading the entire tree upfront.
 * Optimized for large category hierarchies (15k+ categories).
 *
 * Key features:
 * - Lazy loading of category children
 * - Breadcrumb navigation tracking
 * - Local caching to reduce IPC calls
 * - Compatible with existing category navigation patterns
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Category } from "@/types/domain/category";
import type { Product } from "@/types/domain";
import type { BreadcrumbItem } from "@/types/ui";
import {
  categoryCache,
  getCategoryCacheKey,
  invalidateCategoryCache,
} from "@/shared/utils/simple-cache";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("use-virtual-categories");

// Categories are typically displayed all at once in navigation, so larger page size
const CATEGORY_PAGE_SIZE = 200;

interface UseVirtualCategoriesOptions {
  /** Business ID to load categories for */
  businessId: string | undefined;
  /** Products for filtering (optional - for getCurrentCategoryProducts) */
  products?: Product[];
  /** Callback when a category is selected for price input (double-click) */
  onCategorySelectForPriceInput?: (category: Category) => void;
}

interface UseVirtualCategoriesResult {
  /** All loaded categories (for compatibility with existing code) */
  categories: Category[];
  /** Categories at the current level */
  currentCategories: Category[];
  /** Current category ID (null = root) */
  currentCategoryId: string | null;
  /** Breadcrumb trail */
  breadcrumb: BreadcrumbItem[];
  /** Loading state */
  loading: boolean;
  /** Handle category click (navigation or price input) */
  handleCategoryClick: (category: Category, addToCart?: boolean) => void;
  /** Handle breadcrumb click (navigate to level) */
  handleBreadcrumbClick: (index: number) => void;
  /** Get products for current category (including subcategories) */
  getCurrentCategoryProducts: () => Product[];
  /** Refresh categories (clears cache and reloads) */
  loadCategories: () => Promise<void>;
  /** Set current category ID directly */
  setCurrentCategoryId: (id: string | null) => void;
  /** Set breadcrumb directly */
  setBreadcrumb: (breadcrumb: BreadcrumbItem[]) => void;
}

export function useVirtualCategories({
  businessId,
  products = [],
  onCategorySelectForPriceInput,
}: UseVirtualCategoriesOptions): UseVirtualCategoriesResult {
  // State
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [currentCategories, setCurrentCategories] = useState<Category[]>([]);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { id: null, name: "All Categories" },
  ]);

  // Track mounted state
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Load children of a category (or root categories if parentId is null)
   */
  const loadCategoryChildren = useCallback(
    async (parentId: string | null): Promise<Category[]> => {
      if (!businessId) return [];

      // Check cache first
      const cacheKey = getCategoryCacheKey(businessId, parentId);
      const cached = categoryCache.get(cacheKey) as
        | {
            items: Category[];
          }
        | undefined;

      if (cached) {
        return cached.items || [];
      }

      try {
        setLoading(true);

        const response = await window.categoryAPI.getChildren(
          businessId,
          parentId,
          { page: 1, pageSize: CATEGORY_PAGE_SIZE }
        );

        if (!isMountedRef.current) return [];

        if (response.success && response.data) {
          const { items } = response.data;

          // Cache the result
          categoryCache.set(cacheKey, response.data);

          // Also accumulate into allCategories for compatibility
          setAllCategories((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newCategories = items.filter(
              (c: Category) => !existingIds.has(c.id)
            );
            return [...prev, ...newCategories];
          });

          return items;
        } else {
          toast.error("Failed to load categories");
          return [];
        }
      } catch (error) {
        if (!isMountedRef.current) return [];
        logger.error("Error loading categories:", error);
        toast.error("Failed to load categories");
        return [];
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [businessId]
  );

  /**
   * Load root categories on mount
   */
  useEffect(() => {
    const loadRoot = async () => {
      const rootCategories = await loadCategoryChildren(null);
      setCurrentCategories(rootCategories);
    };

    if (businessId) {
      loadRoot();
    }
  }, [businessId, loadCategoryChildren]);

  /**
   * Handle category click - either navigate into it or trigger price input
   */
  const handleCategoryClick = useCallback(
    async (category: Category, addToCart: boolean = false) => {
      if (addToCart && onCategorySelectForPriceInput) {
        // Double-click behavior - select for price input
        onCategorySelectForPriceInput(category);
      } else {
        // Single-click behavior - navigate into category
        setCurrentCategoryId(category.id);
        setBreadcrumb((prev) => [
          ...prev,
          { id: category.id, name: category.name },
        ]);

        // Load children of this category
        const children = await loadCategoryChildren(category.id);
        setCurrentCategories(children);
      }
    },
    [onCategorySelectForPriceInput, loadCategoryChildren]
  );

  /**
   * Handle breadcrumb click - navigate to that level
   */
  const handleBreadcrumbClick = useCallback(
    async (index: number) => {
      const newBreadcrumb = breadcrumb.slice(0, index + 1);
      const targetId = newBreadcrumb[newBreadcrumb.length - 1].id;

      setBreadcrumb(newBreadcrumb);
      setCurrentCategoryId(targetId);

      // Load children of target category
      const children = await loadCategoryChildren(targetId);
      setCurrentCategories(children);
    },
    [breadcrumb, loadCategoryChildren]
  );

  /**
   * Get products for current category (including subcategories)
   * Uses the accumulated allCategories to find descendants
   */
  const getCurrentCategoryProducts = useCallback((): Product[] => {
    if (currentCategoryId === null) {
      // Root level - show all products
      return products;
    }

    // Get all descendant category IDs
    const getDescendantIds = (catId: string): string[] => {
      const children = allCategories.filter((c) => c.parentId === catId);
      return [
        catId,
        ...children.flatMap((child) => getDescendantIds(child.id)),
      ];
    };

    const categoryIds = getDescendantIds(currentCategoryId);
    return products.filter(
      (p) => p.categoryId && categoryIds.includes(p.categoryId)
    );
  }, [currentCategoryId, allCategories, products]);

  /**
   * Refresh categories (clears cache and reloads current view)
   */
  const loadCategories = useCallback(async () => {
    if (businessId) {
      invalidateCategoryCache(businessId);
      setAllCategories([]);
    }

    const children = await loadCategoryChildren(currentCategoryId);
    setCurrentCategories(children);
  }, [businessId, currentCategoryId, loadCategoryChildren]);

  return {
    categories: allCategories,
    currentCategories,
    currentCategoryId,
    breadcrumb,
    loading,
    handleCategoryClick,
    handleBreadcrumbClick,
    getCurrentCategoryProducts,
    loadCategories,
    setCurrentCategoryId,
    setBreadcrumb,
  };
}
