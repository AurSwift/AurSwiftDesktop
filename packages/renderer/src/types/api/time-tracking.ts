/**
 * Time Tracking API Types
 * 
 * Types for time tracking and clock in/out operations.
 * 
 * @module types/api/time-tracking
 */

import type { APIResponse } from './common';

export interface TimeTrackingAPI {
  clockIn: (data: {
    userId: string;
    terminalId: string;
    locationId?: string;
    businessId: string;
    ipAddress?: string;
  }) => Promise<APIResponse & { clockEvent?: any; shift?: any }>;

  clockOut: (data: {
    userId: string;
    terminalId: string;
    ipAddress?: string;
  }) => Promise<APIResponse & { clockEvent?: any; shift?: any }>;

  getActiveShift: (userId: string) => Promise<
    APIResponse & { shift?: any; breaks?: any[] }
  >;

  startBreak: (data: {
    shiftId: string;
    userId: string;
    type?: 'meal' | 'rest' | 'other';
    isPaid?: boolean;
  }) => Promise<APIResponse & { break?: any }>;

  endBreak: (breakId: string) => Promise<
    APIResponse & { break?: any }
  >;

  // ============================================================================
  // Reporting (Admin/Manager)
  // ============================================================================

  getRealTimeDashboard: (businessId: string) => Promise<
    APIResponse & { data?: any }
  >;

  getShiftsReport: (args: {
    businessId: string;
    startDate: string;
    endDate: string;
    filters?: {
      userIds?: string[];
      status?: "active" | "ended";
      complianceOnly?: boolean;
    };
  }) => Promise<APIResponse & { data?: any[] }>;

  getShiftDetails: (shiftId: string) => Promise<APIResponse & { data?: any }>;

  getBreakComplianceReport: (args: {
    businessId: string;
    startDate: string;
    endDate: string;
  }) => Promise<APIResponse & { data?: any[] }>;

  getPayrollSummary: (args: {
    businessId: string;
    startDate: string;
    endDate: string;
    hourlyRate?: number;
  }) => Promise<APIResponse & { data?: any[] }>;

  getPendingTimeCorrections: (businessId: string) => Promise<
    APIResponse & { data?: any[] }
  >;

  // ============================================================================
  // Manager overrides (reason required)
  // ============================================================================

  forceClockOut: (args: {
    userId: string;
    managerId: string;
    reason: string;
  }) => Promise<APIResponse & { data?: any }>;

  updateBreak: (args: {
    breakId: string;
    managerId: string;
    reason: string;
    patch: {
      startTime?: string;
      endTime?: string | null;
      type?: "meal" | "rest" | "other";
      isPaid?: boolean;
      notes?: string | null;
    };
  }) => Promise<APIResponse & { data?: any }>;

  processTimeCorrection: (args: {
    correctionId: string;
    managerId: string;
    approved: boolean;
  }) => Promise<APIResponse & { data?: any }>;
}

