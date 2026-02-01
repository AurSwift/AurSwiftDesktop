/**
 * Pagination Types
 *
 * Standard pagination interfaces for consistent paginated queries across the application
 */

export interface PaginationParams {
  page: number; // 1-based page number
  pageSize: number; // Number of items per page
  sortBy?: string; // Column to sort by
  sortOrder?: "asc" | "desc"; // Sort direction
}

export interface PaginatedResult<T> {
  items: T[]; // Items for the current page
  pagination: {
    page: number; // Current page (1-based)
    pageSize: number; // Items per page
    totalItems: number; // Total number of items
    totalPages: number; // Total number of pages
    hasNextPage: boolean; // Whether there's a next page
    hasPreviousPage: boolean; // Whether there's a previous page
  };
}

export interface ProductFilters {
  categoryId?: string;
  /** When true, include products from all descendant categories */
  includeCategoryDescendants?: boolean;
  searchTerm?: string;
  stockStatus?: "all" | "in_stock" | "low" | "out_of_stock";
  isActive?: boolean;
}

export interface BatchFilters {
  productId?: string;
  status?: "ACTIVE" | "EXPIRED" | "SOLD_OUT" | "REMOVED";
  expiryStatus?: "all" | "expired" | "critical" | "warning" | "info";
  expiringWithinDays?: number;
}

/**
 * Helper function to calculate pagination metadata
 */
export function calculatePagination(
  totalItems: number,
  page: number,
  pageSize: number,
): PaginatedResult<never>["pagination"] {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Helper function to calculate limit and offset from page and pageSize
 */
export function calculateLimitOffset(
  page: number,
  pageSize: number,
): {
  limit: number;
  offset: number;
} {
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}
