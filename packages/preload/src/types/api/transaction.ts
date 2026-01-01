/**
 * Transaction API Types - Preload
 *
 * Type definitions for transaction, refund, void, and cash drawer IPC APIs.
 *
 * @module preload/types/api/transaction
 */

export interface TransactionAPIPreload {
  create: (
    sessionToken: string,
    transactionData: {
      shiftId: string;
      businessId: string;
      type: "sale" | "refund" | "void";
      subtotal: number;
      tax: number;
      total: number;
      paymentMethod: "cash" | "card" | "mobile" | "voucher" | "split";
      cashAmount?: number;
      cardAmount?: number;
      items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
      status: "completed" | "voided" | "pending";
      customerId?: string;
      receiptNumber: string;
      timestamp: string;
    }
  ) => Promise<any>;

  getByShift: (shiftId: string) => Promise<any>;

  createFromCart: (
    sessionToken: string,
    data: {
      cartSessionId: string;
      shiftId?: string;
      businessId: string;
      paymentMethod: "cash" | "card" | "mobile" | "voucher" | "split";
      cashAmount?: number;
      cardAmount?: number;
      receiptNumber: string;
    }
  ) => Promise<any>;

  sendReceipt: (data: {
    transactionId: string;
    customerEmail: string;
  }) => Promise<any>;
}

export interface RefundAPIPreload {
  getTransactionById: (transactionId: string) => Promise<any>;

  getTransactionByReceipt: (receiptNumber: string) => Promise<any>;

  getRecentTransactions: (businessId: string, limit?: number) => Promise<any>;

  getShiftTransactions: (shiftId: string, limit?: number) => Promise<any>;

  validateEligibility: (
    transactionId: string,
    refundItems: Array<{
      originalItemId: string;
      productId: string;
      productName: string;
      originalQuantity: number;
      refundQuantity: number;
      unitPrice: number;
      refundAmount: number;
      reason: string;
      restockable: boolean;
    }>
  ) => Promise<any>;

  createRefundTransaction: (
    sessionToken: string,
    refundData: {
      originalTransactionId: string;
      shiftId: string;
      businessId: string;
      refundItems: Array<{
        originalItemId: string;
        productId: string;
        productName: string;
        originalQuantity: number;
        refundQuantity: number;
        unitPrice: number;
        refundAmount: number;
        reason: string;
        restockable: boolean;
      }>;
      refundReason: string;
      refundMethod: "original" | "store_credit" | "cash" | "card";
      managerApprovalId?: string;
      cashierId: string;
    }
  ) => Promise<any>;
}

export interface VoidAPIPreload {
  validateEligibility: (transactionId: string) => Promise<any>;

  voidTransaction: (
    sessionToken: string,
    voidData: {
      transactionId: string;
      cashierId: string;
      reason: string;
      managerApprovalId?: string;
    }
  ) => Promise<any>;

  getTransactionById: (transactionId: string) => Promise<any>;

  getTransactionByReceipt: (receiptNumber: string) => Promise<any>;
}

export interface CashDrawerAPIPreload {
  getExpectedCash: (shiftId: string) => Promise<any>;

  createCount: (countData: {
    shiftId: string;
    countType: "opening" | "mid-shift" | "closing" | "spot-check";
    expectedAmount: number;
    countedAmount: number;
    variance: number;
    notes?: string;
    countedBy: string;
    denominations?: Array<{
      value: number;
      count: number;
      total: number;
      label: string;
      type: "note" | "coin";
    }>;
    managerApprovalId?: string;
  }) => Promise<any>;

  getCountsByShift: (shiftId: string) => Promise<any>;
}
