/**
 * Zod Validation Schemas for Authentication
 *
 * This desktop EPOS build uses PIN-based authentication.
 * Keep this module minimal and focused on the schemas used by UserManager.
 */

import { z } from "zod";

// PIN validation (4-6 digits)
export const pinSchema = z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits");

// PIN-based login schema (username + PIN - for POS terminal)
export const pinLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  pin: pinSchema,
  rememberMe: z.boolean().optional(),
});

export type PinLoginInput = z.infer<typeof pinLoginSchema>;

/**
 * Validate input and return formatted errors
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((err: z.ZodIssue) => {
    const path = err.path.join(".");
    return path ? `${path}: ${err.message}` : err.message;
  });

  return { success: false, errors };
}

