/**
 * Upgrade Badge Component
 *
 * Badge component that displays "Upgrade Required" with a tooltip
 * explaining the upgrade requirement. Shows upgrade prompt information.
 */

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import type { PlanId } from "../config/plan-features";

export interface UpgradeBadgeProps {
  /**
   * Upgrade message to display in tooltip
   */
  message: string;

  /**
   * Plan ID to upgrade to
   */
  planId: PlanId;

  /**
   * Optional additional className
   */
  className?: string;

  /**
   * Variant for the badge
   */
  variant?: "default" | "outline" | "secondary";

  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
}

/**
 * Upgrade badge component
 *
 * Displays a badge with upgrade information and shows a tooltip
 * when hovered with the upgrade message.
 */
export function UpgradeBadge({
  message,
  planId,
  className,
  variant = "outline",
  size = "sm",
}: UpgradeBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 h-5",
    md: "text-xs px-2.5 py-1 h-6",
    lg: "text-sm px-3 py-1.5 h-7",
  };

  const planName =
    planId === "professional"
      ? "Professional"
      : planId.charAt(0).toUpperCase() + planId.slice(1);

  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <Badge
          variant={variant}
          className={cn(
            sizeClasses[size],
            "gap-1 cursor-help shrink-0 font-medium whitespace-nowrap",
            "bg-sky-100/90 dark:bg-sky-950/60",
            "text-sky-800 dark:text-sky-200",
            "border-sky-300 dark:border-sky-700",
            "hover:bg-sky-200 dark:hover:bg-sky-950/80",
            "hover:border-sky-400 dark:hover:border-sky-600",
            "transition-all shadow-sm hover:shadow",
            className
          )}
        >
          <Sparkles className="h-2.5 w-2.5" />
          <span>Pro</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-xs bg-popover text-popover-foreground border border-border/50 shadow-lg rounded-md p-3 z-[200]"
        side="top"
        align="end"
        sideOffset={8}
        alignOffset={-4}
      >
        <div className="space-y-1.5">
          <p className="font-semibold text-sm leading-tight text-foreground">
            Upgrade to {planName} Plan
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {message}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
