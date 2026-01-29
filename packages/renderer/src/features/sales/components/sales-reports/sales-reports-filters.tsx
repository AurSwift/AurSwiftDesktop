/**
 * Sales Reports Filters
 *
 * Filter component for sales reports.
 * Includes date range picker, transaction type filter, and payment method filter.
 * All filters are dropdowns and always visible.
 */

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { DateRangePicker } from "./date-range-picker";

export type TransactionTypeFilter = "all" | "sale" | "refund" | "void";
export type PaymentMethodFilter = "all" | "cash" | "card" | "mixed";
export type TimePeriod =
  | "today"
  | "week"
  | "month"
  | "lastWeek"
  | "lastMonth"
  | "custom";

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

const transactionTypeOptions: {
  value: TransactionTypeFilter;
  label: string;
}[] = [
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
  dateRange,
  onTransactionTypeChange,
  onPaymentMethodChange,
  onTimePeriodChange,
  onDateRangeChange,
  className,
}: SalesReportsFiltersProps) {
  return (
    <Card
      className={cn("bg-white border-slate-200 shadow-sm", className)}
    >
      <CardHeader className="py-3">
        <div className="flex flex-wrap items-center gap-4">
          <CardTitle className="text-base sm:text-lg font-semibold text-slate-700 flex items-center gap-2 shrink-0">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </CardTitle>

          {/* Date Range Picker (Time Period) */}
          <div className="flex flex-col gap-1.5 min-w-0 shrink-0 w-full sm:w-[280px]">
            <label className="text-xs font-medium text-slate-600">
              Time Period
            </label>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={(range) => {
                onDateRangeChange?.(range);
                onTimePeriodChange?.("custom");
              }}
              className="h-8 w-full max-w-full min-w-0"
            />
          </div>

          {/* Transaction Type Dropdown */}
          <div className="flex flex-col gap-1.5 min-w-0 shrink-0 w-full sm:w-[260px]">
            <label className="text-xs font-medium text-slate-600">
              Transaction Type
            </label>
            <Select
              value={transactionType}
              onValueChange={(value) =>
                onTransactionTypeChange?.(value as TransactionTypeFilter)
              }
            >
              <SelectTrigger size="sm" className="w-full max-w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {transactionTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method Dropdown */}
          <div className="flex flex-col gap-1.5 min-w-0 shrink-0 w-full sm:w-[260px]">
            <label className="text-xs font-medium text-slate-600">
              Payment Method
            </label>
            <Select
              value={paymentMethod}
              onValueChange={(value) =>
                onPaymentMethodChange?.(value as PaymentMethodFilter)
              }
            >
              <SelectTrigger size="sm" className="w-full max-w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
