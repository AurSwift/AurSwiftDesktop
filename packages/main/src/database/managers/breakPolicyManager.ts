import type {
  BreakTypeDefinition,
  NewBreakTypeDefinition,
  BreakPolicy,
  NewBreakPolicy,
  BreakPolicyRule,
  NewBreakPolicyRule,
} from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, asc, gte, lte, isNull, or, sql } from "drizzle-orm";
import * as schema from "../schema.js";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger("breakPolicyManager");

// ============================================================================
// Types for API responses
// ============================================================================

export interface BreakTypeWithDetails extends BreakTypeDefinition {
  // For potential future joins
}

export interface BreakPolicyWithRules extends BreakPolicy {
  rules: (BreakPolicyRule & {
    breakType: BreakTypeDefinition;
  })[];
}

export interface AvailableBreakOption {
  breakType: BreakTypeDefinition;
  rule: BreakPolicyRule;
  remainingCount: number; // How many more of this break can be taken today
  isAllowed: boolean; // Is it within time window?
  reason?: string; // Why not allowed, if applicable
}

// ============================================================================
// Default break types for small grocery shops (UK-compliant)
// ============================================================================

export const DEFAULT_BREAK_TYPES: Omit<
  NewBreakTypeDefinition,
  "business_id" | "publicId"
>[] = [
  {
    name: "Tea Break",
    code: "tea",
    description: "Short paid break for tea/coffee",
    default_duration_minutes: 15,
    min_duration_minutes: 10,
    max_duration_minutes: 20,
    is_paid: true,
    is_required: false,
    counts_as_worked_time: true,
    icon: "coffee",
    color: "#8B5CF6", // Purple
    sort_order: 1,
    is_active: true,
  },
  {
    name: "Lunch Break",
    code: "meal",
    description: "Main meal break (usually unpaid)",
    default_duration_minutes: 30,
    min_duration_minutes: 20,
    max_duration_minutes: 60,
    is_paid: false,
    is_required: true, // Required by UK law after 6 hours
    counts_as_worked_time: false,
    allowed_window_start: "11:00",
    allowed_window_end: "15:00",
    icon: "utensils",
    color: "#F59E0B", // Amber
    sort_order: 2,
    is_active: true,
  },
  {
    name: "Rest Break",
    code: "rest",
    description: "Short rest or comfort break",
    default_duration_minutes: 10,
    min_duration_minutes: 5,
    max_duration_minutes: 15,
    is_paid: true,
    is_required: false,
    counts_as_worked_time: true,
    icon: "pause",
    color: "#10B981", // Emerald
    sort_order: 3,
    is_active: true,
  },
  {
    name: "Other Break",
    code: "other",
    description: "Other type of break (emergency, personal)",
    default_duration_minutes: 15,
    min_duration_minutes: 5,
    max_duration_minutes: 30,
    is_paid: false, // Manager decides
    is_required: false,
    counts_as_worked_time: false,
    icon: "clock",
    color: "#6B7280", // Gray
    sort_order: 4,
    is_active: true,
  },
];

// ============================================================================
// Default policy rules for UK small grocery shops
// ============================================================================

interface DefaultPolicyRuleTemplate {
  breakTypeCode: string;
  min_shift_hours: number;
  max_shift_hours: number | null;
  allowed_count: number;
  is_mandatory: boolean;
  earliest_after_hours: number | null;
  latest_before_end_hours: number | null;
  priority: number;
}

