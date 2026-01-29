import { z } from "zod";

/**
 * Schema for creating a new policy rule
 */
export const policyRuleCreateSchema = z.object({
  break_type_id: z.number().int().positive("Break type is required"),
  min_shift_hours: z
    .number()
    .min(0, "Min shift hours must be at least 0")
    .max(24, "Min shift hours cannot exceed 24"),
  max_shift_hours: z
    .number()
    .min(0, "Max shift hours must be at least 0")
    .max(24, "Max shift hours cannot exceed 24")
    .nullable()
    .optional(),
  allowed_count: z
    .number()
    .int()
    .min(1, "Allowed count must be at least 1")
    .max(10, "Allowed count cannot exceed 10"),
  is_mandatory: z.boolean().default(false),
  earliest_after_hours: z
    .number()
    .min(0, "Earliest after hours must be at least 0")
    .max(24, "Earliest after hours cannot exceed 24")
    .nullable()
    .optional(),
  latest_before_end_hours: z
    .number()
    .min(0, "Latest before end hours must be at least 0")
    .max(24, "Latest before end hours cannot exceed 24")
    .nullable()
    .optional(),
  policy_id: z.number().int().positive("Policy ID is required"),
});

/**
 * Schema for updating an existing policy rule
 */
export const policyRuleUpdateSchema = policyRuleCreateSchema.extend({
  id: z.number().int().positive(),
});

export type PolicyRuleFormData = z.infer<typeof policyRuleCreateSchema>;
export type PolicyRuleUpdateData = z.infer<typeof policyRuleUpdateSchema>;
