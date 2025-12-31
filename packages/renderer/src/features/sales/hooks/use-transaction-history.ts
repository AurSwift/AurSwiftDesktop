/**
 * useTransactionHistory Hook
 *
 * Hook for fetching transaction history with filtering and pagination support.
 * Can be used independently or as part of the sales reports data hook.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/shared/hooks";
import { getLogger } from "@/shared/utils/logger";
import type { Transaction } from "../components/sales-reports";

const logger = getLogger("use-transaction-history");

export interface UseTransactionHistoryOptions {
  businessId?: string;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  transactionType?: "sale" | "refund" | "void" | "all";
  paymentMethod?: "cash" | "card" | "mixed" | "all";
}

export interface UseTransactionHistoryReturn {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useTransactionHistory(
  options: UseTransactionHistoryOptions = {}
): UseTransactionHistoryReturn {
  const {
    businessId,
    limit = 50,
    startDate,
    endDate,
    transactionType = "all",
    paymentMethod = "all",
  } = options;

  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const targetBusinessId = businessId || user?.businessId;

  const fetchTransactions = useCallback(async (append = false) => {
    if (!targetBusinessId) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      if (!append) {
        setIsLoading(true);
      }
      setError(null);

      // Use existing API to fetch transactions
      const response = await window.refundAPI.getRecentTransactions(
        targetBusinessId,
        limit
      );

      if (response.success && "transactions" in response) {
        const transactionsData = (response.transactions || []) as Transaction[];

        // Filter by date range if provided
        let filtered = transactionsData;
        if (startDate || endDate) {
          filtered = transactionsData.filter((t) => {
            const transactionDate = new Date(t.timestamp);
            if (startDate && transactionDate < startDate) return false;
            if (endDate && transactionDate > endDate) return false;
            return true;
          });
        }

        // Filter by transaction type
        if (transactionType !== "all") {
          filtered = filtered.filter((t) => t.type === transactionType);
        }

        // Filter by payment method
        if (paymentMethod !== "all") {
          filtered = filtered.filter((t) => t.paymentMethod === paymentMethod);
        }

        if (append) {
          setTransactions((prev) => [...prev, ...filtered]);
        } else {
          setTransactions(filtered);
        }

        // Check if there are more transactions (simple heuristic)
        setHasMore(transactionsData.length === limit);
      } else {
        throw new Error(response.message || "Failed to load transactions");
      }
    } catch (err) {
      logger.error("Failed to load transaction history:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to load transactions")
      );
      if (!append) {
        setTransactions([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    targetBusinessId,
    limit,
    startDate,
    endDate,
    transactionType,
    paymentMethod,
  ]);

  useEffect(() => {
    fetchTransactions(false);
  }, [fetchTransactions]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchTransactions(true);
  }, [hasMore, isLoading, fetchTransactions]);

  return {
    transactions,
    isLoading,
    error,
    hasMore,
    refetch: () => fetchTransactions(false),
    loadMore,
  };
}