export const DEFAULT_POLICY_RULES: DefaultPolicyRuleTemplate[] = [
  // Any shift: Rest breaks always available (comfort break, bathroom, etc.)
  {
    breakTypeCode: "rest",
    min_shift_hours: 0, // Always available from start
    max_shift_hours: null,
    allowed_count: 3, // Up to 3 short rest breaks per shift
    is_mandatory: false,
    earliest_after_hours: null, // Can take anytime
    latest_before_end_hours: null,
    priority: 1,
  },
  // Shifts 2+ hours: 1 tea break
  {
    breakTypeCode: "tea",
    min_shift_hours: 2,
    max_shift_hours: 4,
    allowed_count: 1,
    is_mandatory: false,
    earliest_after_hours: 0.5,
    latest_before_end_hours: 0.5,
    priority: 2,
  },
  // Shifts 4-6 hours: 1 paid tea break
  {
    breakTypeCode: "tea",
    min_shift_hours: 4,
    max_shift_hours: 6,
    allowed_count: 1,
    is_mandatory: false,
    earliest_after_hours: 1.5,
    latest_before_end_hours: 0.5,
    priority: 3,
  },
  // Shifts 6+ hours: 1 mandatory lunch (UK law: 20min after 6h)
  {
    breakTypeCode: "meal",
    min_shift_hours: 6,
    max_shift_hours: null,
    allowed_count: 1,
    is_mandatory: true, //  Working Time Directive
    earliest_after_hours: 3,
    latest_before_end_hours: 1,
    priority: 4,
  },
  // Shifts 6+ hours: 1 paid tea break in addition to lunch
  {
    breakTypeCode: "tea",
    min_shift_hours: 6,
    max_shift_hours: null,
    allowed_count: 1,
    is_mandatory: false,
    earliest_after_hours: 1.5,
    latest_before_end_hours: 0.5,
    priority: 5,
  },
  // Shifts 8+ hours: 2 paid tea breaks + lunch
  {
    breakTypeCode: "tea",
    min_shift_hours: 8,
    max_shift_hours: null,
    allowed_count: 2,
    is_mandatory: false,
    earliest_after_hours: 1.5,
    latest_before_end_hours: 0.5,
    priority: 6,
  },
  // Any shift: Other break type available (manager approval needed)
  {
    breakTypeCode: "other",
    min_shift_hours: 0,
    max_shift_hours: null,
    allowed_count: 1,
    is_mandatory: false,
    earliest_after_hours: null,
    latest_before_end_hours: null,
    priority: 10,
  },
];

// ============================================================================
// Manager Class
// ============================================================================

