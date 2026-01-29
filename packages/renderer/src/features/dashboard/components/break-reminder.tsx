/**
 * Break Reminder Component
 *
 * Shows notification after 6 hours of work without a meal break (labor law compliance)
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Coffee, AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BreakReminderProps {
  workDuration: number; // in seconds
  hasMealBreakToday: boolean;
  onTakeBreak: () => void;
}

export function BreakReminder({
  workDuration,
  hasMealBreakToday,
  onTakeBreak,
}: BreakReminderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const SIX_HOURS_IN_SECONDS = 6 * 60 * 60; // 6 hours
  const shouldShowReminder =
    workDuration >= SIX_HOURS_IN_SECONDS && !hasMealBreakToday && !isDismissed;

  useEffect(() => {
    if (shouldShowReminder) {
      setIsOpen(true);
    }
  }, [shouldShowReminder]);

  const handleTakeBreak = () => {
    setIsOpen(false);
    onTakeBreak();
  };

  const handleDismiss = () => {
    setIsOpen(false);
    setIsDismissed(true);
  };

  if (!shouldShowReminder) {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Meal Break Required
          </DialogTitle>
          <DialogDescription>Labor law compliance reminder</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert
            variant="default"
            className="border-amber-500 bg-amber-50 dark:bg-amber-950/30"
          >
            <Coffee className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-900 dark:text-amber-200">
              You've been working for{" "}
              <strong>{formatDuration(workDuration)}</strong> without taking a
              meal break. Labor law requires a 30-minute meal break after 6
              hours of continuous work.
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Coffee className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="text-sm font-medium">What is a meal break?</h4>
                <p className="text-xs text-muted-foreground">
                  A meal break is an unpaid break of at least 30 minutes where
                  you're completely relieved of work duties. You can eat, rest,
                  or leave the premises.
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              <strong>Note:</strong> Continuing to work without taking your meal
              break may result in compliance violations. Please take your break
              now or speak with your manager.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={handleTakeBreak} className="w-full gap-2" size="lg">
            <Coffee className="w-5 h-5" />
            Take Meal Break Now
          </Button>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="w-full gap-2"
            size="sm"
          >
            <X className="w-4 h-4" />
            Dismiss (I'll take it later)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
