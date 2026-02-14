import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Calendar as CalendarIcon } from "lucide-react";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { cn } from "@/shared/utils/cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

interface ScheduleFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: "all" | "upcoming" | "active" | "completed" | "missed";
  onStatusFilterChange: (
    value: "all" | "upcoming" | "active" | "completed" | "missed",
  ) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  variant?: "card" | "miniBar";
}

export function ScheduleFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateRange,
  onDateRangeChange,
  variant = "card",
}: ScheduleFiltersProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const keyboardContainerRef = useRef<HTMLDivElement>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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

    const timeoutId = setTimeout(updatePadding, 100);
    updatePadding();
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
    onSearchChange(searchTerm + value);
  };

  const handleKeyboardBackspace = () => {
    onSearchChange(searchTerm.slice(0, -1));
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

  const content = (
    <div
      className={cn(
        "flex flex-col sm:flex-row gap-3 sm:gap-4",
        variant === "miniBar" && "w-full",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="relative">
          <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            placeholder="Search by staff name..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
            className={cn(
              "pl-7 sm:pl-10 text-xs sm:text-sm md:text-base",
              variant === "miniBar" ? "h-8 sm:h-9" : "h-8 sm:h-9 md:h-10",
            )}
          />
        </div>
      </div>

      {variant !== "miniBar" && (
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[140px] h-8 sm:h-9 md:h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
            </SelectContent>
          </Select>

          {onDateRangeChange && (
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 sm:h-9 md:h-10 justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd")} -{" "}
                        {format(dateRange.to, "LLL dd, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, yyyy")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={onDateRangeChange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {variant === "card" ? (
        <div className="rounded-lg border bg-background p-3 sm:p-4 md:p-6">
          {content}
        </div>
      ) : (
        content
      )}

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
