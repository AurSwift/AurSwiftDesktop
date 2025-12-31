/**
 * Sales Reports Transaction Table
 *
 * Paginated table component with search and filters for displaying transactions.
 * Uses shadcn table components with built-in pagination.
 * Now uses separate components for better maintainability.
 */

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ShoppingCart, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Transaction } from "./sales-reports-transaction-list";
import { TransactionRow } from "./transaction-row";
import { TransactionDetails } from "./transaction-details";
import { TransactionTableFilters } from "./transaction-table-filters";

export interface SalesReportsTransactionTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  emptyStateMessage?: string;
  className?: string;
}

type SortField = "timestamp" | "receiptNumber" | "total" | "type" | "paymentMethod";
type SortDirection = "asc" | "desc";

export function SalesReportsTransactionTable({
  transactions,
  isLoading = false,
  emptyStateMessage = "No transactions found",
  className,
}: SalesReportsTransactionTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [typeFilter, setTypeFilter] = useState<"all" | "sale" | "refund" | "void">("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<
    "all" | "cash" | "card" | "mixed"
  >("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filter and search transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filter by type
    if (typeFilter !== "all") {
      filtered = filtered.filter((t) => t.type === typeFilter);
    }

    // Filter by payment method
    if (paymentMethodFilter !== "all") {
      filtered = filtered.filter((t) => t.paymentMethod === paymentMethodFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.receiptNumber.toLowerCase().includes(query) ||
          t.timestamp.toLowerCase().includes(query) ||
          t.items.some((item) =>
            item.productName.toLowerCase().includes(query)
          )
      );
    }

    return filtered;
  }, [transactions, typeFilter, paymentMethodFilter, searchQuery]);

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];

    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "timestamp":
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        case "receiptNumber":
          aValue = a.receiptNumber;
          bValue = b.receiptNumber;
          break;
        case "total":
          aValue = a.total;
          bValue = b.total;
          break;
        case "type":
          aValue = a.type;
          bValue = b.type;
          break;
        case "paymentMethod":
          aValue = a.paymentMethod;
          bValue = b.paymentMethod;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredTransactions, sortField, sortDirection]);

  // Paginate transactions
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedTransactions.slice(startIndex, endIndex);
  }, [sortedTransactions, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedTransactions.length / pageSize);

  // Handle expand/collapse
  const toggleRow = useCallback((transactionId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  }, []);

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
      setCurrentPage(1);
    },
    [sortField, sortDirection]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setCurrentPage(1);
    },
    []
  );

  const handleTypeFilterChange = useCallback(
    (value: "all" | "sale" | "refund" | "void") => {
      setTypeFilter(value);
      handleFilterChange();
    },
    [handleFilterChange]
  );

  const handlePaymentMethodFilterChange = useCallback(
    (value: "all" | "cash" | "card" | "mixed") => {
      setPaymentMethodFilter(value);
      handleFilterChange();
    },
    [handleFilterChange]
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-semibold text-slate-700">
            Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
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
          Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <TransactionTableFilters
          searchQuery={searchQuery}
          typeFilter={typeFilter}
          paymentMethodFilter={paymentMethodFilter}
          onSearchChange={handleSearchChange}
          onTypeFilterChange={handleTypeFilterChange}
          onPaymentMethodFilterChange={handlePaymentMethodFilterChange}
        />

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          Showing {paginatedTransactions.length} of {sortedTransactions.length}{" "}
          transactions
          {searchQuery && ` matching "${searchQuery}"`}
        </div>

        {/* Table */}
        {sortedTransactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="mb-2">
              <ShoppingCart className="h-8 w-8 mx-auto opacity-50" />
            </div>
            <p className="text-sm font-medium">{emptyStateMessage}</p>
            <p className="text-xs mt-1">
              {searchQuery || typeFilter !== "all" || paymentMethodFilter !== "all"
                ? "Try adjusting your filters"
                : "Transactions will appear here once processed"}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[80px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("type")}
                        className="h-8 px-2"
                      >
                        Type
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("receiptNumber")}
                        className="h-8 px-2"
                      >
                        Receipt #
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("timestamp")}
                        className="h-8 px-2"
                      >
                        Date & Time
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">Items</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("paymentMethod")}
                        className="h-8 px-2"
                      >
                        Payment
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("total")}
                        className="h-8 px-2"
                      >
                        Amount
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((transaction) => {
                    const isExpanded = expandedRows.has(transaction.id);
                    return (
                      <React.Fragment key={transaction.id}>
                        <TransactionRow
                          transaction={transaction}
                          isExpanded={isExpanded}
                          onToggleExpand={() => toggleRow(transaction.id)}
                          showItemsColumn={true}
                        />
                        <TransactionDetails
                          transaction={transaction}
                          isExpanded={isExpanded}
                        />
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={sortedTransactions.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                showPageSizeSelector={true}
                showPageInfo={true}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
