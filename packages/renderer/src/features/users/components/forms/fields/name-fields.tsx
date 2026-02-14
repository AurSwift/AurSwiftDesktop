import { memo } from "react";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import type { Control } from "react-hook-form";

interface NameFieldsProps {
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
   * Disabled state
   */
  disabled?: boolean;
}

/**
 * Name Fields Component (First Name + Last Name)
 * Reusable across add/edit forms
 * Memoized to prevent unnecessary re-renders
 */
export const NameFields = memo(function NameFields({
  control,
  onFieldFocus,
  getFieldValue,
  disabled = false,
}: NameFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* First Name */}
      <FormField
        control={control}
        name="firstName"
        render={() => (
          <FormItem>
            <FormControl>
              <AdaptiveFormField
                label="First Name"
                name="firstName"
                placeholder="Enter first name"
                value={getFieldValue("firstName")}
                onFocus={() => onFieldFocus("firstName")}
                disabled={disabled}
                required
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Last Name */}
      <FormField
        control={control}
        name="lastName"
        render={() => (
          <FormItem>
            <FormControl>
              <AdaptiveFormField
                label="Last Name"
                name="lastName"
                placeholder="Enter last name"
                value={getFieldValue("lastName")}
                onFocus={() => onFieldFocus("lastName")}
                disabled={disabled}
                required
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
});
