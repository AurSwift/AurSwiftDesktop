/**
 * Saved Basket Manager
 * 
 * Manages saved baskets (cart sessions saved for later retrieval via QR code)
 * Handles basket code generation, saving, retrieval, and expiration
 */

import type { SavedBasket, CartSession, CartItem } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, gte, or } from "drizzle-orm";
import * as schema from "../schema.js";

export class SavedBasketManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Generate a unique 6-character alphanumeric basket code
   * Format: ABC123 (uppercase letters and numbers)
   */
  private generateBasketCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Check if a basket code already exists
   */
  private async codeExists(code: string): Promise<boolean> {
    const [existing] = await this.db
      .select()
      .from(schema.savedBaskets)
      .where(eq(schema.savedBaskets.basketCode, code))
      .limit(1);
    return !!existing;
  }

  /**
   * Generate a unique basket code (retry if collision)
   */
  private async generateUniqueCode(maxRetries: number = 10): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      const code = this.generateBasketCode();
      const exists = await this.codeExists(code);
      if (!exists) {
        return code;
      }
    }
    throw new Error("Failed to generate unique basket code after multiple attempts");
  }

  /**
   * Save a cart session as a saved basket
   */
  async saveBasket(
    cartSessionId: string,
    basketName: string,
    businessId: string,
    savedBy: string,
    shiftId: string | null = null,
    customerEmail: string | null = null,
    notes: string | null = null,
    expirationDays: number = 7
  ): Promise<SavedBasket> {
    // Verify cart session exists and has items
    const [cartSession] = await this.db
      .select()
      .from(schema.cartSessions)
      .where(eq(schema.cartSessions.id, cartSessionId))
      .limit(1);

    if (!cartSession) {
      throw new Error("Cart session not found");
    }

    // Check if cart has items
    const items = await this.db
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartSessionId, cartSessionId));

    if (items.length === 0) {
      throw new Error("Cannot save empty basket");
    }

    // Generate unique basket code
    const basketCode = await this.generateUniqueCode();
    const fullCode = `BSK-${basketCode}`;

    // Calculate expiration date
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);

    // Create saved basket record
    const basketId = this.uuid.v4();
    await this.db.insert(schema.savedBaskets).values({
      id: basketId,
      basketCode: fullCode,
      name: basketName || `Basket ${basketCode}`,
      cartSessionId,
      businessId,
      savedBy,
      shiftId: shiftId || null,
      customerEmail: customerEmail || null,
      savedAt: now,
      expiresAt,
      status: "active",
      retrievedCount: 0,
      notes: notes || null,
      createdAt: now,
      updatedAt: now,
    });

    // Update cart session status to "SAVED"
    await this.db
      .update(schema.cartSessions)
      .set({
        status: "SAVED",
        updatedAt: now,
      })
      .where(eq(schema.cartSessions.id, cartSessionId));

    return this.getBasketById(basketId);
  }

  /**
   * Get saved basket by ID
   */
  async getBasketById(basketId: string): Promise<SavedBasket> {
    const [basket] = await this.db
      .select()
      .from(schema.savedBaskets)
      .where(eq(schema.savedBaskets.id, basketId))
      .limit(1);

    if (!basket) {
      throw new Error("Saved basket not found");
    }

    return basket as SavedBasket;
  }

  /**
   * Get saved basket by basket code (for QR code lookup)
   */
  async getBasketByCode(basketCode: string): Promise<SavedBasket | null> {
    // Handle both "BSK-ABC123" and "ABC123" formats
    const code = basketCode.startsWith("BSK-") 
      ? basketCode 
      : `BSK-${basketCode}`;

    const [basket] = await this.db
      .select()
      .from(schema.savedBaskets)
      .where(eq(schema.savedBaskets.basketCode, code))
      .limit(1);

    if (!basket) {
      return null;
    }

    // Check if expired
    if (basket.expiresAt && new Date(basket.expiresAt) < new Date()) {
      // Auto-update status to expired
      await this.db
        .update(schema.savedBaskets)
        .set({
          status: "expired",
          updatedAt: new Date(),
        })
        .where(eq(schema.savedBaskets.id, basket.id));
      
      return { ...basket, status: "expired" } as SavedBasket;
    }

    return basket as SavedBasket;
  }

  /**
   * Get saved basket with cart items
   */
  async getBasketWithItems(basketId: string): Promise<{
    basket: SavedBasket;
    cartSession: CartSession;
    items: CartItem[];
  }> {
    const basket = await this.getBasketById(basketId);

    const [cartSession] = await this.db
      .select()
      .from(schema.cartSessions)
      .where(eq(schema.cartSessions.id, basket.cartSessionId))
      .limit(1);

    if (!cartSession) {
      throw new Error("Cart session not found for saved basket");
    }

    const items = await this.db
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartSessionId, basket.cartSessionId))
      .orderBy(schema.cartItems.addedAt);

    return {
      basket,
      cartSession: cartSession as CartSession,
      items: items as CartItem[],
    };
  }

  /**
   * Retrieve a saved basket (load items into new cart session)
   */
  async retrieveBasket(
    basketId: string,
    newCartSessionId: string,
    businessId: string
  ): Promise<{
    basket: SavedBasket;
    itemsAdded: number;
    warnings: string[];
  }> {
    const basket = await this.getBasketById(basketId);

    // Verify business match
    if (basket.businessId !== businessId) {
      throw new Error("Basket does not belong to this business");
    }

    // Check status
    if (basket.status !== "active") {
      throw new Error(`Basket is ${basket.status} and cannot be retrieved`);
    }

    // Check expiration
    if (basket.expiresAt && new Date(basket.expiresAt) < new Date()) {
      // Update status
      await this.db
        .update(schema.savedBaskets)
        .set({
          status: "expired",
          updatedAt: new Date(),
        })
        .where(eq(schema.savedBaskets.id, basketId));
      throw new Error("Basket has expired");
    }

    // Get original cart items
    const originalItems = await this.db
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartSessionId, basket.cartSessionId));

    if (originalItems.length === 0) {
      throw new Error("Saved basket has no items");
    }

    // Get products to validate availability and prices
    const productIds = originalItems
      .filter((item) => item.productId)
      .map((item) => item.productId!);

    const products = productIds.length > 0
      ? await this.db
          .select()
          .from(schema.products)
          .where(
            or(...productIds.map((id) => eq(schema.products.id, id)))
          )
      : [];

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Copy items to new cart session with validation
    const warnings: string[] = [];
    let itemsAdded = 0;
    const now = new Date();

    for (const originalItem of originalItems) {
      try {
        // Validate product exists (if it's a product item)
        if (originalItem.productId) {
          const product = productMap.get(originalItem.productId);
          if (!product) {
            warnings.push(`${originalItem.itemName || "Item"} is no longer available`);
            continue;
          }

          // Check if product is still active
          if (product.status !== "active") {
            warnings.push(`${product.name} is no longer available`);
            continue;
          }
        }

        // Create new cart item in new session
        const newItemId = this.uuid.v4();
        await this.db.insert(schema.cartItems).values({
          id: newItemId,
          cartSessionId: newCartSessionId,
          productId: originalItem.productId || null,
          categoryId: originalItem.categoryId || null,
          itemName: originalItem.itemName || null,
          itemType: originalItem.itemType,
          quantity: originalItem.quantity || null,
          weight: originalItem.weight || null,
          unitOfMeasure: originalItem.unitOfMeasure || null,
          unitPrice: originalItem.unitPrice, // Keep original price
          totalPrice: originalItem.totalPrice, // Keep original total
          taxAmount: originalItem.taxAmount,
          batchId: originalItem.batchId || null,
          batchNumber: originalItem.batchNumber || null,
          expiryDate: originalItem.expiryDate || null,
          ageRestrictionLevel: originalItem.ageRestrictionLevel,
          ageVerified: originalItem.ageVerified,
          scaleReadingWeight: originalItem.scaleReadingWeight || null,
          scaleReadingStable: originalItem.scaleReadingStable,
          addedAt: now,
          updatedAt: now,
        });

        itemsAdded++;
      } catch (error) {
        warnings.push(
          `Failed to add ${originalItem.itemName || "item"}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // Update saved basket retrieval info
    await this.db
      .update(schema.savedBaskets)
      .set({
        retrievedAt: now,
        retrievedCount: (basket.retrievedCount || 0) + 1,
        updatedAt: now,
      })
      .where(eq(schema.savedBaskets.id, basketId));

    return {
      basket: await this.getBasketById(basketId),
      itemsAdded,
      warnings,
    };
  }

  /**
   * Get all saved baskets for a business (with optional filters)
   */
  async getSavedBaskets(
    businessId: string,
    options: {
      savedBy?: string;
      status?: "active" | "retrieved" | "expired" | "deleted";
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<SavedBasket[]> {
    const conditions = [eq(schema.savedBaskets.businessId, businessId)];

    if (options.savedBy) {
      conditions.push(eq(schema.savedBaskets.savedBy, options.savedBy));
    }

    if (options.status) {
      conditions.push(eq(schema.savedBaskets.status, options.status));
    }

    const query = this.db
      .select()
      .from(schema.savedBaskets)
      .where(and(...conditions))
      .orderBy(desc(schema.savedBaskets.savedAt));

    if (options.limit) {
      query.limit(options.limit);
    }

    if (options.offset) {
      query.offset(options.offset);
    }

    return (await query) as SavedBasket[];
  }

  /**
   * Update saved basket
   */
  async updateBasket(
    basketId: string,
    updates: Partial<Pick<SavedBasket, "name" | "notes" | "customerEmail" | "status">>
  ): Promise<SavedBasket> {
    await this.db
      .update(schema.savedBaskets)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.savedBaskets.id, basketId));

    return this.getBasketById(basketId);
  }

  /**
   * Delete saved basket (soft delete by setting status to "deleted")
   */
  async deleteBasket(basketId: string): Promise<void> {
    await this.db
      .update(schema.savedBaskets)
      .set({
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(eq(schema.savedBaskets.id, basketId));
  }

  /**
   * Cleanup expired baskets (run as scheduled job)
   */
  async cleanupExpiredBaskets(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.db
      .update(schema.savedBaskets)
      .set({
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(
        and(
          or(
            eq(schema.savedBaskets.status, "expired"),
            eq(schema.savedBaskets.status, "retrieved")
          ),
          gte(schema.savedBaskets.expiresAt || schema.savedBaskets.savedAt, cutoffDate)
        )
      );

    return result.changes || 0;
  }
}


