/**
 * Hook for managing paginated products
 *
 * Uses server-side pagination via IPC and local caching for optimal performance
 * with large product catalogs (60k+ products).
 *
 * Key features:
 * - Server-side pagination (only loads current page)
 * - Infinite scroll support via loadMore()
 * - Local caching to reduce IPC calls
 * - Filter by category and search term
 * - Cache invalidation support
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import type { Product } from "@/types/domain";
import {
  productCache,
  getProductCacheKey,
  invalidateProductCache,
} from "@/shared/utils/simple-cache";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("use-paginated-products");

// Default page size - balance between UI responsiveness and IPC overhead
const DEFAULT_PAGE_SIZE = 50;

interface UsePaginatedProductsOptions {
  /** Business ID to load products for */
  businessId: string | undefined;
  /** Filter by category ID (optional) */
  categoryId?: string | null;
  /** When true, include products from all descendant categories (default: true) */
  includeCategoryDescendants?: boolean;
  /** Search term for filtering (optional) */
  searchTerm?: string;
  /** Number of items per page (default: 50) */
  pageSize?: number;
  /** Whether to use caching (default: true) */
  useCache?: boolean;
}

interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UsePaginatedProductsResult {
  /** Current loaded products (accumulated for infinite scroll) */
  products: Product[];
  /** Loading state for initial load */
  initialLoading: boolean;
  /** Loading state for subsequent loads (infinite scroll) */
  loading: boolean;
  /** Error message if load failed */
  error: string | null;
  /** Pagination metadata */
  pagination: PaginationState;
  /** Load next page (for infinite scroll) */
  loadMore: () => void;
  /** Refresh all data (clears cache and reloads) */
  refresh: () => void;
  /** Whether there are more items to load */
  hasMore: boolean;
}

export function usePaginatedProducts({
  businessId,
  categoryId,
  includeCategoryDescendants = true,
  searchTerm,
  pageSize = DEFAULT_PAGE_SIZE,
  useCache = true,
}: UsePaginatedProductsOptions): UsePaginatedProductsResult {
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Track current fetch to prevent race conditions
  const fetchIdRef = useRef(0);

  // Track if component is mounted
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Load a specific page of products
   * @param page - Page number to load (1-based)
   * @param append - Whether to append to existing products (for infinite scroll)
   */
  const loadPage = useCallback(
    async (page: number, append: boolean = false) => {
      if (!businessId) {
        setInitialLoading(false);
        return;
      }

      const fetchId = ++fetchIdRef.current;

      // Check cache first (only for non-appended single page loads)
      if (useCache && !append) {
        const cacheKey = getProductCacheKey(
          businessId,
          page,
          pageSize,
          categoryId || undefined,
          searchTerm,
        );
        const cached = productCache.get(cacheKey) as
          | {
              items: Product[];
              pagination: PaginationState;
            }
          | undefined;

        if (cached) {
          setProducts(cached.items);
          setPagination({
            page: cached.pagination.page,
            pageSize: cached.pagination.pageSize,
            totalItems: cached.pagination.totalItems,
            totalPages: cached.pagination.totalPages,
            hasNextPage: cached.pagination.hasNextPage,
            hasPreviousPage: cached.pagination.hasPreviousPage,
          });
          setInitialLoading(false);
          return;
        }
      }

      try {
        setLoading(true);
        setError(null);

        const response = await window.productAPI.getPaginated(
          businessId,
          { page, pageSize },
          {
            categoryId: categoryId || undefined,
            includeCategoryDescendants: categoryId
              ? includeCategoryDescendants
              : undefined,
            searchTerm: searchTerm || undefined,
            isActive: true,
          },
        );

        // Ignore if component unmounted or newer fetch started
        if (!isMountedRef.current || fetchId !== fetchIdRef.current) {
          return;
        }

        if (response.success && response.data) {
          const { items, pagination: paginationData } = response.data;

          if (append) {
            // Append for infinite scroll
            setProducts((prev) => [...prev, ...items]);
          } else {
            // Replace for new query
            setProducts(items);
          }

          setPagination({
            page: paginationData.page,
            pageSize: paginationData.pageSize,
            totalItems: paginationData.totalItems,
            totalPages: paginationData.totalPages,
            hasNextPage: paginationData.hasNextPage,
            hasPreviousPage: paginationData.hasPreviousPage,
          });

          // Cache the result
          if (useCache) {
            const cacheKey = getProductCacheKey(
              businessId,
              page,
              pageSize,
              categoryId || undefined,
              searchTerm,
            );
            productCache.set(cacheKey, { items, pagination: paginationData });
          }
        } else {
          const errorMessage = response.message || "Failed to load products";
          setError(errorMessage);
          toast.error(errorMessage);
        }
      } catch (err) {
        // Ignore if component unmounted or newer fetch started
        if (!isMountedRef.current || fetchId !== fetchIdRef.current) {
          return;
        }

        logger.error("Error loading products:", err);
        setError("Failed to load products");
        toast.error("Failed to load products");
      } finally {
        if (isMountedRef.current && fetchId === fetchIdRef.current) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    },
    [
      businessId,
      categoryId,
      includeCategoryDescendants,
      searchTerm,
      pageSize,
      useCache,
    ],
  );

  /**
   * Reset and load first page when filters change
   */
  useEffect(() => {
    setProducts([]);
    setInitialLoading(true);
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadPage(1);
  }, [businessId, categoryId, searchTerm, loadPage]);

  /**
   * Load next page (for infinite scroll)
   */
  const loadMore = useCallback(() => {
    if (!loading && pagination.hasNextPage) {
      loadPage(pagination.page + 1, true);
    }
  }, [loading, pagination.hasNextPage, pagination.page, loadPage]);

  /**
   * Refresh all data (clears cache and reloads)
   */
  const refresh = useCallback(() => {
    if (businessId) {
      invalidateProductCache(businessId);
    }
    setProducts([]);
    setInitialLoading(true);
    loadPage(1);
  }, [businessId, loadPage]);

  // Memoize hasMore for stability
  const hasMore = useMemo(
    () => pagination.hasNextPage,
    [pagination.hasNextPage],
  );

  return {
    products,
    loading,
    initialLoading,
    error,
    pagination,
    loadMore,
    refresh,
    hasMore,
  };
}
