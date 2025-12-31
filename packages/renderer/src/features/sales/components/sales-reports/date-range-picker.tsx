/**
 * Date Range Picker Component
 *
 * Component for selecting a custom date range.
 * Uses calendar component with range selection.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { format } from "date-fns";
import type { DateRange } from "./sales-reports-filters";

export interface DateRangePickerProps {
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(
    dateRange?.start
  );
  const [endDate, setEndDate] = useState<Date | undefined>(dateRange?.end);

  // Sync internal state with prop changes
  useEffect(() => {
    if (dateRange) {
      setStartDate(dateRange.start);
      setEndDate(dateRange.end);
    } else {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  }, [dateRange]);

  const handleStartDateChange = (date: Date | undefined) => {
    if (date) {
      setStartDate(date);
      // If end date is before start date, reset end date
      if (endDate && date > endDate) {
        setEndDate(undefined);
      }
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (date) {
      setEndDate(date);
    }
  };

  const handleApply = () => {
    if (startDate && endDate) {
      // Set start to beginning of day
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      // Set end to end of day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      onDateRangeChange({ start, end });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setIsOpen(false);
  };

  const displayText = dateRange
    ? `${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`
    : "Select date range";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full sm:w-[280px] justify-start text-left font-normal",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={
                  startDate
                    ? format(startDate, "yyyy-MM-dd")
                    : ""
                }
                onChange={(e) => {
                  if (e.target.value) {
                    handleStartDateChange(new Date(e.target.value));
                  }
                }}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={
                  endDate
                    ? format(endDate, "yyyy-MM-dd")
                    : ""
                }
                onChange={(e) => {
                  if (e.target.value) {
                    handleEndDateChange(new Date(e.target.value));
                  }
                }}
                min={
                  startDate
                    ? format(startDate, "yyyy-MM-dd")
                    : undefined
                }
                className="flex-1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="flex-1"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!startDate || !endDate}
              className="flex-1"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

