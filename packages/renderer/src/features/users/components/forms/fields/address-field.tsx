import { memo } from "react";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import type { Control } from "react-hook-form";

interface AddressFieldProps {
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
 * Address Field Component
 * Reusable across add/edit forms
 * Memoized to prevent unnecessary re-renders
 */
export const AddressField = memo(function AddressField({
  control,
  onFieldFocus,
  getFieldValue,
  disabled = false,
}: AddressFieldProps) {
  return (
    <FormField
      control={control}
      name="address"
      render={() => (
        <FormItem>
          <FormControl>
            <AdaptiveFormField
              label="Address (Optional)"
              name="address"
              placeholder="Enter address"
              value={getFieldValue("address")}
              onFocus={() => onFieldFocus("address")}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});
