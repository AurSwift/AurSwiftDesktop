import type { StockAdjustment } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, desc } from "drizzle-orm";
import * as schema from "../schema.js";
import type { StockMovementManager } from "./stockMovementManager.js";

import { getLogger } from '../../utils/logger.js';
const logger = getLogger('inventoryManager');

export class InventoryManager {
  private db: DrizzleDB;
  private uuid: any;
  private stockMovementManager: StockMovementManager | null = null;

  constructor(
    drizzle: DrizzleDB,
    uuid: any,
    stockMovementManager?: StockMovementManager
  ) {
    this.db = drizzle;
    this.uuid = uuid;
    this.stockMovementManager = stockMovementManager || null;
  }

  /**
   * Set stock movement manager (for creating movement records)
   */
  setStockMovementManager(stockMovementManager: StockMovementManager): void {
    this.stockMovementManager = stockMovementManager;
  }

  async createStockAdjustment(
    adjustmentData: Omit<StockAdjustment, "id" | "timestamp">
  ): Promise<StockAdjustment> {
    const adjustmentId = this.uuid.v4();
    const now = new Date().toISOString();

    // Insert stock adjustment
    this.db
      .insert(schema.stockAdjustments)
      .values({
        id: adjustmentId,
        productId: adjustmentData.productId,
        type: adjustmentData.type,
        quantity: adjustmentData.quantity,
        reason: adjustmentData.reason || "",
        userId: adjustmentData.userId,
        businessId: adjustmentData.businessId,
        timestamp: now,
      })
      .run();

    // Get current stock level
    const product = this.db
      .select({ stockLevel: schema.products.stockLevel })
      .from(schema.products)
      .where(eq(schema.products.id, adjustmentData.productId))
      .get();

    if (!product) {
      throw new Error("Product not found");
    }

    // Calculate new stock level
    let newStockLevel = product.stockLevel ?? 0;
    if (adjustmentData.type === "add" || adjustmentData.type === "adjustment") {
      newStockLevel += adjustmentData.quantity;
    } else {
      newStockLevel -= adjustmentData.quantity;
    }

    // Update product stock level
    this.db
      .update(schema.products)
      .set({
        stockLevel: newStockLevel,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, adjustmentData.productId))
      .run();

    // Create stock movement record if stock movement manager is available
    if (this.stockMovementManager) {
      try {
        // Map adjustment type to movement type
        let movementType: "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "WASTE";

        switch (adjustmentData.type) {
          case "add":
            movementType = "INBOUND";
            break;
          case "remove":
            movementType = "OUTBOUND";
            break;
          case "waste":
            movementType = "WASTE";
            break;
          case "sale":
            movementType = "OUTBOUND";
            break;
          case "adjustment":
          default:
            movementType = "ADJUSTMENT";
            break;
        }

        // Create the stock movement record
        await this.stockMovementManager.createStockMovement({
          productId: adjustmentData.productId,
          movementType,
          quantity: adjustmentData.quantity,
          reason:
            adjustmentData.reason || `Stock adjustment: ${adjustmentData.type}`,
          reference: `ADJ-${adjustmentId}`,
          userId: adjustmentData.userId,
          businessId: adjustmentData.businessId,
        });
      } catch (error) {
        // Log error but don't fail the adjustment
        logger.error("Failed to create stock movement record:", error);
      }
    }

    return {
      id: adjustmentId,
      ...adjustmentData,
      timestamp: now,
    };
  }

  getStockAdjustmentsByProduct(productId: string): StockAdjustment[] {
    return this.db
      .select()
      .from(schema.stockAdjustments)
      .where(eq(schema.stockAdjustments.productId, productId))
      .orderBy(desc(schema.stockAdjustments.timestamp))
      .all() as StockAdjustment[];
  }

  getStockAdjustmentsByBusiness(businessId: string): StockAdjustment[] {
    return this.db
      .select()
      .from(schema.stockAdjustments)
      .where(eq(schema.stockAdjustments.businessId, businessId))
      .orderBy(desc(schema.stockAdjustments.timestamp))
      .all() as StockAdjustment[];
  }
}
