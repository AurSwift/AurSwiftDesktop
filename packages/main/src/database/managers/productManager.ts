import type { Product, NewProduct } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, and, sql as drizzleSql, desc, asc } from "drizzle-orm";
import * as schema from "../schema.js";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("productManager");
import type {
  PaginationParams,
  PaginatedResult,
  ProductFilters,
} from "../types/pagination.js";
import {
  calculatePagination,
  calculateLimitOffset,
} from "../types/pagination.js";

export interface ProductResponse {
  success: boolean;
  message: string;
  product?: Product;
  products?: Product[];
  errors?: string[];
}

export class ProductManager {
  private drizzle: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.drizzle = drizzle;
    this.uuid = uuid;
  }

  async createProduct(
    productData: Omit<NewProduct, "id" | "createdAt" | "updatedAt">,
  ): Promise<Product> {
    const productId = this.uuid.v4();

    // Validate required fields
    if (!productData.categoryId || productData.categoryId.trim() === "") {
      throw new Error("Category is required and cannot be empty");
    }

    await this.drizzle.insert(schema.products).values({
      id: productId,
      name: productData.name,
      description: productData.description ?? null,
      basePrice: productData.basePrice,
      costPrice: productData.costPrice ?? 0,
      sku: productData.sku,
      barcode: productData.barcode ?? null,
      plu: productData.plu ?? null,
      image: productData.image ?? null,
      categoryId: productData.categoryId ?? null,
      productType: productData.productType ?? "STANDARD",
      salesUnit: productData.salesUnit ?? "PIECE",
      usesScale: productData.usesScale ?? false,
      pricePerKg: productData.pricePerKg ?? null,
      isGenericButton: productData.isGenericButton ?? false,
      genericDefaultPrice: productData.genericDefaultPrice ?? null,
      trackInventory: productData.trackInventory ?? true,
      stockLevel: productData.stockLevel ?? 0,
      minStockLevel: productData.minStockLevel ?? 0,
      reorderPoint: productData.reorderPoint ?? 0,
      vatCategoryId: productData.vatCategoryId ?? null,
      vatOverridePercent: productData.vatOverridePercent ?? null,
      businessId: productData.businessId,
      isActive: productData.isActive ?? true,
      allowPriceOverride: productData.allowPriceOverride ?? false,
      allowDiscount: productData.allowDiscount ?? true,
      // Age restriction fields
      ageRestrictionLevel: productData.ageRestrictionLevel ?? "NONE",
      requireIdScan: productData.requireIdScan ?? false,
      restrictionReason: productData.restrictionReason ?? null,
      // Expiry tracking fields
      hasExpiry: productData.hasExpiry ?? false,
      shelfLifeDays: productData.shelfLifeDays ?? null,
      requiresBatchTracking: productData.requiresBatchTracking ?? false,
      stockRotationMethod: productData.stockRotationMethod ?? "FIFO",
    });

    return this.getProductById(productId);
  }

  async getProductById(
    id: string,
    includeInactive: boolean = false,
  ): Promise<Product> {
    const conditions = [eq(schema.products.id, id)];

    if (!includeInactive) {
      conditions.push(eq(schema.products.isActive, true));
    }

    const [product] = await this.drizzle
      .select()
      .from(schema.products)
      .where(and(...conditions))
      .limit(1);

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }

  async getProductByPLU(plu: string): Promise<Product> {
    const [product] = await this.drizzle
      .select()
      .from(schema.products)
      .where(
        and(eq(schema.products.plu, plu), eq(schema.products.isActive, true)),
      )
      .limit(1);

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }

  async getProductBySKU(sku: string): Promise<Product | null> {
    const [product] = await this.drizzle
      .select()
      .from(schema.products)
      .where(
        and(eq(schema.products.sku, sku), eq(schema.products.isActive, true)),
      )
      .limit(1);

    if (!product) {
      return null;
    }

    return product;
  }

  /**
   * Get lightweight product lookup data (id, name, sku only)
   * Optimized for dropdowns and batch enrichment - much faster than loading full products
   */
  async getProductLookup(
    businessId: string,
    options?: {
      includeInactive?: boolean;
      productIds?: string[];
    },
  ): Promise<Array<{ id: string; name: string; sku: string | null }>> {
    const conditions = [eq(schema.products.businessId, businessId)];

    if (!options?.includeInactive) {
      conditions.push(eq(schema.products.isActive, true));
    }

    // If specific product IDs provided, filter to only those
    if (options?.productIds && options.productIds.length > 0) {
      conditions.push(
        drizzleSql`${schema.products.id} IN (${drizzleSql.join(
          options.productIds.map((id) => drizzleSql`${id}`),
          drizzleSql`, `,
        )})`,
      );
    }

    const products = await this.drizzle
      .select({
        id: schema.products.id,
        name: schema.products.name,
        sku: schema.products.sku,
      })
      .from(schema.products)
      .where(and(...conditions))
      .orderBy(schema.products.name);

    return products;
  }

  async getProductsByBusiness(
    businessId: string,
    includeInactive: boolean = false,
  ): Promise<Product[]> {
    const conditions = includeInactive
      ? [eq(schema.products.businessId, businessId)]
      : [
          eq(schema.products.businessId, businessId),
          eq(schema.products.isActive, true),
        ];

    const products = await this.drizzle
      .select()
      .from(schema.products)
      .where(and(...conditions))
      .orderBy(schema.products.name);

    return products;
  }

  /**
   * Get all descendant category IDs for a given category (recursive)
   * Returns an array including the parent category and all its descendants
   */
  private async getDescendantCategoryIds(
    businessId: string,
    categoryId: string,
  ): Promise<string[]> {
    // Start with the given category
    const result: string[] = [categoryId];

    // Use recursive query to get all descendants
    const getAllDescendants = async (parentId: string): Promise<void> => {
      const children = await this.drizzle
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.businessId, businessId),
            eq(schema.categories.parentId, parentId),
            eq(schema.categories.isActive, true),
          ),
        );

      for (const child of children) {
        result.push(child.id);
        await getAllDescendants(child.id);
      }
    };

    await getAllDescendants(categoryId);
    return result;
  }

  /**
   * Get products by business with pagination and filters
   */
  async getProductsByBusinessPaginated(
    businessId: string,
    pagination: PaginationParams,
    filters?: ProductFilters,
  ): Promise<PaginatedResult<Product>> {
    const { limit, offset } = calculateLimitOffset(
      pagination.page,
      pagination.pageSize,
    );

    // Build WHERE conditions
    const conditions = [eq(schema.products.businessId, businessId)];

    // Filter by active status
    if (filters?.isActive !== undefined) {
      conditions.push(eq(schema.products.isActive, filters.isActive));
    } else {
      conditions.push(eq(schema.products.isActive, true)); // Default to active only
    }

    // Filter by category (with optional descendant support)
    if (filters?.categoryId) {
      if (filters?.includeCategoryDescendants) {
        // Get all descendant category IDs
        const categoryIds = await this.getDescendantCategoryIds(
          businessId,
          filters.categoryId,
        );
        if (categoryIds.length > 0) {
          // Use IN clause for multiple categories
          conditions.push(
            drizzleSql`${schema.products.categoryId} IN (${drizzleSql.join(
              categoryIds.map((id) => drizzleSql`${id}`),
              drizzleSql`, `,
            )})`,
          );
        } else {
          // No descendants, just filter by the exact category
          conditions.push(eq(schema.products.categoryId, filters.categoryId));
        }
      } else {
        conditions.push(eq(schema.products.categoryId, filters.categoryId));
      }
    }

    // Filter by search term (name or SKU)
    if (filters?.searchTerm) {
      const searchPattern = `%${filters.searchTerm}%`;
      conditions.push(
        drizzleSql`(
          ${schema.products.name} LIKE ${searchPattern} OR 
          ${schema.products.sku} LIKE ${searchPattern} OR
          ${schema.products.barcode} LIKE ${searchPattern}
        )`,
      );
    }

    // Filter by stock status
    if (filters?.stockStatus && filters.stockStatus !== "all") {
      if (filters.stockStatus === "out_of_stock") {
        conditions.push(drizzleSql`${schema.products.stockLevel} = 0`);
      } else if (filters.stockStatus === "low") {
        conditions.push(
          drizzleSql`${schema.products.stockLevel} > 0 AND ${schema.products.stockLevel} <= ${schema.products.minStockLevel}`,
        );
      } else if (filters.stockStatus === "in_stock") {
        conditions.push(
          drizzleSql`${schema.products.stockLevel} > ${schema.products.minStockLevel}`,
        );
      }
    }

    // Get total count for pagination
    const [countResult] = await this.drizzle
      .select({ count: drizzleSql<number>`count(*)` })
      .from(schema.products)
      .where(and(...conditions));

    const totalItems = Number(countResult.count);

    // Build sort order
    const sortColumn = pagination.sortBy || "name";
    const sortDirection = pagination.sortOrder || "asc";
    // Map sort column names to actual schema columns
    const columnMap: Record<string, any> = {
      name: schema.products.name,
      basePrice: schema.products.basePrice,
      stockLevel: schema.products.stockLevel,
      sku: schema.products.sku,
      category: schema.products.categoryId,
      status: schema.products.isActive,
      createdAt: schema.products.createdAt,
      updatedAt: schema.products.updatedAt,
    };

    const sortColumnRef = columnMap[sortColumn] || schema.products.name;

    const orderByClause =
      sortDirection === "desc" ? desc(sortColumnRef) : asc(sortColumnRef);

    // Get paginated items
    const items = await this.drizzle
      .select()
      .from(schema.products)
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: calculatePagination(
        totalItems,
        pagination.page,
        pagination.pageSize,
      ),
    };
  }

  async updateProduct(
    id: string,
    updates: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Product> {
    if (Object.keys(updates).length === 0) {
      return this.getProductById(id, true);
    }

    // First check if product exists (include inactive to allow reactivation)
    try {
      await this.getProductById(id, true);
    } catch (error) {
      throw new Error("Product not found");
    }

    // updatedAt will be handled by $onUpdate in schema
    await this.drizzle
      .update(schema.products)
      .set(updates)
      .where(eq(schema.products.id, id));

    return this.getProductById(id, true);
  }

  async deleteProduct(id: string): Promise<boolean> {
    const now = new Date();

    // Check if product has active batches
    const activeBatches = await this.drizzle
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.productId, id),
          eq(schema.productBatches.status, "ACTIVE"),
        ),
      )
      .all();

    if (activeBatches.length > 0) {
      throw new Error(
        `Cannot delete product: ${activeBatches.length} active batch${
          activeBatches.length > 1 ? "es" : ""
        } still exist. Please remove or mark batches as REMOVED first.`,
      );
    }

    // Check if product has any stock
    const product = await this.getProductById(id);
    if ((product.stockLevel ?? 0) > 0) {
      throw new Error(
        `Cannot delete product: Product still has ${product.stockLevel} items in stock. Please adjust stock to 0 first.`,
      );
    }

    const result = await this.drizzle
      .update(schema.products)
      .set({
        isActive: false,
        updatedAt: now,
      })
      .where(
        and(eq(schema.products.id, id), eq(schema.products.isActive, true)),
      );

    return result.changes > 0;
  }

  /**
   * Search products by name or SKU (type-safe)
   */
  async searchProducts(
    businessId: string,
    searchTerm: string,
  ): Promise<Product[]> {
    const searchPattern = `%${searchTerm}%`;

    const products = await this.drizzle
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.isActive, true),
          drizzleSql`(
            ${schema.products.name} LIKE ${searchPattern} OR 
            ${schema.products.sku} LIKE ${searchPattern}
          )`,
        ),
      )
      .orderBy(schema.products.name);

    return products;
  }

  /**
   * Get products with category details using JOIN (type-safe)
   */
  async getProductsWithCategory(businessId: string) {
    const products = await this.drizzle
      .select({
        product: schema.products,
        category: schema.categories,
      })
      .from(schema.products)
      .leftJoin(
        schema.categories,
        eq(schema.products.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.isActive, true),
        ),
      )
      .orderBy(schema.products.name);

    return products;
  }

  /**
   * Get low stock products (type-safe)
   */
  async getLowStockProducts(
    businessId: string,
    threshold: number = 10,
  ): Promise<Product[]> {
    const products = await this.drizzle
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.isActive, true),
          drizzleSql`${schema.products.stockLevel} <= ${threshold}`,
        ),
      )
      .orderBy(schema.products.stockLevel);

    return products;
  }

  // Business Logic Methods (with validation and response wrapping)

  async createProductWithValidation(
    productData: Omit<NewProduct, "id" | "createdAt" | "updatedAt">,
  ): Promise<ProductResponse> {
    try {
      // Validate weight-based product data
      if (productData.usesScale) {
        if (!productData.pricePerKg || productData.pricePerKg <= 0) {
          return {
            success: false,
            message: "Weight-based products must have a valid price per kg",
          };
        }
      }

      // Check if SKU already exists
      try {
        const existingProduct = await this.getProductBySKU(productData.sku);
        if (existingProduct) {
          return {
            success: false,
            message: "A product with this SKU already exists",
          };
        }
      } catch (error) {
        // SKU doesn't exist, which is good
      }

      // Check if PLU already exists (if PLU is provided)
      if (productData.plu) {
        try {
          const existingProductByPLU = await this.getProductByPLU(
            productData.plu,
          );
          if (existingProductByPLU) {
            return {
              success: false,
              message: "A product with this PLU already exists",
            };
          }
        } catch (error) {
          // PLU doesn't exist, which is good
        }
      }

      // Create the product
      const product = await this.createProduct(productData);

      // Fetch the complete product
      const completeProduct = await this.getProductById(product.id);

      return {
        success: true,
        message: "Product created successfully",
        product: completeProduct,
      };
    } catch (error: any) {
      logger.error("Product creation error:", error);
      return {
        success: false,
        message: error.message || "Failed to create product",
      };
    }
  }

  async getProductsByBusinessWithResponse(
    businessId: string,
  ): Promise<ProductResponse> {
    try {
      const products = await this.getProductsByBusiness(businessId);

      return {
        success: true,
        message: "Products retrieved successfully",
        products,
      };
    } catch (error: any) {
      logger.error("Get products error:", error);
      return {
        success: false,
        message: error.message || "Failed to get products",
      };
    }
  }

  async getProductByIdWithResponse(id: string): Promise<ProductResponse> {
    try {
      const product = await this.getProductById(id);

      return {
        success: true,
        message: "Product retrieved successfully",
        product,
      };
    } catch (error: any) {
      logger.error("Get product error:", error);
      return {
        success: false,
        message: error.message || "Product not found",
      };
    }
  }

  async updateProductWithValidation(
    id: string,
    updates: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>,
  ): Promise<ProductResponse> {
    try {
      // If updating SKU, check it doesn't already exist
      if (updates.sku) {
        try {
          const existingProduct = await this.getProductBySKU(updates.sku);
          if (existingProduct && existingProduct.id !== id) {
            return {
              success: false,
              message: "A product with this SKU already exists",
            };
          }
        } catch (error) {
          // SKU doesn't exist, which is good
        }
      }

      // If updating PLU, check it doesn't already exist
      if (updates.plu) {
        try {
          const existingProductByPLU = await this.getProductByPLU(updates.plu);
          if (existingProductByPLU && existingProductByPLU.id !== id) {
            return {
              success: false,
              message: "A product with this PLU already exists",
            };
          }
        } catch (error) {
          // PLU doesn't exist, which is good
        }
      }

      // Update the product
      const product = await this.updateProduct(id, updates);

      // Fetch the complete updated product
      const updatedProduct = await this.getProductById(id, true);

      return {
        success: true,
        message: "Product updated successfully",
        product: updatedProduct,
      };
    } catch (error: any) {
      logger.error("Product update error:", error);
      return {
        success: false,
        message: error.message || "Failed to update product",
      };
    }
  }

  async deleteProductWithResponse(id: string): Promise<ProductResponse> {
    try {
      await this.deleteProduct(id);

      return {
        success: true,
        message: "Product deleted successfully",
      };
    } catch (error: any) {
      logger.error("Product deletion error:", error);
      return {
        success: false,
        message: error.message || "Failed to delete product",
      };
    }
  }

  /**
   * Get aggregated product statistics for dashboard
   * Optimized to return only counts/sums without loading all products
   */
  async getProductStats(businessId: string): Promise<{
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalInventoryValue: number;
  }> {
    const [stats] = await this.drizzle
      .select({
        totalProducts: drizzleSql<number>`COUNT(*)`,
        activeProducts: drizzleSql<number>`COUNT(CASE WHEN ${schema.products.isActive} = 1 THEN 1 END)`,
        inactiveProducts: drizzleSql<number>`COUNT(CASE WHEN ${schema.products.isActive} = 0 THEN 1 END)`,
        lowStockCount: drizzleSql<number>`COUNT(CASE WHEN ${schema.products.stockLevel} > 0 AND ${schema.products.stockLevel} <= ${schema.products.minStockLevel} THEN 1 END)`,
        outOfStockCount: drizzleSql<number>`COUNT(CASE WHEN ${schema.products.stockLevel} = 0 THEN 1 END)`,
        totalInventoryValue: drizzleSql<number>`SUM(CAST(${schema.products.stockLevel} AS REAL) * CAST(${schema.products.costPrice} AS REAL))`,
      })
      .from(schema.products)
      .where(eq(schema.products.businessId, businessId));

    return {
      totalProducts: Number(stats.totalProducts) || 0,
      activeProducts: Number(stats.activeProducts) || 0,
      inactiveProducts: Number(stats.inactiveProducts) || 0,
      lowStockCount: Number(stats.lowStockCount) || 0,
      outOfStockCount: Number(stats.outOfStockCount) || 0,
      totalInventoryValue: Number(stats.totalInventoryValue) || 0,
    };
  }
}
