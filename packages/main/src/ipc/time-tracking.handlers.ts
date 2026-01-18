import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import { scheduleValidator } from "../utils/scheduleValidator.js";
import { shiftRequirementResolver } from "../utils/shiftRequirementResolver.js";

const logger = getLogger("timeTrackingHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerTimeTrackingHandlers() {
  // Time Tracking IPC Handlers
  ipcMain.handle("timeTracking:clockIn", async (event, data) => {
    try {
      const db = await getDatabase();

      // Comprehensive validation before clock-in
      const userId = data.userId;
      if (!userId) {
        return {
          success: false,
          message: "User ID is required",
          code: "MISSING_USER_ID",
        };
      }

      // 1. Validate user exists and is active
      const user = db.users.getUserById(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND",
        };
      }

      if (!user.isActive) {
        return {
          success: false,
          message: "User account is inactive",
          code: "USER_INACTIVE",
        };
      }

      // 2. Check for existing active shift (prevent duplicate clock-in)
      const existingActiveShift = db.timeTracking.getActiveShift(userId);
      if (existingActiveShift) {
        return {
          success: false,
          message: "You already have an active shift. Please clock out first.",
          code: "DUPLICATE_CLOCK_IN",
        };
      }

      // Validate schedule if user requires shift (cashier/manager)
      if (user && data.businessId) {
        const shiftRequirement = await shiftRequirementResolver.resolve(
          user,
          db,
        );

        if (shiftRequirement.requiresShift) {
          // Validate schedule before clock-in
          const scheduleValidation = await scheduleValidator.validateClockIn(
            data.userId,
            data.businessId,
            db,
          );

          // Audit log schedule validation
          try {
            await db.audit.createAuditLog({
              action: scheduleValidation.canClockIn
                ? "schedule_validation_passed"
                : "schedule_validation_failed",
              entityType: "user",
              entityId: data.userId,
              userId: data.userId,
              details: {
                canClockIn: scheduleValidation.canClockIn,
                requiresApproval: scheduleValidation.requiresApproval,
                reason: scheduleValidation.reason,
                warnings: scheduleValidation.warnings,
                scheduleId: scheduleValidation.schedule?.id,
                context: "clock_in_ipc",
              },
            });
          } catch (error) {
            logger.error(
              "[timeTracking:clockIn] Failed to audit log schedule validation:",
              error,
            );
          }

          if (!scheduleValidation.canClockIn) {
            if (!scheduleValidation.requiresApproval) {
              // No schedule or critical issue - block clock-in
              return {
                success: false,
                message:
                  scheduleValidation.reason ||
                  "Cannot clock in: Schedule validation failed",
                code: "SCHEDULE_VALIDATION_FAILED",
                scheduleValidation: {
                  warnings: scheduleValidation.warnings,
                  requiresApproval: scheduleValidation.requiresApproval,
                },
              };
            } else {
              // Schedule validation failed but can proceed with approval
              logger.warn(
                `Schedule validation warnings for clock-in: ${scheduleValidation.warnings.join(
                  ", ",
                )}`,
              );
              // Continue but return warnings
            }
          }
        }
      }

      const clockEvent = await db.timeTracking.createClockEvent({
        ...data,
        type: "in",
        auditManager: db.audit, // Pass audit manager for logging
      });

      // Check if shift should be created
      const activeShift = db.timeTracking.getActiveShift(data.userId);
      if (!activeShift && data.businessId) {
        // Get schedule for linking
        let scheduleId: string | undefined;
        if (user) {
          const scheduleValidation = await scheduleValidator.validateClockIn(
            data.userId,
            data.businessId,
            db,
          );
          scheduleId = scheduleValidation.schedule?.id;
        }

        const shift = await db.timeTracking.createShift({
          userId: data.userId,
          businessId: data.businessId,
          clockInId: clockEvent.id,
          scheduleId,
        });
        return {
          success: true,
          clockEvent,
          shift,
        };
      }

      return {
        success: true,
        clockEvent,
        shift: activeShift,
      };
    } catch (error) {
      logger.error("Clock-in IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to clock in",
      };
    }
  });

  ipcMain.handle("timeTracking:clockOut", async (event, data) => {
    try {
      const db = await getDatabase();

      // Comprehensive validation before clock-out
      const userId = data.userId;
      if (!userId) {
        return {
          success: false,
          message: "User ID is required",
          code: "MISSING_USER_ID",
        };
      }

      // 1. Validate user exists and is active
      const user = db.users.getUserById(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND",
        };
      }

      if (!user.isActive) {
        return {
          success: false,
          message: "User account is inactive",
          code: "USER_INACTIVE",
        };
      }

      // 2. Get active shift and validate ownership
      const activeShift = db.timeTracking.getActiveShift(userId);

      if (!activeShift) {
        return {
          success: false,
          message:
            "No active shift found. Cannot clock out without an active shift.",
          code: "NO_ACTIVE_SHIFT",
        };
      }

      // 3. Validate user owns the shift
      if (activeShift.user_id !== userId) {
        logger.warn(
          `[ClockOut] User ${userId} attempted to clock out shift ${activeShift.id} owned by ${activeShift.user_id}`,
        );
        return {
          success: false,
          message: "You can only clock out your own shift",
          code: "SHIFT_OWNERSHIP_MISMATCH",
        };
      }

      // 4. Check if shift is actually active (not already completed)
      if (activeShift.clock_out_id) {
        return {
          success: false,
          message: "Shift is already completed",
          code: "SHIFT_ALREADY_COMPLETED",
        };
      }

      // 5. Check for duplicate clock-out events
      // Get the clock-in event for this shift
      if (activeShift.clock_in_id) {
        const clockInEvent = db.timeTracking.getClockEventById(
          activeShift.clock_in_id,
        );
        if (clockInEvent) {
          // Check if shift already has a clock-out event (via clock_out_id)
          if (activeShift.clock_out_id) {
            const existingClockOut = db.timeTracking.getClockEventById(
              activeShift.clock_out_id,
            );
            if (existingClockOut && existingClockOut.type === "out") {
              return {
                success: false,
                message: "Clock-out event already exists for this shift",
                code: "DUPLICATE_CLOCK_OUT",
              };
            }
          }
        }
      }

      // 6. Validate minimum shift duration
      if (activeShift.clock_in_id) {
        const clockInEvent = db.timeTracking.getClockEventById(
          activeShift.clock_in_id,
        );
        if (clockInEvent) {
          const shiftDuration =
            Date.now() - new Date(clockInEvent.timestamp).getTime();
          const minDuration = 5 * 60 * 1000; // 5 minute minimum shift duration

          if (shiftDuration < minDuration) {
            const durationMinutes = Math.floor(shiftDuration / (1000 * 60));
            logger.warn(
              `[ClockOut] Shift duration too short: ${durationMinutes} minutes for user ${userId}`,
            );

            // If force flag is not set, block the clock-out and suggest taking a break instead
            if (!data.forceShortShift) {
              return {
                success: false,
                message: `Shift duration is only ${durationMinutes} minute(s). Minimum shift is 5 minutes. If you need a break, use "Take Break" instead of logging out.`,
                code: "SHIFT_TOO_SHORT",
                shiftDurationMinutes: durationMinutes,
                requiresConfirmation: true,
              };
            }
          }
        }
      }

      // All validations passed - proceed with clock-out

      // End any active breaks
      const activeBreak = db.timeTracking.getActiveBreak(activeShift.id);
      if (activeBreak) {
        await db.timeTracking.endBreak(activeBreak.id);
      }

      // Create clock-out event
      const clockEvent = await db.timeTracking.createClockEvent({
        ...data,
        type: "out",
      });

      // Validate clock event (fraud detection)
      const validation = await db.timeTracking.validateClockEvent(clockEvent);
      if (!validation.valid && validation.violations.length > 0) {
        logger.warn(
          `[ClockOut] Clock-out validation violations: ${validation.violations.join(
            ", ",
          )}`,
        );
        // Log but don't block - violations are warnings, not blockers
      }

      // Complete shift
      const completedShift = await db.timeTracking.completeShift(
        activeShift.id,
        clockEvent.id,
      );

      return {
        success: true,
        clockEvent,
        shift: completedShift,
        validation: validation.warnings.length > 0 ? validation : undefined, // Include warnings if any
      };
    } catch (error) {
      logger.error("Clock-out IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to clock out",
        code: "CLOCK_OUT_ERROR",
      };
    }
  });

  ipcMain.handle("timeTracking:getActiveShift", async (event, userId) => {
    try {
      const db = await getDatabase();
      const shift = db.timeTracking.getActiveShift(userId);

      if (!shift) {
        return {
          success: false,
          message: "No active shift found",
        };
      }

      const breaks = db.timeTracking.getBreaksByShift(shift.id);

      // Get clock-in event for timestamp
      let clockInEvent = null;
      if (shift.clock_in_id) {
        clockInEvent = db.timeTracking.getClockEventById(shift.clock_in_id);
      }

      return {
        success: true,
        shift: {
          ...shift,
          clockInEvent, // Include clock-in event info
        },
        breaks,
      };
    } catch (error) {
      logger.error("Get active shift IPC error:", error);
      return {
        success: false,
        message: "Failed to get active shift",
      };
    }
  });

  ipcMain.handle("timeTracking:startBreak", async (event, data) => {
    try {
      const db = await getDatabase();

      // Get shift to retrieve businessId
      const shift = db.timeTracking.getShiftById(data.shiftId);
      if (!shift) {
        return {
          success: false,
          message: "Shift not found",
          code: "SHIFT_NOT_FOUND",
        };
      }

      const breakRecord = await db.timeTracking.startBreak({
        ...data,
        businessId: shift.business_id,
      });
      return {
        success: true,
        break: breakRecord,
      };
    } catch (error) {
      logger.error("Start break IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to start break",
      };
    }
  });

  ipcMain.handle("timeTracking:endBreak", async (event, breakId) => {
    try {
      const db = await getDatabase();
      const breakRecord = await db.timeTracking.endBreak(breakId);
      return {
        success: true,
        break: breakRecord,
      };
    } catch (error) {
      logger.error("End break IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to end break",
      };
    }
  });
}
