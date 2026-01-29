import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, gte, lte, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";
import type { Transaction, TransactionItem, User } from "../schema.js";
import type { DatabaseManagers } from "../index.js";
import { shiftRequirementResolver } from "../../utils/shiftRequirementResolver.js";

// Utility types for transaction operations
export interface RefundItem {
  originalItemId: string;
  productId: string;
  productName: string;
  refundQuantity: number;
  unitPrice: number;
  refundAmount: number;
  restockable: boolean;
}

export interface TransactionWithItems extends Transaction {
  items: TransactionItem[];
}

export class TransactionManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Determine if shift is required for a user based on their role (RBAC-based)
   * - Uses ShiftRequirementResolver for RBAC-based detection
   * - Cashiers/Managers MUST have an active shift to make sales
   * - Admins/Owners can make sales without shifts (solo operator support)
   *
   * @param user - User object
   * @param db - Database managers (for RBAC resolution)
   * @returns Promise<boolean> - true if shift is required, false if shift can be bypassed
   */
  async isShiftRequired(user: User, db: DatabaseManagers): Promise<boolean> {
    const result = await shiftRequirementResolver.resolve(user, db);
    return result.requiresShift;
  }

  /**
   * Synchronous fallback for legacy code (uses user field only)
   * @deprecated Use isShiftRequired(user, db) instead for RBAC-based detection
   */
  isShiftRequiredSync(user: User): boolean {
    // Legacy fallback: check user's shiftRequired field
    if (user.shiftRequired === true) return true;
    if (user.shiftRequired === false) return false;
    return true; // Conservative default
  }
  /**
   * Create transaction
   */
  async createTransaction(
    transactionData: Omit<Transaction, "id" | "createdAt">
  ): Promise<TransactionWithItems> {
    const transactionId = this.uuid.v4();

    await this.db.insert(schema.transactions).values({
      id: transactionId,
      shiftId: transactionData.shiftId ?? null, // Allow null for admin/owner mode
      businessId: transactionData.businessId,
      type: transactionData.type,
      subtotal: transactionData.subtotal,
      tax: transactionData.tax,
      total: transactionData.total,
      paymentMethod: transactionData.paymentMethod,
      cashAmount: transactionData.cashAmount ?? null,
      cardAmount: transactionData.cardAmount ?? null,
      status: transactionData.status,
      voidReason: transactionData.voidReason ?? null,
      customerId: transactionData.customerId ?? null,
      receiptNumber: transactionData.receiptNumber,
      timestamp: transactionData.timestamp,
      originalTransactionId: transactionData.originalTransactionId ?? null,
      refundReason: transactionData.refundReason ?? null,
      refundMethod: transactionData.refundMethod ?? null,
      managerApprovalId: transactionData.managerApprovalId ?? null,
      isPartialRefund: transactionData.isPartialRefund ?? false,
      appliedDiscounts: transactionData.appliedDiscounts
        ? JSON.stringify(transactionData.appliedDiscounts)
        : null,
      // Viva Wallet transaction tracking
      vivaWalletTransactionId:
        (transactionData as any).vivaWalletTransactionId ?? null,
      vivaWalletTerminalId:
        (transactionData as any).vivaWalletTerminalId ?? null,
      vivaWalletAuthCode: (transactionData as any).vivaWalletAuthCode ?? null,
      vivaWalletCardBrand: (transactionData as any).vivaWalletCardBrand ?? null,
      vivaWalletCardLast4: (transactionData as any).vivaWalletCardLast4 ?? null,
      vivaWalletCardType: (transactionData as any).vivaWalletCardType ?? null,
      // Currency for multi-currency support
      currency: (transactionData as any).currency ?? "GBP",
    });

    const transaction = await this.getTransactionById(transactionId);
    if (!transaction) {
      throw new Error("Failed to create transaction");
    }
    return transaction;
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: string): Promise<TransactionWithItems | null> {
    const [transaction] = await this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .limit(1);

    if (!transaction) return null;

    const items = await this.getTransactionItems(id);

    return {
      ...transaction,
      isPartialRefund: Boolean(transaction.isPartialRefund),
      items,
      appliedDiscounts: transaction.appliedDiscounts
        ? JSON.parse(transaction.appliedDiscounts)
        : undefined,
    } as TransactionWithItems;
  }

  /**
   * Get transaction items
   */
  async getTransactionItems(transactionId: string): Promise<TransactionItem[]> {
    const items = await this.db
      .select()
      .from(schema.transactionItems)
      .where(eq(schema.transactionItems.transactionId, transactionId))
      .orderBy(schema.transactionItems.createdAt);

    return items.map((item) => ({
      ...item,
      appliedDiscounts: item.appliedDiscounts
        ? JSON.parse(item.appliedDiscounts)
        : undefined,
    })) as TransactionItem[];
  }

  /**
   * Get transactions by shift
   */
  async getTransactionsByShift(
    shiftId: string
  ): Promise<TransactionWithItems[]> {
    const transactions = await this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.shiftId, shiftId))
      .orderBy(desc(schema.transactions.timestamp));

    const transactionsWithItems = await Promise.all(
      transactions.map(async (tx) => {
        const items = await this.getTransactionItems(tx.id);
        return {
          ...tx,
          isPartialRefund: Boolean(tx.isPartialRefund),
          items,
          appliedDiscounts: tx.appliedDiscounts
            ? JSON.parse(tx.appliedDiscounts)
            : undefined,
        } as TransactionWithItems;
      })
    );

    return transactionsWithItems;
  }

  /**
   * Get recent transactions
   * Now filters to only show transactions from today (current date)
   */
  async getRecentTransactions(
    businessId: string,
    limit: number = 50
  ): Promise<TransactionWithItems[]> {
    // Get start of today (00:00:00)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Get end of today (23:59:59.999)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const transactions = await this.db
      .select({
        transaction: schema.transactions,
        shift: schema.shifts,
        user: schema.users,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.shifts,
        eq(schema.transactions.shiftId, schema.shifts.id)
      )
      .leftJoin(schema.users, eq(schema.shifts.user_id, schema.users.id))
      .where(
        and(
          eq(schema.transactions.businessId, businessId),
          eq(schema.transactions.status, "completed"),
          gte(schema.transactions.timestamp, startOfToday.toISOString()),
          lte(schema.transactions.timestamp, endOfToday.toISOString())
        )
      )
      .orderBy(desc(schema.transactions.timestamp))
      .limit(limit);

    const transactionsWithItems = await Promise.all(
      transactions.map(async ({ transaction, user }) => {
        const items = await this.getTransactionItems(transaction.id);
        return {
          ...transaction,
          isPartialRefund: Boolean(transaction.isPartialRefund),
          items,
          appliedDiscounts: transaction.appliedDiscounts
            ? JSON.parse(transaction.appliedDiscounts)
            : undefined,
          cashierName: user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              user.username
            : undefined,
        } as TransactionWithItems & { cashierName?: string };
      })
    );

    return transactionsWithItems;
  }

  /**
   * Get transactions by date range for reports.
   * Returns completed transactions within [start, end] with items and cashier name.
   */
  async getTransactionsByDateRange(
    businessId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<TransactionWithItems[]> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const transactions = await this.db
      .select({
        transaction: schema.transactions,
        shift: schema.shifts,
        user: schema.users,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.shifts,
        eq(schema.transactions.shiftId, schema.shifts.id)
      )
      .leftJoin(schema.users, eq(schema.shifts.user_id, schema.users.id))
      .where(
        and(
          eq(schema.transactions.businessId, businessId),
          eq(schema.transactions.status, "completed"),
          gte(schema.transactions.timestamp, start.toISOString()),
          lte(schema.transactions.timestamp, end.toISOString())
        )
      )
      .orderBy(desc(schema.transactions.timestamp))
      .limit(limit);

    const transactionsWithItems = await Promise.all(
      transactions.map(async ({ transaction, user }) => {
        const items = await this.getTransactionItems(transaction.id);
        return {
          ...transaction,
          isPartialRefund: Boolean(transaction.isPartialRefund),
          items,
          appliedDiscounts: transaction.appliedDiscounts
            ? JSON.parse(transaction.appliedDiscounts)
            : undefined,
          cashierName: user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              user.username
            : undefined,
        } as TransactionWithItems & { cashierName?: string };
      })
    );

    return transactionsWithItems;
  }

  /**
   * Create transaction with items and modifiers
   */
  async createTransactionWithItems(
    transaction: Omit<Transaction, "id" | "createdAt"> & {
      items?: TransactionItem[];
    }
  ): Promise<TransactionWithItems> {
    const id = this.uuid.v4();

    const result = this.db.transaction((tx: any) => {
      // 1. Insert main transaction
      tx.insert(schema.transactions)
        .values({
          id,
          shiftId: transaction.shiftId,
          businessId: transaction.businessId,
          type: transaction.type,
          subtotal: transaction.subtotal,
          tax: transaction.tax,
          total: transaction.total,
          paymentMethod: transaction.paymentMethod,
          cashAmount: transaction.cashAmount ?? null,
          cardAmount: transaction.cardAmount ?? null,
          status: transaction.status,
          voidReason: transaction.voidReason ?? null,
          customerId: transaction.customerId ?? null,
          receiptNumber: transaction.receiptNumber,
          appliedDiscounts: transaction.appliedDiscounts
            ? JSON.stringify(transaction.appliedDiscounts)
            : null,
          timestamp: transaction.timestamp,
          originalTransactionId: null,
          refundReason: null,
          refundMethod: null,
          managerApprovalId: null,
          isPartialRefund: false,
          // Viva Wallet transaction tracking
          vivaWalletTransactionId:
            (transaction as any).vivaWalletTransactionId ?? null,
          vivaWalletTerminalId:
            (transaction as any).vivaWalletTerminalId ?? null,
          // Currency for multi-currency support
          currency: (transaction as any).currency ?? "GBP",
        })
        .run();

      // 2. Insert transaction items
      if (transaction.items && transaction.items.length > 0) {
        for (const item of transaction.items) {
          const itemId = this.uuid.v4();

          // Determine itemType from quantity vs weight
          const itemType = item.weight != null ? "WEIGHT" : "UNIT";

          tx.insert(schema.transactionItems)
            .values({
              id: itemId,
              transactionId: id,
              productId: item.productId ?? null,
              categoryId: item.categoryId ?? null,
              productName: item.productName,
              itemType,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              taxAmount: item.taxAmount ?? 0,
              refundedQuantity: item.refundedQuantity ?? null,
              weight: item.weight ?? null,
              unitOfMeasure: item.unitOfMeasure ?? null,
              discountAmount: item.discountAmount ?? null,
              appliedDiscounts: item.appliedDiscounts
                ? JSON.stringify(item.appliedDiscounts)
                : null,
              // Batch tracking
              batchId: item.batchId ?? null,
              batchNumber: item.batchNumber ?? null,
              expiryDate:
                item.expiryDate != null
                  ? typeof item.expiryDate === "number"
                    ? new Date(item.expiryDate)
                    : item.expiryDate instanceof Date
                    ? item.expiryDate
                    : null
                  : null,
              // Age restriction tracking
              ageRestrictionLevel: item.ageRestrictionLevel ?? "NONE",
              ageVerified: item.ageVerified ?? false,
              cartItemId: item.cartItemId ?? null,
            })
            .run();
          // Note: appliedModifiers table doesn't exist in schema
        }
      }

      return id;
    });

    // Return the created transaction with items
    const createdTransaction = await this.getTransactionById(result);
    if (!createdTransaction) {
      throw new Error("Failed to retrieve created transaction");
    }
    return createdTransaction;
  }

  /**
   * Create transaction item
   */
  async createTransactionItem(
    transactionId: string,
    item: Omit<TransactionItem, "id" | "createdAt">
  ): Promise<string> {
    const itemId = this.uuid.v4();

    // Determine itemType from quantity vs weight
    const itemType = item.weight != null ? "WEIGHT" : "UNIT";

    await this.db.insert(schema.transactionItems).values({
      id: itemId,
      transactionId,
      productId: item.productId,
      productName: item.productName,
      itemType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      taxAmount: item.taxAmount ?? 0,
      unitOfMeasure: item.unitOfMeasure ?? null,
      weight: item.weight ?? null,
      // Batch tracking
      batchId: item.batchId ?? null,
      batchNumber: item.batchNumber ?? null,
      expiryDate: item.expiryDate ?? null,
      // Age restriction tracking
      ageRestrictionLevel: item.ageRestrictionLevel ?? "NONE",
      ageVerified: item.ageVerified ?? false,
      cartItemId: item.cartItemId ?? null,
      refundedQuantity: item.refundedQuantity ?? null,
      discountAmount: item.discountAmount ?? null,
      appliedDiscounts: item.appliedDiscounts
        ? JSON.stringify(item.appliedDiscounts)
        : null,
    });
    // Note: appliedModifiers table doesn't exist in schema

    return itemId;
  }

  /**
   * Create refund transaction
   */
  async createRefundTransaction(refundData: {
    originalTransactionId: string;
    shiftId: string;
    businessId: string;
    refundItems: RefundItem[];
    refundReason: string;
    refundMethod: "original" | "store_credit" | "cash" | "card";
    managerApprovalId?: string;
    cashierId: string;
  }): Promise<TransactionWithItems> {
    // Get original transaction to validate refund
    const originalTransaction = await this.getTransactionById(
      refundData.originalTransactionId
    );
    if (!originalTransaction) {
      throw new Error("Original transaction not found");
    }

    // Calculate refund totals
    const refundSubtotal = refundData.refundItems.reduce(
      (sum, item) => sum + item.refundAmount,
      0
    );
    const refundTax =
      refundSubtotal * (originalTransaction.tax / originalTransaction.subtotal);
    const refundTotal = refundSubtotal + refundTax;

    // Determine payment method for refund
    let paymentMethod: "cash" | "card" | "mixed";
    if (refundData.refundMethod === "original") {
      paymentMethod = originalTransaction.paymentMethod;
    } else if (refundData.refundMethod === "cash") {
      paymentMethod = "cash";
    } else if (refundData.refundMethod === "card") {
      paymentMethod = "card";
    } else {
      paymentMethod = "cash"; // Store credit treated as cash
    }

    const refundId = this.uuid.v4();
    const receiptNumber = `REF-${Date.now()}`;

    // Check if partial refund
    const isPartialRefund =
      refundData.refundItems.length < originalTransaction.items.length ||
      refundData.refundItems.some((refundItem) => {
        const originalItem = originalTransaction.items.find(
          (item: TransactionItem) => item.id === refundItem.originalItemId
        );
        return (
          originalItem &&
          originalItem.quantity != null &&
          refundItem.refundQuantity < originalItem.quantity
        );
      });

    // Use Drizzle transaction for atomicity
    this.db.transaction((tx: any) => {
      // 1. Create refund transaction record
      tx.insert(schema.transactions)
        .values({
          id: refundId,
          shiftId: refundData.shiftId,
          businessId: refundData.businessId,
          type: "refund",
          subtotal: -refundSubtotal, // Negative for refund
          tax: -refundTax,
          total: -refundTotal,
          paymentMethod,
          cashAmount: paymentMethod === "cash" ? -refundTotal : null,
          cardAmount: paymentMethod === "card" ? -refundTotal : null,
          status: "completed",
          receiptNumber,
          timestamp: new Date().toISOString(),
          originalTransactionId: refundData.originalTransactionId,
          refundReason: refundData.refundReason,
          refundMethod: refundData.refundMethod,
          managerApprovalId: refundData.managerApprovalId ?? null,
          isPartialRefund: isPartialRefund,
          voidReason: null,
          customerId: null,
          appliedDiscounts: null,
        })
        .run();

      // 2. Create refund transaction items
      for (const refundItem of refundData.refundItems) {
        const itemId = this.uuid.v4();

        // Determine itemType - refunds are typically UNIT items
        const itemType = "UNIT";

        // Calculate proportional tax for this item
        const itemTaxAmount =
          refundSubtotal > 0
            ? -refundTax * (refundItem.refundAmount / refundSubtotal)
            : 0;

        tx.insert(schema.transactionItems)
          .values({
            id: itemId,
            transactionId: refundId,
            productId: refundItem.productId,
            productName: refundItem.productName,
            itemType,
            quantity: -refundItem.refundQuantity, // Negative for refund
            unitPrice: refundItem.unitPrice,
            totalPrice: -refundItem.refundAmount,
            taxAmount: itemTaxAmount,
            refundedQuantity: null,
            weight: null,
            discountAmount: null,
            appliedDiscounts: null,
          })
          .run();

        // 3. Update original item's refunded quantity and get batch info
        const [currentItem] = tx
          .select({
            refundedQuantity: schema.transactionItems.refundedQuantity,
            batchId: schema.transactionItems.batchId,
          })
          .from(schema.transactionItems)
          .where(eq(schema.transactionItems.id, refundItem.originalItemId))
          .limit(1)
          .all();

        tx.update(schema.transactionItems)
          .set({
            refundedQuantity:
              (currentItem?.refundedQuantity ?? 0) + refundItem.refundQuantity,
          })
          .where(eq(schema.transactionItems.id, refundItem.originalItemId))
          .run();

        // 4. Update inventory if item is restockable
        if (refundItem.restockable) {
          // Update product stock level
          const [currentProduct] = tx
            .select({ stockLevel: schema.products.stockLevel })
            .from(schema.products)
            .where(eq(schema.products.id, refundItem.productId))
            .limit(1)
            .all();

          tx.update(schema.products)
            .set({
              stockLevel:
                (currentProduct?.stockLevel ?? 0) + refundItem.refundQuantity,
            })
            .where(eq(schema.products.id, refundItem.productId))
            .run();

          // 5. Update batch quantity if item was from a batch
          if (currentItem?.batchId) {
            const [currentBatch] = tx
              .select({
                currentQuantity: schema.productBatches.currentQuantity,
              })
              .from(schema.productBatches)
              .where(eq(schema.productBatches.id, currentItem.batchId))
              .limit(1)
              .all();

            if (currentBatch) {
              tx.update(schema.productBatches)
                .set({
                  currentQuantity:
                    (currentBatch.currentQuantity ?? 0) +
                    refundItem.refundQuantity,
                  updatedAt: new Date(),
                })
                .where(eq(schema.productBatches.id, currentItem.batchId))
                .run();
            }
          }
        }
      }
    });

    // Return the created refund transaction
    const createdTransaction = await this.getTransactionById(refundId);
    if (!createdTransaction) {
      throw new Error("Failed to retrieve created refund transaction");
    }
    return createdTransaction;
  }

  /**
   * Get transaction by receipt number
   */
  async getTransactionByReceiptNumber(
    receiptNumber: string
  ): Promise<TransactionWithItems | null> {
    const [transaction] = await this.db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.receiptNumber, receiptNumber),
          eq(schema.transactions.status, "completed")
        )
      )
      .orderBy(desc(schema.transactions.timestamp))
      .limit(1);

    if (!transaction) return null;

    const items = await this.getTransactionItems(transaction.id);

    return {
      ...transaction,
      isPartialRefund: Boolean(transaction.isPartialRefund),
      items,
      appliedDiscounts: transaction.appliedDiscounts
        ? JSON.parse(transaction.appliedDiscounts)
        : undefined,
    } as TransactionWithItems;
  }

  /**
   * Get shift transactions with limit
   */
  async getShiftTransactions(
    shiftId: string,
    limit: number = 50
  ): Promise<TransactionWithItems[]> {
    const transactions = await this.db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.shiftId, shiftId),
          eq(schema.transactions.status, "completed")
        )
      )
      .orderBy(desc(schema.transactions.timestamp))
      .limit(limit);

    const transactionsWithItems = await Promise.all(
      transactions.map(async (transaction) => {
        const items = await this.getTransactionItems(transaction.id);
        return {
          ...transaction,
          isPartialRefund: Boolean(transaction.isPartialRefund),
          items,
          appliedDiscounts: transaction.appliedDiscounts
            ? JSON.parse(transaction.appliedDiscounts)
            : undefined,
        } as TransactionWithItems;
      })
    );

    return transactionsWithItems;
  }

  /**
   * Validate if a transaction can be refunded
   */
  async validateRefundEligibility(
    transactionId: string,
    refundItems: RefundItem[]
  ): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Get original transaction
    const originalTransaction = await this.getTransactionById(transactionId);
    if (!originalTransaction) {
      errors.push("Original transaction not found");
      return { isValid: false, errors };
    }

    // Check if transaction is too old (configurable - 30 days)
    const transactionDate = new Date(originalTransaction.timestamp);
    const daysDiff =
      (Date.now() - transactionDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      errors.push("Transaction is older than 30 days and cannot be refunded");
    }

    // Validate each refund item
    for (const refundItem of refundItems) {
      const originalItem = originalTransaction.items.find(
        (item: TransactionItem) => item.id === refundItem.originalItemId
      );
      if (!originalItem) {
        errors.push(
          `Item ${refundItem.productName} not found in original transaction`
        );
        continue;
      }

      // Check if refund quantity exceeds available quantity
      if (originalItem.quantity == null) {
        errors.push(`Item ${refundItem.productName} has no quantity to refund`);
        continue;
      }
      const availableQuantity =
        originalItem.quantity - (originalItem.refundedQuantity || 0);
      if (refundItem.refundQuantity > availableQuantity) {
        errors.push(
          `Cannot refund ${refundItem.refundQuantity} of ${refundItem.productName}. Only ${availableQuantity} available.`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate total revenue for a business within a date range
   * Only includes completed sales (excludes refunds and voids)
   */
  getTotalRevenue(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): number {
    const conditions = [
      eq(schema.transactions.businessId, businessId),
      eq(schema.transactions.type, "sale"),
      eq(schema.transactions.status, "completed"),
    ];

    if (startDate) {
      const startStr = startDate.toISOString();
      conditions.push(
        drizzleSql`${schema.transactions.timestamp} >= ${startStr}`
      );
    }
    if (endDate) {
      const endStr = endDate.toISOString();
      conditions.push(
        drizzleSql`${schema.transactions.timestamp} <= ${endStr}`
      );
    }

    const result = this.db
      .select({
        total: drizzleSql<number>`COALESCE(SUM(${schema.transactions.total}), 0)`,
      })
      .from(schema.transactions)
      .where(and(...conditions))
      .get();

    return result?.total || 0;
  }

  /**
   * Get revenue statistics for dashboard
   * Returns current period revenue and comparison with previous period
   */
  getRevenueStatistics(
    businessId: string,
    period: "month" | "week" | "day" = "month"
  ): {
    currentPeriod: number;
    previousPeriod: number;
    change: number;
    changePercent: number;
  } {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date = now;
    let previousStart: Date;
    let previousEnd: Date;

    // Calculate date ranges based on period
    if (period === "month") {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStart.setHours(0, 0, 0, 0);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      previousEnd.setHours(23, 59, 59, 999);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousStart.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
      currentStart = new Date(now.getFullYear(), now.getMonth(), diff);
      currentStart.setHours(0, 0, 0, 0);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousEnd.setHours(23, 59, 59, 999);
      previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - 6);
      previousStart.setHours(0, 0, 0, 0);
    } else {
      // day
      currentStart = new Date(now);
      currentStart.setHours(0, 0, 0, 0);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousEnd.setHours(23, 59, 59, 999);
      previousStart = new Date(previousEnd);
      previousStart.setHours(0, 0, 0, 0);
    }

    // Ensure end dates are at end of day for proper range inclusion
    if (currentEnd) {
      const endOfDay = new Date(currentEnd);
      endOfDay.setHours(23, 59, 59, 999);
      currentEnd = endOfDay;
    }
    if (previousEnd) {
      const endOfDay = new Date(previousEnd);
      endOfDay.setHours(23, 59, 59, 999);
      previousEnd = endOfDay;
    }

    const currentPeriod = this.getTotalRevenue(
      businessId,
      currentStart,
      currentEnd
    );
    const previousPeriod = this.getTotalRevenue(
      businessId,
      previousStart,
      previousEnd
    );

    const change = currentPeriod - previousPeriod;
    const changePercent =
      previousPeriod > 0 ? (change / previousPeriod) * 100 : 0;

    return {
      currentPeriod,
      previousPeriod,
      change,
      changePercent,
    };
  }

  /**
   * Get sales count for today
   */
  getTodaySalesCount(businessId: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString();
    const tomorrowStr = tomorrow.toISOString();

    const result = this.db
      .select({
        count: drizzleSql<number>`COUNT(*)`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.businessId, businessId),
          eq(schema.transactions.type, "sale"),
          eq(schema.transactions.status, "completed"),
          drizzleSql`${schema.transactions.timestamp} >= ${todayStr}`,
          drizzleSql`${schema.transactions.timestamp} < ${tomorrowStr}`
        )
      )
      .get();

    return result?.count || 0;
  }

  /**
   * Get average order value for a business within a date range
   */
  getAverageOrderValue(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): number {
    const conditions = [
      eq(schema.transactions.businessId, businessId),
      eq(schema.transactions.type, "sale"),
      eq(schema.transactions.status, "completed"),
    ];

    if (startDate) {
      const startStr = startDate.toISOString();
      conditions.push(
        drizzleSql`${schema.transactions.timestamp} >= ${startStr}`
      );
    }
    if (endDate) {
      const endStr = endDate.toISOString();
      conditions.push(
        drizzleSql`${schema.transactions.timestamp} <= ${endStr}`
      );
    }

    const result = this.db
      .select({
        avg: drizzleSql<number>`COALESCE(AVG(${schema.transactions.total}), 0)`,
        count: drizzleSql<number>`COUNT(*)`,
      })
      .from(schema.transactions)
      .where(and(...conditions))
      .get();

    return result && result.count > 0 ? result.avg : 0;
  }
}
