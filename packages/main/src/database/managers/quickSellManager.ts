/**
 * Quick Sell Manager
 *
 * Handles database operations for quick sell pages and buttons.
 */

import type { DrizzleDB } from "../drizzle.js";
import { eq, and } from "drizzle-orm";
import {
  quickSellPages,
  quickSellButtons,
  products,
  categories,
  type QuickSellPage,
  type NewQuickSellPage,
  type QuickSellButton,
  type NewQuickSellButton,
} from "../schema.js";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger("quickSellManager");

export interface QuickSellButtonWithDetails extends QuickSellButton {
  product?: {
    id: string;
    name: string;
    basePrice: number;
    image?: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
}

export interface QuickSellPageWithButtons extends QuickSellPage {
  buttons: QuickSellButtonWithDetails[];
}

export class QuickSellManager {
  private drizzle: DrizzleDB;
  private uuid: { v4: () => string };

  constructor(drizzle: DrizzleDB, uuid: { v4: () => string }) {
    this.drizzle = drizzle;
    this.uuid = uuid;
  }

  /**
   * Get all pages for a business
   */
  async getPagesByBusiness(businessId: string): Promise<QuickSellPage[]> {
    const result = await this.drizzle
      .select()
      .from(quickSellPages)
      .where(eq(quickSellPages.businessId, businessId))
      .orderBy(quickSellPages.pageIndex);

    return result;
  }

  /**
   * Get all pages with their buttons for a business
   */
  async getPagesWithButtons(
    businessId: string,
  ): Promise<QuickSellPageWithButtons[]> {
    // Get all pages
    const pages = await this.getPagesByBusiness(businessId);

    if (pages.length === 0) {
      return [];
    }

    // Get all buttons for these pages with product/category details
    const pageIds = pages.map((p) => p.id);
    const buttonsResult = await this.drizzle
      .select({
        button: quickSellButtons,
        product: {
          id: products.id,
          name: products.name,
          basePrice: products.basePrice,
          image: products.image,
        },
        category: {
          id: categories.id,
          name: categories.name,
          color: categories.color,
        },
      })
      .from(quickSellButtons)
      .leftJoin(products, eq(quickSellButtons.productId, products.id))
      .leftJoin(categories, eq(quickSellButtons.categoryId, categories.id))
      .where(eq(quickSellButtons.businessId, businessId));

    // Group buttons by page
    const buttonsByPage = new Map<string, QuickSellButtonWithDetails[]>();

    for (const row of buttonsResult) {
      const pageId = row.button.pageId;
      if (!buttonsByPage.has(pageId)) {
        buttonsByPage.set(pageId, []);
      }

      buttonsByPage.get(pageId)!.push({
        ...row.button,
        product: row.product?.id
          ? {
              id: row.product.id,
              name: row.product.name,
              basePrice: row.product.basePrice,
              image: row.product.image,
            }
          : null,
        category: row.category?.id
          ? {
              id: row.category.id,
              name: row.category.name,
              color: row.category.color,
            }
          : null,
      });
    }

    // Sort buttons by position within each page
    for (const buttons of buttonsByPage.values()) {
      buttons.sort((a, b) => a.position - b.position);
    }

    // Combine pages with their buttons
    return pages.map((page) => ({
      ...page,
      buttons: buttonsByPage.get(page.id) || [],
    }));
  }

  /**
   * Create a new page
   */
  async createPage(data: NewQuickSellPage): Promise<QuickSellPage> {
    const [result] = await this.drizzle
      .insert(quickSellPages)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Create a new button
   */
  async createButton(data: NewQuickSellButton): Promise<QuickSellButton> {
    const [result] = await this.drizzle
      .insert(quickSellButtons)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Get a button by ID
   */
  async getButtonById(id: string): Promise<QuickSellButton | undefined> {
    const [result] = await this.drizzle
      .select()
      .from(quickSellButtons)
      .where(eq(quickSellButtons.id, id));

    return result;
  }

  /**
   * Get a button with product/category details
   */
  async getButtonWithDetails(
    id: string,
  ): Promise<QuickSellButtonWithDetails | null> {
    const [row] = await this.drizzle
      .select({
        button: quickSellButtons,
        product: {
          id: products.id,
          name: products.name,
          basePrice: products.basePrice,
          image: products.image,
        },
        category: {
          id: categories.id,
          name: categories.name,
          color: categories.color,
        },
      })
      .from(quickSellButtons)
      .leftJoin(products, eq(quickSellButtons.productId, products.id))
      .leftJoin(categories, eq(quickSellButtons.categoryId, categories.id))
      .where(eq(quickSellButtons.id, id));

    if (!row) return null;

    return {
      ...row.button,
      product: row.product?.id
        ? {
            id: row.product.id,
            name: row.product.name,
            basePrice: row.product.basePrice,
            image: row.product.image,
          }
        : null,
      category: row.category?.id
        ? {
            id: row.category.id,
            name: row.category.name,
            color: row.category.color,
          }
        : null,
    };
  }

  /**
   * Update a button
   */
  async updateButton(
    id: string,
    updates: Partial<Omit<QuickSellButton, "id" | "createdAt">>,
  ): Promise<QuickSellButton | undefined> {
    const [result] = await this.drizzle
      .update(quickSellButtons)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(quickSellButtons.id, id))
      .returning();

    return result;
  }

  /**
   * Reset all buttons on a page to unassigned
   */
  async resetPageButtons(pageId: string): Promise<void> {
    await this.drizzle
      .update(quickSellButtons)
      .set({
        label: null,
        color: "#3b82f6",
        textColor: "#ffffff",
        shape: "rounded",
        linkType: "unassigned",
        productId: null,
        categoryId: null,
        updatedAt: new Date(),
      })
      .where(eq(quickSellButtons.pageId, pageId));
  }

  /**
   * Delete a page and all its buttons
   */
  async deletePage(pageId: string): Promise<void> {
    // Buttons will be cascade deleted due to foreign key
    await this.drizzle
      .delete(quickSellPages)
      .where(eq(quickSellPages.id, pageId));
  }

  /**
   * Delete all pages and buttons for a business
   */
  async deleteAllForBusiness(businessId: string): Promise<void> {
    // First delete buttons (child table)
    await this.drizzle
      .delete(quickSellButtons)
      .where(eq(quickSellButtons.businessId, businessId));

    // Then delete pages (parent table)
    await this.drizzle
      .delete(quickSellPages)
      .where(eq(quickSellPages.businessId, businessId));
  }
}
