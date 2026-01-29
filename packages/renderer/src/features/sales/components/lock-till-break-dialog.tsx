/**
 * Lock Till & Break Integration Component
 *
 * Industry best practice: Locking the till = taking a break
 * - Locks the POS terminal screen
 * - Automatically starts a break (if shift is active)
 * - Unlocking ends the break and resumes work
 *
 * Now supports dynamic break options from admin-configured policies.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Coffee, AlertCircle, Unlock, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("lock-till-break");

// Local interface matching the API response structure
interface AvailableBreakOption {
  breakType: {
    id: number;
    publicId: string;
    business_id: string;
    name: string;
    code: string;
    description?: string | null;
    default_duration_minutes: number;
    min_duration_minutes: number;
    max_duration_minutes: number;
    is_paid: boolean;
    is_required: boolean;
    counts_as_worked_time: boolean;
    allowed_window_start?: string | null;
    allowed_window_end?: string | null;
    icon?: string | null;
    color?: string | null;
    is_active: boolean;
  };
  rule: {
    id: number;
    allowed_count: number;
    is_mandatory: boolean;
    priority?: number | null;
  };
  remainingCount: number;
  isAllowed: boolean;
  reason?: string;
}

interface LockTillBreakDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string | null;
  userId: string;
  businessId?: string;
  shiftStartTime?: string | Date | null;
  onBreakStarted?: () => void;
  onLockConfirmed: () => void;
}

export function LockTillBreakDialog({
  isOpen,
  onClose,
  shiftId,
  userId,
  businessId,
  shiftStartTime,
  onBreakStarted,
  onLockConfirmed,
}: LockTillBreakDialogProps) {
  const [breakType, setBreakType] = useState<string>("rest");
  const [isPaid, setIsPaid] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic break options from policy
  const [availableBreaks, setAvailableBreaks] = useState<
    AvailableBreakOption[]
  >([]);
  const [loadingBreaks, setLoadingBreaks] = useState(false);
  const [selectedBreak, setSelectedBreak] =
    useState<AvailableBreakOption | null>(null);

  const hasActiveShift = !!shiftId;

  // Format shift start time as ISO string
  const getShiftStartTimeISO = useCallback((): string => {
    if (!shiftStartTime) return new Date().toISOString();
    const date =
      typeof shiftStartTime === "string"
        ? new Date(shiftStartTime)
        : shiftStartTime;
    return date.toISOString();
  }, [shiftStartTime]);

  // Fetch available breaks from policy
  useEffect(() => {
    if (!isOpen || !hasActiveShift || !shiftId || !businessId) {
      logger.info("Skipping break fetch - missing data:", {
        isOpen,
        hasActiveShift,
        shiftId,
        businessId,
      });
      return;
    }

    const fetchAvailableBreaks = async () => {
      setLoadingBreaks(true);
      logger.info("Fetching available breaks from policy API...", {
        businessId,
        shiftId,
        shiftStartTime: getShiftStartTimeISO(),
      });

      try {
        // Use breakPolicyAPI if available
        if (window.breakPolicyAPI) {
          const result = await window.breakPolicyAPI.getAvailableBreaks({
            businessId,
            shiftId,
            shiftStartTime: getShiftStartTimeISO(),
          });

          logger.info("Break policy API response:", result);

          if (result.success && result.data && result.data.length > 0) {
            setAvailableBreaks(result.data);

            // Auto-select first allowed break, or first break if none allowed
            const firstAllowed =
              result.data.find((b) => b.isAllowed) || result.data[0];
            if (firstAllowed) {
              setSelectedBreak(firstAllowed);
              setBreakType(firstAllowed.breakType.code);
              setIsPaid(firstAllowed.breakType.is_paid);
            }
          } else {
            logger.warn(
              "No breaks returned from policy API, using fallback defaults",
            );
            // Fall back to defaults
            setAvailableBreaks([]);
          }
        } else {
          logger.warn("breakPolicyAPI not available on window");
          setAvailableBreaks([]);
        }
      } catch (err) {
        logger.error("Could not load break policies:", err);
        setAvailableBreaks([]);
      } finally {
        setLoadingBreaks(false);
      }
    };

    fetchAvailableBreaks();
  }, [isOpen, hasActiveShift, shiftId, businessId, getShiftStartTimeISO]);

  const handleBreakSelection = (breakCode: string) => {
    const selected = availableBreaks.find(
      (b) => b.breakType.code === breakCode,
    );
    if (selected) {
      setSelectedBreak(selected);
      setBreakType(selected.breakType.code);
      setIsPaid(selected.breakType.is_paid);
    } else {
      // Fallback for default options
      setBreakType(breakCode as "meal" | "rest" | "other");
      setIsPaid(breakCode === "rest");
    }
  };

  const handleLockWithBreak = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // If user has active shift AND breaks are defined, start a break
      if (
        hasActiveShift &&
        shiftId &&
        availableBreaks.length > 0 &&
        selectedBreak
      ) {
        // Use the selected break type code
        const apiBreakType = (
          breakType === "meal" ||
          breakType === "rest" ||
          breakType === "other" ||
          breakType === "tea"
            ? breakType
            : "other"
        ) as "meal" | "rest" | "other" | "tea";

        const response = await window.timeTrackingAPI.startBreak({
          shiftId,
          userId,
          type: apiBreakType,
          isPaid,
        });

        if (!response.success) {
          setError(response.message || "Failed to start break");
          setIsLoading(false);
          return;
        }

        logger.info("Break started for locked till:", response.break);
        onBreakStarted?.();
      } else if (hasActiveShift && availableBreaks.length === 0) {
        // No breaks defined - just lock till without starting break
        logger.info("No breaks defined, locking till without starting break");
      }

      // Lock the till (call parent handler)
      onLockConfirmed();
      onClose();
    } catch (err) {
      logger.error("Failed to lock till with break:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Render break options - either from policy or default fallback
  const renderBreakOptions = () => {
    if (loadingBreaks) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading break options...
        </div>
      );
    }

    // If we have policy-based options, use them
    if (availableBreaks.length > 0) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Break Type</label>
            {selectedBreak?.rule.is_mandatory && (
              <Badge variant="destructive" className="text-xs">
                Required
              </Badge>
            )}
          </div>
          <Select value={breakType} onValueChange={handleBreakSelection}>
            <SelectTrigger className="h-auto min-h-10">
              <SelectValue>
                {selectedBreak && (
                  <div className="flex items-center gap-2 py-1">
                    <span className="font-medium">
                      {selectedBreak.breakType.name}
                    </span>
                    {selectedBreak.breakType.is_paid ? (
                      <Badge variant="outline" className="text-xs">
                        Paid
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Unpaid
                      </Badge>
                    )}
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableBreaks.map((option) => (
                <SelectItem
                  key={option.breakType.code}
                  value={option.breakType.code}
                  className="py-3"
                >
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {option.breakType.name}
                      </span>
                      {option.rule.is_mandatory && (
                        <Badge variant="secondary" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {option.breakType.is_paid ? (
                        <Badge variant="outline" className="text-xs">
                          Paid
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Unpaid
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {option.breakType.default_duration_minutes} min
                      {option.breakType.description &&
                        ` • ${option.breakType.description}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {option.remainingCount} of {option.rule.allowed_count}{" "}
                      remaining today
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedBreak && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3 shrink-0" />
              <span>
                Duration: {selectedBreak.breakType.min_duration_minutes}-
                {selectedBreak.breakType.max_duration_minutes} min
                {selectedBreak.breakType.allowed_window_start &&
                  selectedBreak.breakType.allowed_window_end && (
                    <>
                      {" "}
                      • Time window:{" "}
                      {selectedBreak.breakType.allowed_window_start} -{" "}
                      {selectedBreak.breakType.allowed_window_end}
                    </>
                  )}
              </span>
            </div>
          )}
        </div>
      );
    }

    // No breaks defined - show message to admin
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>No break types defined.</strong>
          <br />
          Please ask your manager to configure break policies in the admin
          settings. You can still lock the till, but no break will be recorded.
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Lock Till
          </DialogTitle>
          <DialogDescription>
            {hasActiveShift
              ? "The till will be locked and a break will be started automatically."
              : "The till will be locked. You're not currently clocked in."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {hasActiveShift ? (
            <>
              <Alert>
                <Coffee className="h-4 w-4" />
                <AlertDescription>
                  <strong>
                    Locking the till will automatically start your break.
                  </strong>
                  <br />
                  When you unlock, your break will end and you'll resume work.
                </AlertDescription>
              </Alert>

              {/* Dynamic break type selection based on policy */}
              {renderBreakOptions()}
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You're not currently clocked in. The till will be locked, but no
                break will be recorded.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-start gap-3">
              <Unlock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1 flex-1">
                <h4 className="text-sm font-medium">To Unlock</h4>
                <p className="text-xs text-muted-foreground">
                  Enter your PIN to unlock the till. If you started a break, it
                  will automatically end when you unlock.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLockWithBreak}
            disabled={isLoading}
            className="flex-1 gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Locking...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Lock Till
                {hasActiveShift &&
                  availableBreaks.length > 0 &&
                  " & Start Break"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
