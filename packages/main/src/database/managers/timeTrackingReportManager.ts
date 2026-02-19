import type { DrizzleDB } from "../drizzle.js";
import { getRawDatabase } from "../drizzle.js";
import { eq, and, desc, gte, lte, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";
import type Database from "better-sqlite3";

// Define AttendanceReport type
export interface AttendanceReport {
  userId: string;
  userName: string;
  period: {
    startDate: string;
    endDate: string;
  };
  totalShifts: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  lateClockIns: number;
  missedClockOuts: number;
  averageHoursPerShift: number;
  tardinessMinutes: number;
}

export class TimeTrackingReportManager {
  private db: DrizzleDB;
  private rawDb: Database.Database;

  constructor(drizzle: DrizzleDB) {
    this.db = drizzle;
    this.rawDb = getRawDatabase();
  }

  /**
   * Generate comprehensive attendance report for a user
   */
  generateUserAttendanceReport(
    userId: string,
    startDate: string,
    endDate: string
  ): AttendanceReport {
    // Get user info
    const [user] = this.db
      .select({
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
      .all();

    // Convert string dates to Date objects for comparison
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    // Get all shifts in date range
    const shifts = this.db
      .select({
        shift: schema.shifts,
        clockInTime: schema.clockEvents.timestamp,
        clockOutTime: drizzleSql<string>`ce_out.timestamp`,
      })
      .from(schema.shifts)
      .innerJoin(
        schema.clockEvents,
        eq(schema.shifts.clock_in_id, schema.clockEvents.id)
      )
      .leftJoin(
        drizzleSql`clock_events ce_out`,
        drizzleSql`${schema.shifts.clock_out_id} = ce_out.id`
      )
      .where(
        and(
          eq(schema.shifts.user_id, userId),
          gte(schema.clockEvents.timestamp, startDateObj),
          lte(schema.clockEvents.timestamp, endDateObj)
        )
      )
      .orderBy(desc(schema.clockEvents.timestamp))
      .all();

    // Calculate statistics
    const totalShifts = shifts.length;
    const completedShifts = shifts.filter(
      (s: any) => s.shift.status === "ended"
    );

    const totalHours = completedShifts.reduce(
      (sum: number, s: any) => sum + (s.shift.total_hours || 0),
      0
    );
    const regularHours = completedShifts.reduce(
      (sum: number, s: any) => sum + (s.shift.regular_hours || 0),
      0
    );
    const overtimeHours = completedShifts.reduce(
      (sum: number, s: any) => sum + (s.shift.overtime_hours || 0),
      0
    );

    // Count late clock-ins (assuming grace period of 7 minutes)
    let lateClockIns = 0;
    let tardinessMinutes = 0;

    shifts.forEach((shiftData: any) => {
      const shift = shiftData.shift;
      if (shift.schedule_id) {
        const [schedule] = this.db
          .select({
            startTime: schema.schedules.startTime,
          })
          .from(schema.schedules)
          .where(eq(schema.schedules.id, shift.schedule_id))
          .limit(1)
          .all();

        if (schedule) {
          const scheduledTime = new Date(schedule.startTime).getTime();
          const actualTime = new Date(shiftData.clockInTime).getTime();
          const diff = (actualTime - scheduledTime) / (1000 * 60); // minutes

          if (diff > 7) {
            // Grace period
            lateClockIns++;
            tardinessMinutes += diff;
          }
        }
      }
    });

    // Count missed clock-outs
    const missedClockOuts = shifts.filter(
      (s: any) => s.shift.status === "active" || !s.shift.clock_out_id
    ).length;

    return {
      userId,
      userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
      period: {
        startDate,
        endDate,
      },
      totalShifts,
      totalHours,
      regularHours,
      overtimeHours,
      lateClockIns,
      missedClockOuts,
      averageHoursPerShift: totalShifts > 0 ? totalHours / totalShifts : 0,
      tardinessMinutes,
    };
  }

  /**
   * Generate attendance report for entire business
   */
  generateBusinessAttendanceReport(
    businessId: string,
    startDate: string,
    endDate: string
  ): AttendanceReport[] {
    // Get all users in business
    const users = this.db
      .select({
        id: schema.users.id,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.businessId, businessId),
          eq(schema.users.isActive, true)
        )
      )
      .all();

    return users.map((user: any) =>
      this.generateUserAttendanceReport(user.id, startDate, endDate)
    );
  }

  /**
   * Get late clock-ins for a date range
   */
  getLateClockIns(
    businessId: string,
    startDate: string,
    endDate: string
  ): any[] {
    return this.rawDb
      .prepare(
        `
        SELECT 
          u.id as userId,
          u.firstName,
          u.lastName,
          ce.timestamp as actualTime,
          s.startTime as scheduledTime,
          CAST((julianday(ce.timestamp) - julianday(s.startTime)) * 24 * 60 AS INTEGER) as minutesLate,
          sh.id as shiftId
        FROM shifts sh
        JOIN users u ON sh.user_id = u.id
        JOIN clock_events ce ON sh.clock_in_id = ce.id
        LEFT JOIN schedules s ON sh.schedule_id = s.id
        WHERE u.businessId = ?
          AND ce.timestamp >= ?
          AND ce.timestamp <= ?
          AND s.startTime IS NOT NULL
          AND CAST((julianday(ce.timestamp) - julianday(s.startTime)) * 24 * 60 AS INTEGER) > 7
        ORDER BY ce.timestamp DESC
      `
      )
      .all(businessId, startDate, endDate);
  }

  /**
   * Get missed clock-outs (active shifts older than 24 hours)
   */
  getMissedClockOuts(businessId: string): any[] {
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    return this.rawDb
      .prepare(
        `
        SELECT 
          u.id as userId,
          u.firstName,
          u.lastName,
          ce.timestamp as clockInTime,
          sh.id as shiftId,
          sh.status
        FROM shifts sh
        JOIN users u ON sh.user_id = u.id
        JOIN clock_events ce ON sh.clock_in_id = ce.id
        WHERE u.businessId = ?
          AND sh.status = 'active'
          AND ce.timestamp < ?
        ORDER BY ce.timestamp ASC
      `
      )
      .all(businessId, twentyFourHoursAgo);
  }

  /**
   * Get overtime report
   */
  getOvertimeReport(
    businessId: string,
    startDate: string,
    endDate: string
  ): any[] {
    return this.rawDb
      .prepare(
        `
        SELECT 
          u.id as userId,
          u.firstName,
          u.lastName,
          COUNT(sh.id) as shiftsWithOvertime,
          SUM(sh.overtime_hours) as totalOvertimeHours,
          AVG(sh.overtime_hours) as averageOvertimePerShift
        FROM shifts sh
        JOIN users u ON sh.user_id = u.id
        JOIN clock_events ce ON sh.clock_in_id = ce.id
        WHERE u.businessId = ?
          AND ce.timestamp >= ?
          AND ce.timestamp <= ?
          AND sh.overtime_hours > 0
        GROUP BY u.id, u.firstName, u.lastName
        ORDER BY totalOvertimeHours DESC
      `
      )
      .all(businessId, startDate, endDate);
  }

  /**
   * Get break compliance report
   */
  getBreakComplianceReport(
    businessId: string,
    startDate: string,
    endDate: string
  ): any[] {
    return this.rawDb
      .prepare(
        `
        SELECT 
          u.id as userId,
          u.firstName,
          u.lastName,
          COUNT(DISTINCT sh.id) as totalShifts,
          COUNT(DISTINCT CASE WHEN b.id IS NOT NULL THEN sh.id END) as shiftsWithBreaks,
          COUNT(b.id) as totalBreaks,
          CAST(AVG(b.duration_seconds / 60) AS INTEGER) as averageBreakDuration
        FROM shifts sh
        JOIN users u ON sh.user_id = u.id
        JOIN clock_events ce ON sh.clock_in_id = ce.id
        LEFT JOIN breaks b ON b.shift_id = sh.id AND b.status = 'completed'
        WHERE u.businessId = ?
          AND ce.timestamp >= ?
          AND ce.timestamp <= ?
          AND sh.total_hours >= 6
        GROUP BY u.id, u.firstName, u.lastName
        HAVING shiftsWithBreaks < totalShifts
        ORDER BY (CAST(shiftsWithBreaks AS REAL) / CAST(totalShifts AS REAL)) ASC
      `
      )
      .all(businessId, startDate, endDate);
  }

  /**
   * Get payroll summary
   */
  getPayrollSummary(
    businessId: string,
    startDate: string,
    endDate: string,
    hourlyRate?: number
  ): any[] {
    const rate = hourlyRate || 15; // Default hourly rate

    return this.rawDb
      .prepare(
        `
        SELECT 
          u.id as userId,
          u.firstName,
          u.lastName,
          u.role,
          COUNT(sh.id) as totalShifts,
          CAST(SUM(sh.regular_hours) AS REAL) as regularHours,
          CAST(SUM(sh.overtime_hours) AS REAL) as overtimeHours,
          CAST(SUM(sh.total_hours) AS REAL) as totalHours,
          CAST(SUM(sh.break_duration_seconds / 60) AS REAL) as totalBreakMinutes
        FROM shifts sh
        JOIN users u ON sh.user_id = u.id
        JOIN clock_events ce ON sh.clock_in_id = ce.id
        WHERE u.businessId = ?
          AND ce.timestamp >= ?
          AND ce.timestamp <= ?
          AND sh.status = 'ended'
        GROUP BY u.id, u.firstName, u.lastName, u.role
        ORDER BY u.lastName, u.firstName
      `
      )
      .all(businessId, startDate, endDate)
      .map((record: any) => ({
        ...record,
        regularPay: (record.regularHours || 0) * rate,
        overtimePay: (record.overtimeHours || 0) * rate * 1.5, // Overtime at 1.5x
        totalPay:
          (record.regularHours || 0) * rate +
          (record.overtimeHours || 0) * rate * 1.5,
      }));
  }

  /**
   * Get shift patterns analysis
   */
  getShiftPatternsAnalysis(userId: string, days: number = 30): any {
    const startDate = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    ).toISOString();
    const endDate = new Date().toISOString();

    const shifts = this.rawDb
      .prepare(
        `
        SELECT 
          sh.*,
          ce_in.timestamp as clockInTime,
          ce_out.timestamp as clockOutTime,
          CAST(strftime('%w', ce_in.timestamp) AS INTEGER) as dayOfWeek,
          CAST(strftime('%H', ce_in.timestamp) AS INTEGER) as clockInHour
        FROM shifts sh
        JOIN clock_events ce_in ON sh.clock_in_id = ce_in.id
        LEFT JOIN clock_events ce_out ON sh.clock_out_id = ce_out.id
        WHERE sh.user_id = ?
          AND ce_in.timestamp >= ?
          AND ce_in.timestamp <= ?
        ORDER BY ce_in.timestamp ASC
      `
      )
      .all(userId, startDate, endDate);

    // Analyze patterns
    const dayDistribution = new Array(7).fill(0);
    const hourDistribution = new Array(24).fill(0);
    let totalShifts = shifts.length;

    shifts.forEach((shift: any) => {
      dayDistribution[shift.dayOfWeek]++;
      hourDistribution[shift.clockInHour]++;
    });

    // Find most common shift start time
    const mostCommonHour = hourDistribution.indexOf(
      Math.max(...hourDistribution)
    );
    const mostCommonDay = dayDistribution.indexOf(Math.max(...dayDistribution));

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    return {
      totalShifts,
      periodDays: days,
      averageShiftsPerWeek: (totalShifts / days) * 7,
      mostCommonStartHour: mostCommonHour,
      mostCommonDay: dayNames[mostCommonDay],
      dayDistribution: dayDistribution.map((count, idx) => ({
        day: dayNames[idx],
        count,
        percentage: totalShifts > 0 ? (count / totalShifts) * 100 : 0,
      })),
      hourDistribution: hourDistribution.map((count, idx) => ({
        hour: idx,
        count,
        percentage: totalShifts > 0 ? (count / totalShifts) * 100 : 0,
      })),
    };
  }

  /**
   * Get real-time dashboard data
   */
  getRealTimeDashboard(businessId: string): any {
    // Currently clocked in users
    const currentlyWorking = this.rawDb
      .prepare(
        `
        SELECT 
          u.id,
          u.firstName,
          u.lastName,
          u.role,
          ce.timestamp as clockInTime,
          sh.id as shiftId
        FROM shifts sh
        JOIN users u ON sh.user_id = u.id
        JOIN clock_events ce ON sh.clock_in_id = ce.id
        WHERE u.businessId = ?
          AND sh.status = 'active'
        ORDER BY ce.timestamp ASC
      `
      )
      .all(businessId);

    // Today's completed shifts
    const completedToday = this.rawDb
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM shifts sh
        JOIN users u ON sh.user_id = u.id
        JOIN clock_events ce ON sh.clock_in_id = ce.id
        WHERE u.businessId = ?
          AND date(ce.timestamp) = date('now')
          AND sh.status = 'ended'
      `
      )
      .get(businessId) as { count: number } | undefined;

    // Active breaks
    const activeBreaks = this.rawDb
      .prepare(
        `
        SELECT 
          b.*,
          u.firstName,
          u.lastName
        FROM breaks b
        JOIN shifts sh ON b.shift_id = sh.id
        JOIN users u ON b.user_id = u.id
        WHERE u.businessId = ?
          AND b.status = 'active'
      `
      )
      .all(businessId);

    // Today's total hours
    const todayHours = this.rawDb
      .prepare(
        `
        SELECT 
          CAST(SUM(sh.total_hours) AS REAL) as totalHours,
          CAST(SUM(sh.overtime_hours) AS REAL) as overtimeHours
        FROM shifts sh
        JOIN users u ON sh.user_id = u.id
        JOIN clock_events ce ON sh.clock_in_id = ce.id
        WHERE u.businessId = ?
          AND date(ce.timestamp) = date('now')
          AND sh.status = 'ended'
      `
      )
      .get(businessId) as
      | { totalHours: number | null; overtimeHours: number | null }
      | undefined;

    return {
      currentlyWorking: currentlyWorking.length,
      workingUsers: currentlyWorking,
      completedShifts: completedToday?.count || 0,
      activeBreaks: activeBreaks.length,
      breakUsers: activeBreaks,
      todayHours: todayHours?.totalHours || 0,
      todayOvertime: todayHours?.overtimeHours || 0,
      timestamp: new Date().toISOString(),
    };
  }
}
