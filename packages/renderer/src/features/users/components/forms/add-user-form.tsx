import { useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/avatar-upload";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";
import {
  userCreateSchema,
  type UserCreateFormData,
} from "@/features/users/schemas/user-schema";
import { useAuth } from "@/shared/hooks/use-auth";
import { useRoles, type Role } from "@/features/rbac/hooks/useRoles";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("add-user-form");

interface AddUserFormProps {
  onSubmit: (data: UserCreateFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  isOpen?: boolean; // Dialog open state to close keyboard when dialog closes
  showButtons?: boolean; // Whether to show buttons (for drawer mode)
}

export function AddUserForm({
  onSubmit,
  onCancel,
  isLoading,
  isOpen = true,
  showButtons = true,
}: AddUserFormProps) {
  const { user } = useAuth();

  // Fetch roles dynamically
  const { data: roles, isLoading: isLoadingRoles } = useRoles();

  // Filter roles to only show active staff roles (cashier, manager)
  const availableRoles = useMemo(() => {
    return roles.filter(
      (role: Role) =>
        role.isActive && (role.name === "cashier" || role.name === "manager")
    );
  }, [roles]);

  const defaultRole = useMemo(() => {
    const firstRole = availableRoles.find(
      (r: Role) => r.name === "cashier" || r.name === "manager"
    );
    return (firstRole?.name as "cashier" | "manager") || "cashier";
  }, [availableRoles]);

  const form = useForm<UserCreateFormData>({
    resolver: zodResolver(userCreateSchema),
    mode: "onChange", // Enable real-time validation for better UX with keyboard
    defaultValues: {
      email: "",
      username: "",
      pin: "",
      firstName: "",
      lastName: "",
      role: defaultRole,
      avatar: "",
      address: "",
      businessId: user?.businessId || "",
    },
  });

  // Keyboard integration hook
  const keyboard = useKeyboardWithRHF({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs: {
      firstName: { keyboardMode: "qwerty" },
      lastName: { keyboardMode: "qwerty" },
      email: { keyboardMode: "qwerty" },
      address: { keyboardMode: "qwerty" },
      username: { keyboardMode: "qwerty" },
      pin: { keyboardMode: "numeric" },
    },
  });

  // Close keyboard when dialog closes
  useEffect(() => {
    if (!isOpen) {
      keyboard.handleCloseKeyboard();
    }
  }, [isOpen, keyboard]);

  const handleSubmit = async (data: UserCreateFormData) => {
    logger.info("Add form submitted with data:", data);

    if (!user?.businessId) {
      form.setError("root", { message: "Business ID not found" });
      return;
    }

    const formData = {
      ...data,
      businessId: user.businessId,
    };

    try {
      await onSubmit(formData);
      // Close keyboard on successful submit
      keyboard.handleCloseKeyboard();
    } catch (error) {
      logger.error("Error in add form submit:", error);
      form.setError("root", {
        message: "Failed to create staff member. Please try again.",
      });
    }
  };

  return (
    <Form {...form}>
      <form
        id="add-user-form"
        onSubmit={form.handleSubmit(handleSubmit, (errors) => {
          logger.error("Add form validation errors:", errors);
        })}
        className={showButtons ? "space-y-4" : "flex flex-col h-full"}
      >
        {/* Fixed Buttons Section - Only in drawer mode */}
        {!showButtons && (
          <div className="border-b bg-background shrink-0">
            <div className="flex space-x-2 px-6 pt-4 pb-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Staff Member"}
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

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={() => (
            <FormItem>
              <FormControl>
                <AdaptiveFormField
                  {...form.register("email")}
                  label="Email *"
                  value={keyboard.formValues.email || ""}
                  error={form.formState.errors.email?.message}
                  onFocus={() => keyboard.handleFieldFocus("email")}
                  placeholder="john.smith@example.com"
                  className={cn(
                    "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                    keyboard.activeField === "email" &&
                      "ring-2 ring-primary border-primary"
                  )}
                  readOnly
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Username */}
        <FormField
          control={form.control}
          name="username"
          render={() => (
            <FormItem>
              <FormControl>
                <AdaptiveFormField
                  {...form.register("username")}
                  label="Username *"
                  value={keyboard.formValues.username || ""}
                  error={form.formState.errors.username?.message}
                  onFocus={() => keyboard.handleFieldFocus("username")}
                  placeholder="Choose a username"
                  className={cn(
                    "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                    keyboard.activeField === "username" &&
                      "ring-2 ring-primary border-primary"
                  )}
                  readOnly
                />
              </FormControl>
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
            <FormItem className="space-y-2">
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

        {/* PIN */}
        <FormField
          control={form.control}
          name="pin"
          render={() => (
            <FormItem>
              <FormControl>
                <AdaptiveFormField
                  {...form.register("pin")}
                  label="PIN *"
                  type="password"
                  value={keyboard.formValues.pin || ""}
                  error={form.formState.errors.pin?.message}
                  onFocus={() => keyboard.handleFieldFocus("pin")}
                  placeholder="Enter 4-digit PIN"
                  className={cn(
                    "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                    keyboard.activeField === "pin" &&
                      "ring-2 ring-primary border-primary"
                  )}
                  readOnly
                  maxLength={4}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        </div>

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
              {isLoading ? "Creating..." : "Create Staff Member"}
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
                  if (keyboard.activeField === "pin") {
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
