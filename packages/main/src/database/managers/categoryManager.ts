import type { DrizzleDB } from "../drizzle.js";
import { eq, and, sql as drizzleSql, isNull } from "drizzle-orm";
import { Category } from "../schema.js";
import * as schema from "../schema.js";
import type { PaginationParams, PaginatedResult } from "../types/pagination.js";
import {
  calculatePagination,
  calculateLimitOffset,
} from "../types/pagination.js";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("categoryManager");

export interface CategoryResponse {
  success: boolean;
  message: string;
  category?: Category;
  categories?: Category[];
  errors?: string[];
}

export class CategoryManager {
  private drizzle: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.drizzle = drizzle;
    this.uuid = uuid;
  }

  /**
   * Get category statistics for a business (optimized - uses COUNT aggregation)
   */
  async getCategoryStats(businessId: string): Promise<{
    totalCategories: number;
    activeCategories: number;
    inactiveCategories: number;
    rootCategories: number;
    mostRecentCategory: { id: string; name: string; createdAt: string } | null;
  }> {
    // Get counts using SQL aggregation (fast even with large datasets)
    const [stats] = await this.drizzle
      .select({
        totalCategories: drizzleSql<number>`count(*)`,
        activeCategories: drizzleSql<number>`sum(case when ${schema.categories.isActive} = 1 then 1 else 0 end)`,
        inactiveCategories: drizzleSql<number>`sum(case when ${schema.categories.isActive} = 0 then 1 else 0 end)`,
        rootCategories: drizzleSql<number>`sum(case when ${schema.categories.parentId} is null then 1 else 0 end)`,
      })
      .from(schema.categories)
      .where(eq(schema.categories.businessId, businessId));

    // Get most recent category separately (single row query)
    const [mostRecent] = await this.drizzle
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        createdAt: schema.categories.createdAt,
      })
      .from(schema.categories)
      .where(eq(schema.categories.businessId, businessId))
      .orderBy(drizzleSql`${schema.categories.createdAt} DESC`)
      .limit(1);

    return {
      totalCategories: Number(stats?.totalCategories) || 0,
      activeCategories: Number(stats?.activeCategories) || 0,
      inactiveCategories: Number(stats?.inactiveCategories) || 0,
      rootCategories: Number(stats?.rootCategories) || 0,
      mostRecentCategory: mostRecent
        ? {
            id: mostRecent.id,
            name: mostRecent.name,
            createdAt:
              mostRecent.createdAt instanceof Date
                ? mostRecent.createdAt.toISOString()
                : String(mostRecent.createdAt),
          }
        : null,
    };
  }

  /**
   * Get category by ID (type-safe)
   */
  async getCategoryById(id: string): Promise<Category> {
    const [category] = await this.drizzle
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, id))
      .limit(1);

    if (!category) {
      throw new Error(`Category with ID ${id} not found`);
    }

    return category as Category;
  }

  /**
   * Get all categories for a business (type-safe)
   */
  async getCategoriesByBusiness(businessId: string): Promise<Category[]> {
    const categories = await this.drizzle
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.businessId, businessId),
          eq(schema.categories.isActive, true)
        )
      )
      .orderBy(schema.categories.sortOrder, schema.categories.name);

    return categories as Category[];
  }

  /**
   * Get direct children of a category with pagination
   * If parentId is null, returns root categories (categories with no parent)
   * This is optimized for lazy loading large category trees
   */
  async getCategoryChildren(
    businessId: string,
    parentId: string | null,
    pagination: PaginationParams
  ): Promise<PaginatedResult<Category>> {
    const { limit, offset } = calculateLimitOffset(
      pagination.page,
      pagination.pageSize
    );

    // Build WHERE conditions
    const conditions = [
      eq(schema.categories.businessId, businessId),
      eq(schema.categories.isActive, true),
    ];

    // Add parent filter - isNull for root categories, eq for children
    if (parentId === null) {
      conditions.push(isNull(schema.categories.parentId));
    } else {
      conditions.push(eq(schema.categories.parentId, parentId));
    }

    // Get total count for pagination
    const [countResult] = await this.drizzle
      .select({ count: drizzleSql<number>`count(*)` })
      .from(schema.categories)
      .where(and(...conditions));

    const totalItems = Number(countResult.count);

    // Get paginated items
    const items = await this.drizzle
      .select()
      .from(schema.categories)
      .where(and(...conditions))
      .orderBy(schema.categories.sortOrder, schema.categories.name)
      .limit(limit)
      .offset(offset);

    return {
      items: items as Category[],
      pagination: calculatePagination(
        totalItems,
        pagination.page,
        pagination.pageSize
      ),
    };
  }

  /**
   * Get all VAT categories for a business (type-safe)
   */
  async getVatCategoriesByBusiness(
    businessId: string
  ): Promise<schema.VatCategory[]> {
    const vatCategories = await this.drizzle
      .select()
      .from(schema.vatCategories)
      .where(
        and(
          eq(schema.vatCategories.businessId, businessId),
          eq(schema.vatCategories.isActive, true)
        )
      )
      .orderBy(schema.vatCategories.name);

    return vatCategories as schema.VatCategory[];
  }

  /**
   * Search categories by name (type-safe)
   */
  async searchCategories(
    businessId: string,
    searchTerm: string
  ): Promise<Category[]> {
    const searchPattern = `%${searchTerm}%`;

    const categories = await this.drizzle
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.businessId, businessId),
          eq(schema.categories.isActive, true),
          drizzleSql`(
            ${schema.categories.name} LIKE ${searchPattern} OR 
            ${schema.categories.description} LIKE ${searchPattern}
          )`
        )
      )
      .orderBy(schema.categories.name);

    return categories as Category[];
  }

  /**
   * Get category hierarchy (parent categories with subcategories)
   */
  async getCategoryHierarchy(businessId: string) {
    // Get all categories for the business
    const categories = await this.drizzle
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.businessId, businessId),
          eq(schema.categories.isActive, true)
        )
      )
      .orderBy(schema.categories.sortOrder, schema.categories.name);

    // Build hierarchy (categories with parentId null are top-level)
    const categoryMap = new Map();
    const topLevel: any[] = [];

    categories.forEach((cat) => {
      categoryMap.set(cat.id, {
        ...cat,
        children: [],
        isActive: Boolean(cat.isActive),
      });
    });

    categories.forEach((cat) => {
      const category = categoryMap.get(cat.id);
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(category);
        }
      } else {
        topLevel.push(category);
      }
    });

    return topLevel;
  }

  /**
   * Create category (type-safe)
   */
  async createCategory(categoryData: {
    name: string;
    description?: string;
    businessId: string;
    sortOrder?: number;
    parentId?: string | null;
    vatCategoryId?: string | null;
    vatOverridePercent?: number | null;
    image?: string | null;
    color?: string | null;
    isActive?: boolean | null;
  }): Promise<Category> {
    const categoryId = this.uuid.v4();
    const now = new Date();

    // Get the next sort order if not provided
    const nextSortOrder =
      categoryData.sortOrder !== undefined
        ? categoryData.sortOrder
        : await this.getNextCategorySortOrder(categoryData.businessId);

    await this.drizzle.insert(schema.categories).values({
      id: categoryId,
      name: categoryData.name,
      parentId: categoryData.parentId || null,
      description: categoryData.description || null,
      businessId: categoryData.businessId,
      sortOrder: nextSortOrder,
      vatCategoryId: categoryData.vatCategoryId || null,
      vatOverridePercent: categoryData.vatOverridePercent ?? null,
      image: categoryData.image || null,
      color: categoryData.color || null,
      isActive:
        categoryData.isActive !== undefined ? categoryData.isActive : true,
      createdAt: now,
      updatedAt: now,
    });

    return this.getCategoryById(categoryId);
  }

  /**
   * Update category (type-safe)
   */
  async updateCategory(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      parentId: string | null;
      sortOrder: number;
      isActive: boolean;
      vatCategoryId: string | null;
      vatOverridePercent: number | null;
      image: string | null;
      color: string | null;
    }>
  ): Promise<Category> {
    const now = new Date();

    // Prepare update object, only including defined fields
    const updateData: any = {
      updatedAt: now,
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.parentId !== undefined) updateData.parentId = updates.parentId;
    if (updates.sortOrder !== undefined)
      updateData.sortOrder = updates.sortOrder;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.vatCategoryId !== undefined)
      updateData.vatCategoryId = updates.vatCategoryId;
    if (updates.vatOverridePercent !== undefined)
      updateData.vatOverridePercent = updates.vatOverridePercent;
    if (updates.image !== undefined) updateData.image = updates.image;
    if (updates.color !== undefined) updateData.color = updates.color;

    await this.drizzle
      .update(schema.categories)
      .set(updateData)
      .where(eq(schema.categories.id, id));

    return this.getCategoryById(id);
  }

  /**
   * Delete category (soft delete, type-safe)
   */
  async deleteCategory(id: string): Promise<boolean> {
    const now = new Date();

    // Check if category is being used by any products
    const productsUsingCategory = await this.drizzle
      .select({ count: drizzleSql<number>`COUNT(*)` })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.categoryId, id),
          eq(schema.products.isActive, true)
        )
      );

    const count = productsUsingCategory[0]?.count || 0;

    if (count > 0) {
      throw new Error(
        `Cannot delete category: ${count} active product(s) are using this category`
      );
    }

    // Check if category has subcategories
    const subcategories = await this.drizzle
      .select({ count: drizzleSql<number>`COUNT(*)` })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.parentId, id),
          eq(schema.categories.isActive, true)
        )
      );

    const subCount = subcategories[0]?.count || 0;

    if (subCount > 0) {
      throw new Error(
        `Cannot delete category: ${subCount} active subcategory(s) exist`
      );
    }

    const result = await this.drizzle
      .update(schema.categories)
      .set({
        isActive: false,
        updatedAt: now,
      })
      .where(eq(schema.categories.id, id));

    return result.changes > 0;
  }

  /**
   * Get next sort order for categories in a business
   */
  private async getNextCategorySortOrder(businessId: string): Promise<number> {
    const result = await this.drizzle
      .select({
        maxOrder: drizzleSql<number>`MAX(${schema.categories.sortOrder})`,
      })
      .from(schema.categories)
      .where(eq(schema.categories.businessId, businessId));

    return (result[0]?.maxOrder || 0) + 1;
  }

  /**
   * Reorder categories
   */
  async reorderCategories(
    businessId: string,
    categoryIds: string[]
  ): Promise<void> {
    const now = new Date();

    // Drizzle doesn't have transaction support in better-sqlite3 driver yet,
    // so we'll run updates sequentially
    for (let index = 0; index < categoryIds.length; index++) {
      await this.drizzle
        .update(schema.categories)
        .set({
          sortOrder: index,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.categories.id, categoryIds[index]),
            eq(schema.categories.businessId, businessId)
          )
        );
    }
  }

  /**
   * Create default categories for a new business
   */
  async createDefaultCategories(businessId: string): Promise<void> {
    const defaultCategories = [
      { name: "Fresh Produce", description: "Fresh fruits and vegetables" },
      {
        name: "Dairy & Eggs",
        description: "Milk, cheese, eggs, and dairy products",
      },
      {
        name: "Meat & Poultry",
        description: "Fresh meat, chicken, and seafood",
      },
      { name: "Bakery", description: "Fresh bread, pastries, and baked goods" },
      {
        name: "Frozen Foods",
        description: "Frozen meals, ice cream, and frozen vegetables",
      },
      {
        name: "Pantry Essentials",
        description: "Canned goods, pasta, rice, and cooking essentials",
      },
      {
        name: "Snacks & Confectionery",
        description: "Chips, candy, chocolates, and snacks",
      },
      {
        name: "Beverages",
        description: "Soft drinks, juices, water, and beverages",
      },
      {
        name: "Health & Beauty",
        description: "Personal care and health products",
      },
      {
        name: "Household Items",
        description: "Cleaning supplies and household necessities",
      },
    ];

    const now = new Date();

    for (let index = 0; index < defaultCategories.length; index++) {
      const category = defaultCategories[index];
      const categoryId = this.uuid.v4();

      await this.drizzle.insert(schema.categories).values({
        id: categoryId,
        name: category.name,
        description: category.description,
        businessId: businessId,
        sortOrder: index,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Business Logic Methods (with validation and response wrapping)

  async createCategoryWithResponse(categoryData: {
    name: string;
    description?: string;
    businessId: string;
    sortOrder?: number;
    parentId?: string | null;
    image?: string | null;
    vatCategoryId?: string | null;
    vatOverridePercent?: number | null;
    color?: string | null;
    isActive?: boolean | null;
  }): Promise<CategoryResponse> {
    try {
      const category = await this.createCategory(categoryData);

      return {
        success: true,
        message: "Category created successfully",
        category,
      };
    } catch (error: any) {
      logger.error("Category creation error:", error);
      return {
        success: false,
        message: error.message || "Failed to create category",
      };
    }
  }

  async getCategoriesByBusinessWithResponse(
    businessId: string
  ): Promise<CategoryResponse> {
    try {
      const categories = await this.getCategoriesByBusiness(businessId);

      return {
        success: true,
        message: "Categories retrieved successfully",
        categories,
      };
    } catch (error: any) {
      logger.error("Get categories error:", error);
      return {
        success: false,
        message: error.message || "Failed to get categories",
      };
    }
  }

  async getCategoryByIdWithResponse(id: string): Promise<CategoryResponse> {
    try {
      const category = await this.getCategoryById(id);

      return {
        success: true,
        message: "Category retrieved successfully",
        category,
      };
    } catch (error: any) {
      logger.error("Get category error:", error);
      return {
        success: false,
        message: error.message || "Category not found",
      };
    }
  }

  async updateCategoryWithResponse(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      parentId: string | null;
      sortOrder: number;
      isActive: boolean;
      image: string | null;
      vatCategoryId: string | null;
      vatOverridePercent: number | null;
      color: string | null;
    }>
  ): Promise<CategoryResponse> {
    try {
      const category = await this.updateCategory(id, updates as any);

      return {
        success: true,
        message: "Category updated successfully",
        category,
      };
    } catch (error: any) {
      logger.error("Update category error:", error);
      return {
        success: false,
        message: error.message || "Failed to update category",
      };
    }
  }

  async deleteCategoryWithResponse(id: string): Promise<CategoryResponse> {
    try {
      await this.deleteCategory(id);

      return {
        success: true,
        message: "Category deleted successfully",
      };
    } catch (error: any) {
      logger.error("Delete category error:", error);
      return {
        success: false,
        message: error.message || "Failed to delete category",
      };
    }
  }

  async reorderCategoriesWithResponse(
    businessId: string,
    categoryIds: string[]
  ): Promise<CategoryResponse> {
    try {
      await this.reorderCategories(businessId, categoryIds);

      return {
        success: true,
        message: "Categories reordered successfully",
      };
    } catch (error: any) {
      logger.error("Reorder categories error:", error);
      return {
        success: false,
        message: error.message || "Failed to reorder categories",
      };
    }
  }
}
