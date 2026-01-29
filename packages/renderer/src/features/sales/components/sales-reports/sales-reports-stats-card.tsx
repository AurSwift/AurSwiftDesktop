/**
 * Sales Reports Stats Card
 *
 * Reusable stats card component for displaying sales metrics.
 * Used throughout the sales reports view for consistent styling.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface SalesReportsStatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  colorTheme?: "green" | "blue" | "amber" | "red" | "purple" | "default";
  isLoading?: boolean;
  className?: string;
}

/** Classic dark grey for numbers and icons (no coloured themes) */
const neutralTheme = {
  icon: "text-slate-700",
  value: "text-slate-800",
};

export function SalesReportsStatsCard({
  title,
  value,
  change,
  icon: Icon,
  colorTheme: _colorTheme = "default",
  isLoading = false,
  className,
}: SalesReportsStatsCardProps) {
  return (
    <Card className={cn("bg-white border-slate-200 shadow-sm h-full", className)}>
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-center justify-between text-sm sm:text-base font-semibold">
          <span className="text-slate-700">{title}</span>
          <Icon
            className={cn(
              "h-4 w-4 sm:h-5 sm:w-5 shrink-0",
              neutralTheme.icon
            )}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <div
              className={cn(
                "text-xl sm:text-2xl font-bold",
                neutralTheme.value
              )}
            >
              {typeof value === "number" ? `£${value.toFixed(2)}` : value}
            </div>
            {change && (
              <p className="text-xs sm:text-sm text-slate-600 mt-2">
                {change}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

