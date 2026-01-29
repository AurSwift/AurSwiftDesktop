/**
 * Logout Confirmation Dialog Component
 *
 * Confirms if user wants to end shift or just take a break
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogOut, Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";


interface LogoutConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: () => Promise<void>;
  hasActiveShift: boolean;
  workDuration: number; // in seconds
  shiftId?: string;
  userId?: string;
  onBreakStarted?: () => void;
}

export function LogoutConfirmationDialog({
  isOpen,
  onClose,
  onConfirmLogout,
  hasActiveShift,
  workDuration,
}: LogoutConfirmationDialogProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onConfirmLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

 

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="w-5 h-5" />
            End Your Shift?
          </DialogTitle>
          <DialogDescription>
            You're currently clocked in. What would you like to do?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasActiveShift && (
            <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4" />
                Current Shift
              </div>
              <div className="text-2xl font-mono font-bold">
                {formatDuration(workDuration)}
              </div>
              <div className="text-xs text-muted-foreground">
                Time worked today
              </div>
            </div>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Logging out will end your shift</strong> and clock you out
              for the day. If you're just taking a break, use the "Take Break"
              button instead.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
      
            <Button
              variant="destructive"
              className="w-full justify-start gap-3 h-auto p-4"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium">Logging Out...</span>
                    <span className="text-xs opacity-90">
                      Ending shift and clocking out
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <LogOut className="w-5 h-5" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium">End Shift & Logout</span>
                    <span className="text-xs opacity-90">
                      Clock out and finish work for the day
                    </span>
                  </div>
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoggingOut}
            className="w-full"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
