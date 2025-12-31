/**
 * Transaction Details Component
 *
 * Expandable details view showing transaction items and additional information.
 */

import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  DollarSign,
  Calendar,
  CreditCard,
  Hash,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import type { Transaction } from "./sales-reports-transaction-list";

export interface TransactionDetailsProps {
  transaction: Transaction;
  isExpanded: boolean;
}

export function TransactionDetails({
  transaction,
  isExpanded,
}: TransactionDetailsProps) {
  if (!isExpanded) return null;

  const getStatusBadge = (status: Transaction["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Completed
          </Badge>
        );
      case "voided":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Voided
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Pending
          </Badge>
        );
    }
  };

  return (
    <TableRow>
      <TableCell colSpan={7} className="p-0">
        <div className="bg-muted/30 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Transaction Items */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Transaction Items ({transaction.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {transaction.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No items in this transaction
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {transaction.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-md border bg-white"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {item.productName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Qty: {item.quantity}
                              {item.refundedQuantity && item.refundedQuantity > 0 && (
                                <span className="text-red-600 ml-2">
                                  (Refunded: {item.refundedQuantity})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-sm font-medium">
                              £{item.unitPrice.toFixed(2)} × {item.quantity}
                            </div>
                            <div className="text-sm font-semibold text-slate-700">
                              £{item.totalPrice.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Transaction Information */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Transaction Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Hash className="h-3 w-3" />
                      Receipt Number:
                    </div>
                    <div className="font-medium">#{transaction.receiptNumber}</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Date & Time:
                    </div>
                    <div className="font-medium text-sm">
                      {new Date(transaction.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CreditCard className="h-3 w-3" />
                      Payment Method:
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        transaction.paymentMethod === "cash"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : transaction.paymentMethod === "card"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                      )}
                    >
                      {transaction.paymentMethod}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      Total Amount:
                    </div>
                    <div
                      className={cn(
                        "font-semibold text-lg",
                        transaction.type === "sale"
                          ? "text-green-700"
                          : "text-red-700"
                      )}
                    >
                      {transaction.type === "sale" ? "+" : "-"}£
                      {Math.abs(transaction.total).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-sm text-muted-foreground">Status:</div>
                    {getStatusBadge(transaction.status)}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Transaction Type:</div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        transaction.type === "sale"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : transaction.type === "refund"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : "bg-amber-100 text-amber-700 border-amber-200"
                      )}
                    >
                      {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

