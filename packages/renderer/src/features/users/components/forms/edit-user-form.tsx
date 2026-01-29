import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "@/components/avatar-upload";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";
import {
  userUpdateSchema,
  type UserUpdateFormData,
} from "@/features/users/schemas/user-schema";
import type { StaffUser } from "@/features/users/schemas/types";
import { useRoles, type Role } from "@/features/rbac/hooks/useRoles";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("edit-user-form");

interface EditUserFormProps {
  user: StaffUser;
  onSubmit: (data: UserUpdateFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  isOpen?: boolean; // Dialog open state to close keyboard when dialog closes
  showButtons?: boolean; // Whether to show buttons (for drawer mode)
}

import { ResetPinDialog } from "@/features/users/components/dialogs/reset-pin-dialog";
import { RotateCcw } from "lucide-react";

export function EditUserForm({
  user,
  onSubmit,
  onCancel,
  isLoading,
  isOpen = true,
  showButtons = true,
}: EditUserFormProps) {
  // Fetch roles dynamically
  const { data: roles, isLoading: isLoadingRoles } = useRoles();
  const [showResetPinDialog, setShowResetPinDialog] = useState(false);

  // Filter roles to only show active staff roles (cashier, manager)
  // Exclude admin roles from staff assignment
  const availableRoles = useMemo(() => {
    return roles.filter(
      (role: Role) =>
        role.isActive && (role.name === "cashier" || role.name === "manager")
    );
  }, [roles]);

  const form = useForm<UserUpdateFormData>({
    resolver: zodResolver(userUpdateSchema),
    mode: "onChange", // Enable real-time validation for better UX with keyboard
    defaultValues: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: getUserRoleName(user) as "cashier" | "manager",
      avatar: user.avatar || "",
      address: user.address || "",
      isActive: user.isActive,
      businessId: user.businessId,
    },
  });

  // Keyboard integration hook
  const keyboard = useKeyboardWithRHF({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs: {
      firstName: { keyboardMode: "qwerty" },
      lastName: { keyboardMode: "qwerty" },
      address: { keyboardMode: "qwerty" },
    },
  });

  // Close keyboard when dialog closes
  useEffect(() => {
    if (!isOpen) {
      keyboard.handleCloseKeyboard();
    }
  }, [isOpen, keyboard]);

  // Update form when user changes
  useEffect(() => {
    logger.info("Setting form values for user:", {
      id: user.id,
      businessId: user.businessId,
      firstName: user.firstName,
    });
    form.reset({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: getUserRoleName(user) as "cashier" | "manager",
      avatar: user.avatar || "",
      address: user.address || "",
      isActive: user.isActive,
      businessId: user.businessId,
    });
  }, [user, form]);

  const handleSubmit = async (data: UserUpdateFormData) => {
    logger.info("Edit form submitted with data:", data);
    logger.info(`ID value: ${data.id} Type: ${typeof data.id}`);
    logger.info(
      `BusinessId value: ${data.businessId} Type: ${typeof data.businessId}`
    );

    // Ensure id and businessId are strings and not empty
    if (!data.id || typeof data.id !== "string") {
      logger.error("Invalid id value:", data.id);
      form.setError("id", { message: "Invalid user ID" });
      return;
    }
    if (!data.businessId || typeof data.businessId !== "string") {
      logger.error("Invalid businessId value:", data.businessId);
      form.setError("businessId", { message: "Invalid business ID" });
      return;
    }

    try {
      await onSubmit(data);
      // Close keyboard on successful submit
      keyboard.handleCloseKeyboard();
    } catch (error) {
      logger.error("Error submitting form:", error);
      form.setError("root", {
        message: "Failed to update staff member. Please try again.",
      });
    }
  };

