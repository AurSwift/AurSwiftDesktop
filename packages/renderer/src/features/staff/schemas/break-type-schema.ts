import { z } from "zod";

/**
 * Schema for creating a new break type
 */
export const breakTypeCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  code: z.string().min(1, "Code is required").max(50, "Code is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  default_duration_minutes: z
    .number()
    .int()
    .min(1, "Default duration must be at least 1 minute")
    .max(480, "Default duration cannot exceed 8 hours"),
  min_duration_minutes: z
    .number()
    .int()
    .min(1, "Min duration must be at least 1 minute")
    .max(480, "Min duration cannot exceed 8 hours"),
  max_duration_minutes: z
    .number()
    .int()
    .min(1, "Max duration must be at least 1 minute")
    .max(480, "Max duration cannot exceed 8 hours"),
  is_paid: z.boolean().default(false),
  is_required: z.boolean().default(false),
  counts_as_worked_time: z.boolean().default(false),
  allowed_window_start: z.string().optional(),
  allowed_window_end: z.string().optional(),
  icon: z.string().default("coffee"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color"),
  business_id: z.string().min(1, "Business ID is required"),
});

/**
 * Schema for updating an existing break type
 */
export const breakTypeUpdateSchema = breakTypeCreateSchema.extend({
  id: z.number().int().positive(),
});

export type BreakTypeFormData = z.infer<typeof breakTypeCreateSchema>;
export type BreakTypeUpdateData = z.infer<typeof breakTypeUpdateSchema>;
