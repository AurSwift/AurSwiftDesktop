/**
 * Transaction Row Component
 *
 * Individual transaction row for the table.
 * Handles display of transaction data and expand/collapse functionality.
 */

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import type { Transaction } from "./sales-reports-transaction-list";

export interface TransactionRowProps {
  transaction: Transaction;
  isExpanded: boolean;
  onToggleExpand: () => void;
  showItemsColumn?: boolean;
}

export function TransactionRow({
  transaction,
  isExpanded,
  onToggleExpand,
  showItemsColumn = true,
}: TransactionRowProps) {
  const getTypeIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "sale":
        return <CheckCircle className="h-4 w-4" />;
      case "refund":
        return <RefreshCw className="h-4 w-4" />;
      case "void":
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: Transaction["type"]) => {
    switch (type) {
      case "sale":
        return "bg-green-100 text-green-700 border-green-200";
      case "refund":
        return "bg-red-100 text-red-700 border-red-200";
      case "void":
        return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  const getPaymentMethodBadgeColor = (method: Transaction["paymentMethod"]) => {
    switch (method) {
      case "cash":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "card":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "mixed":
        return "bg-purple-50 text-purple-700 border-purple-200";
    }
  };

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer hover:bg-muted/50",
          isExpanded && "bg-muted/30",
        )}
        onClick={onToggleExpand}
      >
        <TableCell className="w-12">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="w-20">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full",
              getTypeBadgeColor(transaction.type),
            )}
          >
            {getTypeIcon(transaction.type)}
          </div>
        </TableCell>
        <TableCell className="font-medium">
          #{transaction.receiptNumber}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {new Date(transaction.timestamp).toLocaleString()}
        </TableCell>
        {showItemsColumn && (
          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
            {transaction.items.length} item
            {transaction.items.length !== 1 ? "s" : ""}
          </TableCell>
        )}
        <TableCell>
          <div className="flex flex-wrap items-center gap-1">
            <Badge
              variant="outline"
              className={cn(
                "text-xs uppercase",
                getPaymentMethodBadgeColor(transaction.paymentMethod),
              )}
            >
              {transaction.paymentMethod}
            </Badge>
            {transaction.type === "refund" && (
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-300 text-xs"
              >
                REFUNDED
              </Badge>
            )}
            {transaction.type === "void" && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-300 text-xs"
              >
                VOIDED
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div
            className={cn(
              "font-semibold",
              transaction.type === "sale" ? "text-green-700" : "text-red-700",
            )}
          >
            {transaction.type === "sale"
              ? `+£${Math.abs(transaction.total).toFixed(2)}`
              : `-£${Math.abs(transaction.total).toFixed(2)}`}
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}
