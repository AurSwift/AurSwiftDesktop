/**
 * Common API Types
 *
 * Shared type definitions for API responses and common patterns.
 */

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
