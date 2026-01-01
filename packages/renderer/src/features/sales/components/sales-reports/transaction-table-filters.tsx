/**
 * Transaction Table Filters Component
 *
 * Search and filter controls for the transaction table.
 */

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export interface TransactionTableFiltersProps {
  searchQuery: string;
  typeFilter: "all" | "sale" | "refund" | "void";
  paymentMethodFilter: "all" | "cash" | "card" | "mixed";
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: "all" | "sale" | "refund" | "void") => void;
  onPaymentMethodFilterChange: (
    value: "all" | "cash" | "card" | "mixed"
  ) => void;
}

export function TransactionTableFilters({
  searchQuery,
  typeFilter,
  paymentMethodFilter,
  onSearchChange,
  onTypeFilterChange,
  onPaymentMethodFilterChange,
}: TransactionTableFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by receipt number, date, or product..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Type Filter */}
      <Select value={typeFilter} onValueChange={onTypeFilterChange}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="sale">Sales</SelectItem>
          <SelectItem value="refund">Refunds</SelectItem>
          <SelectItem value="void">Voided</SelectItem>
        </SelectContent>
      </Select>

      {/* Payment Method Filter */}
      <Select
        value={paymentMethodFilter}
        onValueChange={onPaymentMethodFilterChange}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Payment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Methods</SelectItem>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="card">Card</SelectItem>
          <SelectItem value="mixed">Mixed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}



