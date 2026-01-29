import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("breakPolicyHandlers");

export function registerBreakPolicyHandlers() {
  // ============================================================================
  // Break Type Definitions
  // ============================================================================

  /**
   * Get all break types for a business
   */
  ipcMain.handle(
    "breakPolicy:getBreakTypes",
    async (_event, businessId: string) => {
      try {
        const db = await getDatabase();
        const breakTypes = await db.breakPolicy.getBreakTypes(businessId);
        return { success: true, data: breakTypes };
      } catch (error) {
        logger.error("[breakPolicy:getBreakTypes] Error:", error);
        return {
          success: false,
          message: "Failed to fetch break types",
          error,
        };
      }
    }
  );

  /**
   * Get a single break type by ID
   */
  ipcMain.handle("breakPolicy:getBreakTypeById", async (_event, id: number) => {
    try {
      const db = await getDatabase();
      const breakType = await db.breakPolicy.getBreakTypeById(id);
      return { success: true, data: breakType };
    } catch (error) {
      logger.error("[breakPolicy:getBreakTypeById] Error:", error);
      return { success: false, message: "Failed to fetch break type", error };
    }
  });

  /**
   * Create a new break type
   */
  ipcMain.handle(
    "breakPolicy:createBreakType",
    async (
      _event,
      data: {
        business_id: string;
        name: string;
        code: string;
        description?: string;
        default_duration_minutes: number;
        min_duration_minutes: number;
        max_duration_minutes: number;
        is_paid: boolean;
        is_required: boolean;
        counts_as_worked_time: boolean;
        allowed_window_start?: string;
        allowed_window_end?: string;
        icon?: string;
        color?: string;
        sort_order?: number;
      }
    ) => {
      try {
        const db = await getDatabase();
        const breakType = await db.breakPolicy.createBreakType(data);
        logger.info(`[breakPolicy:createBreakType] Created: ${data.name}`);
        return { success: true, data: breakType };
      } catch (error) {
        logger.error("[breakPolicy:createBreakType] Error:", error);
        return {
          success: false,
          message: "Failed to create break type",
          error,
        };
      }
    }
  );

  /**
   * Update a break type
   */
  ipcMain.handle(
    "breakPolicy:updateBreakType",
    async (
      _event,
      data: {
        id: number;
        updates: Partial<{
          name: string;
          code: string;
          description: string;
          default_duration_minutes: number;
          min_duration_minutes: number;
          max_duration_minutes: number;
          is_paid: boolean;
          is_required: boolean;
          counts_as_worked_time: boolean;
          allowed_window_start: string;
          allowed_window_end: string;
          icon: string;
          color: string;
          sort_order: number;
          is_active: boolean;
        }>;
      }
    ) => {
      try {
        const db = await getDatabase();
        const breakType = await db.breakPolicy.updateBreakType(
          data.id,
          data.updates
        );
        logger.info(`[breakPolicy:updateBreakType] Updated: ${data.id}`);
        return { success: true, data: breakType };
      } catch (error) {
        logger.error("[breakPolicy:updateBreakType] Error:", error);
        return {
          success: false,
          message: "Failed to update break type",
          error,
        };
      }
    }
  );

  /**
   * Delete (soft) a break type
   */
  ipcMain.handle("breakPolicy:deleteBreakType", async (_event, id: number) => {
    try {
      const db = await getDatabase();
      await db.breakPolicy.deleteBreakType(id);
      logger.info(`[breakPolicy:deleteBreakType] Deleted: ${id}`);
      return { success: true };
    } catch (error) {
      logger.error("[breakPolicy:deleteBreakType] Error:", error);
      return { success: false, message: "Failed to delete break type", error };
    }
  });

  // ============================================================================
  // Break Policies
  // ============================================================================

  /**
   * Get all policies for a business
   */
  ipcMain.handle(
    "breakPolicy:getPolicies",
    async (_event, businessId: string) => {
      try {
        const db = await getDatabase();
        const policies = await db.breakPolicy.getPolicies(businessId);
        return { success: true, data: policies };
      } catch (error) {
        logger.error("[breakPolicy:getPolicies] Error:", error);
        return { success: false, message: "Failed to fetch policies", error };
      }
    }
  );

  /**
   * Get the active/default policy for a business
   */
  ipcMain.handle(
    "breakPolicy:getActivePolicy",
    async (_event, businessId: string) => {
      try {
        const db = await getDatabase();
        const policy = await db.breakPolicy.getActivePolicy(businessId);
        return { success: true, data: policy };
      } catch (error) {
        logger.error("[breakPolicy:getActivePolicy] Error:", error);
        return {
          success: false,
          message: "Failed to fetch active policy",
          error,
        };
      }
    }
  );

  /**
   * Get a policy with its rules
   */
  ipcMain.handle(
    "breakPolicy:getPolicyWithRules",
    async (_event, policyId: number) => {
      try {
        const db = await getDatabase();
        const policy = await db.breakPolicy.getPolicyWithRules(policyId);
        return { success: true, data: policy };
      } catch (error) {
        logger.error("[breakPolicy:getPolicyWithRules] Error:", error);
        return {
          success: false,
          message: "Failed to fetch policy with rules",
          error,
        };
      }
    }
  );

  /**
   * Create a new policy
   */
  ipcMain.handle(
    "breakPolicy:createPolicy",
    async (
      _event,
      data: {
        business_id: string;
        name: string;
        description?: string;
        max_consecutive_hours: number;
        warn_before_required_minutes: number;
        auto_enforce_breaks: boolean;
        allow_skip_break: boolean;
        require_manager_override: boolean;
        min_staff_for_break?: number;
        is_active?: boolean;
        is_default?: boolean;
      }
    ) => {
      try {
        const db = await getDatabase();
        const policy = await db.breakPolicy.createPolicy(data);
        logger.info(`[breakPolicy:createPolicy] Created: ${data.name}`);
        return { success: true, data: policy };
      } catch (error) {
        logger.error("[breakPolicy:createPolicy] Error:", error);
        return { success: false, message: "Failed to create policy", error };
      }
    }
  );

  /**
   * Update a policy
   */
  ipcMain.handle(
    "breakPolicy:updatePolicy",
    async (
      _event,
      data: {
        id: number;
        updates: Partial<{
          name: string;
          description: string;
          max_consecutive_hours: number;
          warn_before_required_minutes: number;
          auto_enforce_breaks: boolean;
          allow_skip_break: boolean;
          require_manager_override: boolean;
          min_staff_for_break: number;
          is_active: boolean;
          is_default: boolean;
        }>;
      }
    ) => {
      try {
        const db = await getDatabase();
        const policy = await db.breakPolicy.updatePolicy(data.id, data.updates);
        logger.info(`[breakPolicy:updatePolicy] Updated: ${data.id}`);
        return { success: true, data: policy };
      } catch (error) {
        logger.error("[breakPolicy:updatePolicy] Error:", error);
        return { success: false, message: "Failed to update policy", error };
      }
    }
  );

  /**
   * Delete a policy
   */
  ipcMain.handle("breakPolicy:deletePolicy", async (_event, id: number) => {
    try {
      const db = await getDatabase();
      await db.breakPolicy.deletePolicy(id);
      logger.info(`[breakPolicy:deletePolicy] Deleted: ${id}`);
      return { success: true };
    } catch (error) {
      logger.error("[breakPolicy:deletePolicy] Error:", error);
      return { success: false, message: "Failed to delete policy", error };
    }
  });

  // ============================================================================
  // Policy Rules
  // ============================================================================

  /**
   * Get rules for a policy
   */
  ipcMain.handle(
    "breakPolicy:getPolicyRules",
    async (_event, policyId: number) => {
      try {
        const db = await getDatabase();
        const rules = await db.breakPolicy.getPolicyRules(policyId);
        return { success: true, data: rules };
      } catch (error) {
        logger.error("[breakPolicy:getPolicyRules] Error:", error);
        return {
          success: false,
          message: "Failed to fetch policy rules",
          error,
        };
      }
    }
  );

  /**
   * Create a policy rule
   */
  ipcMain.handle(
    "breakPolicy:createPolicyRule",
    async (
      _event,
      data: {
        policy_id: number;
        break_type_id: number;
        min_shift_hours: number;
        max_shift_hours?: number;
        allowed_count: number;
        is_mandatory: boolean;
        earliest_after_hours?: number;
        latest_before_end_hours?: number;
        priority?: number;
      }
    ) => {
      try {
        const db = await getDatabase();
        const rule = await db.breakPolicy.createPolicyRule(data);
        logger.info(
          `[breakPolicy:createPolicyRule] Created for policy: ${data.policy_id}`
        );
        return { success: true, data: rule };
      } catch (error) {
        logger.error("[breakPolicy:createPolicyRule] Error:", error);
        return {
          success: false,
          message: "Failed to create policy rule",
          error,
        };
      }
    }
  );

  /**
   * Update a policy rule
   */
  ipcMain.handle(
    "breakPolicy:updatePolicyRule",
    async (
      _event,
      data: {
        id: number;
        updates: Partial<{
          break_type_id: number;
          min_shift_hours: number;
          max_shift_hours: number;
          allowed_count: number;
          is_mandatory: boolean;
          earliest_after_hours: number;
          latest_before_end_hours: number;
          priority: number;
        }>;
      }
    ) => {
      try {
        const db = await getDatabase();
        const rule = await db.breakPolicy.updatePolicyRule(
          data.id,
          data.updates
        );
        logger.info(`[breakPolicy:updatePolicyRule] Updated: ${data.id}`);
        return { success: true, data: rule };
      } catch (error) {
        logger.error("[breakPolicy:updatePolicyRule] Error:", error);
        return {
          success: false,
          message: "Failed to update policy rule",
          error,
        };
      }
    }
  );

  /**
   * Delete a policy rule
   */
  ipcMain.handle("breakPolicy:deletePolicyRule", async (_event, id: number) => {
    try {
      const db = await getDatabase();
      await db.breakPolicy.deletePolicyRule(id);
      logger.info(`[breakPolicy:deletePolicyRule] Deleted: ${id}`);
      return { success: true };
    } catch (error) {
      logger.error("[breakPolicy:deletePolicyRule] Error:", error);
      return { success: false, message: "Failed to delete policy rule", error };
    }
  });

  // ============================================================================
  // Business Logic Endpoints
  // ============================================================================

  /**
   * Get available break options for a shift
   */
  ipcMain.handle(
    "breakPolicy:getAvailableBreaks",
    async (
      _event,
      data: {
        businessId: string;
        shiftId: string;
        shiftStartTime: string; // ISO date string
        shiftEndTime?: string; // ISO date string
      }
    ) => {
      try {
        const db = await getDatabase();
        const options = await db.breakPolicy.getAvailableBreaksForShift(
          data.businessId,
          data.shiftId,
          new Date(data.shiftStartTime),
          data.shiftEndTime ? new Date(data.shiftEndTime) : null
        );
        return { success: true, data: options };
      } catch (error) {
        logger.error("[breakPolicy:getAvailableBreaks] Error:", error);
        return {
          success: false,
          message: "Failed to get available breaks",
          error,
        };
      }
    }
  );

  /**
   * Check if mandatory break is required
   */
  ipcMain.handle(
    "breakPolicy:checkMandatoryBreak",
    async (
      _event,
      data: {
        businessId: string;
        shiftStartTime: string; // ISO date string
        breaksTaken: { type: string }[];
      }
    ) => {
      try {
        const db = await getDatabase();
        const result = await db.breakPolicy.isMandatoryBreakRequired(
          data.businessId,
          new Date(data.shiftStartTime),
          data.breaksTaken
        );
        return { success: true, data: result };
      } catch (error) {
        logger.error("[breakPolicy:checkMandatoryBreak] Error:", error);
        return {
          success: false,
          message: "Failed to check mandatory break",
          error,
        };
      }
    }
  );

  /**
   * Seed default break types and policy for a business
   */
  ipcMain.handle(
    "breakPolicy:seedDefaults",
    async (_event, businessId: string) => {
      try {
        const db = await getDatabase();
        const result = await db.breakPolicy.seedDefaultsForBusiness(businessId);
        logger.info(
          `[breakPolicy:seedDefaults] Seeded defaults for: ${businessId}`
        );
        return { success: true, data: result };
      } catch (error) {
        logger.error("[breakPolicy:seedDefaults] Error:", error);
        return { success: false, message: "Failed to seed defaults", error };
      }
    }
  );

  /**
   * Check if business has break policy setup
   */
  ipcMain.handle("breakPolicy:hasSetup", async (_event, businessId: string) => {
    try {
      const db = await getDatabase();
      const hasSetup = await db.breakPolicy.hasBreakPolicySetup(businessId);
      return { success: true, data: hasSetup };
    } catch (error) {
      logger.error("[breakPolicy:hasSetup] Error:", error);
      return { success: false, message: "Failed to check setup status", error };
    }
  });

  logger.info("[breakPolicyHandlers] Registered all break policy handlers");
}
