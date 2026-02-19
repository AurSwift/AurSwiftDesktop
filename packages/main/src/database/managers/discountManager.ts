import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";
import { Discount } from "../schema.js";

export class DiscountManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Create a new discount
   */
  createDiscount(
    discountData: Omit<
      schema.Discount,
      "id" | "createdAt" | "updatedAt" | "usageCount"
    >
  ): schema.Discount {
    const now = new Date();
    const id = this.uuid.v4();

    const discount: schema.Discount = {
      id,
      ...discountData,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Serialize array fields to JSON
    const categoryIds = discountData.categoryIds
      ? JSON.stringify(discountData.categoryIds)
      : null;
    const productIds = discountData.productIds
      ? JSON.stringify(discountData.productIds)
      : null;
    const daysOfWeek = discountData.daysOfWeek
      ? JSON.stringify(discountData.daysOfWeek)
      : null;

    this.db
      .insert(schema.discounts)
      .values({
        id: discount.id,
        name: discount.name,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        businessId: discount.businessId,
        applicableTo: discount.applicableTo,
        categoryIds: categoryIds,
        productIds: productIds,
        buyQuantity: discount.buyQuantity,
        getQuantity: discount.getQuantity,
        getDiscountType: discount.getDiscountType,
        getDiscountValue: discount.getDiscountValue,
        minPurchaseAmount: discount.minPurchaseAmount,
        minQuantity: discount.minQuantity,
        maxDiscountAmount: discount.maxDiscountAmount,
        startDate: discount.startDate,
        endDate: discount.endDate,
        isActive: discount.isActive,
        usageLimit: discount.usageLimit,
        usageCount: discount.usageCount,
        perCustomerLimit: discount.perCustomerLimit,
        priority: discount.priority,
        daysOfWeek: daysOfWeek,
        timeStart: discount.timeStart,
        timeEnd: discount.timeEnd,
        requiresCouponCode: discount.requiresCouponCode,
        couponCode: discount.couponCode,
        combinableWithOthers: discount.combinableWithOthers,
        createdAt: discount.createdAt,
        updatedAt: discount.updatedAt,
        createdBy: discount.createdBy,
      })
      .run();

    return discount;
  }

  /**
   * Update an existing discount
   */
  updateDiscount(
    id: string,
    updates: Partial<Omit<schema.Discount, "id" | "createdAt" | "usageCount">>
  ): void {
    const now = new Date().toISOString();

    // Build update object, serializing arrays to JSON
    const updateData: any = { updatedAt: now };

    if (updates.categoryIds !== undefined) {
      updateData.categoryIds = updates.categoryIds
        ? JSON.stringify(updates.categoryIds)
        : null;
    }
    if (updates.productIds !== undefined) {
      updateData.productIds = updates.productIds
        ? JSON.stringify(updates.productIds)
        : null;
    }
    if (updates.daysOfWeek !== undefined) {
      updateData.daysOfWeek = updates.daysOfWeek
        ? JSON.stringify(updates.daysOfWeek)
        : null;
    }

    // Add all other updates directly
    Object.keys(updates).forEach((key) => {
      if (!["categoryIds", "productIds", "daysOfWeek"].includes(key)) {
        updateData[key] = (updates as any)[key];
      }
    });

    if (Object.keys(updateData).length === 1) return; // Only updatedAt

    this.db
      .update(schema.discounts)
      .set(updateData)
      .where(eq(schema.discounts.id, id))
      .run();
  }

  /**
   * Delete a discount
   */
  deleteDiscount(id: string): void {
    this.db.delete(schema.discounts).where(eq(schema.discounts.id, id)).run();
  }

  /**
   * Get discount by ID
   */
  getDiscountById(id: string): Discount | null {
    const row = this.db
      .select()
      .from(schema.discounts)
      .where(eq(schema.discounts.id, id))
      .get();
    return row ? this.deserializeDiscount(row) : null;
  }

  /**
   * Get all discounts for a business
   */
  getDiscountsByBusiness(businessId: string): Discount[] {
    const rows = this.db
      .select()
      .from(schema.discounts)
      .where(eq(schema.discounts.businessId, businessId))
      .orderBy(
        desc(schema.discounts.priority),
        desc(schema.discounts.createdAt)
      )
      .all();
    return rows.map((row: any) => this.deserializeDiscount(row));
  }

  /**
   * Get active discounts for a business
   */
  getActiveDiscounts(businessId: string): Discount[] {
    const now = new Date().toISOString();

    const rows = this.db
      .select()
      .from(schema.discounts)
      .where(
        and(
          eq(schema.discounts.businessId, businessId),
          eq(schema.discounts.isActive, true),
          drizzleSql`(${schema.discounts.startDate} IS NULL OR ${schema.discounts.startDate} <= ${now})`,
          drizzleSql`(${schema.discounts.endDate} IS NULL OR ${schema.discounts.endDate} >= ${now})`,
          drizzleSql`(${schema.discounts.usageLimit} IS NULL OR ${schema.discounts.usageCount} < ${schema.discounts.usageLimit})`
        )
      )
      .orderBy(
        desc(schema.discounts.priority),
        desc(schema.discounts.createdAt)
      )
      .all();
    return rows.map((row: any) => this.deserializeDiscount(row));
  }

  /**
   * Get applicable discounts for a product
   */
  getApplicableDiscountsForProduct(
    businessId: string,
    productId: string,
    categoryId: string
  ): Discount[] {
    const activeDiscounts = this.getActiveDiscounts(businessId);
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    return activeDiscounts.filter((discount) => {
      // Check time restrictions
      if (discount.daysOfWeek && discount.daysOfWeek.length > 0) {
        if (!discount.daysOfWeek.includes(String(currentDay))) return false;
      }
      if (discount.timeStart && currentTime < discount.timeStart) return false;
      if (discount.timeEnd && currentTime > discount.timeEnd) return false;

      // Check applicability
      if (discount.applicableTo === "all") return true;
      if (discount.applicableTo === "product") {
        return discount.productIds && discount.productIds.includes(productId);
      }
      if (discount.applicableTo === "category") {
        return (
          discount.categoryIds && discount.categoryIds.includes(categoryId)
        );
      }
      return false;
    });
  }

  /**
   * Calculate discount amount for a transaction item
   */
  calculateItemDiscount(
    item: { unitPrice: number; quantity: number },
    discount: Discount
  ): number {
    let discountAmount = 0;
    const itemTotal = item.unitPrice * item.quantity;

    if (discount.type === "percentage") {
      discountAmount = (itemTotal * discount.value) / 100;
    } else if (discount.type === "fixed_amount") {
      discountAmount = discount.value * item.quantity;
    }

    // Apply max discount cap
    if (
      discount.maxDiscountAmount &&
      discountAmount > discount.maxDiscountAmount
    ) {
      discountAmount = discount.maxDiscountAmount;
    }

    // Don't discount more than the item total
    return Math.min(discountAmount, itemTotal);
  }

  /**
   * Calculate discount for entire transaction
   */
  calculateTransactionDiscount(subtotal: number, discount: Discount): number {
    let discountAmount = 0;

    if (discount.type === "percentage") {
      discountAmount = (subtotal * discount.value) / 100;
    } else if (discount.type === "fixed_amount") {
      discountAmount = discount.value;
    }

    // Apply max discount cap
    if (
      discount.maxDiscountAmount &&
      discountAmount > discount.maxDiscountAmount
    ) {
      discountAmount = discount.maxDiscountAmount;
    }

    // Don't discount more than the subtotal
    return Math.min(discountAmount, subtotal);
  }

  /**
   * Increment usage count
   */
  incrementUsageCount(discountId: string): void {
    this.db
      .update(schema.discounts)
      .set({
        usageCount: drizzleSql`${schema.discounts.usageCount} + 1`,
      })
      .where(eq(schema.discounts.id, discountId))
      .run();
  }

  /**
   * Validate coupon code
   */
  validateCouponCode(businessId: string, couponCode: string): Discount | null {
    const row = this.db
      .select()
      .from(schema.discounts)
      .where(
        and(
          eq(schema.discounts.businessId, businessId),
          eq(schema.discounts.couponCode, couponCode),
          eq(schema.discounts.isActive, true),
          eq(schema.discounts.requiresCouponCode, true)
        )
      )
      .get();

    if (!row) return null;

    const discount = this.deserializeDiscount(row);

    // Check if within date range
    const now = new Date().toISOString();
    if (discount.startDate && discount.startDate > now) return null;
    if (discount.endDate && discount.endDate < now) return null;

    // Check usage limit
    if (
      discount.usageLimit &&
      discount.usageCount !== null &&
      discount.usageCount !== undefined &&
      discount.usageCount >= discount.usageLimit
    )
      return null;

    return discount;
  }

  /**
   * Deserialize discount from database row
   */
  private deserializeDiscount(row: any): Discount {
    return {
      ...row,
      isActive: Boolean(row.isActive),
      requiresCouponCode: Boolean(row.requiresCouponCode),
      combinableWithOthers: Boolean(row.combinableWithOthers),
      categoryIds: row.categoryIds ? JSON.parse(row.categoryIds) : undefined,
      productIds: row.productIds ? JSON.parse(row.productIds) : undefined,
      daysOfWeek: row.daysOfWeek ? JSON.parse(row.daysOfWeek) : undefined,
    };
  }
}
