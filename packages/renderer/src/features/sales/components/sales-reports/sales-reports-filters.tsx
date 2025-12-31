/**
 * Sales Reports Filters
 *
 * Filter component for sales reports.
 * Includes date range picker, transaction type filter, and payment method filter.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/utils/cn";
import { DateRangePicker } from "./date-range-picker";

export type TransactionTypeFilter = "all" | "sale" | "refund" | "void";
export type PaymentMethodFilter = "all" | "cash" | "card" | "mixed";
export type TimePeriod = "today" | "week" | "month" | "lastWeek" | "lastMonth" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SalesReportsFiltersProps {
  transactionType?: TransactionTypeFilter;
  paymentMethod?: PaymentMethodFilter;
  timePeriod?: TimePeriod;
  dateRange?: DateRange;
  onTransactionTypeChange?: (type: TransactionTypeFilter) => void;
  onPaymentMethodChange?: (method: PaymentMethodFilter) => void;
  onTimePeriodChange?: (period: TimePeriod) => void;
  onDateRangeChange?: (range: DateRange) => void;
  onReset?: () => void;
  className?: string;
}

const timePeriodOptions: { value: TimePeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "lastWeek", label: "Last Week" },
  { value: "lastMonth", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const transactionTypeOptions: { value: TransactionTypeFilter; label: string }[] =
  [
    { value: "all", label: "All Types" },
    { value: "sale", label: "Sales" },
    { value: "refund", label: "Refunds" },
    { value: "void", label: "Voided" },
  ];

const paymentMethodOptions: { value: PaymentMethodFilter; label: string }[] = [
  { value: "all", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "mixed", label: "Mixed" },
];

export function SalesReportsFilters({
  transactionType = "all",
  paymentMethod = "all",
  timePeriod = "month",
  dateRange,
  onTransactionTypeChange,
  onPaymentMethodChange,
  onTimePeriodChange,
  onDateRangeChange,
  onReset,
  className,
}: SalesReportsFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasActiveFilters =
    transactionType !== "all" ||
    paymentMethod !== "all" ||
    timePeriod !== "month";

  const handleReset = () => {
    onTransactionTypeChange?.("all");
    onPaymentMethodChange?.("all");
    onTimePeriodChange?.("month");
    onReset?.();
  };

  return (
    <Card className={cn("bg-white border-slate-200 shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg font-semibold text-slate-700 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 text-xs"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-2">
            {transactionType !== "all" && (
              <Badge variant="secondary" className="text-xs">
                Type: {transactionTypeOptions.find((o) => o.value === transactionType)?.label}
              </Badge>
            )}
            {paymentMethod !== "all" && (
              <Badge variant="secondary" className="text-xs">
                Method: {paymentMethodOptions.find((o) => o.value === paymentMethod)?.label}
              </Badge>
            )}
            {timePeriod !== "month" && (
              <Badge variant="secondary" className="text-xs">
                Period: {timePeriodOptions.find((o) => o.value === timePeriod)?.label}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Time Period Selector */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Time Period
            </label>
            <div className="flex flex-wrap gap-2">
              {timePeriodOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={timePeriod === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTimePeriodChange?.(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {timePeriod === "custom" && (
              <div className="mt-3">
                <DateRangePicker
                  dateRange={dateRange}
                  onDateRangeChange={(range) => {
                    onDateRangeChange?.(range);
                  }}
                />
              </div>
            )}
          </div>

          {/* Transaction Type Filter */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Transaction Type
            </label>
            <div className="flex flex-wrap gap-2">
              {transactionTypeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={transactionType === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTransactionTypeChange?.(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Payment Method
            </label>
            <div className="flex flex-wrap gap-2">
              {paymentMethodOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={paymentMethod === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPaymentMethodChange?.(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

