import { useState, useEffect, useCallback } from "react";

export interface UseTablePaginationOptions {
  /**
   * Total number of items
   */
  totalItems: number;
  /**
   * Initial page size
   */
  initialPageSize?: number;
  /**
   * Initial current page (1-indexed)
   */
  initialPage?: number;
}

export interface ControlledPaginationProps {
  /**
   * Current page (1-indexed, controlled)
   */
  currentPage: number;
  /**
   * Page size (controlled)
   */
  pageSize: number;
  /**
   * Callback when page changes
   */
  onPageChange: (page: number) => void;
  /**
   * Callback when page size changes
   */
  onPageSizeChange: (pageSize: number) => void;
}

export interface UseTablePaginationReturn<T = unknown> {
  /**
   * Current page (1-indexed)
   */
  currentPage: number;
  /**
   * Items per page
   */
  pageSize: number;
  /**
   * Total number of pages
   */
  totalPages: number;
  /**
   * Whether there's a previous page
   */
  hasPreviousPage: boolean;
  /**
   * Whether there's a next page
   */
  hasNextPage: boolean;
  /**
   * Set current page
   */
  setCurrentPage: (page: number) => void;
  /**
   * Set page size
   */
  setPageSize: (size: number) => void;
  /**
   * Go to next page
   */
  goToNextPage: () => void;
  /**
   * Go to previous page
   */
  goToPreviousPage: () => void;
  /**
   * Go to first page
   */
  goToFirstPage: () => void;
  /**
   * Go to last page
   */
  goToLastPage: () => void;
  /**
   * Get paginated slice of data
   */
  getPaginatedData: (data: T[]) => T[];
}

/**
 * Generic table pagination hook
 * Supports both controlled and uncontrolled modes
 * FIXES: Race condition in pagination (original bug in user-table.tsx:137-139)
 *
 * @example
 * ```tsx
 * // Uncontrolled mode
 * const pagination = useTablePagination({
 *   totalItems: users.length,
 *   initialPageSize: 10,
 *   initialPage: 1
 * });
 *
 * // Use pagination
 * const pageData = pagination.getPaginatedData(users);
 * ```
 *
 * @example
 * ```tsx
 * // Controlled mode
 * const [page, setPage] = useState(1);
 * const [pageSize, setPageSize] = useState(10);
 *
 * const pagination = useTablePagination({
 *   totalItems: users.length,
 *   controlled: { currentPage: page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }
 * });
 * ```
 */
export function useTablePagination<T = unknown>(
  options: UseTablePaginationOptions & {
    controlled?: ControlledPaginationProps;
  },
): UseTablePaginationReturn<T> {
  const {
    totalItems,
    initialPageSize = 10,
    initialPage = 1,
    controlled,
  } = options;

  const [internalCurrentPage, setInternalCurrentPage] = useState(initialPage);
  const [internalPageSize, setInternalPageSize] = useState(initialPageSize);

  // Use controlled values if provided, otherwise use internal state
  const currentPage = controlled?.currentPage ?? internalCurrentPage;
  const pageSize = controlled?.pageSize ?? internalPageSize;
  const setCurrentPage = controlled?.onPageChange ?? setInternalCurrentPage;
  const setPageSize = controlled?.onPageSizeChange ?? setInternalPageSize;

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // FIX: Safe page adjustment to prevent race condition
  // Automatically adjust page when totalPages changes
  useEffect(() => {
    const maxPage = Math.max(1, totalPages);
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    } else if (currentPage < 1) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, setCurrentPage]);

  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;

  const goToNextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, hasNextPage, setCurrentPage]);

  const goToPreviousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage, hasPreviousPage, setCurrentPage]);

  const goToFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, [setCurrentPage]);

  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages, setCurrentPage]);

  const getPaginatedData = useCallback(
    (data: T[]): T[] => {
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      return data.slice(start, end);
    },
    [currentPage, pageSize],
  );

  return {
    currentPage,
    pageSize,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    setCurrentPage,
    setPageSize,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    getPaginatedData,
  };
}
