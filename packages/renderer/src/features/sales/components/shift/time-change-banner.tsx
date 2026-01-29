/**
 * Time change warning banner – shown when system time change is detected during a shift.
 */

import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeChangeDetector } from "@/shared/utils/time-change-detector";

interface TimeChangeBannerProps {
  show: boolean;
  timeDifferenceMs: number | null;
  onDismiss: () => void;
}

export function TimeChangeBanner({
  show,
  timeDifferenceMs,
  onDismiss,
}: TimeChangeBannerProps) {
  if (!show || timeDifferenceMs == null) return null;

  const formattedDiff =
    TimeChangeDetector.formatTimeDifference(timeDifferenceMs);
  const direction = timeDifferenceMs > 0 ? "forward" : "backward";

  return (
    <div className="bg-amber-50 border-b-2 border-amber-300 p-3 sm:p-4 flex items-start sm:items-center justify-between gap-2 sm:gap-3">
      <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
        <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
        <div className="min-w-0">
          <h3 className="font-semibold text-amber-900 text-sm sm:text-base">
            System time changed
          </h3>
          <p className="text-xs sm:text-sm text-amber-700">
            System time moved {direction} by {formattedDiff}. This may affect
            shift calculations.
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        className="shrink-0 h-8 w-8 text-amber-700 hover:bg-amber-200/50 hover:text-amber-900"
        aria-label="Dismiss time change warning"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
