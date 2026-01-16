import { useState, useEffect, useCallback, memo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import {
  DollarSign,
  ShoppingCart,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/shared/hooks";
import { useNavigate } from "react-router-dom";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("cashier-dashboard-page");
interface Transaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  total: number;
  paymentMethod: "cash" | "card" | "mixed";
  items: TransactionItem[];
  type: "sale" | "refund" | "void";
  status: "completed" | "voided" | "pending";
}

interface TransactionItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  refundedQuantity?: number;
}

interface Shift {
  id: string;
  scheduleId?: string; // Links to the planned schedule
  cashierId: string;
  businessId: string;
  startTime: string; // ACTUAL clock-in time (when cashier really started)
  endTime?: string; // ACTUAL clock-out time (when cashier really ended)
  status: "active" | "ended";
  startingCash: number;
  finalCashDrawer?: number;
  expectedCashDrawer?: number;
  cashVariance?: number;
  totalSales?: number;
  totalTransactions?: number;
  totalRefunds?: number;
  totalVoids?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ShiftStats {
  totalTransactions: number;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
}
interface CashierDashboardPageProps {
  onNewTransaction: () => void;
}
const CashierDashboardView = ({
  onNewTransaction,
}: CashierDashboardPageProps) => {
  // State management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  const [shiftStats, setShiftStats] = useState<ShiftStats>({
    totalTransactions: 0,
    totalSales: 0,
    totalRefunds: 0,
    totalVoids: 0,
  });
  const [hourlyStats, setHourlyStats] = useState<{
    lastHour: number;
    currentHour: number;
    averagePerHour: number;
  }>({
    lastHour: 0,
    currentHour: 0,
    averagePerHour: 0,
  });
  const [cashDrawerBalance, setCashDrawerBalance] = useState<{
    amount: number;
    isEstimated: boolean;
    lastCountTime?: string;
    variance?: number;
  }>({
    amount: 0,
    isEstimated: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Load shift data function with smart updates to prevent flickering
  const loadShiftData = useCallback(
    async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) {
          setIsLoading(true);
        }

        if (!user?.id) return;

        // Load active shift
        const activeShiftResponse = await window.shiftAPI.getActive(user.id);
        if (activeShiftResponse.success && activeShiftResponse.data) {
          const shiftData = activeShiftResponse.data as Shift;

          // Only update if data has actually changed
          setActiveShift((prevShift) => {
            if (
              !prevShift ||
              JSON.stringify(prevShift) !== JSON.stringify(shiftData)
            ) {
              return shiftData;
            }
            return prevShift;
          });

          // Load shift stats if shift is active
          const statsResponse = await window.shiftAPI.getStats(shiftData.id);
          if (statsResponse.success && statsResponse.data) {
            const newStats = statsResponse.data as ShiftStats;
            setShiftStats((prevStats) => {
              if (JSON.stringify(prevStats) !== JSON.stringify(newStats)) {
                return newStats;
              }
              return prevStats;
            });
          }

          // Load hourly stats if shift is active
          const hourlyStatsResponse = await window.shiftAPI.getHourlyStats(
            shiftData.id
          );
          if (hourlyStatsResponse.success && hourlyStatsResponse.data) {
            const newHourlyStats = hourlyStatsResponse.data as {
              lastHour: number;
              currentHour: number;
              averagePerHour: number;
            };
            setHourlyStats((prevHourlyStats) => {
              if (
                JSON.stringify(prevHourlyStats) !==
                JSON.stringify(newHourlyStats)
              ) {
                return newHourlyStats;
              }
              return prevHourlyStats;
            });
          }

          // Load cash drawer balance if shift is active
          const cashBalanceResponse =
            await window.shiftAPI.getCashDrawerBalance(shiftData.id);
          if (cashBalanceResponse.success && cashBalanceResponse.data) {
            const newCashBalance = cashBalanceResponse.data as {
              amount: number;
              isEstimated: boolean;
              lastCountTime?: string;
              variance?: number;
            };
            setCashDrawerBalance((prevCashBalance) => {
              if (
                JSON.stringify(prevCashBalance) !==
                JSON.stringify(newCashBalance)
              ) {
                return newCashBalance;
              }
              return prevCashBalance;
            });
          }
        } else {
          // Only update if currently there is an active shift
          setActiveShift((prevShift) => (prevShift ? null : prevShift));
          setHourlyStats((prevStats) => {
            const defaultStats = {
              lastHour: 0,
              currentHour: 0,
              averagePerHour: 0,
            };
            if (JSON.stringify(prevStats) !== JSON.stringify(defaultStats)) {
              return defaultStats;
            }
            return prevStats;
          });
          setCashDrawerBalance((prevBalance) => {
            const defaultBalance = {
              amount: 0,
              isEstimated: true,
            };
            if (
              JSON.stringify(prevBalance) !== JSON.stringify(defaultBalance)
            ) {
              return defaultBalance;
            }
            return prevBalance;
          });
        }

        // Load recent transactions (including refunds) - prioritize current shift if active
        try {
          let transactionsResponse;
          if (activeShiftResponse.success && activeShiftResponse.data) {
            // If there's an active shift, get transactions from current shift only
            const shiftData = activeShiftResponse.data as Shift;
            transactionsResponse = await window.refundAPI.getShiftTransactions(
              shiftData.id,
              10
            );
          } else if (user.businessId) {
            // If no active shift, get recent transactions from business
            transactionsResponse = await window.refundAPI.getRecentTransactions(
              user.businessId,
              10
            );
          }

          if (
            transactionsResponse &&
            transactionsResponse.success &&
            "transactions" in transactionsResponse
          ) {
            const transactionsData = transactionsResponse as {
              success: boolean;
              transactions: Transaction[];
            };
            const newTransactions = transactionsData.transactions || [];
            setTransactions((prevTransactions) => {
              if (
                JSON.stringify(prevTransactions) !==
                JSON.stringify(newTransactions)
              ) {
                return newTransactions;
              }
              return prevTransactions;
            });
          }
        } catch (transactionError) {
          logger.error("Failed to load recent transactions:", transactionError);
          // Don't fail the entire load if transactions fail
          setTransactions([]);
        }
      } catch (error) {
        logger.error("Failed to load shift data:", error);
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        }
      }
    },
    [user?.id, user?.businessId]
  );

  // Load shift data on component mount
  useEffect(() => {
    loadShiftData(true); // Initial load with loading indicator

    // Refresh data every 30 seconds to pick up schedule changes made by manager
    // This ensures that when manager extends end time (e.g., 9 PM to 10 PM),
    // cashier dashboard updates live while preserving actual work times
    const interval = setInterval(() => {
      // Only refresh if component is still mounted and user is authenticated
      if (user?.id) {
        loadShiftData(false); // Background refresh without loading indicator
      }
    }, 30000); // Reduced frequency from 2 seconds to 30 seconds to prevent flickering
    return () => clearInterval(interval);
  }, [loadShiftData, user?.id]);

  if (!user) {
    navigate("/");
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="text-gray-600 text-sm sm:text-base">
            Loading shift data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Transaction Count */}
        <Card className="bg-white border-slate-200 shadow-sm h-full">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="flex items-center justify-between text-sm sm:text-base font-semibold">
              <span className="text-slate-700">Transactions</span>
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-black">
              {shiftStats.totalTransactions || 0}
            </div>
            <div className="flex items-center mt-2 text-xs sm:text-sm text-slate-600">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-blue-500 shrink-0" />
              <span>This shift</span>
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1">
              Last hour: {hourlyStats.lastHour} transactions
            </div>
          </CardContent>
        </Card>

        {/* Cash Drawer Balance */}
        <Card className="bg-white border-slate-200 shadow-sm h-full">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="flex items-center justify-between text-sm sm:text-base font-semibold">
              <span className="text-slate-700">Cash Drawer</span>
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-black">
              £{cashDrawerBalance.amount.toFixed(2)}
              {cashDrawerBalance.isEstimated && (
                <span className="text-[10px] sm:text-xs text-amber-600 ml-1">
                  (est.)
                </span>
              )}
            </div>
            <div className="flex items-center mt-2 text-xs sm:text-sm text-black">
              {(cashDrawerBalance.variance || 0) >= 0 ? (
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 shrink-0" />
              ) : (
                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 shrink-0" />
              )}
              <span>
                Variance: £
                {Math.abs(cashDrawerBalance.variance || 0).toFixed(2)}
                {cashDrawerBalance.isEstimated && " (est.)"}
              </span>
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1">
              {cashDrawerBalance.lastCountTime ? (
                <>
                  Last count:{" "}
                  {new Date(cashDrawerBalance.lastCountTime).toLocaleTimeString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    }
                  )}
                </>
              ) : (
                <>Starting: £{(activeShift?.startingCash || 0).toFixed(2)}</>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Adjustments */}
        <Card className="bg-white border-slate-200 shadow-sm h-full">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="flex items-center justify-between text-sm sm:text-base font-semibold">
              <span className="text-slate-700">Adjustments</span>
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2 text-xs sm:text-sm">
              <span className="text-slate-600">Refunds:</span>
              <span className="font-semibold text-black">
                -£{(shiftStats.totalRefunds || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-slate-600">Voided Transactions:</span>
              <span className="font-semibold text-black">
                {shiftStats.totalVoids || 0}
              </span>
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-2">
              Total adjustments:{" "}
              {(shiftStats.totalVoids || 0) +
                ((shiftStats.totalRefunds || 0) > 0 ? 1 : 0)}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-white border-slate-200 shadow-sm h-full flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 shrink-0" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex-1">
            {!activeShift && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
                  <span className="text-xs sm:text-sm text-amber-800 font-medium">
                    Start your shift to access quick actions
                  </span>
                </div>
              </div>
            )}
            <Button
              onClick={onNewTransaction}
              variant="default"
              className="w-full justify-start text-sm sm:text-base h-9 sm:h-10 touch-manipulation"
              disabled={!activeShift}
            >
              <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 shrink-0" />
              New Sale
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Recent Transactions */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg font-semibold text-slate-700">
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-slate-500">
                  <div className="mb-2">
                    <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 mx-auto opacity-50" />
                  </div>
                  <p className="text-xs sm:text-sm">No recent transactions</p>
                  <p className="text-[10px] sm:text-xs mt-1">
                    Transactions will appear here once processed
                  </p>
                </div>
              ) : (
                transactions.map((transaction: Transaction) => (
                  <div key={transaction.id}>
                    <div className="flex items-center gap-3">
                      <div
                        className={`
                      p-2 rounded-full
                      ${
                        transaction.type === "sale"
                          ? "bg-green-100 text-green-600"
                          : ""
                      }
                      ${
                        transaction.type === "refund"
                          ? "bg-red-100 text-red-600"
                          : ""
                      }
                      ${
                        transaction.type === "void"
                          ? "bg-amber-100 text-amber-600"
                          : ""
                      }
                    `}
                      >
                        {transaction.type === "sale" && (
                          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                        {transaction.type === "refund" && (
                          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                        {transaction.type === "void" && (
                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs sm:text-sm truncate">
                          #{transaction.receiptNumber}
                        </div>
                        <div className="text-[10px] sm:text-xs text-slate-500 truncate">
                          {new Date(transaction.timestamp).toLocaleString()} •{" "}
                          {transaction.items.length} items
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-xs sm:text-sm text-black">
                        {transaction.type === "sale"
                          ? `+£${Math.abs(transaction.total).toFixed(2)}`
                          : `-£${Math.abs(transaction.total).toFixed(2)}`}
                      </div>
                      <Badge
                        variant="outline"
                        className={`
                      text-[10px] sm:text-xs mt-1
                      ${
                        transaction.paymentMethod === "cash"
                          ? "bg-amber-50 text-amber-700"
                          : ""
                      }
                      ${
                        transaction.paymentMethod === "card"
                          ? "bg-blue-50 text-blue-700"
                          : ""
                      }
                      ${
                        transaction.paymentMethod === "mixed"
                          ? "bg-purple-50 text-purple-700"
                          : ""
                      }
                    `}
                      >
                        {transaction.paymentMethod}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default memo(CashierDashboardView);
