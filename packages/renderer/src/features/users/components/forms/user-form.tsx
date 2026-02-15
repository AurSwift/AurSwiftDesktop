import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";
import { RotateCcw } from "lucide-react";
import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateFormData,
  type UserUpdateFormData,
} from "@/features/users/schemas/user-schema";
import type { StaffUser } from "@/features/users/schemas/types";
import { useAuth } from "@/shared/hooks/use-auth";
import { useRoles, type Role } from "@/features/rbac/hooks/useRoles";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { ResetPinDialog } from "../dialogs/reset-pin-dialog";

// Import field components
import { NameFields } from "./fields/name-fields";
import { AvatarField } from "./fields/avatar-field";
import { AddressField } from "./fields/address-field";
import { RoleField } from "./fields/role-field";
import { EmailField } from "./fields/email-field";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("user-form");

export type UserFormMode = "create" | "edit";

interface UserFormProps {
  /**
   * Form mode - create or edit
   */
  mode: UserFormMode;
  /**
   * User data (only for edit mode)
   */
  user?: StaffUser;
  /**
   * Form submission handler
   */
  onSubmit: (data: UserCreateFormData | UserUpdateFormData) => Promise<void>;
  /**
   * Cancel button handler
   */
  onCancel: () => void;
  /**
   * Loading state
   */
  isLoading: boolean;
  /**
   * Dialog/drawer open state (for keyboard management)
   */
  isOpen?: boolean;
  /**
   * Whether to show buttons (dialog mode = true, drawer mode = false)
   */
  showButtons?: boolean;
}

/**
 * Unified User Form Component
 * Handles both create and edit modes
 * Replaces add-user-form.tsx and edit-user-form.tsx
 *
 * @example
 * ```tsx
 * // Create mode
 * <UserForm
 *   mode="create"
 *   onSubmit={handleCreate}
 *   onCancel={onClose}
 *   isLoading={isCreating}
 * />
 *
 * // Edit mode
 * <UserForm
 *   mode="edit"
 *   user={selectedUser}
 *   onSubmit={handleUpdate}
 *   onCancel={onClose}
 *   isLoading={isUpdating}
 * />
 * ```
 */
