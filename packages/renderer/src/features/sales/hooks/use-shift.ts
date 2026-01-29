/**
 * Hook for managing shift operations
 * Handles shift loading, starting, timing validation, overtime detection,
 * retry logic, concurrent access, and time change detection
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Shift, Schedule } from "@/types/domain/shift";
import { retryWithBackoff, isNetworkError } from "@/shared/utils/retry";
import { getDeviceId } from "@/shared/utils/device-id";
import { TimeChangeDetector } from "@/shared/utils/time-change-detector";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-shift");
import {
  queueOperation,
  processQueue,
  isOnline,
  setupOfflineListener,
} from "@/shared/utils/offline-queue";

interface UseShiftProps {
  userId: string | undefined;
  userRole: string | undefined; // eslint-disable-line @typescript-eslint/no-unused-vars
  businessId: string | undefined;
  onCartSessionInit?: () => Promise<void>;
}

/**
 * Hook for managing shift
 * @param props - Shift configuration props
 * @returns Shift state and operations
 */
export function useShift({
  userId,
  userRole: _userRole, // Prefixed with _ to indicate intentionally unused
  businessId,
  onCartSessionInit,
}: UseShiftProps) {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<Schedule | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [showStartShiftDialog, setShowStartShiftDialog] = useState(false);
  const [showLateStartConfirm, setShowLateStartConfirm] = useState(false);
  const [startingCash, setStartingCash] = useState("");
  const [lateStartMinutes, setLateStartMinutes] = useState(0);
  const [showOvertimeWarning, setShowOvertimeWarning] = useState(false);
  const [overtimeMinutes, setOvertimeMinutes] = useState(0);
  const [timeChangeDetected, setTimeChangeDetected] = useState(false);
  const [timeChangeInfo, setTimeChangeInfo] = useState<{
    detected: boolean;
    timeDifference: number;
  } | null>(null);

  // Time change detector instance
  const timeChangeDetectorRef = useRef<TimeChangeDetector | null>(null);
  if (!timeChangeDetectorRef.current) {
    timeChangeDetectorRef.current = new TimeChangeDetector(5000); // 5 second threshold
  }

  /**
   * Load shift data function with smart updates to prevent flickering
   */
  const loadShiftData = useCallback(
    async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) {
          setIsLoadingShift(true);
        }

        if (!userId) return;

        // Load active shift
        const activeShiftResponse = await window.shiftAPI.getActive(userId);
        if (activeShiftResponse.success && activeShiftResponse.data) {
          const shiftData = activeShiftResponse.data as Shift;

          // Only update if data has actually changed
          setActiveShift((prevShift) => {
            if (
              !prevShift ||
              JSON.stringify(prevShift) !== JSON.stringify(shiftData)
            ) {
              return shiftData;
            }
            return prevShift;
          });
        } else {
          // Only update if currently there is an active shift
          setActiveShift((prevShift) => (prevShift ? null : prevShift));
        }

        // Load today's schedule
        const scheduleResponse = await window.shiftAPI.getTodaySchedule(userId);
        if (scheduleResponse.success && scheduleResponse.data) {
          const newSchedule = scheduleResponse.data as Schedule;
          setTodaySchedule((prevSchedule) => {
            if (!prevSchedule) return newSchedule;

            const now = new Date();
            const newShiftStart = new Date(newSchedule.startTime);
            const newShiftEnd = new Date(newSchedule.endTime);
            const prevScheduleEnd = prevSchedule
              ? new Date(prevSchedule.endTime)
              : null;

            // If schedules are the same (by ID), always prefer the new one (might have been updated)
            if (prevSchedule.id === newSchedule.id) {
              return newSchedule;
            }

            // Priority logic: always prefer the most relevant schedule
            // 1. Prefer schedules that haven't ended yet (current or future)
            const newScheduleNotEnded = newShiftEnd > now;
            const prevScheduleNotEnded =
              prevScheduleEnd && prevScheduleEnd > now;

            if (newScheduleNotEnded && !prevScheduleNotEnded) {
              // New schedule is current/future, old one is ended - use new
              return newSchedule;
            }

            if (!newScheduleNotEnded && prevScheduleNotEnded) {
              // Old schedule is current/future, new one is ended - keep old
              return prevSchedule;
            }

            if (newScheduleNotEnded && prevScheduleNotEnded) {
              // Both are current/future - prefer the one that starts later (more recent)
              if (newShiftStart > new Date(prevSchedule.startTime)) {
                return newSchedule;
              }
              return prevSchedule;
            }

            // Both are ended - prefer the one that starts later (more recent)
            if (newShiftStart > new Date(prevSchedule.startTime)) {
              return newSchedule;
            }

            return prevSchedule;
          });
        } else {
          // If API returns no schedule, clear it
          setTodaySchedule(null);
        }
      } catch (error) {
        logger.error("Failed to load shift data:", error);
      } finally {
        if (isInitialLoad) {
          setIsLoadingShift(false);
        }
      }
    },
    [userId],
  );

  /**
   * Check for overtime and handle automatic shift ending
   */
  useEffect(() => {
    if (!activeShift || !todaySchedule) return;

    const checkOvertime = () => {
      const now = new Date();
      const scheduledEnd = new Date(todaySchedule.endTime);
      const timeDifference = now.getTime() - scheduledEnd.getTime();
      const minutesOvertime = Math.floor(timeDifference / (1000 * 60));

      if (minutesOvertime > 0) {
        setOvertimeMinutes(minutesOvertime);

        // Show warning after 15 minutes of overtime
        if (minutesOvertime >= 15 && !showOvertimeWarning) {
          setShowOvertimeWarning(true);
        }
      } else {
        setOvertimeMinutes(0);
        setShowOvertimeWarning(false);
      }
    };

    checkOvertime(); // Check immediately
    const overtimeInterval = setInterval(checkOvertime, 60000); // Check every minute

    return () => clearInterval(overtimeInterval);
  }, [activeShift, todaySchedule, showOvertimeWarning]);

  /**
   * Calculate shift timing validation
   */
  const shiftTimingInfo = useMemo(() => {
    if (!todaySchedule) {
      return {
        canStart: false,
        buttonText: "No Schedule",
        reason: "No schedule found",
      };
    }

    const now = new Date();
    const scheduledStart = new Date(todaySchedule.startTime);
    const scheduledEnd = new Date(todaySchedule.endTime);
    const timeDifference = now.getTime() - scheduledStart.getTime();
    const minutesDifference = timeDifference / (1000 * 60);

    // Check if shift has already ended
    const timeFromEnd = now.getTime() - scheduledEnd.getTime();
    const minutesAfterEnd = timeFromEnd / (1000 * 60);

    // Don't allow starting shifts that are more than 1 hour past their end time
    if (minutesAfterEnd > 60) {
      const hoursAfterEnd = Math.floor(minutesAfterEnd / 60);
      const remainingMinutes = Math.floor(minutesAfterEnd % 60);

      let overdueText;
      if (hoursAfterEnd > 0) {
        if (remainingMinutes === 0) {
          overdueText =
            hoursAfterEnd === 1 ? "1 hour" : `${hoursAfterEnd} hours`;
        } else {
          overdueText = `${hoursAfterEnd}h ${remainingMinutes}m`;
        }
      } else {
        overdueText = `${Math.floor(minutesAfterEnd)} minutes`;
      }

      return {
        canStart: false,
        buttonText: "Shift Ended",
        reason: `Shift ended ${overdueText} ago`,
      };
    }

    const EARLY_START_MINUTES = 15;
    const LATE_START_MINUTES = 30;

    if (minutesDifference < -EARLY_START_MINUTES) {
      const minutesUntilStart = Math.ceil(-minutesDifference);
      return {
        canStart: false,
        buttonText: `Start in ${minutesUntilStart}m`,
        reason: `Too early - wait ${minutesUntilStart} minutes`,
      };
    } else if (minutesDifference > LATE_START_MINUTES) {
      const minutesLate = Math.floor(minutesDifference);
      const hoursLate = Math.floor(minutesLate / 60);
      const remainingMinutes = minutesLate % 60;

      let lateText;
      if (hoursLate > 0) {
        if (remainingMinutes === 0) {
          lateText =
            hoursLate === 1 ? "1 hour late" : `${hoursLate} hours late`;
        } else {
          lateText = `${hoursLate}h ${remainingMinutes}m late`;
        }
      } else {
        lateText = `${minutesLate} minutes late`;
      }

      return {
        canStart: true,
        buttonText: `Start Shift (Late)`,
        reason: lateText,
      };
    } else {
      return {
        canStart: true,
        buttonText: "Start Shift",
        reason: "Ready to start",
      };
    }
  }, [todaySchedule]);

  /**
   * Validate schedule times
   */
  const validateSchedule = useCallback(
    (schedule: Schedule): { valid: boolean; error?: string } => {
      try {
        const startTime = new Date(schedule.startTime);
        const endTime = new Date(schedule.endTime);

        // Validate time format
        if (isNaN(startTime.getTime())) {
          return { valid: false, error: "Invalid schedule start time format" };
        }
        if (isNaN(endTime.getTime())) {
          return { valid: false, error: "Invalid schedule end time format" };
        }

        // Validate start time < end time
        if (startTime >= endTime) {
          return {
            valid: false,
            error: "Schedule end time must be after start time",
          };
        }

        // Validate schedule is for today (or within reasonable window - 24 hours before/after)
        const now = new Date();
        const scheduleDate = new Date(startTime);
        scheduleDate.setHours(0, 0, 0, 0);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const daysDiff = Math.abs(
          (scheduleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysDiff > 1) {
          return {
            valid: false,
            error: `Schedule is not for today (${daysDiff} days difference)`,
          };
        }

        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          error: `Error validating schedule: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
    [],
  );

  /**
   * Handle start shift click
   */
  const handleStartShiftClick = useCallback(() => {
    if (!userId) {
      toast.error("User not authenticated");
      return;
    }

    if (!todaySchedule) {
      toast.error("No schedule found for today. Please contact your manager.");
      return;
    }

    // Validate schedule times
    const scheduleValidation = validateSchedule(todaySchedule);
    if (!scheduleValidation.valid) {
      toast.error(scheduleValidation.error || "Invalid schedule");
      return;
    }

    // Validate shift timing
    const now = new Date();
    const scheduledStart = new Date(todaySchedule.startTime);
    const scheduledEnd = new Date(todaySchedule.endTime);
    const timeDifference = now.getTime() - scheduledStart.getTime();
    const minutesDifference = timeDifference / (1000 * 60);

    // Check if the scheduled shift has already ended
    const timeFromEnd = now.getTime() - scheduledEnd.getTime();
    const minutesAfterEnd = timeFromEnd / (1000 * 60);

    // Don't allow starting shifts that are more than 1 hour past their scheduled end time
    if (minutesAfterEnd > 60) {
      toast.error(
        `This shift ended at ${scheduledEnd.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })} and is now ${Math.floor(minutesAfterEnd / 60)}h ${Math.floor(
          minutesAfterEnd % 60,
        )}m overdue. Please contact your manager to reschedule or create a new shift.`,
        {
          duration: 6000,
        },
      );
      return;
    }

    // Allow starting 15 minutes early or up to 30 minutes late
    const EARLY_START_MINUTES = 15;
    const LATE_START_MINUTES = 30;

    if (minutesDifference < -EARLY_START_MINUTES) {
      const minutesUntilStart = Math.ceil(-minutesDifference);
      toast.warning(
        `Cannot start shift yet. Your shift is scheduled to start at ${scheduledStart.toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          },
        )}. Please wait ${minutesUntilStart} more minutes.`,
        {
          duration: 5000,
        },
      );
      return;
    }

    if (minutesDifference > LATE_START_MINUTES) {
      const minutesLate = Math.floor(minutesDifference);
      setLateStartMinutes(minutesLate);
      setShowLateStartConfirm(true);
      return;
    }

    // Show start shift dialog
    setStartingCash("");
    setShowStartShiftDialog(true);
  }, [userId, todaySchedule, validateSchedule]);

  /**
   * Confirm start shift with retry logic and concurrent access handling
   */
  const confirmStartShift = useCallback(async () => {
    if (!startingCash || isNaN(Number(startingCash))) {
      toast.error("Please enter a valid cash amount");
      return;
    }

    const cashAmount = Number(startingCash);

    // Validate negative values
    if (cashAmount < 0) {
      toast.error("Starting cash cannot be negative", {
        duration: 4000,
      });
      return;
    }

    // Validate upper limit (configurable - default £10,000)
    const MAX_STARTING_CASH = 10000;
    const WARNING_THRESHOLD = 5000;

    if (cashAmount > MAX_STARTING_CASH) {
      toast.error(
        `Starting cash exceeds maximum limit of £${MAX_STARTING_CASH.toLocaleString()}. Please verify the amount.`,
        {
          duration: 6000,
        },
      );
      return;
    }

    // Show warning for large amounts (but allow)
    if (cashAmount > WARNING_THRESHOLD) {
      toast.warning(
        `Starting cash amount is unusually large (£${cashAmount.toLocaleString()}). Please verify.`,
        {
          duration: 5000,
        },
      );
    }

    if (!userId || !businessId) {
      toast.error("User information missing");
      return;
    }

    const deviceId = getDeviceId();

    // Check if offline
    if (!isOnline()) {
      // Queue the operation for later
      queueOperation("shift:start", {
        scheduleId: todaySchedule?.id,
        cashierId: userId,
        businessId,
        startingCash: cashAmount,
        deviceId,
      });
      toast.info(
        "You are offline. Shift start has been queued and will be processed when connection is restored.",
        {
          duration: 5000,
        },
      );
      return;
    }

    // Store previous state for rollback
    const previousActiveShift = activeShift;
    const previousShowDialog = showStartShiftDialog;
    const previousStartingCash = startingCash;

    // Optimistic UI update - close dialog immediately
    setShowStartShiftDialog(false);
    setShowLateStartConfirm(false);
    setStartingCash("");

    try {
      // Use retry logic for network errors
      const response = await retryWithBackoff(
        async () => {
          return await window.shiftAPI.start({
            scheduleId: todaySchedule?.id,
            cashierId: userId,
            businessId,
            startingCash: cashAmount,
            deviceId,
          });
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          retryableErrors: (error) => isNetworkError(error),
        },
      );

      if (response.success && response.data) {
        const shiftData = response.data as Shift;
        setActiveShift(shiftData);

        // Reset time change detector when shift starts
        timeChangeDetectorRef.current?.reset();

        // Always refresh shift state after API call to ensure consistency
        await loadShiftData(false);

        // Initialize cart session now that shift is active
        if (onCartSessionInit) {
          await onCartSessionInit();
        }
        toast.success("Shift started successfully");
      } else {
        // Rollback optimistic update on error
        setActiveShift(previousActiveShift);
        setShowStartShiftDialog(previousShowDialog);
        setStartingCash(previousStartingCash);
        // Handle concurrent access specifically
        if (
          response.message?.includes("already have an active shift") ||
          (response as any).isDifferentDevice
        ) {
          const isDifferentDevice = (response as any).isDifferentDevice;
          const existingShift = response.data as Shift | undefined;

          if (isDifferentDevice && existingShift) {
            toast.warning(
              `Shift is already active on another device. Started at ${new Date(
                existingShift.startTime,
              ).toLocaleString()}`,
              {
                duration: 5000,
              },
            );
          } else {
            toast.warning("You already have an active shift running", {
              duration: 5000,
            });
          }

          // Automatically refresh shift state
          await loadShiftData(false);
        } else {
          // Other errors
          toast.error(
            response.message || "Failed to start shift. Please try again.",
            {
              duration: 5000,
            },
          );
        }
      }
    } catch (error) {
      // Rollback optimistic update on error
      setActiveShift(previousActiveShift);
      setShowStartShiftDialog(previousShowDialog);
      setStartingCash(previousStartingCash);

      logger.error("Failed to start shift:", error);

      if (isNetworkError(error)) {
        toast.error(
          "Network error. Please check your connection and try again.",
          {
            duration: 5000,
          },
        );
      } else {
        toast.error("Failed to start shift. Please try again.", {
          duration: 5000,
        });
      }
    }
  }, [
    startingCash,
    userId,
    businessId,
    todaySchedule,
    loadShiftData,
    onCartSessionInit,
  ]);

  /**
   * Confirm late start
   */
  const confirmLateStart = useCallback(() => {
    setShowLateStartConfirm(false);
    setStartingCash("");
    setShowStartShiftDialog(true);
  }, []);

  /**
   * Dismiss time-change warning (toast action + banner button).
   * Clears both timeChangeDetected and timeChangeInfo for consistency.
   */
  const dismissTimeChange = useCallback(() => {
    setTimeChangeDetected(false);
    setTimeChangeInfo(null);
    toast.dismiss("time-change");
  }, []);

  /**
   * Time change detection during active shift
   */
  useEffect(() => {
    if (!activeShift) {
      // Reset detector when no active shift
      timeChangeDetectorRef.current?.reset();
      setTimeChangeDetected(false);
      setTimeChangeInfo(null);
      return;
    }

    // Establish baseline immediately so we can detect changes within the first 30s
    timeChangeDetectorRef.current?.checkTimeChange();

    const notifyTimeChange = (changeInfo: {
      detected: boolean;
      timeDifference: number;
    }) => {
      setTimeChangeDetected(true);
      setTimeChangeInfo({
        detected: true,
        timeDifference: changeInfo.timeDifference,
      });

      const formattedDiff = TimeChangeDetector.formatTimeDifference(
        changeInfo.timeDifference,
      );
      const direction = changeInfo.timeDifference > 0 ? "forward" : "backward";

      toast.warning(
        `System time changed ${direction} by ${formattedDiff}. This may affect shift calculations.`,
        {
          id: "time-change",
          duration: 10000,
          action: {
            label: "Dismiss",
            onClick: dismissTimeChange,
          },
        },
      );
    };

    // Check for time changes every 30 seconds
    const timeCheckInterval = setInterval(() => {
      const result = timeChangeDetectorRef.current?.checkTimeChange();
      if (result?.detected) {
        notifyTimeChange({
          detected: true,
          timeDifference: result.timeDifference,
        });
      }
    }, 30000);

    return () => clearInterval(timeCheckInterval);
  }, [activeShift, dismissTimeChange]);

  /**
   * Process offline queue when connection is restored
   */
  useEffect(() => {
    if (!isOnline()) return;

    const processOfflineQueue = async () => {
      const result = await processQueue(async (operation) => {
        if (operation.type === "shift:start") {
          try {
            const response = await window.shiftAPI.start(operation.data);
            if (response.success) {
              // Refresh shift data
              await loadShiftData(false);
              toast.success("Queued shift start completed successfully");
              return true;
            }
            return false;
          } catch (error) {
            logger.error("Failed to process queued shift start:", error);
            return false;
          }
        }
        return false;
      });

      if (result.processed > 0) {
        toast.success(`Processed ${result.processed} queued operation(s)`, {
          duration: 3000,
        });
      }
    };

    // Process queue when coming online
    const cleanup = setupOfflineListener(
      () => {
        // Connection restored
        toast.info("Connection restored. Processing queued operations...");
        processOfflineQueue();
      },
      () => {
        // Connection lost
        toast.warning("Connection lost. Operations will be queued.", {
          duration: 3000,
        });
      },
    );

    // Process queue on mount if online
    if (isOnline()) {
      processOfflineQueue();
    }

    // Also process queue periodically (every 60 seconds)
    const queueInterval = setInterval(() => {
      if (isOnline()) {
        processOfflineQueue();
      }
    }, 60000);

    return () => {
      cleanup();
      clearInterval(queueInterval);
    };
  }, [loadShiftData]);

  /**
   * Load shift data on component mount and periodically
   */
  useEffect(() => {
    loadShiftData(true); // Initial load with loading indicator

    // Refresh data every 30 seconds to pick up schedule changes made by manager
    const interval = setInterval(() => {
      if (userId) {
        loadShiftData(false); // Background refresh without loading indicator
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadShiftData, userId]);

  return {
    activeShift,
    todaySchedule,
    isLoadingShift,
    showStartShiftDialog,
    showLateStartConfirm,
    startingCash,
    lateStartMinutes,
    showOvertimeWarning,
    overtimeMinutes,
    shiftTimingInfo,
    timeChangeDetected,
    timeChangeInfo,
    dismissTimeChange,
    loadShiftData,
    handleStartShiftClick,
    confirmStartShift,
    confirmLateStart,
    setShowStartShiftDialog,
    setShowLateStartConfirm,
    setStartingCash,
  };
}