export class BreakPolicyManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  // ============================================================================
  // Break Type Definitions CRUD
  // ============================================================================

  /**
   * Get all break types for a business
   */
  async getBreakTypes(businessId: string): Promise<BreakTypeDefinition[]> {
    return this.db
      .select()
      .from(schema.breakTypeDefinitions)
      .where(
        and(
          eq(schema.breakTypeDefinitions.business_id, businessId),
          eq(schema.breakTypeDefinitions.is_active, true)
        )
      )
      .orderBy(asc(schema.breakTypeDefinitions.sort_order))
      .all();
  }

  /**
   * Get a single break type by ID
   */
  async getBreakTypeById(id: number): Promise<BreakTypeDefinition | null> {
    const [result] = this.db
      .select()
      .from(schema.breakTypeDefinitions)
      .where(eq(schema.breakTypeDefinitions.id, id))
      .limit(1)
      .all();
    return result || null;
  }

  /**
   * Get a break type by code for a business
   */
  async getBreakTypeByCode(
    businessId: string,
    code: string
  ): Promise<BreakTypeDefinition | null> {
    const [result] = this.db
      .select()
      .from(schema.breakTypeDefinitions)
      .where(
        and(
          eq(schema.breakTypeDefinitions.business_id, businessId),
          eq(schema.breakTypeDefinitions.code, code)
        )
      )
      .limit(1)
      .all();
    return result || null;
  }

  /**
   * Create a new break type
   */
  async createBreakType(
    data: Omit<NewBreakTypeDefinition, "publicId">
  ): Promise<BreakTypeDefinition> {
    const publicId = this.uuid.v4();

    this.db
      .insert(schema.breakTypeDefinitions)
      .values({
        ...data,
        publicId,
      })
      .run();

    const [created] = this.db
      .select()
      .from(schema.breakTypeDefinitions)
      .where(eq(schema.breakTypeDefinitions.publicId, publicId))
      .limit(1)
      .all();

    logger.info(
      `[createBreakType] Created break type: ${data.name} (${data.code})`
    );
    return created;
  }

  /**
   * Update a break type
   */
  async updateBreakType(
    id: number,
    data: Partial<NewBreakTypeDefinition>
  ): Promise<BreakTypeDefinition | null> {
    this.db
      .update(schema.breakTypeDefinitions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.breakTypeDefinitions.id, id))
      .run();

    const [updated] = this.db
      .select()
      .from(schema.breakTypeDefinitions)
      .where(eq(schema.breakTypeDefinitions.id, id))
      .limit(1)
      .all();

    return updated || null;
  }

  /**
   * Soft delete a break type (set is_active = false)
   */
  async deleteBreakType(id: number): Promise<boolean> {
    this.db
      .update(schema.breakTypeDefinitions)
      .set({ is_active: false, updatedAt: new Date() })
      .where(eq(schema.breakTypeDefinitions.id, id))
      .run();

    logger.info(`[deleteBreakType] Soft deleted break type: ${id}`);
    return true;
  }

  // ============================================================================
  // Break Policies CRUD
  // ============================================================================

  /**
   * Get all policies for a business
   */
  async getPolicies(businessId: string): Promise<BreakPolicy[]> {
    return this.db
      .select()
      .from(schema.breakPolicies)
      .where(eq(schema.breakPolicies.business_id, businessId))
      .orderBy(desc(schema.breakPolicies.is_default))
      .all();
  }

  /**
   * Get the active/default policy for a business
   */
  async getActivePolicy(businessId: string): Promise<BreakPolicy | null> {
    // First try to get the default policy
    let [policy] = this.db
      .select()
      .from(schema.breakPolicies)
      .where(
        and(
          eq(schema.breakPolicies.business_id, businessId),
          eq(schema.breakPolicies.is_default, true),
          eq(schema.breakPolicies.is_active, true)
        )
      )
      .limit(1)
      .all();

    // If no default, get any active policy
    if (!policy) {
      [policy] = this.db
        .select()
        .from(schema.breakPolicies)
        .where(
          and(
            eq(schema.breakPolicies.business_id, businessId),
            eq(schema.breakPolicies.is_active, true)
          )
        )
        .limit(1)
        .all();
    }

    return policy || null;
  }

  /**
   * Get a policy by ID with its rules
   */
  async getPolicyWithRules(
    policyId: number
  ): Promise<BreakPolicyWithRules | null> {
    const [policy] = this.db
      .select()
      .from(schema.breakPolicies)
      .where(eq(schema.breakPolicies.id, policyId))
      .limit(1)
      .all();

    if (!policy) return null;

    // Get all rules for this policy with break type details
    const rules = this.db
      .select({
        rule: schema.breakPolicyRules,
        breakType: schema.breakTypeDefinitions,
      })
      .from(schema.breakPolicyRules)
      .innerJoin(
        schema.breakTypeDefinitions,
        eq(
          schema.breakPolicyRules.break_type_id,
          schema.breakTypeDefinitions.id
        )
      )
      .where(eq(schema.breakPolicyRules.policy_id, policyId))
      .orderBy(asc(schema.breakPolicyRules.priority))
      .all();

    return {
      ...policy,
      rules: rules.map((r) => ({
        ...r.rule,
        breakType: r.breakType,
      })),
    };
  }

  /**
   * Create a new policy
   */
  async createPolicy(
    data: Omit<NewBreakPolicy, "publicId">
  ): Promise<BreakPolicy> {
    const publicId = this.uuid.v4();

    // If this is set as default, unset other defaults
    if (data.is_default) {
      this.db
        .update(schema.breakPolicies)
        .set({ is_default: false, updatedAt: new Date() })
        .where(eq(schema.breakPolicies.business_id, data.business_id))
        .run();
    }

    this.db
      .insert(schema.breakPolicies)
      .values({
        ...data,
        publicId,
      })
      .run();

    const [created] = this.db
      .select()
      .from(schema.breakPolicies)
      .where(eq(schema.breakPolicies.publicId, publicId))
      .limit(1)
      .all();

    logger.info(`[createPolicy] Created break policy: ${data.name}`);
    return created;
  }

  /**
   * Update a policy
   */
  async updatePolicy(
    id: number,
    data: Partial<NewBreakPolicy>
  ): Promise<BreakPolicy | null> {
    // Get current policy to check business_id
    const [current] = this.db
      .select()
      .from(schema.breakPolicies)
      .where(eq(schema.breakPolicies.id, id))
      .limit(1)
      .all();

    if (!current) return null;

    // If setting as default, unset other defaults
    if (data.is_default) {
      this.db
        .update(schema.breakPolicies)
        .set({ is_default: false, updatedAt: new Date() })
        .where(
          and(
            eq(schema.breakPolicies.business_id, current.business_id),
            sql`${schema.breakPolicies.id} != ${id}`
          )
        )
        .run();
    }

    this.db
      .update(schema.breakPolicies)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.breakPolicies.id, id))
      .run();

    const [updated] = this.db
      .select()
      .from(schema.breakPolicies)
      .where(eq(schema.breakPolicies.id, id))
      .limit(1)
      .all();

    return updated || null;
  }

  /**
   * Delete a policy (cascade deletes rules)
   */
  async deletePolicy(id: number): Promise<boolean> {
    // Rules are cascade deleted
    this.db
      .delete(schema.breakPolicies)
      .where(eq(schema.breakPolicies.id, id))
      .run();

    logger.info(`[deletePolicy] Deleted break policy: ${id}`);
    return true;
  }

  // ============================================================================
  // Policy Rules CRUD
  // ============================================================================

  /**
   * Get rules for a policy
   */
  async getPolicyRules(policyId: number): Promise<BreakPolicyRule[]> {
    return this.db
      .select()
      .from(schema.breakPolicyRules)
      .where(eq(schema.breakPolicyRules.policy_id, policyId))
      .orderBy(asc(schema.breakPolicyRules.priority))
      .all();
  }

  /**
   * Create a policy rule
   */
  async createPolicyRule(
    data: Omit<NewBreakPolicyRule, "publicId">
  ): Promise<BreakPolicyRule> {
    const publicId = this.uuid.v4();

    this.db
      .insert(schema.breakPolicyRules)
      .values({
        ...data,
        publicId,
      })
      .run();

    const [created] = this.db
      .select()
      .from(schema.breakPolicyRules)
      .where(eq(schema.breakPolicyRules.publicId, publicId))
      .limit(1)
      .all();

    logger.info(`[createPolicyRule] Created rule for policy ${data.policy_id}`);
    return created;
  }

  /**
   * Update a policy rule
   */
  async updatePolicyRule(
    id: number,
    data: Partial<NewBreakPolicyRule>
  ): Promise<BreakPolicyRule | null> {
    this.db
      .update(schema.breakPolicyRules)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.breakPolicyRules.id, id))
      .run();

    const [updated] = this.db
      .select()
      .from(schema.breakPolicyRules)
      .where(eq(schema.breakPolicyRules.id, id))
      .limit(1)
      .all();

    return updated || null;
  }

  /**
   * Delete a policy rule
   */
  async deletePolicyRule(id: number): Promise<boolean> {
    this.db
      .delete(schema.breakPolicyRules)
      .where(eq(schema.breakPolicyRules.id, id))
      .run();

    logger.info(`[deletePolicyRule] Deleted rule: ${id}`);
    return true;
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Get available break options for a shift based on policy rules
   * Considers: shift length, already taken breaks, time of day
   * Auto-seeds default policy if none exists
   */
  async getAvailableBreaksForShift(
    businessId: string,
    shiftId: string,
    shiftStartTime: Date,
    shiftEndTime?: Date | null
  ): Promise<AvailableBreakOption[]> {
    // Get active policy
    let policy = await this.getActivePolicy(businessId);

    // Auto-seed defaults if no policy exists
    if (!policy) {
      logger.info(
        `[getAvailableBreaksForShift] No active policy for business ${businessId}, auto-seeding defaults...`
      );
      try {
        await this.seedDefaultsForBusiness(businessId);
        policy = await this.getActivePolicy(businessId);
        if (policy) {
          logger.info(
            `[getAvailableBreaksForShift] Successfully auto-seeded defaults for business ${businessId}`
          );
        }
      } catch (seedError) {
        logger.error(
          `[getAvailableBreaksForShift] Failed to auto-seed defaults:`,
          seedError
        );
      }
    }

    if (!policy) {
      logger.warn(
        `[getAvailableBreaksForShift] Still no active policy after seeding for business ${businessId}`
      );
      return [];
    }

    // Calculate shift duration so far
    const now = new Date();
    const effectiveEnd = shiftEndTime || now;
    const shiftDurationHours =
      (effectiveEnd.getTime() - shiftStartTime.getTime()) / (1000 * 60 * 60);

    logger.debug(
      `[getAvailableBreaksForShift] Shift duration: ${shiftDurationHours.toFixed(
        2
      )} hours`
    );

    // Get policy with rules
    const policyWithRules = await this.getPolicyWithRules(policy.id);
    if (!policyWithRules) {
      logger.warn(
        `[getAvailableBreaksForShift] Policy ${policy.id} has no rules`
      );
      return [];
    }

    // Get breaks already taken this shift
    const takenBreaks = this.db
      .select()
      .from(schema.breaks)
      .where(
        and(
          eq(schema.breaks.shift_id, shiftId),
          sql`${schema.breaks.status} != 'cancelled'`
        )
      )
      .all();

    // Count breaks by type code
    const breakCountByType: Record<string, number> = {};
    for (const brk of takenBreaks) {
      breakCountByType[brk.type] = (breakCountByType[brk.type] || 0) + 1;
    }

    // Build available options
    const options: AvailableBreakOption[] = [];
    const currentTime = now.getHours() + now.getMinutes() / 60;

    logger.info(
      `[getAvailableBreaksForShift] Processing ${
        policyWithRules.rules.length
      } rules for shift duration ${shiftDurationHours.toFixed(2)}h`
    );

    for (const rule of policyWithRules.rules) {
      const breakType = rule.breakType;

      // Check if shift length qualifies for this rule
      if (shiftDurationHours < rule.min_shift_hours) {
        logger.debug(
          `[getAvailableBreaksForShift] Skipping rule ${
            breakType.code
          }: shift ${shiftDurationHours.toFixed(2)}h < min ${
            rule.min_shift_hours
          }h`
        );
        continue;
      }
      if (rule.max_shift_hours && shiftDurationHours > rule.max_shift_hours) {
        logger.debug(
          `[getAvailableBreaksForShift] Skipping rule ${
            breakType.code
          }: shift ${shiftDurationHours.toFixed(2)}h > max ${
            rule.max_shift_hours
          }h`
        );
        continue;
      }

      // Calculate remaining count
      const takenCount = breakCountByType[breakType.code] || 0;
      const remainingCount = Math.max(0, rule.allowed_count - takenCount);

      // Check time window if specified
      let isAllowed = remainingCount > 0;
      let reason: string | undefined;

      if (breakType.allowed_window_start && breakType.allowed_window_end) {
        const [startH, startM] = breakType.allowed_window_start
          .split(":")
          .map(Number);
        const [endH, endM] = breakType.allowed_window_end
          .split(":")
          .map(Number);
        const windowStart = startH + startM / 60;
        const windowEnd = endH + endM / 60;

        if (currentTime < windowStart || currentTime > windowEnd) {
          isAllowed = false;
          reason = `Only available ${breakType.allowed_window_start} - ${breakType.allowed_window_end}`;
        }
      }

      // Check earliest/latest timing rules
      const hoursWorked =
        (now.getTime() - shiftStartTime.getTime()) / (1000 * 60 * 60);
      if (
        rule.earliest_after_hours &&
        hoursWorked < rule.earliest_after_hours
      ) {
        isAllowed = false;
        reason = `Available after ${rule.earliest_after_hours} hours of work`;
      }

      // Add to options (even if not allowed, so UI can show why)
      options.push({
        breakType,
        rule,
        remainingCount,
        isAllowed,
        reason,
      });
    }

    logger.info(
      `[getAvailableBreaksForShift] Found ${
        options.length
      } matching break options for ${shiftDurationHours.toFixed(2)}h shift`
    );

    // If no rules match the current shift duration, show all break types
    // but mark them as "not yet available" with the minimum time required
    if (options.length === 0 && policyWithRules.rules.length > 0) {
      logger.info(
        `[getAvailableBreaksForShift] No rules match shift duration, showing all break types with availability info`
      );

      // Group rules by break type and find the earliest applicable rule
      const breakTypeMinHours: Record<
        string,
        { rule: (typeof policyWithRules.rules)[0]; minHours: number }
      > = {};

      for (const rule of policyWithRules.rules) {
        const code = rule.breakType.code;
        if (
          !breakTypeMinHours[code] ||
          rule.min_shift_hours < breakTypeMinHours[code].minHours
        ) {
          breakTypeMinHours[code] = { rule, minHours: rule.min_shift_hours };
        }
      }

      // Add each break type with "not yet available" status
      for (const [code, { rule, minHours }] of Object.entries(
        breakTypeMinHours
      )) {
        const hoursRemaining = minHours - shiftDurationHours;
        options.push({
          breakType: rule.breakType,
          rule,
          remainingCount: rule.allowed_count,
          isAllowed: false,
          reason: `Available after ${minHours}h shift (${hoursRemaining.toFixed(
            1
          )}h remaining)`,
        });
      }

      logger.info(
        `[getAvailableBreaksForShift] Added ${options.length} break types with future availability`
      );
    }

    return options;
  }

  /**
   * Check if a break is mandatory (required by law/policy)
   */
  async isMandatoryBreakRequired(
    businessId: string,
    shiftStartTime: Date,
    breaksTaken: { type: string }[]
  ): Promise<{
    required: boolean;
    reason?: string;
    breakTypeCode?: string;
  }> {
    const policy = await this.getActivePolicy(businessId);
    if (!policy) return { required: false };

    const policyWithRules = await this.getPolicyWithRules(policy.id);
    if (!policyWithRules) return { required: false };

    const now = new Date();
    const hoursWorked =
      (now.getTime() - shiftStartTime.getTime()) / (1000 * 60 * 60);

    // Check if worked beyond max consecutive hours
    if (hoursWorked >= policy.max_consecutive_hours) {
      // Find mandatory break types
      const mandatoryRule = policyWithRules.rules.find(
        (r) =>
          r.is_mandatory &&
          hoursWorked >= r.min_shift_hours &&
          (!r.max_shift_hours || hoursWorked <= r.max_shift_hours)
      );

      if (mandatoryRule) {
        const takenOfType = breaksTaken.filter(
          (b) => b.type === mandatoryRule.breakType.code
        ).length;
        if (takenOfType < mandatoryRule.allowed_count) {
          return {
            required: true,
            reason: `UK law requires a ${mandatoryRule.breakType.name} after ${policy.max_consecutive_hours} hours`,
            breakTypeCode: mandatoryRule.breakType.code,
          };
        }
      }
    }

    return { required: false };
  }

  // ============================================================================
  // Seeding & Initialization
  // ============================================================================

  /**
   * Seed default break types and policy for a business
   */
  async seedDefaultsForBusiness(businessId: string): Promise<{
    breakTypes: BreakTypeDefinition[];
    policy: BreakPolicy;
    rules: BreakPolicyRule[];
  }> {
    logger.info(
      `[seedDefaultsForBusiness] Seeding break defaults for business ${businessId}`
    );

    // Check if already seeded
    const existingTypes = await this.getBreakTypes(businessId);
    if (existingTypes.length > 0) {
      logger.info(
        `[seedDefaultsForBusiness] Business already has break types, skipping`
      );
      const policy = await this.getActivePolicy(businessId);
      const rules = policy ? await this.getPolicyRules(policy.id) : [];
      return { breakTypes: existingTypes, policy: policy!, rules };
    }

    // Create break types
    const breakTypes: BreakTypeDefinition[] = [];
    for (const typeTemplate of DEFAULT_BREAK_TYPES) {
      const created = await this.createBreakType({
        ...typeTemplate,
        business_id: businessId,
      });
      breakTypes.push(created);
    }

    // Create default policy
    const policy = await this.createPolicy({
      business_id: businessId,
      name: "Standard Policy",
      description:
        "Default break policy for small grocery shops, compliant with Working Time Directive",
      max_consecutive_hours: 6,
      warn_before_required_minutes: 30,
      auto_enforce_breaks: true,
      allow_skip_break: false,
      require_manager_override: true,
      min_staff_for_break: 1,
      is_active: true,
      is_default: true,
    });

    // Create policy rules
    const rules: BreakPolicyRule[] = [];
    for (const ruleTemplate of DEFAULT_POLICY_RULES) {
      // Find the break type by code
      const breakType = breakTypes.find(
        (bt) => bt.code === ruleTemplate.breakTypeCode
      );
      if (!breakType) continue;

      const rule = await this.createPolicyRule({
        policy_id: policy.id,
        break_type_id: breakType.id,
        min_shift_hours: ruleTemplate.min_shift_hours,
        max_shift_hours: ruleTemplate.max_shift_hours,
        allowed_count: ruleTemplate.allowed_count,
        is_mandatory: ruleTemplate.is_mandatory,
        earliest_after_hours: ruleTemplate.earliest_after_hours,
        latest_before_end_hours: ruleTemplate.latest_before_end_hours,
        priority: ruleTemplate.priority,
      });
      rules.push(rule);
    }

    logger.info(
      `[seedDefaultsForBusiness] Created ${breakTypes.length} break types, 1 policy, ${rules.length} rules`
    );

    return { breakTypes, policy, rules };
  }

  /**
   * Check if business has break policy setup
   */
  async hasBreakPolicySetup(businessId: string): Promise<boolean> {
    const types = await this.getBreakTypes(businessId);
    const policy = await this.getActivePolicy(businessId);
    return types.length > 0 && policy !== null;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: BreakPolicyManager | null = null;

export function getBreakPolicyManager(
  drizzle: DrizzleDB,
  uuid: any
): BreakPolicyManager {
  if (!instance) {
    instance = new BreakPolicyManager(drizzle, uuid);
  }
  return instance;
}

export function createBreakPolicyManager(
  drizzle: DrizzleDB,
  uuid: any
): BreakPolicyManager {
  return new BreakPolicyManager(drizzle, uuid);
}