export function UserForm({
  mode,
  user,
  onSubmit,
  onCancel,
  isLoading,
  isOpen = true,
  showButtons = true,
}: UserFormProps) {
  const { user: currentUser } = useAuth();
  const [showResetPinDialog, setShowResetPinDialog] = useState(false);

  // Fetch roles dynamically
  const { data: roles, isLoading: isLoadingRoles } = useRoles();

  // Filter roles to only show active staff roles (cashier, manager)
  const availableRoles = useMemo(() => {
    return roles.filter(
      (role: Role) =>
        role.isActive && (role.name === "cashier" || role.name === "manager"),
    );
  }, [roles]);

  const defaultRole = useMemo(() => {
    const firstRole = availableRoles.find(
      (r: Role) => r.name === "cashier" || r.name === "manager",
    );
    return (firstRole?.name as "cashier" | "manager") || "cashier";
  }, [availableRoles]);

  // Schema and default values based on mode
  const schema = mode === "create" ? userCreateSchema : userUpdateSchema;

  const getDefaultValues = () => {
    if (mode === "create") {
      return {
        email: "",
        username: "",
        pin: "",
        firstName: "",
        lastName: "",
        role: defaultRole,
        avatar: "",
        address: "",
        businessId: currentUser?.businessId || "",
      };
    } else {
      // Edit mode
      return {
        id: user?.id || "",
        email: user?.email || "",
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        role: (getUserRoleName(user) as "cashier" | "manager") || defaultRole,
        avatar: user?.avatar || "",
        address: user?.address || "",
        isActive: user?.isActive ?? true,
        businessId: user?.businessId || "",
      };
    }
  };

  const form = useForm<UserCreateFormData | UserUpdateFormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: getDefaultValues(),
  });

  // Keyboard integration hook
  const keyboardFields =
    mode === "create"
      ? {
          firstName: { keyboardMode: "qwerty" as const },
          lastName: { keyboardMode: "qwerty" as const },
          email: { keyboardMode: "qwerty" as const },
          address: { keyboardMode: "qwerty" as const },
          username: { keyboardMode: "qwerty" as const },
          pin: { keyboardMode: "numeric" as const },
        }
      : {
          firstName: { keyboardMode: "qwerty" as const },
          lastName: { keyboardMode: "qwerty" as const },
          address: { keyboardMode: "qwerty" as const },
        };

  const keyboard = useKeyboardWithRHF({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs: keyboardFields,
  });

  // Close keyboard when dialog closes
  useEffect(() => {
    if (!isOpen) {
      keyboard.handleCloseKeyboard();
    }
  }, [isOpen, keyboard]);

  // Update form when user changes (edit mode only)
  useEffect(() => {
    if (mode === "edit" && user) {
      logger.info("Updating form values for user:", {
        id: user.id,
        businessId: user.businessId,
        firstName: user.firstName,
      });
      form.reset(getDefaultValues());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode]);

  const handleSubmit = async (
    data: UserCreateFormData | UserUpdateFormData,
  ) => {
    logger.info(`${mode} form submitted with data:`, data);

    if (mode === "create") {
      if (!currentUser?.businessId) {
        form.setError("root", { message: "Business ID not found" });
        return;
      }
      const formData = {
        ...data,
        businessId: currentUser.businessId,
      } as UserCreateFormData;

      try {
        await onSubmit(formData);
        keyboard.handleCloseKeyboard();
      } catch (error) {
        logger.error("Error in create form submit:", error);
        form.setError("root", {
          message: "Failed to create staff member. Please try again.",
        });
      }
    } else {
      // Edit mode
      const updateData = data as UserUpdateFormData;

      // Validate required fields
      if (!updateData.id || typeof updateData.id !== "string") {
        logger.error("Invalid id value:", updateData.id);
        form.setError("id", { message: "Invalid user ID" });
        return;
      }
      if (!updateData.businessId || typeof updateData.businessId !== "string") {
        logger.error("Invalid businessId value:", updateData.businessId);
        form.setError("businessId", { message: "Invalid business ID" });
        return;
      }

      try {
        await onSubmit(updateData);
        keyboard.handleCloseKeyboard();
      } catch (error) {
        logger.error("Error submitting form:", error);
        form.setError("root", {
          message: "Failed to update staff member. Please try again.",
        });
      }
    }
  };

  const submitButtonText = mode === "create" ? "Creating..." : "Updating...";
  const submitButtonIdleText =
    mode === "create" ? "Create Staff Member" : "Update Staff Member";

  // Helper to safely get field value from form
  const getFieldValue = (field: string): string => {
    const value =
      keyboard.formValues[field as keyof typeof keyboard.formValues];
    return typeof value === "string" ? value : "";
  };

  // Get current keyboard mode based on active field
  const currentKeyboardMode: "qwerty" | "numeric" | "symbols" =
    (
      keyboard.activeFieldConfig as {
        keyboardMode?: "qwerty" | "numeric" | "symbols";
      } | null
    )?.keyboardMode || "qwerty";

  return (
    <>
      <Form {...form}>
        <form
          id={`${mode}-user-form`}
          onSubmit={form.handleSubmit(handleSubmit, (errors) => {
            logger.error("Form validation errors:", errors);
          })}
          className={showButtons ? "space-y-4" : "flex flex-col h-full"}
        >
          {/* Fixed Buttons Section - Only in drawer mode */}
          {!showButtons && (
            <div className="border-b bg-background shrink-0">
              <div className="flex space-x-2 px-6 pt-4 pb-4">
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? submitButtonText : submitButtonIdleText}
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
          <div
            className={
              showButtons ? "" : "p-6 overflow-y-auto flex-1 min-h-0 space-y-4"
            }
          >
            {/* Form Errors */}
            {form.formState.errors.root && (
              <div className="text-sm text-red-500 p-2 bg-red-50 rounded">
                {form.formState.errors.root.message}
              </div>
            )}

            {/* Avatar Upload */}
            <AvatarField control={form.control} disabled={isLoading} />

            {/* Name Fields */}
            <NameFields
              control={form.control}
              onFieldFocus={(field) => keyboard.handleFieldFocus(field as any)}
              getFieldValue={getFieldValue}
              disabled={isLoading}
            />

            {/* Email Field */}
            <EmailField
              control={form.control}
              onFieldFocus={(field) => keyboard.handleFieldFocus(field as any)}
              getFieldValue={getFieldValue}
              activeField={keyboard.activeField || undefined}
              readOnly={mode === "edit"}
              disabled={isLoading}
              error={form.formState.errors.email?.message}
            />

            {/* Create Mode: Username and PIN */}
            {mode === "create" && (
              <>
                {/* Username */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <AdaptiveFormField
                          {...field}
                          variant="borderOnly"
                          label="Username *"
                          value={getFieldValue("username")}
                          error={
                            mode === "create"
                              ? (form.formState.errors as any).username?.message
                              : undefined
                          }
                          onFocus={() =>
                            keyboard.handleFieldFocus("username" as any)
                          }
                          placeholder="Choose a username"
                          className={cn(
                            "text-xs sm:text-sm md:text-base",
                            keyboard.activeField === "username" &&
                              "border-primary",
                          )}
                          readOnly
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* PIN */}
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <AdaptiveFormField
                          {...field}
                          variant="borderOnly"
                          label="PIN *"
                          type="password"
                          value={getFieldValue("pin")}
                          error={
                            mode === "create"
                              ? (form.formState.errors as any).pin?.message
                              : undefined
                          }
                          onFocus={() =>
                            keyboard.handleFieldFocus("pin" as any)
                          }
                          placeholder="Enter 4-digit PIN"
                          className={cn(
                            "text-xs sm:text-sm md:text-base",
                            keyboard.activeField === "pin" && "border-primary",
                          )}
                          readOnly
                          maxLength={4}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Edit Mode: Hidden fields for ID and businessId */}
            {mode === "edit" && user && (
              <>
                <input type="hidden" {...form.register("id")} value={user.id} />
                <input
                  type="hidden"
                  {...form.register("businessId")}
                  value={user.businessId}
                />
                <input
                  type="hidden"
                  {...form.register("isActive")}
                  value={user.isActive ? "true" : "false"}
                />
              </>
            )}

            {/* Address Field */}
            <AddressField
              control={form.control}
              onFieldFocus={(field) => keyboard.handleFieldFocus(field as any)}
              getFieldValue={getFieldValue}
              disabled={isLoading}
            />

            {/* Role Field */}
            <RoleField
              control={form.control}
              availableRoles={availableRoles}
              isLoadingRoles={isLoadingRoles}
              disabled={isLoading}
              value={mode === "edit" ? getUserRoleName(user) : undefined}
            />

            {/* Edit Mode: Reset PIN Button */}
            {mode === "edit" && user && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetPinDialog(true)}
                  disabled={isLoading}
                  className="w-full text-xs sm:text-sm md:text-base"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset PIN
                </Button>
              </div>
            )}
          </div>

          {/* Actions - Only show if showButtons is true */}
          {showButtons && (
            <div
              className={cn(
                "flex flex-col sm:flex-row gap-2 sm:gap-2 pt-4",
                keyboard.showKeyboard && "pb-[340px]",
              )}
            >
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
              >
                {isLoading ? submitButtonText : submitButtonIdleText}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  keyboard.handleCloseKeyboard();
                  onCancel();
                }}
                className="flex-1 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Adaptive Keyboard */}
          {keyboard.showKeyboard && (
            <div
              className={cn(
                showButtons
                  ? "sticky bottom-0 left-0 right-0 z-50 mt-4 bg-background"
                  : "border-t bg-background px-2 py-2 shrink-0",
              )}
            >
              <div className={showButtons ? "" : "max-w-full overflow-hidden"}>
                <AdaptiveKeyboard
                  onInput={keyboard.handleInput}
                  onBackspace={keyboard.handleBackspace}
                  onClear={keyboard.handleClear}
                  onEnter={() => {
                    // Move to next field or submit if last field
                    if (
                      (mode === "create" && keyboard.activeField === "pin") ||
                      (mode === "edit" && keyboard.activeField === "address")
                    ) {
                      form.handleSubmit(handleSubmit)();
                    }
                  }}
                  initialMode={currentKeyboardMode}
                />
              </div>
            </div>
          )}
        </form>
      </Form>

      {/* Reset PIN Dialog (Edit Mode Only) */}
      {mode === "edit" && user && (
        <ResetPinDialog
          open={showResetPinDialog}
          onOpenChange={setShowResetPinDialog}
          userId={user.id}
          userName={`${user.firstName} ${user.lastName}`}
        />
      )}
    </>
  );
}
