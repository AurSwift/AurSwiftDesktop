/**
 * Transaction Table Filters Component
 *
 * Search and filter controls for the transaction table.
 */

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { cn } from "@/shared/utils/cn";

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
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const keyboardContainerRef = useRef<HTMLDivElement>(null);

  // Add padding to body when keyboard is visible to allow content scrolling
  useEffect(() => {
    if (!keyboardVisible || !keyboardContainerRef.current) {
      document.body.style.paddingBottom = "";
      return;
    }

    const updatePadding = () => {
      const keyboard = keyboardContainerRef.current;
      if (keyboard) {
        const height = keyboard.offsetHeight;
        document.body.style.paddingBottom = `${height}px`;
      }
    };

    // Small delay to ensure keyboard is rendered and measured
    const timeoutId = setTimeout(updatePadding, 100);
    updatePadding();

    // Update on resize in case keyboard height changes
    window.addEventListener("resize", updatePadding);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updatePadding);
      document.body.style.paddingBottom = "";
    };
  }, [keyboardVisible]);

  // Hide keyboard when user clicks/taps outside input + keyboard
  useEffect(() => {
    if (!keyboardVisible) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      const clickedSearchInput = searchInputRef.current?.contains(target);
      const clickedKeyboard = keyboardContainerRef.current?.contains(target);

      if (clickedSearchInput || clickedKeyboard) return;
      setKeyboardVisible(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [keyboardVisible]);

  // Adaptive keyboard handlers
  const handleKeyboardInput = (value: string) => {
    onSearchChange(searchQuery + value);
  };

  const handleKeyboardBackspace = () => {
    onSearchChange(searchQuery.slice(0, -1));
  };

  const handleKeyboardClear = () => {
    onSearchChange("");
  };

  const handleKeyboardEnter = () => {
    setKeyboardVisible(false);
    searchInputRef.current?.blur();
  };

  const handleSearchFocus = () => {
    setKeyboardVisible(true);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search by receipt number, date, or product..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
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

      {/* Adaptive Keyboard - Bottom attached, full width, no gap */}
      {keyboardVisible && (
        <div
          ref={keyboardContainerRef}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50",
            "overflow-hidden shadow-2xl",
            "transform transition-all duration-300 ease-out",
            keyboardVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-full pointer-events-none",
          )}
          style={{
            margin: 0,
            padding: 0,
          }}
        >
          <AdaptiveKeyboard
            onInput={handleKeyboardInput}
            onBackspace={handleKeyboardBackspace}
            onClear={handleKeyboardClear}
            onEnter={handleKeyboardEnter}
            initialMode="qwerty"
            inputType="text"
            visible={keyboardVisible}
            onClose={() => setKeyboardVisible(false)}
            className="!rounded-none"
          />
        </div>
      )}
    </>
  );
}



