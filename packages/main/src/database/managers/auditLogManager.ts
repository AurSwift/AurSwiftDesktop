import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, lt, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger("auditLogManager");

export class AuditLogManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Create audit log
   */
  createAuditLog(logData: {
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    details?: any;
  }): void {
    const logId = this.uuid.v4();
    const now = new Date();

    this.db
      .insert(schema.auditLogs)
      .values({
        id: logId,
        user_id: logData.userId,
        action: logData.action,
        resource: logData.resource,
        resource_id: logData.resourceId,
        details: logData.details ? JSON.stringify(logData.details) : null,
        timestamp: now, // Use Date object for timestamp_ms mode
      })
      .run();
  }

  /**
   * Get audit logs by user
   */
  getAuditLogsByUser(userId: string, limit: number = 100): any[] {
    const results = this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.user_id, userId))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .all();

    return results.map((log: any) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    }));
  }

  /**
   * Get audit logs by resource
   */
  getAuditLogsByResource(
    resource: string,
    resourceId: string,
    limit: number = 100
  ): any[] {
    const results = this.db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.resource, resource),
          eq(schema.auditLogs.resource_id, resourceId)
        )
      )
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .all();

    return results.map((log: any) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    }));
  }

  /**
   * Get audit logs with filtering
   */
  getAuditLogs(options?: {
    userId?: string;
    resource?: string;
    resourceId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): any[] {
    // Build where conditions
    const conditions = [];
    if (options?.userId) {
      conditions.push(eq(schema.auditLogs.user_id, options.userId));
    }
    if (options?.resource) {
      conditions.push(eq(schema.auditLogs.resource, options.resource));
    }
    if (options?.resourceId) {
      conditions.push(eq(schema.auditLogs.resource_id, options.resourceId));
    }
    if (options?.action) {
      conditions.push(eq(schema.auditLogs.action, options.action));
    }

    // Build query with conditions
    let queryBuilder = this.db.select().from(schema.auditLogs);

    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions)) as any;
    }

    queryBuilder = queryBuilder.orderBy(
      desc(schema.auditLogs.timestamp)
    ) as any;

    if (options?.limit) {
      queryBuilder = queryBuilder.limit(options.limit) as any;
    }
    if (options?.offset) {
      queryBuilder = queryBuilder.offset(options.offset) as any;
    }

    const results = queryBuilder.all();

    return results.map((log: any) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    }));
  }

  /**
   * Cleanup old audit logs
   * @param daysToKeep - Number of days to keep logs (default: 90)
   * @returns Number of logs deleted
   */
  cleanupOldLogs(daysToKeep: number = 90): number {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = this.db
        .delete(schema.auditLogs)
        .where(lt(schema.auditLogs.timestamp, cutoffDate))
        .run();

      return result.changes;
    } catch (error) {
      logger.error("Failed to cleanup old audit logs:", error);
      return 0;
    }
  }
}
