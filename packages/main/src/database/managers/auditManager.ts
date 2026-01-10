import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, gte, lte, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger("auditManager");

export class AuditManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Create an audit log entry
   */
  async createAuditLog(data: {
    action: string;
    entityType:
      | "clock_event"
      | "shift"
      | "break"
      | "time_correction"
      | "session"
      | "user";
    entityId: string;
    userId: string;
    details: any; // Will be JSON stringified
    ipAddress?: string;
    terminalId?: string;
  }): Promise<schema.AuditLog> {
    const auditId = this.uuid.v4();
    const now = new Date();

    // Validate userId is provided
    if (!data.userId) {
      throw new Error("userId is required for audit log");
    }

    // Validate terminalId exists if provided (to avoid foreign key constraint errors)
    let validTerminalId: string | null = null;
    if (data.terminalId) {
      const [terminal] = this.db
        .select({ id: schema.terminals.id })
        .from(schema.terminals)
        .where(eq(schema.terminals.id, data.terminalId))
        .limit(1)
        .all();

      if (terminal) {
        validTerminalId = data.terminalId;
      } else {
        // Terminal doesn't exist - log warning but continue without terminal_id
        logger.warn(
          `[createAuditLog] Terminal ID ${data.terminalId} does not exist, omitting from audit log`
        );
      }
    }

    this.db
      .insert(schema.auditLogs)
      .values({
        id: auditId,
        action: data.action,
        resource: data.entityType, // Store in resource for backward compatibility
        resource_id: data.entityId, // Store in resource_id for backward compatibility
        entity_type: data.entityType,
        entity_id: data.entityId,
        user_id: data.userId,
        details:
          typeof data.details === "string"
            ? data.details
            : JSON.stringify(data.details),
        ip_address: data.ipAddress ?? null,
        terminal_id: validTerminalId,
        timestamp: now, // Use Date object for timestamp_ms mode
        createdAt: now,
      })
      .run();

    // Retrieve the created audit log to return proper type
    const [created] = this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.id, auditId))
      .limit(1)
      .all();

    return created as schema.AuditLog;
  }

  /**
   * Log a clock event action
   */
  async logClockEvent(
    action: "clock_in" | "clock_out" | "clock_event_modified",
    clockEvent: any,
    userId: string,
    terminalId?: string,
    ipAddress?: string,
    additionalDetails?: any
  ): Promise<schema.AuditLog> {
    return this.createAuditLog({
      action,
      entityType: "clock_event",
      entityId: clockEvent.id,
      userId,
      details: {
        clockEvent,
        ...additionalDetails,
      },
      ipAddress,
      terminalId,
    });
  }

  /**
   * Log a shift action
   */
  async logShiftAction(
    action:
      | "shift_started"
      | "shift_completed"
      | "shift_modified"
      | "shift_forced_end",
    shift: any,
    userId: string,
    terminalId?: string,
    ipAddress?: string,
    additionalDetails?: any
  ): Promise<schema.AuditLog> {
    return this.createAuditLog({
      action,
      entityType: "shift",
      entityId: shift.id,
      userId,
      details: {
        shift,
        ...additionalDetails,
      },
      ipAddress,
      terminalId,
    });
  }

  /**
   * Log a break action
   */
  async logBreakAction(
    action: "break_started" | "break_ended" | "break_modified",
    breakRecord: any,
    userId: string,
    terminalId?: string,
    ipAddress?: string,
    additionalDetails?: any
  ): Promise<schema.AuditLog> {
    return this.createAuditLog({
      action,
      entityType: "break",
      entityId: breakRecord.id,
      userId,
      details: {
        break: breakRecord,
        ...additionalDetails,
      },
      ipAddress,
      terminalId,
    });
  }

  /**
   * Log a time correction action
   */
  async logTimeCorrectionAction(
    action:
      | "time_correction_requested"
      | "time_correction_approved"
      | "time_correction_rejected",
    correction: any,
    userId: string,
    terminalId?: string,
    ipAddress?: string,
    additionalDetails?: any
  ): Promise<schema.AuditLog> {
    return this.createAuditLog({
      action,
      entityType: "time_correction",
      entityId: correction.id,
      userId,
      details: {
        correction,
        ...additionalDetails,
      },
      ipAddress,
      terminalId,
    });
  }

  /**
   * Log a session action
   */
  async logSessionAction(
    action:
      | "login"
      | "logout"
      | "session_expired"
      | "concurrent_login"
      | "session_terminated",
    session: any,
    userId: string,
    terminalId?: string,
    ipAddress?: string,
    additionalDetails?: any
  ): Promise<schema.AuditLog> {
    return this.createAuditLog({
      action,
      entityType: "session",
      entityId: session.id,
      userId,
      details: {
        session,
        ...additionalDetails,
      },
      ipAddress,
      terminalId,
    });
  }

  /**
   * Log a user action
   */
  async logUserAction(
    action:
      | "user_created"
      | "user_updated"
      | "user_deleted"
      | "password_changed",
    user: any,
    performedBy: string,
    terminalId?: string,
    ipAddress?: string,
    additionalDetails?: any
  ): Promise<schema.AuditLog> {
    return this.createAuditLog({
      action,
      entityType: "user",
      entityId: user.id,
      userId: performedBy,
      details: {
        user: {
          id: user.id,
          email: user.email,
          // Note: role is now managed via RBAC (userRoles table)
          ...additionalDetails,
        },
      },
      ipAddress,
      terminalId,
    });
  }

  /**
   * Get audit logs by entity
   */
  getAuditLogsByEntity(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): schema.AuditLog[] {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.entity_type, entityType),
          eq(schema.auditLogs.entity_id, entityId)
        )
      )
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .all() as schema.AuditLog[];
  }

  /**
   * Get audit logs by user
   */
  getAuditLogsByUser(userId: string, limit: number = 100): schema.AuditLog[] {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.user_id, userId))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .all() as schema.AuditLog[];
  }

  /**
   * Get audit logs by action
   */
  getAuditLogsByAction(action: string, limit: number = 100): schema.AuditLog[] {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, action))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .all() as schema.AuditLog[];
  }

  /**
   * Get audit logs within date range
   */
  getAuditLogsByDateRange(
    startDate: string,
    endDate: string,
    entityType?: string,
    limit: number = 100
  ): schema.AuditLog[] {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const conditions = [
      gte(schema.auditLogs.timestamp, startDateObj),
      lte(schema.auditLogs.timestamp, endDateObj),
    ];

    if (entityType) {
      conditions.push(eq(schema.auditLogs.entity_type, entityType));
    }

    return this.db
      .select()
      .from(schema.auditLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .all() as schema.AuditLog[];
  }

  /**
   * Get recent suspicious activities
   */
  getSuspiciousActivities(
    businessId: string,
    limit: number = 50
  ): schema.AuditLog[] {
    const results = this.db
      .select({
        auditLog: schema.auditLogs,
      })
      .from(schema.auditLogs)
      .innerJoin(schema.users, eq(schema.auditLogs.user_id, schema.users.id))
      .where(
        and(
          eq(schema.users.businessId, businessId),
          drizzleSql`(
            ${schema.auditLogs.action} IN ('clock_event_modified', 'shift_forced_end', 'time_correction_requested')
            OR ${schema.auditLogs.action} LIKE '%concurrent%'
          )`
        )
      )
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .all();

    return results.map((r) => r.auditLog) as schema.AuditLog[];
  }

  /**
   * Get audit trail for compliance reporting
   */
  getComplianceAuditTrail(
    businessId: string,
    startDate: string,
    endDate: string
  ): schema.AuditLog[] {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const results = this.db
      .select({
        auditLog: schema.auditLogs,
      })
      .from(schema.auditLogs)
      .innerJoin(schema.users, eq(schema.auditLogs.user_id, schema.users.id))
      .where(
        and(
          eq(schema.users.businessId, businessId),
          gte(schema.auditLogs.timestamp, startDateObj),
          lte(schema.auditLogs.timestamp, endDateObj)
        )
      )
      .orderBy(desc(schema.auditLogs.timestamp))
      .all();

    return results.map((r) => r.auditLog) as schema.AuditLog[];
  }

  /**
   * Clean up old audit logs (optional - for data retention policies)
   */
  async cleanupOldAuditLogs(daysToKeep: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = this.db
      .delete(schema.auditLogs)
      .where(drizzleSql`${schema.auditLogs.timestamp} < ${cutoffDate.getTime()}`)
      .run();

    return result.changes || 0;
  }
}
