import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";

export class ReportManager {
  private db: DrizzleDB;

  constructor(drizzle: DrizzleDB) {
    this.db = drizzle;
  }

  // Report generation methods - to be implemented from database.ts
  getSalesReport(
    _businessId: string,
    _startDate: string,
    _endDate: string
  ): any {
    // Implement sales report logic
    return {};
  }

  getInventoryReport(_businessId: string): any {
    // Implement inventory report logic
    return {};
  }

  // ============================================
  // DRIZZLE ORM METHODS
  // ============================================

  /**
   * Get current cash drawer balance using Drizzle ORM (type-safe)
   */
  getCurrentCashDrawerBalanceDrizzle(shiftId: string): {
    amount: number;
    isEstimated: boolean;
    lastCountTime?: string;
    variance?: number;
  } {
    // Get shift details
    const shift = this.db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, shiftId))
      .get();

    if (!shift) {
      return { amount: 0, isEstimated: true };
    }

    // Get the most recent cash count
    const latestCount = this.db
      .select()
      .from(schema.cashDrawerCounts)
      .where(eq(schema.cashDrawerCounts.shift_id, shiftId))
      .orderBy(desc(schema.cashDrawerCounts.timestamp))
      .limit(1)
      .get();

    if (latestCount) {
      // Use actual counted amount
      const expectedAtCountTime = this.getExpectedCashForShiftDrizzle(shiftId);
      const variance =
        latestCount.counted_amount - expectedAtCountTime.expectedAmount;

      return {
        amount: latestCount.counted_amount,
        isEstimated: false,
        lastCountTime: latestCount.timestamp instanceof Date 
          ? latestCount.timestamp.toISOString() 
          : typeof latestCount.timestamp === 'number'
          ? new Date(latestCount.timestamp).toISOString()
          : String(latestCount.timestamp),
        variance: variance,
      };
    } else {
      // Estimate based on starting cash + sales
      const expectedCash = this.getExpectedCashForShiftDrizzle(shiftId);
      return {
        amount: expectedCash.expectedAmount,
        isEstimated: true,
      };
    }
  }

  /**
   * Calculate expected cash amount for a shift using Drizzle ORM (type-safe)
   * Complex aggregation query
   */
  getExpectedCashForShiftDrizzle(shiftId: string): {
    expectedAmount: number;
    breakdown: {
      startingCash: number;
      cashSales: number;
      cashRefunds: number;
      cashVoids: number;
    };
  } {
    // Get shift details
    const shift = this.db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, shiftId))
      .get();

    if (!shift) {
      throw new Error("Shift not found");
    }

    // Calculate cash transactions using aggregation
    const cashTransactions = this.db
      .select({
        type: schema.transactions.type,
        cashAmount: drizzleSql<number>`SUM(CASE 
          WHEN ${schema.transactions.paymentMethod} = 'cash' THEN ${schema.transactions.total}
          WHEN ${schema.transactions.paymentMethod} = 'mixed' THEN COALESCE(${schema.transactions.cashAmount}, 0)
          ELSE 0
        END)`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.shiftId, shiftId),
          eq(schema.transactions.status, "completed"),
          drizzleSql`(${schema.transactions.paymentMethod} = 'cash' OR (${schema.transactions.paymentMethod} = 'mixed' AND ${schema.transactions.cashAmount} > 0))`
        )
      )
      .groupBy(schema.transactions.type)
      .all();

    let cashSales = 0;
    let cashRefunds = 0;
    let cashVoids = 0;

    cashTransactions.forEach((transaction: any) => {
      switch (transaction.type) {
        case "sale":
          cashSales += transaction.cashAmount;
          break;
        case "refund":
          cashRefunds += Math.abs(transaction.cashAmount);
          break;
        case "void":
          cashVoids += Math.abs(transaction.cashAmount);
          break;
      }
    });

    const expectedAmount =
      (shift.starting_cash || 0) + cashSales - cashRefunds - cashVoids;

    return {
      expectedAmount,
      breakdown: {
        startingCash: shift.starting_cash || 0,
        cashSales,
        cashRefunds,
        cashVoids,
      },
    };
  }

  /**
   * Generate shift report using Drizzle ORM (type-safe)
   * Complex reporting with aggregations and calculations
   */
  async generateShiftReportDrizzle(shiftId: string): Promise<any | null> {
    // Get shift data
    const shift = this.db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.id, shiftId))
      .get();

    if (!shift) return null;

    // Get linked schedule if exists
    let schedule: any = undefined;
    if (shift.schedule_id) {
      const scheduleResult = this.db
        .select()
        .from(schema.schedules)
        .where(eq(schema.schedules.id, shift.schedule_id))
        .get();

      if (scheduleResult) {
        schedule = {
          ...scheduleResult,
          assignedRegister: scheduleResult.assignedRegister ?? undefined,
          notes: scheduleResult.notes ?? undefined,
        };
      }
    }

    // Get transactions
    const allTransactions = this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.shiftId, shiftId))
      .orderBy(desc(schema.transactions.timestamp))
      .all();

    // Transform transactions with items
    const transactions = allTransactions.map((t: any) => ({
      ...t,
      items: this.db
        .select()
        .from(schema.transactionItems)
        .where(eq(schema.transactionItems.transactionId, t.id))
        .all(),
      appliedDiscounts: t.appliedDiscounts
        ? JSON.parse(t.appliedDiscounts)
        : undefined,
    }));

    // Get cash drawer counts
    const cashDrawerCounts = this.db
      .select()
      .from(schema.cashDrawerCounts)
      .where(eq(schema.cashDrawerCounts.shift_id, shiftId))
      .all();

    // Calculate totals using aggregation
    const salesStats = this.db
      .select({
        totalSales: drizzleSql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type} = 'sale' AND ${schema.transactions.status} = 'completed' THEN ${schema.transactions.total} ELSE 0 END), 0)`,
        totalRefunds: drizzleSql<number>`COALESCE(ABS(SUM(CASE WHEN ${schema.transactions.type} = 'refund' AND ${schema.transactions.status} = 'completed' THEN ${schema.transactions.total} ELSE 0 END)), 0)`,
        totalVoids: drizzleSql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.status} = 'voided' THEN ${schema.transactions.total} ELSE 0 END), 0)`,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.shiftId, shiftId))
      .get();

    const totalSales = salesStats?.totalSales ?? 0;
    const totalRefunds = salesStats?.totalRefunds ?? 0;
    const totalVoids = salesStats?.totalVoids ?? 0;

    // Get clock events for shift start/end times
    const clockIn = shift.clock_in_id
      ? this.db
          .select()
          .from(schema.clockEvents)
          .where(eq(schema.clockEvents.id, shift.clock_in_id))
          .get()
      : null;
    const clockOut = shift.clock_out_id
      ? this.db
          .select()
          .from(schema.clockEvents)
          .where(eq(schema.clockEvents.id, shift.clock_out_id))
          .get()
      : null;

    const actualStart = clockIn?.timestamp 
      ? (clockIn.timestamp instanceof Date 
          ? clockIn.timestamp 
          : typeof clockIn.timestamp === 'number'
          ? new Date(clockIn.timestamp)
          : new Date(clockIn.timestamp as string))
      : null;
    const actualEnd = clockOut?.timestamp
      ? (clockOut.timestamp instanceof Date
          ? clockOut.timestamp
          : typeof clockOut.timestamp === 'number'
          ? new Date(clockOut.timestamp)
          : new Date(clockOut.timestamp as string))
      : null;

    // Calculate attendance variance if schedule exists
    let attendanceVariance;
    if (schedule && actualStart) {
      const plannedStart = schedule.startTime instanceof Date
        ? schedule.startTime
        : typeof schedule.startTime === 'number'
        ? new Date(schedule.startTime)
        : new Date(schedule.startTime as string);
      const earlyMinutes = Math.max(
        0,
        (plannedStart.getTime() - actualStart.getTime()) / (1000 * 60)
      );
      const lateMinutes = Math.max(
        0,
        (actualStart.getTime() - plannedStart.getTime()) / (1000 * 60)
      );

      attendanceVariance = {
        plannedStart: schedule.startTime,
        actualStart: actualStart,
        plannedEnd: schedule.endTime,
        actualEnd: actualEnd,
        earlyMinutes: earlyMinutes > 0 ? Math.round(earlyMinutes) : undefined,
        lateMinutes: lateMinutes > 0 ? Math.round(lateMinutes) : undefined,
      };
    }

    return {
      shift,
      schedule,
      transactions,
      cashDrawerCounts,
      totalSales,
      totalRefunds,
      totalVoids,
      attendanceVariance,
    };
  }
}
