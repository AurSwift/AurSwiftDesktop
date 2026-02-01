/**
 * Product API Types - Preload
 *
 * Type definitions for product management IPC APIs.
 *
 * @module preload/types/api/product
 */

export interface ProductAPIPreload {
  create: (productData: {
    name: string;
    description?: string;
    basePrice: number;
    costPrice?: number;
    sku: string;
    barcode?: string;
    plu?: string;
    image?: string;
    categoryId: string;
    productType?: "STANDARD" | "WEIGHTED" | "GENERIC";
    salesUnit?: "PIECE" | "KG" | "GRAM" | "LITRE" | "ML" | "PACK";
    usesScale?: boolean;
    pricePerKg?: number;
    isGenericButton?: boolean;
    genericDefaultPrice?: number;
    trackInventory?: boolean;
    stockLevel?: number;
    minStockLevel?: number;
    reorderPoint?: number;
    vatCategoryId?: string;
    vatOverridePercent?: number;
    businessId: string;
    isActive?: boolean;
    allowPriceOverride?: boolean;
    allowDiscount?: boolean;
  }) => Promise<any>;

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

  getById: (id: string) => Promise<any>;

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

  update: (
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      basePrice: number;
      costPrice: number;
      sku: string;
      barcode: string;
      plu: string;
      image: string;
      categoryId: string;
      productType: "STANDARD" | "WEIGHTED" | "GENERIC";
      salesUnit: "PIECE" | "KG" | "GRAM" | "LITRE" | "ML" | "PACK";
      usesScale: boolean;
      pricePerKg: number;
      isGenericButton: boolean;
      genericDefaultPrice: number;
      trackInventory: boolean;
      stockLevel: number;
      minStockLevel: number;
      reorderPoint: number;
      vatCategoryId: string;
      vatOverridePercent: number;
      isActive: boolean;
      allowPriceOverride: boolean;
      allowDiscount: boolean;
    }>,
  ) => Promise<any>;

  delete: (id: string) => Promise<any>;

  createModifier: (modifierData: {
    name: string;
    type: "single" | "multiple";
    required: boolean;
    businessId: string;
    options: { name: string; price: number }[];
  }) => Promise<any>;

  adjustStock: (adjustmentData: {
    productId: string;
    type: "add" | "remove" | "sale" | "waste" | "adjustment";
    quantity: number;
    reason: string;
    userId: string;
    businessId: string;
  }) => Promise<any>;

  getStockAdjustments: (productId: string) => Promise<any>;

  syncStock: (businessId: string) => Promise<any>;

  getStats: (businessId: string) => Promise<any>;
}
