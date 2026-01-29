/**
 * Break Policy API Type Definitions
 *
 * This file contains all the type definitions for the Break Policy API.
 */

// ============================================================================
// Entity Types
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
// API Response Types
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: any;
}

// ============================================================================
// API Interface
// ============================================================================

export interface BreakPolicyAPI {
  // Break Types
  getBreakTypes: (
    businessId: string
  ) => Promise<APIResponse<BreakTypeDefinition[]>>;

  getBreakTypeById: (
    id: number
  ) => Promise<APIResponse<BreakTypeDefinition | null>>;

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
  }) => Promise<APIResponse<BreakTypeDefinition>>;

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
  ) => Promise<APIResponse<BreakTypeDefinition | null>>;

  deleteBreakType: (id: number) => Promise<APIResponse<void>>;

  // Policies
  getPolicies: (businessId: string) => Promise<APIResponse<BreakPolicy[]>>;

  getActivePolicy: (
    businessId: string
  ) => Promise<APIResponse<BreakPolicy | null>>;

  getPolicyWithRules: (
    policyId: number
  ) => Promise<APIResponse<BreakPolicyWithRules | null>>;

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
  }) => Promise<APIResponse<BreakPolicy>>;

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
  ) => Promise<APIResponse<BreakPolicy | null>>;

  deletePolicy: (id: number) => Promise<APIResponse<void>>;

  // Policy Rules
  getPolicyRules: (policyId: number) => Promise<APIResponse<BreakPolicyRule[]>>;

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
  }) => Promise<APIResponse<BreakPolicyRule>>;

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
  ) => Promise<APIResponse<BreakPolicyRule | null>>;

  deletePolicyRule: (id: number) => Promise<APIResponse<void>>;

  // Business Logic
  getAvailableBreaks: (data: {
    businessId: string;
    shiftId: string;
    shiftStartTime: string;
    shiftEndTime?: string;
  }) => Promise<APIResponse<AvailableBreakOption[]>>;

  checkMandatoryBreak: (data: {
    businessId: string;
    shiftStartTime: string;
    breaksTaken: { type: string }[];
  }) => Promise<APIResponse<MandatoryBreakCheck>>;

  seedDefaults: (businessId: string) => Promise<
    APIResponse<{
      breakTypes: BreakTypeDefinition[];
      policy: BreakPolicy;
      rules: BreakPolicyRule[];
    }>
  >;

  hasSetup: (businessId: string) => Promise<APIResponse<boolean>>;
}
