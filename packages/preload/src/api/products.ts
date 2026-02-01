import { ipcRenderer } from "electron";

export const productAPI = {
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
  }) => ipcRenderer.invoke("products:create", productData),

  getByBusiness: (businessId: string, includeInactive?: boolean) =>
    ipcRenderer.invoke("products:getByBusiness", businessId, includeInactive),

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
  ) =>
    ipcRenderer.invoke(
      "products:getPaginated",
      businessId,
      pagination,
      filters,
    ),

  getById: (id: string) => ipcRenderer.invoke("products:getById", id),

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
  ) => ipcRenderer.invoke("products:update", id, updates),

  delete: (id: string) => ipcRenderer.invoke("products:delete", id),

  createModifier: (modifierData: {
    name: string;
    type: "single" | "multiple";
    required: boolean;
    businessId: string;
    options: { name: string; price: number }[];
  }) => ipcRenderer.invoke("modifiers:create", modifierData),

  /**
   * Get lightweight product lookup data (optimized for dropdowns)
   * Only returns id, name, sku - much faster than loading full products
   * @param businessId - Business ID
   * @param options - Optional filters (includeInactive, specific productIds)
   */
  getLookup: (
    businessId: string,
    options?: { includeInactive?: boolean; productIds?: string[] },
  ) => ipcRenderer.invoke("products:getLookup", businessId, options),

  adjustStock: (adjustmentData: {
    productId: string;
    type: "add" | "remove" | "sale" | "waste" | "adjustment";
    quantity: number;
    reason: string;
    userId: string;
    businessId: string;
  }) => ipcRenderer.invoke("stock:adjust", adjustmentData),

  getStockAdjustments: (productId: string) =>
    ipcRenderer.invoke("stock:getAdjustments", productId),

  syncStock: (businessId: string) =>
    ipcRenderer.invoke("products:syncStock", businessId),

  /**
   * Get aggregated product statistics for dashboard
   * Optimized to return only counts/sums without loading all products
   * @param businessId - Business ID
   */
  getStats: (businessId: string) =>
    ipcRenderer.invoke("products:getStats", businessId),
};
