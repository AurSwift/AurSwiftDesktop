import { memo } from "react";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { cn } from "@/shared/utils/cn";
import type { Control } from "react-hook-form";

interface EmailFieldProps {
  /**
   * Form control from react-hook-form
   */
  control: Control<any>;
  /**
   * Keyboard focus handler
   */
  onFieldFocus: (field: string) => void;
  /**
   * Field value getter
   */
  getFieldValue: (field: string) => string;
  /**
   * Active field for keyboard focus styling
   */
  activeField?: string;
  /**
   * Whether field is read-only (edit mode)
   */
  readOnly?: boolean;
  /**
   * Disabled state
   */
  disabled?: boolean;
  /**
   * Error message
   */
  error?: string;
}

/**
 * Email Field Component
 * Can be editable (add mode) or read-only (edit mode)
 * Reusable across add/edit forms
 * Memoized to prevent unnecessary re-renders
 */
export const EmailField = memo(function EmailField({
  control,
  onFieldFocus,
  getFieldValue,
  activeField,
  readOnly = false,
  disabled = false,
  error,
}: EmailFieldProps) {
  return (
    <FormField
      control={control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <AdaptiveFormField
              {...field}
              variant="borderOnly"
              label={readOnly ? "Email" : "Email *"}
              value={getFieldValue("email")}
              error={error}
              onFocus={() => onFieldFocus("email")}
              placeholder="john.smith@example.com"
              className={cn(
                "text-xs sm:text-sm md:text-base",
                activeField === "email" && "border-primary",
              )}
              readOnly={readOnly}
              disabled={disabled || readOnly}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});
