/**
 * Sales Reports Transaction List
 *
 * Extracted and enhanced transaction list component from cashier dashboard.
 * Displays transactions with filtering, sorting, and pagination support.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  CheckCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";

export interface Transaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  total: number;
  paymentMethod: "cash" | "card" | "mixed";
  items: TransactionItem[];
  type: "sale" | "refund" | "void";
  status: "completed" | "voided" | "pending";
  cashierName?: string;
  shiftId?: string;
  userId?: string;
}

export interface TransactionItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  refundedQuantity?: number;
}

export interface SalesReportsTransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
  emptyStateMessage?: string;
  showPaymentMethod?: boolean;
  className?: string;
}

export function SalesReportsTransactionList({
  transactions,
  isLoading = false,
  emptyStateMessage = "No transactions found",
  showPaymentMethod = true,
  className,
}: SalesReportsTransactionListProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-semibold text-slate-700">
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
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
              <p className="text-xs sm:text-sm">{emptyStateMessage}</p>
              <p className="text-caption mt-1">
                Transactions will appear here once processed
              </p>
            </div>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-3">
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
                  <div className="text-caption text-slate-500 truncate">
                    {new Date(transaction.timestamp).toLocaleString()} •{" "}
                    {transaction.items.length} items
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`font-semibold text-xs sm:text-sm ${
                      transaction.type === "sale"
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {transaction.type === "sale"
                      ? `+£${Math.abs(transaction.total).toFixed(2)}`
                      : `-£${Math.abs(transaction.total).toFixed(2)}`}
                  </div>
                  {showPaymentMethod && (
                    <Badge
                      variant="outline"
                      className={`
                        text-caption mt-1
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
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

