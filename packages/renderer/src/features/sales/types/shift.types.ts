/**
 * Shift-related type definitions
 *
 * @deprecated Use @/types/domain instead
 * @see /Users/admin/Documents/Developer/Electron/aurswift/packages/renderer/src/types/domain
 *
 * Migration: Replace imports with:
 * ```typescript
 * import { Shift, Schedule } from '@/types/domain';
 * ```
 */

export interface Shift {
  id: string;
  scheduleId?: string; // Links to the planned schedule
  cashierId: string;
  businessId: string;
  startTime: string; // ACTUAL clock-in time (when cashier really started)
  endTime?: string; // ACTUAL clock-out time (when cashier really ended)
  status: "active" | "ended";
  startingCash: number;
  finalCashDrawer?: number;
  expectedCashDrawer?: number;
  cashVariance?: number;
  totalSales?: number;
  totalTransactions?: number;
  totalRefunds?: number;
  totalVoids?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Schedule {
  id: string;
  staffId: string;
  businessId: string;
  startTime: string; // PLANNED start time (what manager scheduled)
  endTime: string; // PLANNED end time (what manager scheduled - can be updated live)
  status: "upcoming" | "active" | "completed" | "missed";
  assignedRegister?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string; // Changes when manager modifies scheduled times
}
