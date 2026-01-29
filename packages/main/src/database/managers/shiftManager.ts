import type { Shift } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("shiftManager");

export class ShiftManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Validate that a shift belongs to a specific user (cashier)
   * Prevents cashiers from creating transactions on other users' shifts
   *
   * @param shiftId - ID of the shift to validate
   * @param userId - ID of the user (should be shift owner)
   * @returns true if shift belongs to user, false otherwise
   */
  validateShiftOwnership(shiftId: string, userId: string): boolean {
    try {
      const shift = this.getShiftById(shiftId);
      // Use user_id from schema (snake_case)
      return shift.user_id === userId;
    } catch (error) {
      logger.error("Error validating shift ownership:", error);
      return false;
    }
  }

  /**
   * Create shift with transaction support for atomicity
   * Note: Shifts require a clock_in_id (clock event) to be created first
   * This method expects the shift data to match the schema (snake_case)
   */
  createShift(shiftData: {
    user_id: string;
    business_id: string;
    clock_in_id: string;
    schedule_id?: string | null;
    terminal_id?: string | null;
    starting_cash?: number | null;
    status?: "active" | "ended" | "pending_review";
    clock_out_id?: string | null;
    notes?: string | null;
  }): Shift {
    const shiftId = this.uuid.v4();
    const now = new Date();

    // Validate data before creating shift
    if (!shiftData.user_id) {
      throw new Error("User ID is required");
    }
    if (!shiftData.business_id) {
      throw new Error("Business ID is required");
    }
    if (!shiftData.clock_in_id) {
      throw new Error("Clock in ID is required");
    }
    if (
      shiftData.starting_cash !== undefined &&
      shiftData.starting_cash !== null
    ) {
      if (shiftData.starting_cash < 0) {
        throw new Error("Starting cash cannot be negative");
      }
      if (shiftData.starting_cash > 100000) {
        throw new Error("Starting cash exceeds maximum limit");
      }
    }

    // Use transaction to ensure atomicity
    const result = this.db.transaction((tx) => {
      tx.insert(schema.shifts)
        .values({
          id: shiftId,
          user_id: shiftData.user_id,
          business_id: shiftData.business_id,
          clock_in_id: shiftData.clock_in_id,
          clock_out_id: shiftData.clock_out_id ?? null,
          schedule_id: shiftData.schedule_id ?? null,
          terminal_id: shiftData.terminal_id ?? null,
          status: shiftData.status ?? "active",
          starting_cash: shiftData.starting_cash ?? null,
          total_sales: 0,
          total_transactions: 0,
          total_refunds: 0,
          total_voids: 0,
          notes: shiftData.notes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      return shiftId;
    });

    return this.getShiftById(result);
  }

  /**
   * Get shift by ID
   */
  getShiftById(id: string): Shift {
    const shifts = this.db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, id))
      .limit(1)
      .all();

    if (!shifts || shifts.length === 0) {
      throw new Error("Shift not found");
    }

    return shifts[0] as Shift;
  }

  /**
   * Get shifts by business
   */
  getShiftsByBusiness(businessId: string): Shift[] {
    return this.db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.business_id, businessId))
      .orderBy(desc(schema.shifts.createdAt))
      .all() as Shift[];
  }

  /**
   * Get active shift for cashier
   */
  getActiveShift(cashierId: string): Shift | null {
    const shifts = this.db
      .select()
      .from(schema.shifts)
      .where(
        and(
          eq(schema.shifts.user_id, cashierId),
          eq(schema.shifts.status, "active"),
        ),
      )
      .orderBy(desc(schema.shifts.createdAt))
      .limit(1)
      .all();

    return shifts.length > 0 ? (shifts[0] as Shift) : null;
  }

  /**
   * Get all shifts for a specific schedule
   * Used to track how many shift segments have been created for one scheduled day
   */
  getShiftsByScheduleId(scheduleId: string): Shift[] {
    if (!scheduleId) {
      return [];
    }

    return this.db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.schedule_id, scheduleId))
      .orderBy(desc(schema.shifts.createdAt))
      .all() as Shift[];
  }

  /**
   * Get active shifts by shift ID (shifts table is the unified time shift table)
   */
  getActiveShiftsByTimeShift(timeShiftId: string): Shift[] {
    if (!timeShiftId) {
      return [];
    }

    return this.db
      .select()
      .from(schema.shifts)
      .where(
        and(
          eq(schema.shifts.id, timeShiftId),
          eq(schema.shifts.status, "active"),
        ),
      )
      .orderBy(desc(schema.shifts.createdAt))
      .all() as Shift[];
  }

  /**
   * End shift with final calculations
   * Note: clock_out_id should be set separately via time tracking manager
   */
  endShift(
    shiftId: string,
    endData: {
      clock_out_id?: string;
      total_sales?: number;
      total_transactions?: number;
      total_refunds?: number;
      total_voids?: number;
      notes?: string;
    },
  ): void {
    const now = new Date();

    this.db
      .update(schema.shifts)
      .set({
        clock_out_id: endData.clock_out_id ?? undefined,
        status: "ended",
        total_sales: endData.total_sales ?? undefined,
        total_transactions: endData.total_transactions ?? undefined,
        total_refunds: endData.total_refunds ?? undefined,
        total_voids: endData.total_voids ?? undefined,
        notes: endData.notes ?? null,
        updatedAt: now,
      })
      .where(eq(schema.shifts.id, shiftId))
      .run();
  }

  /**
   * Get active shift for today (considering night shifts from 6 AM yesterday)
   */
  getTodaysActiveShift(cashierId: string): Shift | null {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(6, 0, 0, 0);

    // Get shifts with clock events to filter by start time
    const shifts = this.db
      .select({
        shift: schema.shifts,
        clockInTimestamp: schema.clockEvents.timestamp,
      })
      .from(schema.shifts)
      .leftJoin(
        schema.clockEvents,
        eq(schema.shifts.clock_in_id, schema.clockEvents.id),
      )
      .where(
        and(
          eq(schema.shifts.user_id, cashierId),
          eq(schema.shifts.status, "active"),
        ),
      )
      .orderBy(desc(schema.shifts.createdAt))
      .all()
      .filter((item) => {
        if (!item.clockInTimestamp) return false;
        const clockInMs =
          typeof item.clockInTimestamp === "number"
            ? item.clockInTimestamp
            : item.clockInTimestamp instanceof Date
              ? item.clockInTimestamp.getTime()
              : new Date(item.clockInTimestamp as string).getTime();
        return new Date(clockInMs) >= yesterday;
      });

    return shifts.length > 0 ? (shifts[0].shift as Shift) : null;
  }

  /**
   * Auto-close old unclosed shifts that are more than 24 hours old
   * Returns array of closed shift info (id, timeShiftId, cashierId) for clock-out handling
   */
  autoCloseOldActiveShifts(): Array<{
    id: string;
    timeShiftId: string | null;
    cashierId: string;
  }> {
    const now = new Date();
    const nowString = now.toISOString();

    const basicCutoffTime = new Date(now);
    basicCutoffTime.setDate(basicCutoffTime.getDate() - 1);
    basicCutoffTime.setHours(6, 0, 0, 0);

    // Get all active shifts with their schedules and clock-in events
    const activeShifts = this.db
      .select({
        shift: schema.shifts,
        scheduledEndTime: schema.schedules.endTime,
        clockInTimestamp: schema.clockEvents.timestamp,
      })
      .from(schema.shifts)
      .leftJoin(
        schema.schedules,
        eq(schema.shifts.schedule_id, schema.schedules.id),
      )
      .leftJoin(
        schema.clockEvents,
        eq(schema.shifts.clock_in_id, schema.clockEvents.id),
      )
      .where(eq(schema.shifts.status, "active"))
      .all();

    const closedShifts: Array<{
      id: string;
      timeShiftId: string | null;
      cashierId: string;
    }> = [];

    for (const { shift, scheduledEndTime, clockInTimestamp } of activeShifts) {
      let shouldClose = false;
      let closeReason = "";

      // Get shift start time from clock-in event timestamp
      // Note: clockInTimestamp is a number (milliseconds) from timestamp_ms column
      const shiftStartMs =
        clockInTimestamp && typeof clockInTimestamp === "number"
          ? clockInTimestamp
          : clockInTimestamp instanceof Date
            ? clockInTimestamp.getTime()
            : clockInTimestamp
              ? new Date(clockInTimestamp as string).getTime()
              : shift.createdAt instanceof Date
                ? shift.createdAt.getTime()
                : typeof shift.createdAt === "number"
                  ? shift.createdAt
                  : new Date(shift.createdAt as string).getTime();
      const shiftStart = new Date(shiftStartMs);

      // Rule 1: Close shifts older than 24 hours
      if (shiftStart < basicCutoffTime) {
        shouldClose = true;
        closeReason =
          "Auto-closed - shift was left open for more than 24 hours";
      }
      // Rule 2: Close shifts that are way past their scheduled end time
      else if (scheduledEndTime) {
        // Convert scheduledEndTime (number milliseconds) to Date
        const scheduledEndMs =
          typeof scheduledEndTime === "number"
            ? scheduledEndTime
            : scheduledEndTime instanceof Date
              ? scheduledEndTime.getTime()
              : new Date(scheduledEndTime as string).getTime();
        const scheduledEnd = new Date(scheduledEndMs);
        const hoursOverdue =
          (now.getTime() - scheduledEnd.getTime()) / (1000 * 60 * 60);

        if (hoursOverdue > 4) {
          shouldClose = true;
          closeReason = `Auto-closed - shift was ${Math.round(
            hoursOverdue,
          )} hours past scheduled end time`;
        }
      }
      // Rule 3: Close shifts that started more than 16 hours ago
      else {
        const hoursActive =
          (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
        if (hoursActive > 16) {
          shouldClose = true;
          closeReason = `Auto-closed - shift was active for ${Math.round(
            hoursActive,
          )} hours without schedule`;
        }
      }

      if (shouldClose) {
        // Use snake_case field names from schema
        const estimatedCash =
          (shift.starting_cash || 0) + (shift.total_sales || 0);

        this.db
          .update(schema.shifts)
          .set({
            status: "ended",
            notes: shift.notes ? `${shift.notes}; ${closeReason}` : closeReason,
            updatedAt: now,
          })
          .where(eq(schema.shifts.id, shift.id))
          .run();

        // Store closed shift info for clock-out handling
        // Note: shift.id is the timeShiftId (shifts table is the unified time shift table)
        closedShifts.push({
          id: shift.id,
          timeShiftId: shift.id, // The shift itself is the time shift
          cashierId: shift.user_id, // Use user_id from schema
        });

        logger.info(`Auto-closed shift ${shift.id}: ${closeReason}`);
      }
    }

    return closedShifts;
  }

  /**
   * Auto-end overdue shifts today (more aggressive than 24-hour cleanup)
   * Returns array of closed shift info (id, timeShiftId, cashierId) for clock-out handling
   */
  autoEndOverdueShiftsToday(): Array<{
    id: string;
    timeShiftId: string | null;
    cashierId: string;
  }> {
    const now = new Date();
    const nowString = now.toISOString();

    // Get all active shifts with their schedules and clock-in events
    const activeShifts = this.db
      .select({
        shift: schema.shifts,
        scheduledEndTime: schema.schedules.endTime,
        clockInTimestamp: schema.clockEvents.timestamp,
      })
      .from(schema.shifts)
      .leftJoin(
        schema.schedules,
        eq(schema.shifts.schedule_id, schema.schedules.id),
      )
      .leftJoin(
        schema.clockEvents,
        eq(schema.shifts.clock_in_id, schema.clockEvents.id),
      )
      .where(eq(schema.shifts.status, "active"))
      .all()
      .filter((item) => {
        // Filter for today's shifts
        // Get shift start time from clock-in event timestamp
        const clockInMs =
          item.clockInTimestamp && typeof item.clockInTimestamp === "number"
            ? item.clockInTimestamp
            : item.clockInTimestamp instanceof Date
              ? item.clockInTimestamp.getTime()
              : item.clockInTimestamp
                ? new Date(item.clockInTimestamp as string).getTime()
                : item.shift.createdAt instanceof Date
                  ? item.shift.createdAt.getTime()
                  : typeof item.shift.createdAt === "number"
                    ? item.shift.createdAt
                    : new Date(item.shift.createdAt as string).getTime();
        const shiftDate = new Date(clockInMs);
        const today = new Date();
        return (
          shiftDate.getDate() === today.getDate() &&
          shiftDate.getMonth() === today.getMonth() &&
          shiftDate.getFullYear() === today.getFullYear()
        );
      });

    const closedShifts: Array<{
      id: string;
      timeShiftId: string | null;
      cashierId: string;
    }> = [];

    for (const { shift, scheduledEndTime, clockInTimestamp } of activeShifts) {
      let shouldClose = false;
      let closeReason = "";

      // Get shift start time from clock-in event timestamp
      const shiftStartMs =
        clockInTimestamp && typeof clockInTimestamp === "number"
          ? clockInTimestamp
          : clockInTimestamp instanceof Date
            ? clockInTimestamp.getTime()
            : clockInTimestamp
              ? new Date(clockInTimestamp as string).getTime()
              : shift.createdAt instanceof Date
                ? shift.createdAt.getTime()
                : typeof shift.createdAt === "number"
                  ? shift.createdAt
                  : new Date(shift.createdAt as string).getTime();
      const shiftStart = new Date(shiftStartMs);

      if (scheduledEndTime) {
        // Convert scheduledEndTime (number milliseconds) to Date
        const scheduledEndMs =
          typeof scheduledEndTime === "number"
            ? scheduledEndTime
            : scheduledEndTime instanceof Date
              ? scheduledEndTime.getTime()
              : new Date(scheduledEndTime as string).getTime();
        const scheduledEnd = new Date(scheduledEndMs);
        const hoursOverdue =
          (now.getTime() - scheduledEnd.getTime()) / (1000 * 60 * 60);

        // More aggressive: Close shifts that are 2+ hours past scheduled end time
        if (hoursOverdue > 2) {
          shouldClose = true;
          closeReason = `Auto-closed - shift was ${Math.round(
            hoursOverdue,
          )} hours past scheduled end time`;
        }
      } else {
        // No schedule - close if active for more than 12 hours
        const hoursActive =
          (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
        if (hoursActive > 12) {
          shouldClose = true;
          closeReason = `Auto-closed - shift was active for ${Math.round(
            hoursActive,
          )} hours without schedule`;
        }
      }

      if (shouldClose) {
        // Use snake_case field names from schema
        const estimatedCash =
          (shift.starting_cash || 0) + (shift.total_sales || 0);

        this.db
          .update(schema.shifts)
          .set({
            status: "ended",
            notes: shift.notes ? `${shift.notes}; ${closeReason}` : closeReason,
            updatedAt: now,
          })
          .where(eq(schema.shifts.id, shift.id))
          .run();

        // Store closed shift info for clock-out handling
        closedShifts.push({
          id: shift.id,
          timeShiftId: shift.id, // The shift itself is the time shift
          cashierId: shift.user_id, // Use user_id from schema
        });

        logger.info(`Auto-ended overdue shift ${shift.id}: ${closeReason}`);
      }
    }

    return closedShifts;
  }

  /**
   * Get hourly transaction statistics for a shift
   */
  getHourlyTransactionStats(shiftId: string): {
    lastHour: number;
    currentHour: number;
    averagePerHour: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const currentHourStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      0,
      0,
    );

    // Get transactions from the last hour
    const lastHourResult = this.db
      .select({ count: drizzleSql<number>`COUNT(*)` })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.shiftId, shiftId),
          drizzleSql`${
            schema.transactions.timestamp
          } >= ${oneHourAgo.toISOString()}`,
          drizzleSql`${schema.transactions.timestamp} <= ${now.toISOString()}`,
          eq(schema.transactions.status, "completed"),
        ),
      )
      .get();

    // Get transactions from current hour
    const currentHourResult = this.db
      .select({ count: drizzleSql<number>`COUNT(*)` })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.shiftId, shiftId),
          drizzleSql`${
            schema.transactions.timestamp
          } >= ${currentHourStart.toISOString()}`,
          eq(schema.transactions.status, "completed"),
        ),
      )
      .get();

    // Get shift start time from clock event for average calculation
    const shiftWithClockIn = this.db
      .select({
        clockInTimestamp: schema.clockEvents.timestamp,
      })
      .from(schema.shifts)
      .leftJoin(
        schema.clockEvents,
        eq(schema.shifts.clock_in_id, schema.clockEvents.id),
      )
      .where(eq(schema.shifts.id, shiftId))
      .get();

    let averagePerHour = 0;
    if (shiftWithClockIn?.clockInTimestamp) {
      const clockInMs =
        typeof shiftWithClockIn.clockInTimestamp === "number"
          ? shiftWithClockIn.clockInTimestamp
          : shiftWithClockIn.clockInTimestamp instanceof Date
            ? shiftWithClockIn.clockInTimestamp.getTime()
            : new Date(shiftWithClockIn.clockInTimestamp as string).getTime();
      const shiftStart = new Date(clockInMs);
      const hoursWorked = Math.max(
        (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60),
        0.1,
      );

      const totalResult = this.db
        .select({ count: drizzleSql<number>`COUNT(*)` })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.shiftId, shiftId),
            eq(schema.transactions.status, "completed"),
          ),
        )
        .get();

      averagePerHour = (totalResult?.count || 0) / hoursWorked;
    }

    return {
      lastHour: lastHourResult?.count || 0,
      currentHour: currentHourResult?.count || 0,
      averagePerHour: Math.round((averagePerHour || 0) * 10) / 10,
    };
  }

  /**
   * Reconcile an auto-ended shift with manager approval
   */
  reconcileShift(
    shiftId: string,
    reconciliationData: {
      actualCashDrawer: number;
      managerNotes: string;
      managerId: string;
    },
  ): void {
    const shift = this.getShiftById(shiftId);

    const reconciliationNote = `Reconciled by manager. Actual cash: £${reconciliationData.actualCashDrawer.toFixed(
      2,
    )}. ${reconciliationData.managerNotes}`;

    const updatedNotes = shift.notes
      ? `${shift.notes} | Manager Reconciliation: ${reconciliationNote}`
      : reconciliationNote;

    // Note: shifts table doesn't have finalCashDrawer field
    // Cash drawer counts are stored in cash_drawer_counts table
    this.db
      .update(schema.shifts)
      .set({
        notes: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(schema.shifts.id, shiftId))
      .run();
  }

  /**
   * Get shifts that need manager reconciliation (auto-ended shifts)
   */
  getPendingReconciliationShifts(businessId: string): Shift[] {
    return this.db
      .select()
      .from(schema.shifts)
      .where(
        and(
          eq(schema.shifts.business_id, businessId),
          eq(schema.shifts.status, "ended"),
          drizzleSql`${schema.shifts.notes} LIKE '%Auto-ended%' OR ${schema.shifts.notes} LIKE '%Auto-closed%'`,
        ),
      )
      .orderBy(desc(schema.shifts.updatedAt))
      .all() as Shift[];
  }
}
