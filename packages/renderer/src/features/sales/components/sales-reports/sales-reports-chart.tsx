/**
 * Sales Reports Chart Component
 *
 * Placeholder for chart visualizations.
 * Can be enhanced with a charting library like recharts or chart.js.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface SalesReportsChartProps {
  title?: string;
  data?: Array<{ label: string; value: number }>;
  type?: "bar" | "line" | "pie";
  isLoading?: boolean;
  className?: string;
}

/**
 * Simple bar chart using CSS (can be replaced with a proper charting library)
 */
function SimpleBarChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600">{item.label}</span>
            <span className="font-medium text-slate-900">{item.value}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SalesReportsChart({
  title = "Chart",
  data = [],
  type = "bar",
  isLoading = false,
  className,
}: SalesReportsChartProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-semibold text-slate-700 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-2 w-full bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-semibold text-slate-700 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-slate-500">
            <BarChart3 className="h-8 w-8 mx-auto opacity-50 mb-2" />
            <p className="text-sm">No data available for chart</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-white border-slate-200 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg font-semibold text-slate-700 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {type === "bar" && <SimpleBarChart data={data} />}
        {/* Add other chart types here when implementing with a charting library */}
        {type !== "bar" && (
          <div className="text-center py-6 text-slate-500">
            <p className="text-sm">
              {type} chart type not yet implemented. Use a charting library like
              recharts or chart.js.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

