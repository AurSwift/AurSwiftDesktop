import type { ClockEvent, Shift, Break, TimeCorrection } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import {
  eq,
  and,
  desc,
  gte,
  lte,
  isNull,
  sql as drizzleSql,
} from "drizzle-orm";
import * as schema from "../schema.js";
import { getLogger } from "../../utils/logger.js";
import { shiftDataValidator } from "../../utils/shiftDataValidator.js";
import { breakComplianceValidator } from "../../utils/breakComplianceValidator.js";
import { getDatabase } from "../index.js";

const logger = getLogger("timeTrackingManager");

export class TimeTrackingManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  // ============= Clock Events =============

  /**
   * Create a clock-in or clock-out event
   */
  async createClockEvent(data: {
    userId: string;
    businessId: string;
    terminalId: string;
    locationId?: string;
    scheduleId?: string;
    type: "in" | "out";
    method?: "login" | "manual" | "auto" | "manager";
    geolocation?: string;
    ipAddress?: string;
    notes?: string;
    auditManager?: any; // Optional audit manager for logging
  }): Promise<ClockEvent> {
    const eventId = this.uuid.v4();
    const now = new Date();

    // Validate terminal exists, or get/create a default terminal for the business
    let validTerminalId = data.terminalId;
    const [existingTerminal] = this.db
      .select({ id: schema.terminals.id })
      .from(schema.terminals)
      .where(eq(schema.terminals.id, data.terminalId))
      .limit(1)
      .all();

    if (!existingTerminal) {
      // Terminal doesn't exist - try to find any terminal for this business
      const [businessTerminal] = this.db
        .select({ id: schema.terminals.id })
        .from(schema.terminals)
        .where(eq(schema.terminals.business_id, data.businessId))
        .limit(1)
        .all();

      if (businessTerminal) {
        validTerminalId = businessTerminal.id;
        logger.warn(
          `[createClockEvent] Terminal ${data.terminalId} does not exist, using business terminal ${validTerminalId}`
        );
      } else {
        // No terminals exist for this business - create a default one
        const defaultTerminalId = this.uuid.v4();
        this.db
          .insert(schema.terminals)
          .values({
            id: defaultTerminalId,
            business_id: data.businessId,
            name: "Default Terminal",
            type: "pos",
            status: "active",
            createdAt: now,
            updatedAt: now,
          })
          .run();
        validTerminalId = defaultTerminalId;
        logger.info(
          `[createClockEvent] Created default terminal ${validTerminalId} for business ${data.businessId}`
        );
      }
    }

    const clockEvent = {
      id: eventId,
      user_id: data.userId,
      business_id: data.businessId, // ✅ REQUIRED: business_id is NOT NULL
      terminal_id: validTerminalId,
      location_id: data.locationId ?? null,
      schedule_id: data.scheduleId ?? null, // ✅ NEW: Link to schedule
      type: data.type,
      timestamp: now, // Use Date object for timestamp_ms mode
      method: data.method || "manual",
      status: "confirmed" as const,
      geolocation: data.geolocation ?? null,
      ip_address: data.ipAddress ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    // Validate clock event data
    const validation = shiftDataValidator.validateClockEvent(clockEvent);
    if (!validation.valid) {
      logger.warn(
        `[createClockEvent] Clock event validation warnings: ${validation.warnings.join(
          ", "
        )}`
      );
    }

    this.db.insert(schema.clockEvents).values(clockEvent).run();

    // Retrieve the created event to return proper ClockEvent type
    const [created] = this.db
      .select()
      .from(schema.clockEvents)
      .where(eq(schema.clockEvents.id, eventId))
      .limit(1)
      .all();

    // Audit log clock event
    if (data.auditManager) {
      try {
        await data.auditManager.logClockEvent(
          data.type === "in" ? "clock_in" : "clock_out",
          created as ClockEvent,
          data.userId,
          data.terminalId,
          data.ipAddress,
          {
            scheduleId: data.scheduleId,
            method: data.method || "manual",
          }
        );
      } catch (error) {
        logger.error("[createClockEvent] Failed to audit log:", error);
      }
    }

    return created as ClockEvent;
  }

  /**
   * Get clock event by ID
   */
  getClockEventById(eventId: string): ClockEvent | undefined {
    const [event] = this.db
      .select()
      .from(schema.clockEvents)
      .where(eq(schema.clockEvents.id, eventId))
      .limit(1)
      .all();

    return event as ClockEvent | undefined;
  }

  /**
   * Get all clock events for a user
   */
  getClockEventsByUser(userId: string, limit: number = 50): ClockEvent[] {
    return this.db
      .select()
      .from(schema.clockEvents)
      .where(eq(schema.clockEvents.user_id, userId))
      .orderBy(desc(schema.clockEvents.timestamp))
      .limit(limit)
      .all() as ClockEvent[];
  }

  /**
   * Get active clock-in event (no corresponding clock-out in active shift)
   */
  getActiveClockIn(userId: string): ClockEvent | undefined {
    const results = this.db
      .select({
        clockEvent: schema.clockEvents,
      })
      .from(schema.clockEvents)
      .leftJoin(
        schema.shifts,
        eq(schema.shifts.clock_in_id, schema.clockEvents.id)
      )
      .where(
        and(
          eq(schema.clockEvents.user_id, userId),
          eq(schema.clockEvents.type, "in"),
          drizzleSql`(${schema.shifts.clock_out_id} IS NULL OR ${schema.shifts.status} = 'active')`
        )
      )
      .orderBy(desc(schema.clockEvents.timestamp))
      .limit(1)
      .all();

    return results[0]?.clockEvent as ClockEvent | undefined;
  }

  // ============= Time Shifts =============

  /**
   * Create a new shift
   */
  async createShift(data: {
    userId: string;
    businessId: string;
    clockInId: string;
    scheduleId?: string;
    notes?: string;
  }): Promise<Shift> {
    const shiftId = this.uuid.v4();

    this.db
      .insert(schema.shifts)
      .values({
        id: shiftId,
        user_id: data.userId,
        business_id: data.businessId,
        clock_in_id: data.clockInId,
        clock_out_id: null,
        schedule_id: data.scheduleId || null,
        status: "active",
        total_hours: null,
        regular_hours: null,
        overtime_hours: null,
        break_duration_seconds: 0, // Initialize to 0, will be calculated on shift completion
        notes: data.notes || null,
      })
      .run();

    // Retrieve the created shift to return proper Shift type
    const [created] = this.db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, shiftId))
      .limit(1)
      .all();

    return created as Shift;
  }

  /**
   * Complete a shift by adding clock-out event
   */
  async completeShift(shiftId: string, clockOutId: string): Promise<Shift> {
    const shift = this.getShiftById(shiftId);
    if (!shift) {
      throw new Error("Shift not found");
    }

    const clockIn = this.getClockEventById(shift.clock_in_id);
    const clockOut = this.getClockEventById(clockOutId);

    if (!clockIn || !clockOut) {
      throw new Error("Clock events not found");
    }

    // Calculate total hours
    const startTime = new Date(clockIn.timestamp).getTime();
    const endTime = new Date(clockOut.timestamp).getTime();
    const totalMinutes = (endTime - startTime) / (1000 * 60);

    // Check for active breaks before completing shift
    const activeBreak = this.getActiveBreak(shiftId);
    if (activeBreak) {
      throw new Error(
        "Cannot clock out: active break in progress. Please end break first."
      );
    }

    // Get total break duration (in seconds)
    const breaks = this.getBreaksByShift(shiftId);
    // Sum all completed breaks' duration_seconds
    const breakSeconds = breaks
      .filter((b) => b.status === "completed" && b.duration_seconds)
      .reduce((sum, b) => sum + (b.duration_seconds || 0), 0);
    const breakMinutes = breakSeconds / 60;

    // Calculate working hours (excluding breaks)
    const workingMinutes = totalMinutes - breakMinutes;
    const totalHours = workingMinutes / 60;

    // Calculate regular and overtime hours (assuming 8 hour standard)
    const regularHours = Math.min(totalHours, 8);
    const overtimeHours = Math.max(0, totalHours - 8);

    const updatedShift = {
      clock_out_id: clockOutId,
      status: "ended" as const,
      total_hours: totalHours,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      break_duration_seconds: breakSeconds,
    };

    // Validate shift status transition
    const statusValidation = shiftDataValidator.validateShiftStatusTransition(
      shift.status,
      "ended"
    );
    if (!statusValidation.valid) {
      throw new Error(
        `Invalid shift status transition: ${statusValidation.errors.join(", ")}`
      );
    }

    // Validate break duration matches sum of breaks
    const breakDurationValidation =
      shiftDataValidator.validateShiftBreakDuration(
        { ...shift, ...updatedShift } as Shift,
        breaks
      );
    if (breakDurationValidation.warnings.length > 0) {
      logger.warn(
        `[completeShift] Break duration validation warnings: ${breakDurationValidation.warnings.join(
          ", "
        )}`
      );
    }

    this.db
      .update(schema.shifts)
      .set(updatedShift)
      .where(eq(schema.shifts.id, shiftId))
      .run();

    const completedShift = this.getShiftById(shiftId)!;

    // Audit log shift completion
    try {
      const dbInstance = await getDatabase();
      await dbInstance.audit.createAuditLog({
        action: "shift_completed",
        entityType: "shift",
        entityId: shiftId,
        userId: shift.user_id,
        details: {
          totalHours,
          regularHours,
          overtimeHours,
          breakDurationSeconds: breakSeconds,
          breakCount: breaks.filter((b) => b.status === "completed").length,
        },
      });
    } catch (error) {
      logger.error("[completeShift] Failed to audit log:", error);
    }

    return completedShift;
  }

  /**
   * Get shift by ID
   */
  getShiftById(shiftId: string): Shift | undefined {
    const [shift] = this.db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, shiftId))
      .limit(1)
      .all();

    return shift as Shift | undefined;
  }

  /**
   * Get active shift for user
   */
  getActiveShift(userId: string): Shift | undefined {
    const [shift] = this.db
      .select()
      .from(schema.shifts)
      .where(
        and(
          eq(schema.shifts.user_id, userId),
          eq(schema.shifts.status, "active")
        )
      )
      .orderBy(desc(schema.shifts.createdAt))
      .limit(1)
      .all();

    return shift as Shift | undefined;
  }

  /**
   * Get all shifts for a user
   */
  getShiftsByUser(userId: string, limit: number = 50): Shift[] {
    return this.db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.user_id, userId))
      .orderBy(desc(schema.shifts.createdAt))
      .limit(limit)
      .all() as Shift[];
  }

  /**
   * Get shifts by business within date range
   */
  getShiftsByBusinessAndDateRange(
    businessId: string,
    startDate: string,
    endDate: string
  ): Shift[] {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const results = this.db
      .select({
        shift: schema.shifts,
      })
      .from(schema.shifts)
      .innerJoin(
        schema.clockEvents,
        eq(schema.shifts.clock_in_id, schema.clockEvents.id)
      )
      .where(
        and(
          eq(schema.shifts.business_id, businessId),
          gte(schema.clockEvents.timestamp, startDateObj),
          lte(schema.clockEvents.timestamp, endDateObj)
        )
      )
      .orderBy(desc(schema.clockEvents.timestamp))
      .all();

    return results.map((r) => r.shift) as Shift[];
  }

  // ============= Breaks =============

  /**
   * Start a break
   */
  async startBreak(data: {
    shiftId: string;
    userId: string;
    businessId: string; // Required for breaks table
    type?: "meal" | "rest" | "other";
    isPaid?: boolean;
    notes?: string;
  }): Promise<Break> {
    const breakId = this.uuid.v4();
    const now = new Date();

    // Verify shift exists and is active
    const shift = this.getShiftById(data.shiftId);
    if (!shift) {
      throw new Error("Shift not found");
    }

    // Validate shift belongs to user
    if (shift.user_id !== data.userId) {
      throw new Error("Cannot start break: Shift does not belong to this user");
    }

    // Validate shift is active
    if (shift.status !== "active") {
      throw new Error("Cannot start break: shift is not active");
    }

    // Check if there's already an active break
    const activeBreak = this.getActiveBreak(data.shiftId);
    if (activeBreak) {
      throw new Error("There is already an active break for this shift");
    }

    // Validate against break policy - check if allowed count exceeded
    const db = await getDatabase();
    const clockInEvent = shift.clock_in_id
      ? this.getClockEventById(shift.clock_in_id)
      : undefined;
    const shiftStartDate =
      clockInEvent?.timestamp instanceof Date
        ? clockInEvent.timestamp
        : typeof clockInEvent?.timestamp === "number"
          ? new Date(clockInEvent.timestamp)
          : clockInEvent?.timestamp
            ? new Date(clockInEvent.timestamp as any)
            : new Date();
    const availableBreaks = await db.breakPolicy.getAvailableBreaksForShift(
      data.businessId,
      data.shiftId,
      shiftStartDate
    );

    const breakType = data.type || "rest";
    const matchingBreakOption = availableBreaks.find(
      (opt) => opt.breakType.code === breakType
    );

    if (matchingBreakOption) {
      // Check if this break type is allowed (has remaining count)
      if (matchingBreakOption.remainingCount <= 0) {
        throw new Error(
          `Break limit reached: You have already taken the maximum allowed ${matchingBreakOption.breakType.name} breaks (${matchingBreakOption.rule.allowed_count}) for this shift`
        );
      }

      // Check if currently allowed (time window, hours worked, etc.)
      if (!matchingBreakOption.isAllowed && matchingBreakOption.reason) {
        logger.warn(
          `[startBreak] Break not currently allowed: ${matchingBreakOption.reason}`
        );
        // We allow this with a warning - manager can override timing rules
      }

      // Use the paid status from the break type definition
      data.isPaid = matchingBreakOption.breakType.is_paid;
    } else {
      logger.warn(
        `[startBreak] No policy rule found for break type '${breakType}', using provided isPaid value`
      );
    }

    // Check break compliance requirements
    const compliance = await breakComplianceValidator.validateBreakStart(
      shift as any,
      data.type || "rest",
      db
    );

    // Log warnings but don't block break
    if (compliance.warnings.length > 0) {
      logger.warn(
        `[startBreak] Break compliance warnings for shift ${
          data.shiftId
        }: ${compliance.warnings.join(", ")}`
      );
    }

    // Determine if break is required and minimum duration
    const breakRequirement =
      await breakComplianceValidator.checkBreakRequirement(shift as any, db);

    const breakRecord = {
      id: breakId,
      shift_id: data.shiftId,
      user_id: data.userId,
      business_id: data.businessId,
      type: data.type || "rest",
      start_time: now,
      end_time: null,
      duration_seconds: null,
      is_paid: data.isPaid || false,
      status: "active" as const,
      is_required: breakRequirement.requiresBreak,
      required_reason: breakRequirement.requiresBreak
        ? breakRequirement.reason
        : null,
      minimum_duration_seconds: breakRequirement.minimumDurationSeconds,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    // Validate break data before inserting
    const validation = shiftDataValidator.validateBreak(breakRecord as Break);
    if (!validation.valid) {
      throw new Error(
        `Break validation failed: ${validation.errors.join(", ")}`
      );
    }
    if (validation.warnings.length > 0) {
      logger.warn(
        `[startBreak] Break validation warnings: ${validation.warnings.join(
          ", "
        )}`
      );
    }

    this.db.insert(schema.breaks).values(breakRecord).run();

    // Retrieve the created break
    const [created] = this.db
      .select()
      .from(schema.breaks)
      .where(eq(schema.breaks.id, breakId))
      .limit(1)
      .all();

    // Audit log break start
    try {
      await db.audit.createAuditLog({
        action: "break_started",
        entityType: "break",
        entityId: breakId,
        userId: data.userId,
        details: {
          shiftId: data.shiftId,
          breakType: data.type || "rest",
          isRequired: breakRequirement.requiresBreak,
          requiredReason: breakRequirement.reason,
          minimumDurationSeconds: breakRequirement.minimumDurationSeconds,
          complianceWarnings: compliance.warnings,
        },
      });
    } catch (error) {
      logger.error("[startBreak] Failed to audit log:", error);
    }

    return created as Break;
  }

  /**
   * End a break
   */
  async endBreak(breakId: string): Promise<Break> {
    const breakRecord = this.getBreakById(breakId);
    if (!breakRecord) {
      throw new Error("Break not found");
    }

    if (breakRecord.status !== "active") {
      throw new Error("Break is not active");
    }

    // Get shift for compliance validation
    const shift = this.getShiftById(breakRecord.shift_id);
    if (!shift) {
      throw new Error("Shift not found for break");
    }

    const now = new Date();
    // Handle both Date and number (timestamp_ms) formats
    const startTimeMs =
      typeof breakRecord.start_time === "number"
        ? breakRecord.start_time
        : breakRecord.start_time instanceof Date
        ? breakRecord.start_time.getTime()
        : new Date(breakRecord.start_time as string).getTime();
    const endTimeMs = now.getTime();
    const duration_seconds = Math.floor((endTimeMs - startTimeMs) / 1000); // Duration in seconds

    // Get database managers for compliance validation
    const db = await getDatabase();

    // Validate break compliance
    const compliance = await breakComplianceValidator.validateBreakEnd(
      breakRecord,
      shift as any,
      db
    );

    // Log violations and warnings
    if (compliance.violations.length > 0) {
      logger.warn(
        `[endBreak] Break compliance violations for break ${breakId}: ${compliance.violations.join(
          ", "
        )}`
      );
    }
    if (compliance.warnings.length > 0) {
      logger.info(
        `[endBreak] Break compliance warnings for break ${breakId}: ${compliance.warnings.join(
          ", "
        )}`
      );
    }

    // Determine if break was too short
    const isShort =
      breakRecord.is_required &&
      breakRecord.minimum_duration_seconds &&
      duration_seconds < breakRecord.minimum_duration_seconds;

    const updatedBreak = {
      end_time: now,
      duration_seconds,
      status: "completed" as const,
      is_short: isShort ? true : isShort === false ? false : null,
    };

    // Validate updated break data
    const updatedBreakRecord = {
      ...breakRecord,
      ...updatedBreak,
    } as Break;
    const validation = shiftDataValidator.validateBreak(updatedBreakRecord);
    if (!validation.valid) {
      throw new Error(
        `Break validation failed: ${validation.errors.join(", ")}`
      );
    }
    if (validation.warnings.length > 0) {
      logger.warn(
        `[endBreak] Break validation warnings: ${validation.warnings.join(
          ", "
        )}`
      );
    }

    this.db
      .update(schema.breaks)
      .set(updatedBreak)
      .where(eq(schema.breaks.id, breakId))
      .run();

    const finalBreak = this.getBreakById(breakId)!;

    // Audit log break end
    try {
      const db = await getDatabase();
      await db.audit.createAuditLog({
        action: "break_ended",
        entityType: "break",
        entityId: breakId,
        userId: breakRecord.user_id,
        details: {
          shiftId: breakRecord.shift_id,
          breakType: breakRecord.type,
          durationSeconds: duration_seconds,
          isShort,
          complianceViolations: compliance.violations,
          complianceWarnings: compliance.warnings,
        },
      });
    } catch (error) {
      logger.error("[endBreak] Failed to audit log:", error);
    }

    return finalBreak;
  }

  /**
   * Update an existing break (manager override).
   *
   * This is intended for manager/admin corrections and should always be paired
   * with an audit log entry at the IPC layer (include reason + managerId).
   */
  async updateBreakByManager(data: {
    breakId: string;
    startTime?: string; // ISO
    endTime?: string | null; // ISO or null (null not allowed for completed breaks)
    type?: "meal" | "rest" | "other";
    isPaid?: boolean;
    notes?: string | null;
  }): Promise<Break> {
    const breakRecord = this.getBreakById(data.breakId);
    if (!breakRecord) {
      throw new Error("Break not found");
    }

    const shift = this.getShiftById(breakRecord.shift_id);
    if (!shift) {
      throw new Error("Shift not found for break");
    }

    // Normalize inputs (accept only ISO strings)
    const nextStart =
      typeof data.startTime === "string"
        ? new Date(data.startTime)
        : typeof breakRecord.start_time === "number"
        ? new Date(breakRecord.start_time)
        : breakRecord.start_time instanceof Date
        ? breakRecord.start_time
        : new Date(breakRecord.start_time as string);

    const nextEnd =
      data.endTime === null
        ? null
        : typeof data.endTime === "string"
        ? new Date(data.endTime)
        : breakRecord.end_time
        ? breakRecord.end_time instanceof Date
          ? breakRecord.end_time
          : new Date(breakRecord.end_time as string)
        : null;

    if (isNaN(nextStart.getTime())) {
      throw new Error("Invalid break start time");
    }
    if (nextEnd && isNaN(nextEnd.getTime())) {
      throw new Error("Invalid break end time");
    }
    if (nextEnd && nextEnd.getTime() < nextStart.getTime()) {
      throw new Error("Break end time cannot be before start time");
    }

    // If break is completed, don't allow reopening via manager edit (safety).
    if (breakRecord.status === "completed" && data.endTime === null) {
      throw new Error("Cannot reopen a completed break");
    }

    const durationSeconds =
      nextEnd && nextStart
        ? Math.floor((nextEnd.getTime() - nextStart.getTime()) / 1000)
        : null;

    const isShort =
      breakRecord.is_required &&
      breakRecord.minimum_duration_seconds &&
      typeof durationSeconds === "number" &&
      durationSeconds < breakRecord.minimum_duration_seconds;

    const nextStatus: Break["status"] =
      nextEnd || breakRecord.status === "completed" ? "completed" : "active";

    const updatedBreakRecord = {
      ...breakRecord,
      start_time: nextStart,
      end_time: nextEnd,
      duration_seconds: durationSeconds,
      status: nextStatus,
      type: (data.type ?? breakRecord.type) as Break["type"],
      is_paid:
        typeof data.isPaid === "boolean" ? data.isPaid : breakRecord.is_paid,
      notes:
        typeof data.notes === "string" || data.notes === null
          ? data.notes
          : (breakRecord as any).notes ?? null,
      is_short: isShort ? true : isShort === false ? false : null,
      updatedAt: new Date(),
    } as Break;

    const validation = shiftDataValidator.validateBreak(updatedBreakRecord);
    if (!validation.valid) {
      throw new Error(
        `Break validation failed: ${validation.errors.join(", ")}`
      );
    }
    if (validation.warnings.length > 0) {
      logger.warn(
        `[updateBreakByManager] Break validation warnings: ${validation.warnings.join(
          ", "
        )}`
      );
    }

    // Re-run compliance validation when break becomes completed (best-effort; log-only)
    if (updatedBreakRecord.end_time) {
      try {
        const dbManagers = await getDatabase();
        const compliance = await breakComplianceValidator.validateBreakEnd(
          updatedBreakRecord,
          shift as any,
          dbManagers
        );
        if (compliance.violations.length > 0) {
          logger.warn(
            `[updateBreakByManager] Compliance violations: ${compliance.violations.join(
              ", "
            )}`
          );
        }
        if (compliance.warnings.length > 0) {
          logger.info(
            `[updateBreakByManager] Compliance warnings: ${compliance.warnings.join(
              ", "
            )}`
          );
        }
      } catch (error) {
        logger.warn(
          "[updateBreakByManager] Failed compliance validation (non-blocking):",
          error
        );
      }
    }

    // Persist break update
    this.db
      .update(schema.breaks)
      .set({
        start_time: nextStart,
        end_time: nextEnd,
        duration_seconds: durationSeconds,
        status: nextStatus,
        type: updatedBreakRecord.type,
        is_paid: updatedBreakRecord.is_paid,
        notes: (updatedBreakRecord as any).notes ?? null,
        is_short: (updatedBreakRecord as any).is_short ?? null,
        updatedAt: new Date(),
      } as any)
      .where(eq(schema.breaks.id, data.breakId))
      .run();

    // If shift is ended, keep cached break_duration_seconds in sync (best-effort)
    try {
      const breaks = this.getBreaksByShift(shift.id);
      const totalBreakSeconds = breaks
        .filter((b) => b.status === "completed" && b.duration_seconds)
        .reduce((sum, b) => sum + (b.duration_seconds || 0), 0);

      this.db
        .update(schema.shifts)
        .set({
          break_duration_seconds: totalBreakSeconds,
        } as any)
        .where(eq(schema.shifts.id, shift.id))
        .run();
    } catch (error) {
      logger.warn(
        `[updateBreakByManager] Failed to update shift break_duration_seconds:`,
        error
      );
    }

    return this.getBreakById(data.breakId)!;
  }

  /**
   * Get break by ID
   */
  getBreakById(breakId: string): Break | undefined {
    const [result] = this.db
      .select()
      .from(schema.breaks)
      .where(eq(schema.breaks.id, breakId))
      .limit(1)
      .all();

    if (!result) return undefined;

    return {
      ...result,
      is_paid: Boolean(result.is_paid),
    } as Break;
  }

  /**
   * Get active break for a shift
   */
  getActiveBreak(shiftId: string): Break | undefined {
    const [result] = this.db
      .select()
      .from(schema.breaks)
      .where(
        and(
          eq(schema.breaks.shift_id, shiftId),
          eq(schema.breaks.status, "active")
        )
      )
      .limit(1)
      .all();

    if (!result) return undefined;

    return {
      ...result,
      is_paid: Boolean(result.is_paid),
    } as Break;
  }

  /**
   * Get all breaks for a shift
   */
  getBreaksByShift(shiftId: string): Break[] {
    const results = this.db
      .select()
      .from(schema.breaks)
      .where(eq(schema.breaks.shift_id, shiftId))
      .orderBy(schema.breaks.start_time)
      .all();

    return results.map((result) => ({
      ...result,
      is_paid: Boolean(result.is_paid),
    })) as Break[];
  }

  /**
   * Get all breaks for a user
   */
  getBreaksByUser(userId: string, limit: number = 50): Break[] {
    const results = this.db
      .select()
      .from(schema.breaks)
      .where(eq(schema.breaks.user_id, userId))
      .orderBy(desc(schema.breaks.start_time))
      .limit(limit)
      .all();

    return results.map((result) => ({
      ...result,
      is_paid: Boolean(result.is_paid),
    })) as Break[];
  }

  // ============= Time Corrections =============

  /**
   * Request a time correction
   */
  async requestTimeCorrection(data: {
    userId: string;
    businessId: string;
    clockEventId?: string;
    shiftId?: string;
    correctionType: "clock_time" | "break_time" | "manual_entry";
    originalTime?: string;
    correctedTime: string;
    reason: string;
    requestedBy: string;
  }): Promise<TimeCorrection> {
    const correctionId = this.uuid.v4();

    // Calculate time difference in seconds
    let timeDifferenceSeconds = 0;
    if (data.originalTime) {
      const original = new Date(data.originalTime).getTime();
      const corrected = new Date(data.correctedTime).getTime();
      timeDifferenceSeconds = Math.floor((corrected - original) / 1000);
    }

    this.db
      .insert(schema.timeCorrections)
      .values({
        id: correctionId,
        user_id: data.userId,
        business_id: data.businessId,
        clock_event_id: data.clockEventId ?? null,
        shift_id: data.shiftId ?? null,
        correction_type: data.correctionType,
        original_time: data.originalTime ? new Date(data.originalTime) : null,
        corrected_time: new Date(data.correctedTime),
        time_difference_seconds: timeDifferenceSeconds,
        reason: data.reason,
        requested_by: data.requestedBy,
        approved_by: null,
        status: "pending",
      })
      .run();

    // Retrieve the created correction
    const [created] = this.db
      .select()
      .from(schema.timeCorrections)
      .where(eq(schema.timeCorrections.id, correctionId))
      .limit(1)
      .all();

    return created as TimeCorrection;
  }

  /**
   * Approve or reject a time correction
   */
  async processTimeCorrection(
    correctionId: string,
    approvedBy: string,
    approved: boolean
  ): Promise<TimeCorrection> {
    const correction = this.getTimeCorrectionById(correctionId);
    if (!correction) {
      throw new Error("Time correction not found");
    }

    if (correction.status !== "pending") {
      throw new Error("Time correction has already been processed");
    }

    const status = approved ? "approved" : "rejected";

    this.db
      .update(schema.timeCorrections)
      .set({
        status,
        approved_by: approvedBy,
      })
      .where(eq(schema.timeCorrections.id, correctionId))
      .run();

    // If approved, apply the correction
    if (approved && correction.clock_event_id) {
      this.db
        .update(schema.clockEvents)
        .set({
          timestamp: correction.corrected_time,
        })
        .where(eq(schema.clockEvents.id, correction.clock_event_id))
        .run();
    }

    return this.getTimeCorrectionById(correctionId)!;
  }

  /**
   * Get time correction by ID
   */
  getTimeCorrectionById(correctionId: string): TimeCorrection | undefined {
    const [correction] = this.db
      .select()
      .from(schema.timeCorrections)
      .where(eq(schema.timeCorrections.id, correctionId))
      .limit(1)
      .all();

    return correction as TimeCorrection | undefined;
  }

  /**
   * Get pending time corrections for a business
   */
  getPendingTimeCorrections(businessId: string): TimeCorrection[] {
    const results = this.db
      .select({
        correction: schema.timeCorrections,
      })
      .from(schema.timeCorrections)
      .innerJoin(
        schema.users,
        eq(schema.timeCorrections.user_id, schema.users.id)
      )
      .where(
        and(
          eq(schema.users.businessId, businessId),
          eq(schema.timeCorrections.status, "pending")
        )
      )
      .orderBy(desc(schema.timeCorrections.createdAt))
      .all();

    return results.map((r) => r.correction) as TimeCorrection[];
  }

  /**
   * Get time corrections by user
   */
  getTimeCorrectionsByUser(
    userId: string,
    limit: number = 50
  ): TimeCorrection[] {
    return this.db
      .select()
      .from(schema.timeCorrections)
      .where(eq(schema.timeCorrections.user_id, userId))
      .orderBy(desc(schema.timeCorrections.createdAt))
      .limit(limit)
      .all() as TimeCorrection[];
  }

  // ============= Fraud Detection & Validation =============

  /**
   * Validate a clock event for potential fraud
   */
  async validateClockEvent(clockEvent: ClockEvent): Promise<any> {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Check for multiple clock-ins without clock-out
    const activeShift = this.getActiveShift(clockEvent.user_id);
    if (clockEvent.type === "in" && activeShift) {
      violations.push("User already has an active shift without clock-out");
    }

    // Check for clock-out without clock-in
    if (clockEvent.type === "out" && !activeShift) {
      violations.push("No active shift found for clock-out");
    }

    // Check for rapid clock events (potential buddy punching)
    const thirtySecondsAgo = new Date(
      new Date(clockEvent.timestamp).getTime() - 30000
    );

    const recentEvents = this.db
      .select()
      .from(schema.clockEvents)
      .where(
        and(
          eq(schema.clockEvents.terminal_id, clockEvent.terminal_id),
          gte(schema.clockEvents.timestamp, thirtySecondsAgo),
          drizzleSql`${schema.clockEvents.user_id} != ${clockEvent.user_id}`
        )
      )
      .all();

    if (recentEvents.length > 0) {
      warnings.push(
        "Multiple users clocking in/out from same terminal within 30 seconds"
      );
    }

    // Check for unusual hours (e.g., late night clock-ins)
    const clockHour = new Date(clockEvent.timestamp).getHours();
    if (clockHour < 5 || clockHour > 23) {
      warnings.push(`Clock event at unusual hour: ${clockHour}:00`);
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
      requiresReview: violations.length > 0 || warnings.length > 0,
    };
  }

  /**
   * Check for grace period and tardiness
   */
  calculateTardiness(
    scheduledTime: string,
    actualTime: string
  ): {
    status: "on_time" | "grace_period" | "late";
    minutes: number;
  } {
    const scheduled = new Date(scheduledTime).getTime();
    const actual = new Date(actualTime).getTime();
    const differenceMs = actual - scheduled;
    const minutes = Math.floor(differenceMs / (1000 * 60));

    const gracePeriodMinutes = 7;

    if (minutes <= 0) {
      return { status: "on_time", minutes: 0 };
    } else if (minutes <= gracePeriodMinutes) {
      return { status: "grace_period", minutes };
    } else {
      return { status: "late", minutes };
    }
  }

  /**
   * Force clock-out by manager
   */
  async forceClockOut(
    userId: string,
    managerId: string,
    reason: string
  ): Promise<{ clockEvent: ClockEvent; shift: Shift }> {
    const activeShift = this.getActiveShift(userId);
    if (!activeShift) {
      throw new Error("No active shift found for user");
    }

    // End any active break before clocking out (match regular clock-out behavior)
    const activeBreak = this.getActiveBreak(activeShift.id);
    if (activeBreak) {
      await this.endBreak(activeBreak.id);
    }

    // Create clock-out event with manager method
    const clockOutEvent = await this.createClockEvent({
      userId,
      businessId: activeShift.business_id, // ✅ REQUIRED: Get from shift
      terminalId: "manager_override",
      type: "out",
      method: "manager",
      notes: `Forced clock-out by manager. Reason: ${reason}`,
    });

    // Complete the shift
    const completedShift = await this.completeShift(
      activeShift.id,
      clockOutEvent.id
    );

    return {
      clockEvent: clockOutEvent,
      shift: completedShift,
    };
  }
}