  return (
    <Form {...form}>
      <form
        id="edit-user-form"
        onSubmit={form.handleSubmit(handleSubmit, (errors) => {
          logger.error("Form validation errors:", errors);
          // Show first error message
          const firstError = Object.values(errors)[0];
          if (firstError?.message) {
            // Error will be shown by FormMessage components
          }
        })}
        className={showButtons ? "space-y-4" : "flex flex-col h-full"}
      >
        {/* Fixed Buttons Section - Only in drawer mode */}
        {!showButtons && (
          <div className="border-b bg-background shrink-0">
            <div className="flex space-x-2 px-6 pt-4 pb-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update Staff Member"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  keyboard.handleCloseKeyboard();
                  onCancel();
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Scrollable Form Content */}
        <div className={showButtons ? "" : "p-6 overflow-y-auto flex-1 min-h-0 space-y-4"}>
          {/* Form Errors */}
          {form.formState.errors.root && (
            <div className="text-sm text-red-500 p-2 bg-red-50 rounded">
              {form.formState.errors.root.message}
            </div>
          )}

        {/* Hidden fields for id and businessId - required for validation but not displayed */}
        <FormField
          control={form.control}
          name="id"
          render={({ field }) => <input type="hidden" {...field} />}
        />
        <FormField
          control={form.control}
          name="businessId"
          render={({ field }) => <input type="hidden" {...field} />}
        />

        {/* Avatar Upload */}
        <FormField
          control={form.control}
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="firstName"
            render={() => (
              <FormItem>
                <FormControl>
                  <AdaptiveFormField
                    {...form.register("firstName")}
                    label="First Name *"
                    value={keyboard.formValues.firstName || ""}
                    error={form.formState.errors.firstName?.message}
                    onFocus={() => keyboard.handleFieldFocus("firstName")}
                    placeholder="John"
                    className={cn(
                      "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                      keyboard.activeField === "firstName" &&
                        "ring-2 ring-primary border-primary"
                    )}
                    readOnly
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={() => (
              <FormItem>
                <FormControl>
                  <AdaptiveFormField
                    {...form.register("lastName")}
                    label="Last Name *"
                    value={keyboard.formValues.lastName || ""}
                    error={form.formState.errors.lastName?.message}
                    onFocus={() => keyboard.handleFieldFocus("lastName")}
                    placeholder="Smith"
                    className={cn(
                      "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                      keyboard.activeField === "lastName" &&
                        "ring-2 ring-primary border-primary"
                    )}
                    readOnly
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Email (Read-only) */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs sm:text-sm md:text-base lg:text-base">
                Email
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  disabled
                  className="bg-gray-50 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
                  {...field}
                />
              </FormControl>
              <p className="text-xs sm:text-sm md:text-base lg:text-base text-gray-500">
                Email cannot be changed
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Address */}
        <FormField
          control={form.control}
          name="address"
          render={() => (
            <FormItem>
              <FormControl>
                <AdaptiveFormField
                  {...form.register("address")}
                  label="Address"
                  value={keyboard.formValues.address || ""}
                  error={form.formState.errors.address?.message}
                  onFocus={() => keyboard.handleFieldFocus("address")}
                  placeholder="123 Main Street, City, State"
                  className={cn(
                    "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                    keyboard.activeField === "address" &&
                      "ring-2 ring-primary border-primary"
                  )}
                  readOnly
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Role */}
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-foreground">
                Role *
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || availableRoles[0]?.name || "cashier"}
                disabled={isLoadingRoles || availableRoles.length === 0}
              >
                <FormControl>
                  <SelectTrigger
                    className={cn(
                      "min-h-12 h-auto rounded-lg border-2 bg-input px-4 py-3",
                      "text-xs sm:text-sm md:text-base lg:text-base font-medium",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                  >
                    {(() => {
                      const selectedRole = availableRoles.find(
                        (r: Role) => r.name === field.value
                      );

                      if (!selectedRole) {
                        return (
                          <span className="text-muted-foreground">
                            {isLoadingRoles
                              ? "Loading roles..."
                              : "Select a role"}
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

        {/* Status */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs sm:text-sm md:text-base lg:text-base">
                Status
              </FormLabel>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="rounded"
                />
                <Label
                  htmlFor="editIsActive"
                  className="text-xs sm:text-sm md:text-base lg:text-base"
                >
                  Active (user can log in)
                </Label>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        
        {/* Reset PIN Button */}
        <div className="pt-2">
            <Label className="text-xs sm:text-sm md:text-base lg:text-base block mb-2">
                Security
            </Label>
            <Button
                type="button"
                variant="outline"
                className="w-full justify-start text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
                onClick={() => setShowResetPinDialog(true)}
            >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset PIN
            </Button>
            <p className="text-xs sm:text-sm md:text-sm text-muted-foreground mt-1">
                Generates a temporary PIN for the user.
            </p>
        </div>
        </div>

        <ResetPinDialog 
            open={showResetPinDialog}
            onOpenChange={setShowResetPinDialog}
            userId={user.id}
            userName={`${user.firstName} ${user.lastName}`}
        />

        {/* Actions - Only show if showButtons is true */}
        {showButtons && (
          <div
            className={cn(
              "flex flex-col sm:flex-row gap-2 sm:gap-2 pt-4",
              keyboard.showKeyboard && "pb-[340px]"
            )}
          >
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
            >
              {isLoading ? "Updating..." : "Update Staff Member"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                keyboard.handleCloseKeyboard();
                onCancel();
              }}
              className="flex-1 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Adaptive Keyboard */}
        {keyboard.showKeyboard && (
          <div className={cn(
            showButtons ? "sticky bottom-0 left-0 right-0 z-50 mt-4 bg-background" : "border-t bg-background px-2 py-2 shrink-0"
          )}>
            <div className={showButtons ? "" : "max-w-full overflow-hidden"}>
              <AdaptiveKeyboard
                onInput={keyboard.handleInput}
                onBackspace={keyboard.handleBackspace}
                onClear={keyboard.handleClear}
                onEnter={() => {
                  // Move to next field or submit if last field
                  if (keyboard.activeField === "address") {
                    form.handleSubmit(handleSubmit)();
                  }
                }}
                initialMode={keyboard.activeFieldConfig?.keyboardMode || "qwerty"}
                visible={keyboard.showKeyboard}
                onClose={keyboard.handleCloseKeyboard}
              />
            </div>
          </div>
        )}
      </form>
    </Form>
  );
}
