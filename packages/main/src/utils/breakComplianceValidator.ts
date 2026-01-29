/**
 * Break Compliance Validator
 *
 * Validates break compliance with labor law requirements:
 * - Required breaks (e.g., meal break after 6 hours)
 * - Minimum break duration
 * - Maximum consecutive work hours
 *
 * Now supports loading policy settings from database when available.
 */

import type { DatabaseManagers } from "../database/index.js";
import type {
  Shift,
  Break,
  BreakPolicy,
  BreakTypeDefinition,
} from "../database/schema.js";
import { getLogger } from "./logger.js";

const logger = getLogger("breakComplianceValidator");

export interface BreakComplianceResult {
  compliant: boolean;
  warnings: string[];
  violations: string[];
  isRequired: boolean;
  requiredReason?: string;
  minimumDurationSeconds?: number;
}

export interface BreakRequirementCheck {
  requiresBreak: boolean;
  reason: string;
  minimumDurationSeconds: number;
}

// Cache for policy settings per business
interface PolicyCache {
  policy: BreakPolicy | null;
  breakTypes: BreakTypeDefinition[];
  loadedAt: number;
}

const policyCache: Map<string, PolicyCache> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class BreakComplianceValidator {
  // Default labor law constants (used when no policy configured)
  private readonly DEFAULT_REQUIRED_BREAK_AFTER_HOURS = 6;
  private readonly DEFAULT_MINIMUM_MEAL_BREAK_SECONDS = 30 * 60; // 30 minutes
  private readonly DEFAULT_MINIMUM_REST_BREAK_SECONDS = 10 * 60; // 10 minutes
  private readonly DEFAULT_MAX_CONSECUTIVE_HOURS = 6;

  /**
   * Load policy settings from database with caching
   */
  private async loadPolicy(
    businessId: string,
    db: DatabaseManagers
  ): Promise<PolicyCache> {
    // Check cache
    const cached = policyCache.get(businessId);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached;
    }

    try {
      // Load from database
      const policy = await db.breakPolicy.getActivePolicy(businessId);
      const breakTypes = await db.breakPolicy.getBreakTypes(businessId);

      const cacheEntry: PolicyCache = {
        policy,
        breakTypes,
        loadedAt: Date.now(),
      };

      policyCache.set(businessId, cacheEntry);
      return cacheEntry;
    } catch (error) {
      logger.warn(
        `[loadPolicy] Failed to load policy for business ${businessId}:`,
        error
      );
      // Return empty cache on error
      return {
        policy: null,
        breakTypes: [],
        loadedAt: Date.now(),
      };
    }
  }

  /**
   * Get policy settings or fall back to defaults
   */
  private getPolicySettings(policyCache: PolicyCache): {
    requiredBreakAfterHours: number;
    minimumMealBreakSeconds: number;
    minimumRestBreakSeconds: number;
    maxConsecutiveHours: number;
  } {
    const { policy, breakTypes } = policyCache;

    if (policy) {
      // Find meal and rest break type durations
      const mealType = breakTypes.find((t) => t.code === "meal");
      const restType = breakTypes.find((t) => t.code === "rest");

      return {
        requiredBreakAfterHours: policy.max_consecutive_hours,
        minimumMealBreakSeconds: mealType
          ? mealType.min_duration_minutes * 60
          : this.DEFAULT_MINIMUM_MEAL_BREAK_SECONDS,
        minimumRestBreakSeconds: restType
          ? restType.min_duration_minutes * 60
          : this.DEFAULT_MINIMUM_REST_BREAK_SECONDS,
        maxConsecutiveHours: policy.max_consecutive_hours,
      };
    }

    // Fall back to defaults
    return {
      requiredBreakAfterHours: this.DEFAULT_REQUIRED_BREAK_AFTER_HOURS,
      minimumMealBreakSeconds: this.DEFAULT_MINIMUM_MEAL_BREAK_SECONDS,
      minimumRestBreakSeconds: this.DEFAULT_MINIMUM_REST_BREAK_SECONDS,
      maxConsecutiveHours: this.DEFAULT_MAX_CONSECUTIVE_HOURS,
    };
  }

  /**
   * Check if a break is required for a shift
   *
   * @param shift - Shift to check
   * @param db - Database managers
   * @returns Break requirement check result
   */
  async checkBreakRequirement(
    shift: Shift,
    db: DatabaseManagers
  ): Promise<BreakRequirementCheck> {
    try {
      // Load policy settings
      const policyCache = await this.loadPolicy(shift.business_id, db);
      const settings = this.getPolicySettings(policyCache);

      // Get clock-in event to calculate work duration
      const clockIn = db.timeTracking.getClockEventById(shift.clock_in_id);
      if (!clockIn) {
        logger.warn(
          `[checkBreakRequirement] Clock-in event not found for shift ${shift.id}`
        );
        return {
          requiresBreak: false,
          reason: "Cannot determine shift duration",
          minimumDurationSeconds: settings.minimumRestBreakSeconds,
        };
      }

      const now = new Date();
      const clockInTime =
        typeof clockIn.timestamp === "string"
          ? new Date(clockIn.timestamp)
          : new Date(clockIn.timestamp);
      const workDurationMs = now.getTime() - clockInTime.getTime();
      const workDurationHours = workDurationMs / (1000 * 60 * 60);

      // Get existing breaks for this shift
      const breaks = db.timeTracking.getBreaksByShift(shift.id);
      const completedBreaks = breaks.filter(
        (b) => b.status === "completed" && b.duration_seconds
      );

      // Calculate consecutive work hours (time since last break or clock-in)
      const lastBreakEnd =
        completedBreaks.length > 0
          ? (() => {
              const lastBreak = completedBreaks[completedBreaks.length - 1];
              const endTime =
                typeof lastBreak.end_time === "number"
                  ? new Date(lastBreak.end_time)
                  : typeof lastBreak.end_time === "string"
                  ? new Date(lastBreak.end_time)
                  : lastBreak.end_time instanceof Date
                  ? lastBreak.end_time
                  : new Date();
              return endTime;
            })()
          : clockInTime;

      const consecutiveWorkMs = now.getTime() - lastBreakEnd.getTime();
      const consecutiveWorkHours = consecutiveWorkMs / (1000 * 60 * 60);

      // Check if break is required
      if (workDurationHours >= settings.requiredBreakAfterHours) {
        // Check if meal break already taken
        const hasMealBreak = completedBreaks.some((b) => b.type === "meal");
        if (!hasMealBreak) {
          return {
            requiresBreak: true,
            reason: `Labor law: Meal break required after ${settings.requiredBreakAfterHours} hours of work`,
            minimumDurationSeconds: settings.minimumMealBreakSeconds,
          };
        }
      }

      // Check consecutive work hours
      if (consecutiveWorkHours >= settings.maxConsecutiveHours) {
        return {
          requiresBreak: true,
          reason: `Labor law: Break required after ${settings.maxConsecutiveHours} consecutive hours of work`,
          minimumDurationSeconds: settings.minimumRestBreakSeconds,
        };
      }

      return {
        requiresBreak: false,
        reason: "No break required at this time",
        minimumDurationSeconds: settings.minimumRestBreakSeconds,
      };
    } catch (error) {
      logger.error(
        `[checkBreakRequirement] Error checking break requirement for shift ${shift.id}:`,
        error
      );
      return {
        requiresBreak: false,
        reason: "Error checking break requirement",
        minimumDurationSeconds: this.DEFAULT_MINIMUM_REST_BREAK_SECONDS,
      };
    }
  }

  /**
   * Validate break compliance when starting a break
   *
   * @param shift - Shift the break is for
   * @param breakType - Type of break
   * @param db - Database managers
   * @returns Compliance validation result
   */
  async validateBreakStart(
    shift: Shift,
    breakType: "meal" | "rest" | "other",
    db: DatabaseManagers
  ): Promise<BreakComplianceResult> {
    const warnings: string[] = [];
    const violations: string[] = [];

    try {
      // Check if break is required
      const requirement = await this.checkBreakRequirement(shift, db);
      const isRequired = requirement.requiresBreak;

      // If meal break is required but user is taking a rest break, warn
      if (
        isRequired &&
        requirement.reason.includes("Meal break") &&
        breakType !== "meal"
      ) {
        warnings.push(
          `Meal break is required but you're taking a ${breakType} break. Consider taking a meal break instead.`
        );
      }

      return {
        compliant: violations.length === 0,
        warnings,
        violations,
        isRequired,
        requiredReason: isRequired ? requirement.reason : undefined,
        minimumDurationSeconds: requirement.minimumDurationSeconds,
      };
    } catch (error) {
      logger.error(
        `[validateBreakStart] Error validating break start for shift ${shift.id}:`,
        error
      );
      return {
        compliant: false,
        warnings: [],
        violations: [
          `Error validating break: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
        isRequired: false,
      };
    }
  }

  /**
   * Validate break compliance when ending a break
   *
   * @param breakRecord - Break being ended
   * @param shift - Shift the break belongs to
   * @param db - Database managers for policy lookup
   * @returns Compliance validation result
   */
  async validateBreakEnd(
    breakRecord: Break,
    shift: Shift,
    db: DatabaseManagers
  ): Promise<BreakComplianceResult> {
    const warnings: string[] = [];
    const violations: string[] = [];

    try {
      // Load policy settings
      const policyCache = await this.loadPolicy(shift.business_id, db);
      const settings = this.getPolicySettings(policyCache);

      // Calculate break duration
      const startTimeMs =
        typeof breakRecord.start_time === "number"
          ? breakRecord.start_time
          : breakRecord.start_time instanceof Date
          ? breakRecord.start_time.getTime()
          : new Date(breakRecord.start_time as string).getTime();

      const endTimeMs =
        breakRecord.end_time === null || breakRecord.end_time === undefined
          ? Date.now()
          : typeof breakRecord.end_time === "number"
          ? breakRecord.end_time
          : breakRecord.end_time instanceof Date
          ? breakRecord.end_time.getTime()
          : new Date(breakRecord.end_time as string).getTime();

      const durationSeconds = Math.floor((endTimeMs - startTimeMs) / 1000) || 0;

      // Check minimum duration if break was required
      if (breakRecord.is_required && breakRecord.minimum_duration_seconds) {
        const minimumDuration = breakRecord.minimum_duration_seconds;
        if (durationSeconds < minimumDuration) {
          violations.push(
            `Break duration (${Math.floor(
              durationSeconds / 60
            )} minutes) is shorter than required minimum (${Math.floor(
              minimumDuration / 60
            )} minutes). This may violate labor law requirements.`
          );
        }
      }

      // Check if break meets minimum duration for type (using policy settings)
      const minimumForType =
        breakRecord.type === "meal"
          ? settings.minimumMealBreakSeconds
          : settings.minimumRestBreakSeconds;

      if (durationSeconds < minimumForType) {
        warnings.push(
          `Break duration (${Math.floor(
            durationSeconds / 60
          )} minutes) is shorter than recommended minimum for ${
            breakRecord.type
          } breaks (${Math.floor(minimumForType / 60)} minutes).`
        );
      }

      return {
        compliant: violations.length === 0,
        warnings,
        violations,
        isRequired: breakRecord.is_required || false,
        requiredReason: breakRecord.required_reason || undefined,
        minimumDurationSeconds:
          breakRecord.minimum_duration_seconds || undefined,
      };
    } catch (error) {
      logger.error(
        `[validateBreakEnd] Error validating break end for break ${breakRecord.id}:`,
        error
      );
      return {
        compliant: false,
        warnings: [],
        violations: [
          `Error validating break: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
        isRequired: false,
      };
    }
  }

  /**
   * Clear policy cache (useful for testing or when policies are updated)
   */
  clearCache(businessId?: string): void {
    if (businessId) {
      policyCache.delete(businessId);
    } else {
      policyCache.clear();
    }
  }
}

// Export singleton instance for convenience
export const breakComplianceValidator = new BreakComplianceValidator();
