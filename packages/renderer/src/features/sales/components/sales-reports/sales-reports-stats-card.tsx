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

const colorThemes = {
  green: {
    icon: "text-green-600",
    value: "text-green-700",
    bg: "bg-green-100",
  },
  blue: {
    icon: "text-blue-600",
    value: "text-blue-700",
    bg: "bg-blue-100",
  },
  amber: {
    icon: "text-amber-600",
    value: "text-amber-700",
    bg: "bg-amber-100",
  },
  red: {
    icon: "text-red-600",
    value: "text-red-700",
    bg: "bg-red-100",
  },
  purple: {
    icon: "text-purple-600",
    value: "text-purple-700",
    bg: "bg-purple-100",
  },
  default: {
    icon: "text-slate-600",
    value: "text-slate-700",
    bg: "bg-slate-100",
  },
};

export function SalesReportsStatsCard({
  title,
  value,
  change,
  icon: Icon,
  colorTheme = "default",
  isLoading = false,
  className,
}: SalesReportsStatsCardProps) {
  const theme = colorThemes[colorTheme];

  return (
    <Card className={cn("bg-white border-slate-200 shadow-sm h-full", className)}>
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-center justify-between text-sm sm:text-base font-semibold">
          <span className="text-slate-700">{title}</span>
          <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 shrink-0", theme.icon)} />
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
            <div className={cn("text-xl sm:text-2xl font-bold", theme.value)}>
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

