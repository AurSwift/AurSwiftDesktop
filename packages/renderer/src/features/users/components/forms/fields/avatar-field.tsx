import { memo } from "react";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { AvatarUpload } from "@/components/avatar-upload";
import type { Control } from "react-hook-form";

interface AvatarFieldProps {
  /**
   * Form control from react-hook-form
   */
  control: Control<any>;
  /**
   * Disabled state
   */
  disabled?: boolean;
}

/**
 * Avatar Upload Field Component
 * Reusable across add/edit forms
 * Memoized to prevent unnecessary re-renders
 */
export const AvatarField = memo(function AvatarField({
  control,
  disabled = false,
}: AvatarFieldProps) {
  return (
    <FormField
      control={control}
      name="avatar"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <AvatarUpload
              label="Profile Picture (Optional)"
              value={field.value}
              onChange={field.onChange}
              type="user"
              size="md"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});
