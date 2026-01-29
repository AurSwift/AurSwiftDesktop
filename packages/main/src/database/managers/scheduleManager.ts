import type { Schedule } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, asc, gte, lte, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";

export class ScheduleManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Create schedule
   */
  createSchedule(
    scheduleData: Omit<Schedule, "id" | "createdAt" | "updatedAt">
  ): Schedule {
    const scheduleId = this.uuid.v4();

    this.db
      .insert(schema.schedules)
      .values({
        id: scheduleId,
        staffId: scheduleData.staffId,
        businessId: scheduleData.businessId,
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime,
        status: scheduleData.status,
        assignedRegister: scheduleData.assignedRegister ?? null,
        notes: scheduleData.notes ?? null,
      })
      .run();

    // Retrieve and return the created schedule
    const [created] = this.db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.id, scheduleId))
      .limit(1)
      .all();

    return created as Schedule;
  }

  /**
   * Get schedule by ID
   */
  getScheduleById(id: string): Schedule {
    const schedules = this.db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.id, id))
      .limit(1)
      .all();

    if (!schedules || schedules.length === 0) {
      throw new Error("Schedule not found");
    }

    const s = schedules[0];
    return {
      ...s,
      assignedRegister: s.assignedRegister ?? undefined,
      notes: s.notes ?? undefined,
    } as Schedule;
  }

  /**
   * Get schedules by business
   */
  getSchedulesByBusiness(businessId: string): Schedule[] {
    const result = this.db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.businessId, businessId))
      .orderBy(asc(schema.schedules.startTime))
      .all();

    return result.map((s) => ({
      ...s,
      assignedRegister: s.assignedRegister ?? undefined,
      notes: s.notes ?? undefined,
    })) as Schedule[];
  }

  /**
   * Get schedules by staff ID
   */
  getSchedulesByStaffId(staffId: string): Schedule[] {
    const result = this.db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.staffId, staffId))
      .orderBy(asc(schema.schedules.startTime))
      .all();

    return result.map((s) => ({
      ...s,
      assignedRegister: s.assignedRegister ?? undefined,
      notes: s.notes ?? undefined,
    })) as Schedule[];
  }

  /**
   * Find active schedule for user on given date
   * Returns schedule if:
   * - Status is "upcoming" or "active"
   * - Start time is today
   * - Current time is within clock-in window (15 mins early to scheduled start)
   */
  findActiveScheduleForClockIn(
    userId: string,
    currentTime: Date = new Date()
  ): Schedule | null {
    // Helper functions to get start and end of day
    const startOfDay = (date: Date): Date => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const endOfDay = (date: Date): Date => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    const todayStart = startOfDay(currentTime);
    const todayEnd = endOfDay(currentTime);

    // Find schedules for today
    // Note: Drizzle's gte/lte for timestamp_ms columns expect Date objects
    const schedules = this.db
      .select()
      .from(schema.schedules)
      .where(
        and(
          eq(schema.schedules.staffId, userId),
          drizzleSql`${schema.schedules.status} IN ('upcoming', 'active')`,
          gte(schema.schedules.startTime, todayStart),
          lte(schema.schedules.startTime, todayEnd)
        )
      )
      .orderBy(schema.schedules.startTime)
      .all();

    if (!schedules.length) return null;

    // Check if current time is within clock-in window
    const GRACE_PERIOD_EARLY_MS = 15 * 60 * 1000; // 15 minutes
    const currentTimeMs = currentTime.getTime();

    // Helper to convert timestamp to number (handles both Date and number)
    const toTimestamp = (
      value: Date | number | null | undefined
    ): number | null => {
      if (value === null || value === undefined) return null;
      if (value instanceof Date) return value.getTime();
      return value as number;
    };

    for (const schedule of schedules) {
      // Convert schedule times to timestamps (numbers) for comparison
      // Drizzle returns Date objects for timestamp_ms columns
      const scheduledStart = toTimestamp(schedule.startTime as Date | number);
      const scheduledEnd = toTimestamp(
        schedule.endTime as Date | number | null | undefined
      );

      if (scheduledStart === null) continue; // Skip if no start time

      const earliestClockIn = scheduledStart - GRACE_PERIOD_EARLY_MS;

      // Allow clock-in if:
      // 1. Within 15 mins early to scheduled start time, OR
      // 2. After scheduled start but before shift end (or no end time specified)
      const isWithinEarlyWindow =
        currentTimeMs >= earliestClockIn && currentTimeMs <= scheduledStart;
      const isAfterStartButBeforeEnd =
        currentTimeMs > scheduledStart &&
        (scheduledEnd === null || currentTimeMs <= scheduledEnd);

      if (isWithinEarlyWindow || isAfterStartButBeforeEnd) {
        return {
          ...schedule,
          assignedRegister: schedule.assignedRegister ?? undefined,
          notes: schedule.notes ?? undefined,
        } as Schedule;
      }
    }

    return null;
  }

  /**
   * Update schedule status
   */
  updateScheduleStatus(scheduleId: string, status: Schedule["status"]): void {
    this.db
      .update(schema.schedules)
      .set({ status })
      .where(eq(schema.schedules.id, scheduleId))
      .run();
  }

  /**
   * Update schedule
   */
  updateSchedule(
    scheduleId: string,
    updates: Partial<
      Pick<
        Schedule,
        | "staffId"
        | "startTime"
        | "endTime"
        | "assignedRegister"
        | "notes"
        | "status"
      >
    >
  ): Schedule {
    const now = new Date(); // Keep as Date object for timestamp column

    // Build update object
    const updateData: any = { updatedAt: now };

    if (updates.staffId !== undefined) updateData.staffId = updates.staffId;
    if (updates.startTime !== undefined)
      updateData.startTime = updates.startTime;
    if (updates.endTime !== undefined) updateData.endTime = updates.endTime;
    if (updates.assignedRegister !== undefined)
      updateData.assignedRegister = updates.assignedRegister ?? null;
    if (updates.notes !== undefined) updateData.notes = updates.notes ?? null;
    if (updates.status !== undefined) updateData.status = updates.status;

    if (Object.keys(updateData).length === 1) {
      throw new Error("No fields to update");
    }

    this.db
      .update(schema.schedules)
      .set(updateData)
      .where(eq(schema.schedules.id, scheduleId))
      .run();

    // Return the updated schedule
    const updated = this.db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.id, scheduleId))
      .get();

    if (!updated) {
      throw new Error("Schedule not found after update");
    }

    return {
      ...updated,
      assignedRegister: updated.assignedRegister ?? undefined,
      notes: updated.notes ?? undefined,
    } as Schedule;
  }

  /**
   * Delete schedule
   */
  deleteSchedule(scheduleId: string): void {
    const result = this.db
      .delete(schema.schedules)
      .where(eq(schema.schedules.id, scheduleId))
      .run();

    if (result.changes === 0) {
      throw new Error("Schedule not found");
    }
  }

  /**
   * Auto-complete schedules that have passed their end time
   * Should be called periodically (e.g., every 30 minutes)
   *
   * @param graceMinutes - Minutes after schedule end to wait before auto-completing (default: 30)
   * @returns Number of schedules auto-completed
   */
  autoCompleteExpiredSchedules(graceMinutes: number = 30): number {
    const now = new Date();
    const graceTime = new Date(now.getTime() - graceMinutes * 60 * 1000);

    // Find schedules that are active or upcoming, but have passed their end time + grace
    const expiredSchedules = this.db
      .select()
      .from(schema.schedules)
      .where(
        and(
          drizzleSql`${schema.schedules.status} IN ('active', 'upcoming')`,
          lte(schema.schedules.endTime, graceTime)
        )
      )
      .all();

    if (expiredSchedules.length === 0) {
      return 0;
    }

    // Update all expired schedules to 'completed'
    const scheduleIds = expiredSchedules.map((s) => s.id);

    for (const id of scheduleIds) {
      this.updateScheduleStatus(id, "completed");
    }

    return scheduleIds.length;
  }
}
