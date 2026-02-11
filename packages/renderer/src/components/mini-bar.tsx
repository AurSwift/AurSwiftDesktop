import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";

type MiniBarAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  ariaLabel?: string;
};

type MiniBarProps = {
  title: string;
  onBack?: () => void;
  backAriaLabel?: string;
  action?: MiniBarAction;
  /** Center slot (e.g. search field). Shown between left and right. */
  center?: ReactNode;
  /** Right slot (e.g. pagination, view toggles). */
  right?: ReactNode;
  className?: string;
};

export function MiniBar({
  title,
  onBack,
  backAriaLabel = "Back",
  action,
  center,
  right,
  className,
}: MiniBarProps) {
  return (
    <div
      className={cn(
        "w-full flex flex-col gap-2 sm:flex-row sm:items-center",
        "rounded-lg border bg-background px-3 py-2",
        center != null ? "sm:gap-3" : "sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onBack}
            aria-label={backAriaLabel}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {action && (
          <Button
            size="sm"
            className="h-8 px-3 text-xs font-semibold shrink-0"
            onClick={action.onClick}
            aria-label={action.ariaLabel ?? action.label}
          >
            {action.icon ? <span className="mr-2 inline-flex">{action.icon}</span> : null}
            {action.label}
          </Button>
        )}

        <div className="min-w-0 flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">
            {title}
          </span>
        </div>
      </div>

      {center != null ? (
        <div className="flex-1 min-w-0 flex items-center justify-center sm:justify-center">
          {center}
        </div>
      ) : null}

      {right != null ? (
        <div className="flex items-center justify-end gap-2 min-w-0 shrink-0">
          {right}
        </div>
      ) : null}
    </div>
  );
}
