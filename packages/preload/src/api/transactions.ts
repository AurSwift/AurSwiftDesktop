import { ipcRenderer } from "electron";

export const transactionAPI = {
  create: (
    sessionToken: string,
    transactionData: {
      shiftId: string;
      businessId: string;
      type: "sale" | "refund" | "void";
      subtotal: number;
      tax: number;
      total: number;
      paymentMethod:
        | "cash"
        | "card"
        | "mobile"
        | "voucher"
        | "split"
        | "viva_wallet";
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
  ) => ipcRenderer.invoke("transactions:create", sessionToken, transactionData),

  getByShift: (shiftId: string) =>
    ipcRenderer.invoke("transactions:getByShift", shiftId),

  createFromCart: (
    sessionToken: string,
    data: {
      cartSessionId: string;
      shiftId?: string; // Made optional for admin/manager
      businessId: string;
      paymentMethod:
        | "cash"
        | "card"
        | "mobile"
        | "voucher"
        | "split"
        | "viva_wallet";
      cashAmount?: number;
      cardAmount?: number;
      receiptNumber: string;
      // Viva Wallet specific
      vivaWalletTransactionId?: string;
      vivaWalletTerminalId?: string;
    }
  ) => ipcRenderer.invoke("transactions:createFromCart", sessionToken, data),

  sendReceipt: (data: { transactionId: string; customerEmail: string }) =>
    ipcRenderer.invoke("transactions:sendReceipt", data),
};

export const refundAPI = {
  getTransactionById: (transactionId: string) =>
    ipcRenderer.invoke("refunds:getTransactionById", transactionId),

  getTransactionByReceipt: (receiptNumber: string) =>
    ipcRenderer.invoke("refunds:getTransactionByReceipt", receiptNumber),

  getRecentTransactions: (businessId: string, limit?: number) =>
    ipcRenderer.invoke("refunds:getRecentTransactions", businessId, limit),

  getTransactionsByDateRange: (
    businessId: string,
    startDate: string,
    endDate: string,
    limit?: number
  ) =>
    ipcRenderer.invoke(
      "refunds:getTransactionsByDateRange",
      businessId,
      startDate,
      endDate,
      limit ?? 1000
    ),

  getShiftTransactions: (shiftId: string, limit?: number) =>
    ipcRenderer.invoke("refunds:getShiftTransactions", shiftId, limit),

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
  ) =>
    ipcRenderer.invoke(
      "refunds:validateEligibility",
      transactionId,
      refundItems
    ),

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
  ) => ipcRenderer.invoke("refunds:create", sessionToken, refundData),
};

export const cashDrawerAPI = {
  getExpectedCash: (shiftId: string) =>
    ipcRenderer.invoke("cashDrawer:getExpectedCash", shiftId),

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
  }) => ipcRenderer.invoke("cashDrawer:createCount", countData),

  getCountsByShift: (shiftId: string) =>
    ipcRenderer.invoke("cashDrawer:getCountsByShift", shiftId),
};
