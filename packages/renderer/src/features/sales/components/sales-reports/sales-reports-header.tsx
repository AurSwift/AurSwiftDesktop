/**
 * Sales Reports Header
 *
 * Header component for sales reports view.
 * Includes title, date range display, and export button.
 */

import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface SalesReportsHeaderProps {
  title?: string;
  subtitle?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  onExport?: (format: "csv" | "pdf") => void;
  onPrint?: () => void;
  showExport?: boolean;
  showPrint?: boolean;
  className?: string;
}

export function SalesReportsHeader({
  title = "Sales Reports",
  subtitle = "Comprehensive sales analytics and insights",
  dateRange: _dateRange,
  onExport,
  onPrint,
  showExport = true,
  showPrint = false,
  className,
}: SalesReportsHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm sm:text-base text-slate-600 mt-1">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showExport && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport?.("csv")}
              className="text-xs sm:text-sm"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport?.("pdf")}
              className="text-xs sm:text-sm"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Export PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </>
        )}
        {showPrint && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPrint}
            className="text-xs sm:text-sm"
          >
            <Printer className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Print</span>
            <span className="sm:hidden">Print</span>
          </Button>
        )}
      </div>
    </div>
  );
}
