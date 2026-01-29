import { ipcRenderer } from "electron";

// ============================================================================
// Break Type Definitions API
// ============================================================================

export interface BreakTypeDefinition {
  id: number;
  publicId: string;
  business_id: string;
  name: string;
  code: string;
  description?: string | null;
  default_duration_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  is_paid: boolean;
  is_required: boolean;
  counts_as_worked_time: boolean;
  allowed_window_start?: string | null;
  allowed_window_end?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number | null;
  is_active: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
}

export interface BreakPolicy {
  id: number;
  publicId: string;
  business_id: string;
  name: string;
  description?: string | null;
  max_consecutive_hours: number;
  warn_before_required_minutes: number;
  auto_enforce_breaks: boolean;
  allow_skip_break: boolean;
  require_manager_override: boolean;
  min_staff_for_break?: number | null;
  is_active: boolean;
  is_default: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
}

export interface BreakPolicyRule {
  id: number;
  publicId: string;
  policy_id: number;
  break_type_id: number;
  min_shift_hours: number;
  max_shift_hours?: number | null;
  allowed_count: number;
  is_mandatory: boolean;
  earliest_after_hours?: number | null;
  latest_before_end_hours?: number | null;
  priority?: number | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

export interface BreakPolicyWithRules extends BreakPolicy {
  rules: (BreakPolicyRule & {
    breakType: BreakTypeDefinition;
  })[];
}

export interface AvailableBreakOption {
  breakType: BreakTypeDefinition;
  rule: BreakPolicyRule;
  remainingCount: number;
  isAllowed: boolean;
  reason?: string;
}

export interface MandatoryBreakCheck {
  required: boolean;
  reason?: string;
  breakTypeCode?: string;
}

// ============================================================================
// API Functions
// ============================================================================

export const breakPolicyAPI = {
  // ========================
  // Break Types
  // ========================

  /** Get all break types for a business */
  getBreakTypes: (
    businessId: string
  ): Promise<{
    success: boolean;
    data?: BreakTypeDefinition[];
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:getBreakTypes", businessId),

  /** Get a single break type by ID */
  getBreakTypeById: (
    id: number
  ): Promise<{
    success: boolean;
    data?: BreakTypeDefinition | null;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:getBreakTypeById", id),

  /** Create a new break type */
  createBreakType: (data: {
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
  }): Promise<{
    success: boolean;
    data?: BreakTypeDefinition;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:createBreakType", data),

  /** Update a break type */
  updateBreakType: (
    id: number,
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
    }>
  ): Promise<{
    success: boolean;
    data?: BreakTypeDefinition | null;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:updateBreakType", { id, updates }),

  /** Delete (soft) a break type */
  deleteBreakType: (
    id: number
  ): Promise<{
    success: boolean;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:deleteBreakType", id),

  // ========================
  // Policies
  // ========================

  /** Get all policies for a business */
  getPolicies: (
    businessId: string
  ): Promise<{
    success: boolean;
    data?: BreakPolicy[];
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:getPolicies", businessId),

  /** Get the active/default policy for a business */
  getActivePolicy: (
    businessId: string
  ): Promise<{
    success: boolean;
    data?: BreakPolicy | null;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:getActivePolicy", businessId),

  /** Get a policy with its rules */
  getPolicyWithRules: (
    policyId: number
  ): Promise<{
    success: boolean;
    data?: BreakPolicyWithRules | null;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:getPolicyWithRules", policyId),

  /** Create a new policy */
  createPolicy: (data: {
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
  }): Promise<{
    success: boolean;
    data?: BreakPolicy;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:createPolicy", data),

  /** Update a policy */
  updatePolicy: (
    id: number,
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
    }>
  ): Promise<{
    success: boolean;
    data?: BreakPolicy | null;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:updatePolicy", { id, updates }),

  /** Delete a policy */
  deletePolicy: (
    id: number
  ): Promise<{
    success: boolean;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:deletePolicy", id),

  // ========================
  // Policy Rules
  // ========================

  /** Get rules for a policy */
  getPolicyRules: (
    policyId: number
  ): Promise<{
    success: boolean;
    data?: BreakPolicyRule[];
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:getPolicyRules", policyId),

  /** Create a policy rule */
  createPolicyRule: (data: {
    policy_id: number;
    break_type_id: number;
    min_shift_hours: number;
    max_shift_hours?: number;
    allowed_count: number;
    is_mandatory: boolean;
    earliest_after_hours?: number;
    latest_before_end_hours?: number;
    priority?: number;
  }): Promise<{
    success: boolean;
    data?: BreakPolicyRule;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:createPolicyRule", data),

  /** Update a policy rule */
  updatePolicyRule: (
    id: number,
    updates: Partial<{
      break_type_id: number;
      min_shift_hours: number;
      max_shift_hours: number;
      allowed_count: number;
      is_mandatory: boolean;
      earliest_after_hours: number;
      latest_before_end_hours: number;
      priority: number;
    }>
  ): Promise<{
    success: boolean;
    data?: BreakPolicyRule | null;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:updatePolicyRule", { id, updates }),

  /** Delete a policy rule */
  deletePolicyRule: (
    id: number
  ): Promise<{
    success: boolean;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:deletePolicyRule", id),

  // ========================
  // Business Logic
  // ========================

  /** Get available break options for a shift */
  getAvailableBreaks: (data: {
    businessId: string;
    shiftId: string;
    shiftStartTime: string; // ISO date string
    shiftEndTime?: string; // ISO date string
  }): Promise<{
    success: boolean;
    data?: AvailableBreakOption[];
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:getAvailableBreaks", data),

  /** Check if mandatory break is required */
  checkMandatoryBreak: (data: {
    businessId: string;
    shiftStartTime: string; // ISO date string
    breaksTaken: { type: string }[];
  }): Promise<{
    success: boolean;
    data?: MandatoryBreakCheck;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:checkMandatoryBreak", data),

  /** Seed default break types and policy for a business */
  seedDefaults: (
    businessId: string
  ): Promise<{
    success: boolean;
    data?: {
      breakTypes: BreakTypeDefinition[];
      policy: BreakPolicy;
      rules: BreakPolicyRule[];
    };
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:seedDefaults", businessId),

  /** Check if business has break policy setup */
  hasSetup: (
    businessId: string
  ): Promise<{
    success: boolean;
    data?: boolean;
    message?: string;
  }> => ipcRenderer.invoke("breakPolicy:hasSetup", businessId),
};
