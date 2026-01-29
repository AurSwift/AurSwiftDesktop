import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";
import {
  roleCreateSchema,
  type RoleCreateFormData,
} from "@/features/rbac/schemas";
import { getLogger } from "@/shared/utils/logger";
import { getAllAvailablePermissions } from "@app/shared/constants/permissions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Search } from "lucide-react";

const logger = getLogger("create-role-form");

// Get all available permissions from constants (single source of truth)
const AVAILABLE_PERMISSIONS = getAllAvailablePermissions();

interface CreateRoleFormProps {
  onSubmit: (data: RoleCreateFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  isOpen?: boolean; // Drawer open state to close keyboard when drawer closes
  showButtons?: boolean; // Whether to show buttons (for drawer mode)
}

export function CreateRoleForm({
  onSubmit,
  onCancel,
  isLoading,
  isOpen = true,
  showButtons = true,
}: CreateRoleFormProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");

  const form = useForm<RoleCreateFormData>({
    resolver: zodResolver(roleCreateSchema),
    mode: "onChange", // Enable real-time validation for better UX with keyboard
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      permissions: [],
    },
  });

  // Sync selectedPermissions with form's permissions field
  useEffect(() => {
    form.setValue("permissions", selectedPermissions, { shouldValidate: true });
  }, [selectedPermissions, form]);

  // Keyboard integration hook
  const keyboard = useKeyboardWithRHF({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs: {
      name: { keyboardMode: "qwerty" },
      displayName: { keyboardMode: "qwerty" },
      description: { keyboardMode: "qwerty" },
    },
  });

  // Close keyboard and reset form when drawer closes
  useEffect(() => {
    if (!isOpen) {
      keyboard.handleCloseKeyboard();
      form.reset();
      setSelectedPermissions([]);
      setPermissionSearch("");
    }
  }, [isOpen, keyboard, form]);

  const handleSubmit = async (data: RoleCreateFormData) => {
    logger.info("Create role form submitted with data:", data);

    // Use permissions from form data (which should match selectedPermissions)
    const permissions = data.permissions || selectedPermissions;

    // Validate permissions
    if (!permissions || permissions.length === 0) {
      form.setError("permissions", { message: "At least one permission is required" });
      return;
    }

    // Only include description if it's provided and meets minimum length
    const submitData: RoleCreateFormData = {
      name: data.name.trim(),
      displayName: data.displayName.trim(),
      permissions: permissions,
    };

    // Only add description if it's provided and has at least 10 characters
    if (data.description && data.description.trim().length >= 10) {
      submitData.description = data.description.trim();
    }

    try {
      await onSubmit(submitData);
      // Close keyboard on successful submit
      keyboard.handleCloseKeyboard();
    } catch (error) {
      logger.error("Error in create role form submit:", error);
      form.setError("root", {
        message: "Failed to create role. Please try again.",
      });
    }
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const filteredPermissions = AVAILABLE_PERMISSIONS.filter((p) =>
    p.toLowerCase().includes(permissionSearch.toLowerCase())
  );

  return (
    <Form {...form}>
      <form
        id="create-role-form"
        onSubmit={form.handleSubmit(handleSubmit, (errors) => {
          logger.error("Create role form validation errors:", errors);
        })}
        className={showButtons ? "space-y-4" : "flex flex-col h-full"}
      >
        {/* Fixed Buttons Section - Only in drawer mode */}
        {!showButtons && (
          <div className="border-b bg-background shrink-0">
            <div className="flex space-x-2 px-6 pt-4 pb-4">
              <Button type="submit" className="flex-1" disabled={isLoading || selectedPermissions.length === 0}>
                {isLoading ? "Creating..." : "Create Role"}
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

          {/* Role Name */}
          <FormField
            control={form.control}
            name="name"
            render={() => (
              <FormItem>
                <FormControl>
                  <AdaptiveFormField
                    {...form.register("name")}
                    label="Role Name *"
                    value={keyboard.formValues.name || ""}
                    error={form.formState.errors.name?.message}
                    onFocus={() => keyboard.handleFieldFocus("name")}
                    placeholder="e.g., inventory_specialist"
                    className={cn(
                      "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                      keyboard.activeField === "name" &&
                        "ring-2 ring-primary border-primary"
                    )}
                    readOnly
                  />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  Use lowercase with underscores only
                </p>
              </FormItem>
            )}
          />

          {/* Display Name */}
          <FormField
            control={form.control}
            name="displayName"
            render={() => (
              <FormItem>
                <FormControl>
                  <AdaptiveFormField
                    {...form.register("displayName")}
                    label="Display Name *"
                    value={keyboard.formValues.displayName || ""}
                    error={form.formState.errors.displayName?.message}
                    onFocus={() => keyboard.handleFieldFocus("displayName")}
                    placeholder="e.g., Inventory Specialist"
                    className={cn(
                      "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                      keyboard.activeField === "displayName" &&
                        "ring-2 ring-primary border-primary"
                    )}
                    readOnly
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={() => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Description (Optional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...form.register("description")}
                    placeholder="Describe the purpose of this role... (min 10 characters if provided)"
                    rows={3}
                    className={cn(
                      "text-xs sm:text-sm md:text-base lg:text-base",
                      "resize-none",
                      keyboard.activeField === "description" &&
                        "ring-2 ring-primary border-primary"
                    )}
                    onFocus={() => keyboard.handleFieldFocus("description")}
                    readOnly
                    value={keyboard.formValues.description || ""}
                  />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  Optional. If provided, must be at least 10 characters.
                </p>
              </FormItem>
            )}
          />

          {/* Permissions */}
          <FormField
            control={form.control}
            name="permissions"
            render={() => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Permissions *
                </FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search permissions..."
                        value={permissionSearch}
                        onChange={(e) => setPermissionSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                      {filteredPermissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No permissions found
                        </p>
                      ) : (
                        filteredPermissions.map((permission) => (
                          <div
                            key={permission}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded"
                            onClick={() => togglePermission(permission)}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(permission)}
                              onChange={() => togglePermission(permission)}
                              className="cursor-pointer"
                            />
                            <span className="text-sm">{permission}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {selectedPermissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedPermissions.map((permission) => (
                          <Badge key={permission} variant="secondary">
                            {permission}
                            <X
                              className="h-3 w-3 ml-1 cursor-pointer"
                              onClick={() => togglePermission(permission)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}

                    {selectedPermissions.length === 0 && (
                      <p className="text-sm text-destructive">
                        At least one permission is required
                      </p>
                    )}
                  </div>
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
              disabled={isLoading || selectedPermissions.length === 0}
              className="flex-1 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
            >
              {isLoading ? "Creating..." : "Create Role"}
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
                  if (keyboard.activeField === "description") {
                    form.handleSubmit(handleSubmit)();
                  }
                }}
                initialMode={(keyboard.activeFieldConfig as { keyboardMode?: "qwerty" | "numeric" | "symbols" } | undefined)?.keyboardMode ?? "qwerty"}
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
