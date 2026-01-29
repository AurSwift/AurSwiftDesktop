/**
 * Refund API Types
 * 
 * Types for refund transaction operations.
 * 
 * @module types/api/refund
 */

import type { APIResponse } from './common';

export interface RefundAPI {
  getTransactionById: (transactionId: string) => Promise<APIResponse>;
  getTransactionByReceipt: (receiptNumber: string) => Promise<APIResponse>;
  getRecentTransactions: (
    businessId: string,
    limit?: number
  ) => Promise<APIResponse>;
  getTransactionsByDateRange: (
    businessId: string,
    startDate: string,
    endDate: string,
    limit?: number
  ) => Promise<APIResponse>;
  getShiftTransactions: (
    shiftId: string,
    limit?: number
  ) => Promise<APIResponse>;
  validateEligibility: (
    transactionId: string,
    refundItems: Array<any>
  ) => Promise<APIResponse>;
  createRefundTransaction: (refundData: any) => Promise<APIResponse>;
}

