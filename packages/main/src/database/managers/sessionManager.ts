import type { Session } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";

export class SessionManager {
  private drizzle: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.drizzle = drizzle;
    this.uuid = uuid;
  }

  /**
   * Create a new session with access token
   * Desktop EPOS: Uses long-lived tokens with secure storage (Electron safeStorage)
   * No refresh tokens needed - simplified architecture for desktop apps
   * 
   * @param userId - User ID
   * @param expiryDays - Session expiry in days (default: 7 days)
   * @returns Session object
   */
  createSession(
    userId: string,
    expiryDays: number = 7
  ): Session {
    const sessionId = this.uuid.v4();
    const token = this.uuid.v4(); // Session token
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + expiryDays * 24 * 60 * 60 * 1000
    );

    this.drizzle
      .insert(schema.sessions)
      .values({
        id: sessionId,
        userId,
        token,
        expiresAt: expiresAt.toISOString(),
        createdAt: now,
      })
      .run();

    return {
      id: sessionId,
      userId,
      token,
      expiresAt: expiresAt.toISOString(),
      createdAt: now,
      updatedAt: null,
    };
  }

  createOrUpdateSession(token: string, value: string): void {
    const session = this.getSessionByToken(token);
    if (session) {
      this.drizzle
        .update(schema.sessions)
        .set({
          token,
          createdAt: new Date(),
        })
        .where(eq(schema.sessions.id, session.id))
        .run();
    } else {
      const userId = JSON.parse(value).userId || "";
      // Validate user exists and is active
      const [user] = this.drizzle
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(eq(schema.users.id, userId), eq(schema.users.isActive, true))
        )
        .limit(1)
        .all();
      if (!user) {
        throw new Error(
          "Cannot create session: user does not exist or is not active"
        );
      }
      const sessionId = this.uuid.v4();
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      this.drizzle
        .insert(schema.sessions)
        .values({
          id: sessionId,
          userId,
          token,
          expiresAt,
          createdAt: new Date(),
        })
        .run();
    }
  }

  /**
   * Get session by token, filtering out expired sessions
   *
   * Note: This method filters expired sessions at the database level.
   * For explicit error codes and consistent validation, use validateSession()
   * from authHelpers.ts instead.
   *
   * @param token - Session token
   * @returns Session if found and not expired, null otherwise
   */
  getSessionByToken(token: string): Session | null {
    const now = new Date().toISOString();
    const [session] = this.drizzle
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.token, token),
          drizzleSql`${schema.sessions.expiresAt} > ${now}`
        )
      )
      .limit(1)
      .all();
    return session || null;
  }

  deleteSession(token: string): boolean {
    const result = this.drizzle
      .delete(schema.sessions)
      .where(eq(schema.sessions.token, token))
      .run();
    return result.changes > 0;
  }

  deleteSessionByToken(token: string): void {
    this.drizzle
      .delete(schema.sessions)
      .where(eq(schema.sessions.token, token))
      .run();
  }

  cleanupExpiredSessions(): number {
    const now = new Date().toISOString();
    const result = this.drizzle
      .delete(schema.sessions)
      .where(drizzleSql`${schema.sessions.expiresAt} <= ${now}`)
      .run();
    return result.changes;
  }

  deleteUserSessions(userId: string): number {
    const result = this.drizzle
      .delete(schema.sessions)
      .where(eq(schema.sessions.userId, userId))
      .run();

    return result.changes;
  }

  /**
   * Get active sessions for a user (type-safe)
   */
  getActiveSessions(userId: string): Session[] {
    const now = new Date().toISOString();

    const sessions = this.drizzle
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, userId),
          drizzleSql`${schema.sessions.expiresAt} > ${now}`
        )
      )
      .orderBy(desc(schema.sessions.createdAt))
      .all();

    return sessions as Session[];
  }

  /**
   * @deprecated Refresh tokens are not used in desktop EPOS architecture
   * Desktop apps use long-lived tokens with secure storage (Electron safeStorage)
   * This method is kept for backward compatibility but will always return null
   */
  getSessionByRefreshToken(_refreshToken: string): Session | null {
    // Refresh tokens not supported in desktop EPOS
    return null;
  }

  /**
   * @deprecated Refresh tokens are not used in desktop EPOS architecture
   * Desktop apps use long-lived tokens with secure storage (Electron safeStorage)
   * This method is kept for backward compatibility but will always return null
   */
  refreshAccessToken(
    _refreshToken: string,
    _accessTokenExpiryHours: number = 1
  ): Session | null {
    // Refresh tokens not supported in desktop EPOS
    return null;
  }
}
