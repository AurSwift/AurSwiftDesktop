import { memo } from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/shared/utils/cn";
import type { Control } from "react-hook-form";
import type { Role } from "@/features/rbac/hooks/useRoles";

interface RoleFieldProps {
  /**
   * Form control from react-hook-form
   */
  control: Control<any>;
  /**
   * Available roles to select from
   */
  availableRoles: Role[];
  /**
   * Loading state for roles
   */
  isLoadingRoles: boolean;
  /**
   * Disabled state
   */
  disabled?: boolean;
  /**
   * Current role value
   */
  value?: string;
}

/**
 * Role Selection Field Component
 * Displays roles with their display names and descriptions
 * Reusable across add/edit forms
 * Memoized to prevent unnecessary re-renders
 */
export const RoleField = memo(function RoleField({
  control,
  availableRoles,
  isLoadingRoles,
  disabled = false,
  value,
}: RoleFieldProps) {
  return (
    <FormField
      control={control}
      name="role"
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormLabel className="text-sm font-medium text-foreground">
            Role *
          </FormLabel>
          <Select
            onValueChange={field.onChange}
            value={field.value || value || availableRoles[0]?.name || "cashier"}
            disabled={disabled || isLoadingRoles || availableRoles.length === 0}
          >
            <FormControl>
              <SelectTrigger
                className={cn(
                  "min-h-10 h-auto rounded-none border-0 border-b-2 bg-transparent pl-0 pr-8 py-2",
                  "text-xs sm:text-sm md:text-base font-medium",
                  "focus-visible:ring-0 focus-visible:border-primary border-input hover:bg-transparent",
                )}
              >
                {(() => {
                  const selectedRole = availableRoles.find(
                    (r: Role) => r.name === (field.value || value),
                  );

                  if (!selectedRole) {
                    return (
                      <span className="text-muted-foreground">
                        {isLoadingRoles ? "Loading roles..." : "Select a role"}
                      </span>
                    );
                  }

                  return (
                    <div className="flex flex-col items-start gap-0.5 leading-tight">
                      <span className="text-xs sm:text-sm md:text-base lg:text-base">
                        {selectedRole.displayName}
                      </span>
                      {selectedRole.description && (
                        <span className="text-xs sm:text-sm md:text-sm text-muted-foreground font-normal">
                          {selectedRole.description}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Keep Radix value for a11y/typeahead; hide visually */}
                <span className="sr-only">
                  <SelectValue />
                </span>
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {isLoadingRoles ? (
                <SelectItem value="loading" disabled>
                  Loading roles...
                </SelectItem>
              ) : availableRoles.length === 0 ? (
                <SelectItem value="no-roles" disabled>
                  No roles available
                </SelectItem>
              ) : (
                availableRoles.map((role: Role) => (
                  <SelectItem
                    key={role.id}
                    value={role.name}
                    className="px-4 py-3"
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-xs sm:text-sm md:text-base lg:text-base">
                        {role.displayName}
                      </span>
                      {role.description && (
                        <span className="text-xs sm:text-sm md:text-base lg:text-base text-gray-500">
                          {role.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});
