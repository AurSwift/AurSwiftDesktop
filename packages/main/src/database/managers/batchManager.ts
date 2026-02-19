import type { ProductBatch } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";
import * as schema from "../schema.js";
import type {
  PaginationParams,
  PaginatedResult,
  BatchFilters,
} from "../types/pagination.js";
import {
  calculatePagination,
  calculateLimitOffset,
} from "../types/pagination.js";

export interface BatchResponse {
  success: boolean;
  message: string;
  batch?: ProductBatch;
  batches?: ProductBatch[];
  errors?: string[];
}

export interface CreateBatchData {
  productId: string;
  batchNumber?: string; // Auto-generated if not provided
  manufacturingDate?: Date;
  expiryDate: Date;
  initialQuantity: number;
  currentQuantity?: number; // Defaults to initialQuantity
  supplierId?: string;
  purchaseOrderNumber?: string;
  costPrice?: number;
  businessId: string;
}

export interface BatchSelectionResult {
  batchId: string;
  quantity: number;
  batchNumber: string;
  expiryDate: Date;
}

export class BatchManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Get batch statistics for a business (optimized - uses COUNT aggregation)
   * This is much faster than loading all batches for dashboard display
   */
  async getBatchStats(
    businessId: string,
    expirySettings?: {
      criticalAlertDays: number;
      warningAlertDays: number;
      infoAlertDays: number;
    }
  ): Promise<{
    totalBatches: number;
    activeBatches: number;
    expiredBatches: number;
    soldOutBatches: number;
    criticalBatches: number;
    warningBatches: number;
    expiringThisWeek: number;
    expiringNext30Days: number;
    valueAtRisk: number;
    wasteValue: number;
  }> {
    const now = new Date();
    const criticalDays = expirySettings?.criticalAlertDays ?? 3;
    const warningDays = expirySettings?.warningAlertDays ?? 7;

    const criticalDate = new Date();
    criticalDate.setDate(criticalDate.getDate() + criticalDays);

    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + warningDays);

    const weekDate = new Date();
    weekDate.setDate(weekDate.getDate() + 7);

    const thirtyDayDate = new Date();
    thirtyDayDate.setDate(thirtyDayDate.getDate() + 30);

    // Convert dates to ISO strings for SQLite compatibility
    const nowStr = now.toISOString();
    const criticalDateStr = criticalDate.toISOString();
    const warningDateStr = warningDate.toISOString();
    const weekDateStr = weekDate.toISOString();
    const thirtyDayDateStr = thirtyDayDate.toISOString();

    // Get counts and values using SQL aggregation (fast even with large datasets)
    const [stats] = await this.db
      .select({
        totalBatches: sql<number>`count(*)`,
        activeBatches: sql<number>`sum(case when ${schema.productBatches.status} = 'ACTIVE' then 1 else 0 end)`,
        expiredBatches: sql<number>`sum(case when ${schema.productBatches.status} = 'EXPIRED' then 1 else 0 end)`,
        soldOutBatches: sql<number>`sum(case when ${schema.productBatches.status} = 'SOLD_OUT' then 1 else 0 end)`,
        criticalBatches: sql<number>`sum(case when ${schema.productBatches.status} = 'ACTIVE' and ${schema.productBatches.expiryDate} > ${nowStr} and ${schema.productBatches.expiryDate} <= ${criticalDateStr} then 1 else 0 end)`,
        warningBatches: sql<number>`sum(case when ${schema.productBatches.status} = 'ACTIVE' and ${schema.productBatches.expiryDate} > ${criticalDateStr} and ${schema.productBatches.expiryDate} <= ${warningDateStr} then 1 else 0 end)`,
        expiringThisWeek: sql<number>`sum(case when ${schema.productBatches.status} = 'ACTIVE' and ${schema.productBatches.expiryDate} > ${nowStr} and ${schema.productBatches.expiryDate} <= ${weekDateStr} then 1 else 0 end)`,
        expiringNext30Days: sql<number>`sum(case when ${schema.productBatches.status} = 'ACTIVE' and ${schema.productBatches.expiryDate} > ${nowStr} and ${schema.productBatches.expiryDate} <= ${thirtyDayDateStr} then 1 else 0 end)`,
        valueAtRisk: sql<number>`sum(case when ${schema.productBatches.status} = 'ACTIVE' and ${schema.productBatches.expiryDate} > ${nowStr} and ${schema.productBatches.expiryDate} <= ${weekDateStr} then coalesce(${schema.productBatches.costPrice}, 0) * ${schema.productBatches.currentQuantity} else 0 end)`,
        wasteValue: sql<number>`sum(case when ${schema.productBatches.status} = 'EXPIRED' then coalesce(${schema.productBatches.costPrice}, 0) * ${schema.productBatches.currentQuantity} else 0 end)`,
      })
      .from(schema.productBatches)
      .where(eq(schema.productBatches.businessId, businessId));

    return {
      totalBatches: Number(stats?.totalBatches) || 0,
      activeBatches: Number(stats?.activeBatches) || 0,
      expiredBatches: Number(stats?.expiredBatches) || 0,
      soldOutBatches: Number(stats?.soldOutBatches) || 0,
      criticalBatches: Number(stats?.criticalBatches) || 0,
      warningBatches: Number(stats?.warningBatches) || 0,
      expiringThisWeek: Number(stats?.expiringThisWeek) || 0,
      expiringNext30Days: Number(stats?.expiringNext30Days) || 0,
      valueAtRisk: Number(stats?.valueAtRisk) || 0,
      wasteValue: Number(stats?.wasteValue) || 0,
    };
  }

  /**
   * Generate batch number if not provided
   */
  private generateBatchNumber(expiryDate: Date): string {
    const dateStr = expiryDate.toISOString().split("T")[0].replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BATCH-${dateStr}-${random}`;
  }

  /**
   * Create a new batch
   */
  async createBatch(batchData: CreateBatchData): Promise<ProductBatch> {
    const batchId = this.uuid.v4();
    const now = new Date();

    // Validate required fields
    if (!batchData.productId) {
      throw new Error("Product ID is required");
    }
    if (!batchData.expiryDate) {
      throw new Error("Expiry date is required");
    }
    if (!batchData.businessId) {
      throw new Error("Business ID is required");
    }
    if (batchData.initialQuantity <= 0) {
      throw new Error("Initial quantity must be greater than 0");
    }

    // Generate batch number if not provided
    const batchNumber =
      batchData.batchNumber || this.generateBatchNumber(batchData.expiryDate);

    // Check for duplicate batch number (per product and business)
    const existingBatch = this.db
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.batchNumber, batchNumber),
          eq(schema.productBatches.productId, batchData.productId),
          eq(schema.productBatches.businessId, batchData.businessId)
        )
      )
      .limit(1)
      .all();

    if (existingBatch.length > 0) {
      throw new Error(
        `Batch number ${batchNumber} already exists for this product`
      );
    }

    const currentQuantity =
      batchData.currentQuantity ?? batchData.initialQuantity;

    // Determine initial status
    const expiryDate = new Date(batchData.expiryDate);
    const status =
      expiryDate < now
        ? "EXPIRED"
        : currentQuantity <= 0
        ? "SOLD_OUT"
        : "ACTIVE";

    await this.db.insert(schema.productBatches).values({
      id: batchId,
      productId: batchData.productId,
      batchNumber,
      manufacturingDate: batchData.manufacturingDate
        ? new Date(batchData.manufacturingDate)
        : null,
      expiryDate: expiryDate,
      initialQuantity: batchData.initialQuantity,
      currentQuantity,
      supplierId: batchData.supplierId ?? null,
      purchaseOrderNumber: batchData.purchaseOrderNumber ?? null,
      costPrice: batchData.costPrice ?? null,
      status,
      businessId: batchData.businessId,
      createdAt: now,
      updatedAt: now,
    });

    // Update product stock level if product requires batch tracking
    await this.updateProductStockFromBatches(batchData.productId);

    return this.getBatchById(batchId);
  }

  /**
   * Get batch by ID
   */
  async getBatchById(id: string): Promise<ProductBatch> {
    const [batch] = await this.db
      .select()
      .from(schema.productBatches)
      .where(eq(schema.productBatches.id, id))
      .limit(1);

    if (!batch) {
      throw new Error("Batch not found");
    }

    return batch as ProductBatch;
  }

  /**
   * Get batches by product ID
   */
  async getBatchesByProduct(
    productId: string,
    options?: {
      status?: "ACTIVE" | "EXPIRED" | "SOLD_OUT" | "REMOVED";
      includeExpired?: boolean;
    }
  ): Promise<ProductBatch[]> {
    const conditions = [eq(schema.productBatches.productId, productId)];

    if (options?.status) {
      conditions.push(eq(schema.productBatches.status, options.status));
    } else if (!options?.includeExpired) {
      // Exclude expired by default unless explicitly included
      conditions.push(sql`${schema.productBatches.status} != 'EXPIRED'`);
    }

    const batches = await this.db
      .select()
      .from(schema.productBatches)
      .where(and(...conditions))
      .orderBy(asc(schema.productBatches.expiryDate));

    return batches as ProductBatch[];
  }

  /**
   * Get active batches by product (for FEFO/FIFO selection)
   */
  async getActiveBatchesByProduct(
    productId: string,
    rotationMethod: "FIFO" | "FEFO" | "NONE" = "FEFO"
  ): Promise<ProductBatch[]> {
    const batches = await this.db
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.productId, productId),
          eq(schema.productBatches.status, "ACTIVE"),
          sql`${schema.productBatches.currentQuantity} > 0`
        )
      )
      .orderBy(
        rotationMethod === "FEFO"
          ? asc(schema.productBatches.expiryDate)
          : asc(schema.productBatches.createdAt)
      );

    return batches as ProductBatch[];
  }

  /**
   * Get batches by business ID
   */
  async getBatchesByBusiness(
    businessId: string,
    options?: {
      status?: "ACTIVE" | "EXPIRED" | "SOLD_OUT" | "REMOVED";
      productId?: string;
      expiringWithinDays?: number;
    }
  ): Promise<ProductBatch[]> {
    const conditions = [eq(schema.productBatches.businessId, businessId)];

    if (options?.status) {
      conditions.push(eq(schema.productBatches.status, options.status));
    }

    if (options?.productId) {
      conditions.push(eq(schema.productBatches.productId, options.productId));
    }

    if (options?.expiringWithinDays !== undefined) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + options.expiringWithinDays);
      conditions.push(lte(schema.productBatches.expiryDate, futureDate));
    }

    const batches = await this.db
      .select()
      .from(schema.productBatches)
      .where(and(...conditions))
      .orderBy(asc(schema.productBatches.expiryDate));

    return batches as ProductBatch[];
  }

  /**
   * Get batches by business ID with pagination and filters
   */
  async getBatchesByBusinessPaginated(
    businessId: string,
    pagination: PaginationParams,
    filters?: BatchFilters
  ): Promise<PaginatedResult<ProductBatch>> {
    const { limit, offset } = calculateLimitOffset(
      pagination.page,
      pagination.pageSize
    );

    // Build WHERE conditions
    const conditions = [eq(schema.productBatches.businessId, businessId)];

    // Filter by product
    if (filters?.productId) {
      conditions.push(eq(schema.productBatches.productId, filters.productId));
    }

    // Filter by status
    if (filters?.status) {
      conditions.push(eq(schema.productBatches.status, filters.status));
    }

    // Filter by expiry status
    if (filters?.expiryStatus && filters.expiryStatus !== "all") {
      const now = new Date();

      if (filters.expiryStatus === "expired") {
        conditions.push(lte(schema.productBatches.expiryDate, now));
      } else if (filters.expiryStatus === "critical") {
        const criticalDate = new Date();
        criticalDate.setDate(criticalDate.getDate() + 3); // 3 days
        conditions.push(
          and(
            gte(schema.productBatches.expiryDate, now),
            lte(schema.productBatches.expiryDate, criticalDate)
          )!
        );
      } else if (filters.expiryStatus === "warning") {
        const warningStart = new Date();
        warningStart.setDate(warningStart.getDate() + 3);
        const warningEnd = new Date();
        warningEnd.setDate(warningEnd.getDate() + 7); // 3-7 days
        conditions.push(
          and(
            gte(schema.productBatches.expiryDate, warningStart),
            lte(schema.productBatches.expiryDate, warningEnd)
          )!
        );
      } else if (filters.expiryStatus === "info") {
        const infoStart = new Date();
        infoStart.setDate(infoStart.getDate() + 7);
        const infoEnd = new Date();
        infoEnd.setDate(infoEnd.getDate() + 30); // 7-30 days
        conditions.push(
          and(
            gte(schema.productBatches.expiryDate, infoStart),
            lte(schema.productBatches.expiryDate, infoEnd)
          )!
        );
      }
    }

    // Filter by expiring within days
    if (filters?.expiringWithinDays !== undefined) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.expiringWithinDays);
      conditions.push(lte(schema.productBatches.expiryDate, futureDate));
    }

    // Get total count for pagination
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.productBatches)
      .where(and(...conditions));

    const totalItems = Number(countResult.count);

    // Build sort order with type-safe column mapping
    const sortColumn = pagination.sortBy || "expiryDate";
    const sortDirection = pagination.sortOrder || "asc";

    // Map sort column names to actual schema columns
    const columnMap: Record<string, any> = {
      expiryDate: schema.productBatches.expiryDate,
      createdAt: schema.productBatches.createdAt,
      batchNumber: schema.productBatches.batchNumber,
      status: schema.productBatches.status,
      currentQuantity: schema.productBatches.currentQuantity,
      initialQuantity: schema.productBatches.initialQuantity,
      productId: schema.productBatches.productId,
      businessId: schema.productBatches.businessId,
    };

    const sortColumnRef =
      columnMap[sortColumn] || schema.productBatches.expiryDate;
    const orderByClause =
      sortDirection === "desc" ? desc(sortColumnRef) : asc(sortColumnRef);

    // Get paginated items with product info via LEFT JOIN
    // This avoids the need to load all products client-side for enrichment
    const items = await this.db
      .select({
        // Batch fields
        id: schema.productBatches.id,
        productId: schema.productBatches.productId,
        batchNumber: schema.productBatches.batchNumber,
        manufacturingDate: schema.productBatches.manufacturingDate,
        expiryDate: schema.productBatches.expiryDate,
        initialQuantity: schema.productBatches.initialQuantity,
        currentQuantity: schema.productBatches.currentQuantity,
        supplierId: schema.productBatches.supplierId,
        purchaseOrderNumber: schema.productBatches.purchaseOrderNumber,
        costPrice: schema.productBatches.costPrice,
        status: schema.productBatches.status,
        businessId: schema.productBatches.businessId,
        createdAt: schema.productBatches.createdAt,
        updatedAt: schema.productBatches.updatedAt,
        // Product fields (via JOIN)
        productName: schema.products.name,
        productSku: schema.products.sku,
        productImage: schema.products.image,
      })
      .from(schema.productBatches)
      .leftJoin(
        schema.products,
        eq(schema.productBatches.productId, schema.products.id)
      )
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Transform to include nested product object
    const transformedItems = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      batchNumber: item.batchNumber,
      manufacturingDate: item.manufacturingDate,
      expiryDate: item.expiryDate,
      initialQuantity: item.initialQuantity,
      currentQuantity: item.currentQuantity,
      supplierId: item.supplierId,
      purchaseOrderNumber: item.purchaseOrderNumber,
      costPrice: item.costPrice,
      status: item.status,
      businessId: item.businessId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      // Nested product object (if product exists)
      product: item.productName
        ? {
            id: item.productId,
            name: item.productName,
            sku: item.productSku,
            image: item.productImage,
          }
        : undefined,
    }));

    return {
      items: transformedItems as ProductBatch[],
      pagination: calculatePagination(
        totalItems,
        pagination.page,
        pagination.pageSize
      ),
    };
  }

  /**
   * Get batches expiring soon
   */
  async getBatchesExpiringSoon(
    businessId: string,
    days: number
  ): Promise<ProductBatch[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const batches = await this.db
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.status, "ACTIVE"),
          gte(schema.productBatches.expiryDate, now),
          lte(schema.productBatches.expiryDate, futureDate)
        )
      )
      .orderBy(asc(schema.productBatches.expiryDate));

    return batches as ProductBatch[];
  }

  /**
   * Select batches for sale using FIFO/FEFO
   */
  async selectBatchesForSale(
    productId: string,
    quantity: number,
    rotationMethod: "FIFO" | "FEFO" | "NONE" = "FEFO"
  ): Promise<BatchSelectionResult[]> {
    const batches = await this.getActiveBatchesByProduct(
      productId,
      rotationMethod
    );

    if (batches.length === 0) {
      throw new Error("No active batches available for this product");
    }

    const selected: BatchSelectionResult[] = [];
    let remaining = quantity;

    for (const batch of batches) {
      if (remaining <= 0) break;

      const available = batch.currentQuantity;
      const deductAmount = Math.min(remaining, available);

      selected.push({
        batchId: batch.id,
        quantity: deductAmount,
        batchNumber: batch.batchNumber,
        expiryDate: new Date(batch.expiryDate),
      });

      remaining -= deductAmount;
    }

    if (remaining > 0) {
      throw new Error(
        `Insufficient stock. Available: ${
          quantity - remaining
        }, Requested: ${quantity}`
      );
    }

    return selected;
  }

  /**
   * Update batch quantity
   */
  async updateBatchQuantity(
    batchId: string,
    quantity: number,
    movementType: "INBOUND" | "OUTBOUND" | "ADJUSTMENT"
  ): Promise<ProductBatch> {
    const batch = await this.getBatchById(batchId);
    const now = new Date();

    let newQuantity = batch.currentQuantity;

    if (movementType === "INBOUND") {
      newQuantity += quantity;
    } else if (movementType === "OUTBOUND") {
      newQuantity -= quantity;
      if (newQuantity < 0) {
        throw new Error("Insufficient batch quantity");
      }
    } else {
      // ADJUSTMENT - set directly
      newQuantity = quantity;
      if (newQuantity < 0) {
        throw new Error("Batch quantity cannot be negative");
      }
    }

    // Determine new status
    let status = batch.status;
    const expiryDate = new Date(batch.expiryDate);
    if (expiryDate < now && status !== "REMOVED") {
      status = "EXPIRED";
    } else if (newQuantity <= 0 && status !== "REMOVED") {
      status = "SOLD_OUT";
    } else if (newQuantity > 0 && status === "SOLD_OUT") {
      status = expiryDate < now ? "EXPIRED" : "ACTIVE";
    }

    await this.db
      .update(schema.productBatches)
      .set({
        currentQuantity: newQuantity,
        status,
        updatedAt: now,
      })
      .where(eq(schema.productBatches.id, batchId))
      .run();

    // Update product stock level
    await this.updateProductStockFromBatches(batch.productId);

    return this.getBatchById(batchId);
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(
    batchId: string,
    status: "ACTIVE" | "EXPIRED" | "SOLD_OUT" | "REMOVED"
  ): Promise<ProductBatch> {
    const now = new Date();

    await this.db
      .update(schema.productBatches)
      .set({
        status,
        updatedAt: now,
      })
      .where(eq(schema.productBatches.id, batchId))
      .run();

    const batch = await this.getBatchById(batchId);
    await this.updateProductStockFromBatches(batch.productId);

    return batch;
  }

  /**
   * Calculate product stock from batches
   */
  async calculateProductStock(productId: string): Promise<number> {
    const batches = await this.getBatchesByProduct(productId, {
      status: "ACTIVE",
    });

    return batches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
  }

  /**
   * Update product stock level from batches
   */
  private async updateProductStockFromBatches(
    productId: string
  ): Promise<void> {
    const stock = await this.calculateProductStock(productId);

    await this.db
      .update(schema.products)
      .set({
        stockLevel: stock,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, productId))
      .run();
  }

  /**
   * Auto-update expired batch statuses
   */
  async autoUpdateExpiredBatches(businessId?: string): Promise<number> {
    const now = new Date();
    const conditions = [
      eq(schema.productBatches.status, "ACTIVE"),
      sql`${schema.productBatches.expiryDate} < ${now.getTime()}`,
    ];

    if (businessId) {
      conditions.push(eq(schema.productBatches.businessId, businessId));
    }

    const expiredBatches = await this.db
      .select()
      .from(schema.productBatches)
      .where(and(...conditions))
      .all();

    let updatedCount = 0;

    for (const batch of expiredBatches) {
      await this.updateBatchStatus(batch.id, "EXPIRED");
      updatedCount++;
    }

    return updatedCount;
  }

  /**
   * Delete/Remove batch
   */
  async removeBatch(batchId: string): Promise<boolean> {
    await this.getBatchById(batchId);

    // Mark as removed instead of deleting (for audit trail)
    await this.updateBatchStatus(batchId, "REMOVED");

    return true;
  }

  /**
   * Get batch by batch number
   */
  async getBatchByNumber(
    batchNumber: string,
    productId: string,
    businessId: string
  ): Promise<ProductBatch | null> {
    const [batch] = await this.db
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.batchNumber, batchNumber),
          eq(schema.productBatches.productId, productId),
          eq(schema.productBatches.businessId, businessId)
        )
      )
      .limit(1);

    return (batch as ProductBatch) || null;
  }

  /**
   * Get batches for dashboard display (OPTIMIZED)
   * Only returns expired batches and batches expiring within the specified days
   * with a limit to prevent loading massive datasets.
   * Includes product info via JOIN for display.
   */
  async getBatchesForDashboard(
    businessId: string,
    options?: {
      expiringWithinDays?: number; // Default 30 days
      limit?: number; // Default 100
      includeExpired?: boolean; // Default true
    }
  ): Promise<{
    expiredBatches: ProductBatch[];
    expiringBatches: ProductBatch[];
  }> {
    const expiringDays = options?.expiringWithinDays ?? 30;
    const limit = options?.limit ?? 100;
    const includeExpired = options?.includeExpired ?? true;

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + expiringDays);

    // Get expiring batches (active, expiring within the specified days)
    const expiringBatches = await this.db
      .select({
        // Batch fields
        id: schema.productBatches.id,
        productId: schema.productBatches.productId,
        batchNumber: schema.productBatches.batchNumber,
        manufacturingDate: schema.productBatches.manufacturingDate,
        expiryDate: schema.productBatches.expiryDate,
        initialQuantity: schema.productBatches.initialQuantity,
        currentQuantity: schema.productBatches.currentQuantity,
        supplierId: schema.productBatches.supplierId,
        purchaseOrderNumber: schema.productBatches.purchaseOrderNumber,
        costPrice: schema.productBatches.costPrice,
        status: schema.productBatches.status,
        businessId: schema.productBatches.businessId,
        createdAt: schema.productBatches.createdAt,
        updatedAt: schema.productBatches.updatedAt,
        // Product fields (via JOIN)
        productName: schema.products.name,
        productSku: schema.products.sku,
        productImage: schema.products.image,
      })
      .from(schema.productBatches)
      .leftJoin(
        schema.products,
        eq(schema.productBatches.productId, schema.products.id)
      )
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.status, "ACTIVE"),
          gte(schema.productBatches.expiryDate, now),
          lte(schema.productBatches.expiryDate, futureDate)
        )
      )
      .orderBy(asc(schema.productBatches.expiryDate))
      .limit(limit);

    // Get expired batches if requested
    let expiredBatches: any[] = [];
    if (includeExpired) {
      expiredBatches = await this.db
        .select({
          // Batch fields
          id: schema.productBatches.id,
          productId: schema.productBatches.productId,
          batchNumber: schema.productBatches.batchNumber,
          manufacturingDate: schema.productBatches.manufacturingDate,
          expiryDate: schema.productBatches.expiryDate,
          initialQuantity: schema.productBatches.initialQuantity,
          currentQuantity: schema.productBatches.currentQuantity,
          supplierId: schema.productBatches.supplierId,
          purchaseOrderNumber: schema.productBatches.purchaseOrderNumber,
          costPrice: schema.productBatches.costPrice,
          status: schema.productBatches.status,
          businessId: schema.productBatches.businessId,
          createdAt: schema.productBatches.createdAt,
          updatedAt: schema.productBatches.updatedAt,
          // Product fields (via JOIN)
          productName: schema.products.name,
          productSku: schema.products.sku,
          productImage: schema.products.image,
        })
        .from(schema.productBatches)
        .leftJoin(
          schema.products,
          eq(schema.productBatches.productId, schema.products.id)
        )
        .where(
          and(
            eq(schema.productBatches.businessId, businessId),
            eq(schema.productBatches.status, "EXPIRED")
          )
        )
        .orderBy(desc(schema.productBatches.expiryDate))
        .limit(limit);
    }

    // Transform results to include nested product object
    const transformBatch = (item: any) => ({
      id: item.id,
      productId: item.productId,
      batchNumber: item.batchNumber,
      manufacturingDate: item.manufacturingDate,
      expiryDate: item.expiryDate,
      initialQuantity: item.initialQuantity,
      currentQuantity: item.currentQuantity,
      supplierId: item.supplierId,
      purchaseOrderNumber: item.purchaseOrderNumber,
      costPrice: item.costPrice,
      status: item.status,
      businessId: item.businessId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      product: item.productName
        ? {
            id: item.productId,
            name: item.productName,
            sku: item.productSku,
            image: item.productImage,
          }
        : undefined,
    });

    return {
      expiredBatches: expiredBatches.map(transformBatch) as ProductBatch[],
      expiringBatches: expiringBatches.map(transformBatch) as ProductBatch[],
    };
  }
}
