/**
 * Rate Limiter for Authentication
 * 
 * Implements rate limiting to prevent brute force attacks on login endpoints.
 * Uses in-memory storage with automatic cleanup of expired entries.
 */

import { getLogger } from "./logger.js";

const logger = getLogger("rateLimiter");

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil?: number; // Account lockout timestamp
}

/**
 * Rate limit storage - maps identifier (IP or username) to attempt tracking
 * In production, consider using Redis for distributed rate limiting
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const MAX_ATTEMPTS = 5; // Maximum failed attempts before lockout
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes lockout after max attempts

// Cleanup interval - remove expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove if both reset time and lockout time have passed
    if (
      entry.resetAt < now &&
      (!entry.lockedUntil || entry.lockedUntil < now)
    ) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`[RateLimiter] Cleaned up ${cleaned} expired rate limit entries`);
  }
}, 5 * 60 * 1000); // Every 5 minutes

/**
 * Get identifier for rate limiting
 * For desktop EPOS systems, we use terminal ID + username combination
 * This prevents one compromised terminal from affecting others
 */
function getRateLimitKey(
  identifier: string,
  type: "ip" | "username" | "terminal" = "username",
  terminalId?: string
): string {
  // For desktop EPOS: Use terminal + username combination
  // This provides better security than username alone
  if (type === "username" && terminalId) {
    return `terminal:${terminalId}:user:${identifier}`;
  }
  return `${type}:${identifier}`;
}

/**
 * Check if request should be rate limited
 * 
 * @param identifier - IP address, username, or terminal ID
 * @param type - Type of identifier ("ip", "username", or "terminal")
 * @param terminalId - Optional terminal ID for combined rate limiting (recommended for EPOS)
 * @returns Object with allowed status and remaining attempts
 */
export function checkRateLimit(
  identifier: string,
  type: "ip" | "username" | "terminal" = "username",
  terminalId?: string
): {
  allowed: boolean;
  remainingAttempts: number;
  resetAt: number;
  lockedUntil?: number;
  message?: string;
} {
  const key = getRateLimitKey(identifier, type, terminalId);
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // If entry doesn't exist or window has expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + WINDOW_MS,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Check if account is locked
  if (entry.lockedUntil && entry.lockedUntil > now) {
    const minutesRemaining = Math.ceil((entry.lockedUntil - now) / (60 * 1000));
    return {
      allowed: false,
      remainingAttempts: 0,
      resetAt: entry.resetAt,
      lockedUntil: entry.lockedUntil,
      message: `Too many failed login attempts. Account locked for ${minutesRemaining} more minute(s).`,
    };
  }
  
  // Check if max attempts reached
  if (entry.count >= MAX_ATTEMPTS) {
    // Lock the account
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    rateLimitStore.set(key, entry);
    
    logger.warn(
      `[RateLimiter] Account locked due to too many failed attempts: ${identifier}`
    );
    
    return {
      allowed: false,
      remainingAttempts: 0,
      resetAt: entry.resetAt,
      lockedUntil: entry.lockedUntil,
      message: `Too many failed login attempts. Account locked for ${LOCKOUT_DURATION_MS / (60 * 1000)} minutes.`,
    };
  }
  
  const remainingAttempts = MAX_ATTEMPTS - entry.count;
  
  return {
    allowed: true,
    remainingAttempts,
    resetAt: entry.resetAt,
  };
}

/**
 * Record a failed login attempt
 * 
 * @param identifier - IP address, username, or terminal ID
 * @param type - Type of identifier
 * @param terminalId - Optional terminal ID for combined rate limiting
 */
export function recordFailedAttempt(
  identifier: string,
  type: "ip" | "username" | "terminal" = "username",
  terminalId?: string
): void {
  const key = getRateLimitKey(identifier, type, terminalId);
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + WINDOW_MS,
    };
  }
  
  entry.count++;
  rateLimitStore.set(key, entry);
  
  logger.info(
    `[RateLimiter] Failed attempt recorded for ${identifier}. ` +
      `Attempts: ${entry.count}/${MAX_ATTEMPTS}`
  );
}

/**
 * Clear rate limit for successful login
 * 
 * @param identifier - IP address, username, or terminal ID
 * @param type - Type of identifier
 * @param terminalId - Optional terminal ID for combined rate limiting
 */
export function clearRateLimit(
  identifier: string,
  type: "ip" | "username" | "terminal" = "username",
  terminalId?: string
): void {
  const key = getRateLimitKey(identifier, type, terminalId);
  rateLimitStore.delete(key);
  logger.debug(`[RateLimiter] Cleared rate limit for ${identifier}`);
}

/**
 * Get rate limit statistics (for monitoring/debugging)
 */
export function getRateLimitStats() {
  return {
    totalEntries: rateLimitStore.size,
    entries: Array.from(rateLimitStore.entries()).map(([key, entry]) => ({
      key,
      count: entry.count,
      resetAt: new Date(entry.resetAt),
      lockedUntil: entry.lockedUntil ? new Date(entry.lockedUntil) : null,
    })),
  };
}
