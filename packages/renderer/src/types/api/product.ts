/**
 * Product API Types
 *
 * Types for product management operations.
 *
 * @module types/api/product
 */

export interface ProductAPI {
  create: (productData: Record<string, any>) => Promise<any>;
  getByBusiness: (
    businessId: string,
    includeInactive?: boolean,
  ) => Promise<any>;
  getPaginated: (
    businessId: string,
    pagination: {
      page: number;
      pageSize: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    },
    filters?: {
      categoryId?: string;
      /** When true, include products from all descendant categories */
      includeCategoryDescendants?: boolean;
      searchTerm?: string;
      stockStatus?: "all" | "in_stock" | "low" | "out_of_stock";
      isActive?: boolean;
    },
  ) => Promise<any>;
  /**
   * Get lightweight product lookup data (optimized for dropdowns)
   * Only returns id, name, sku - much faster than loading full products
   */
  getLookup: (
    businessId: string,
    options?: { includeInactive?: boolean; productIds?: string[] },
  ) => Promise<{
    success: boolean;
    products?: Array<{ id: string; name: string; sku: string | null }>;
    message?: string;
  }>;
  getById: (id: string) => Promise<any>;
  update: (id: string, updates: Record<string, any>) => Promise<any>;
  delete: (id: string) => Promise<any>;
  adjustStock: (adjustmentData: Record<string, any>) => Promise<any>;
  getStockAdjustments: (productId: string) => Promise<any>;
  syncStock: (businessId: string) => Promise<any>;
  getStats: (businessId: string) => Promise<any>;
}
