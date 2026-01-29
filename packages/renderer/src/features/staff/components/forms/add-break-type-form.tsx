import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveTextarea } from "@/features/adaptive-keyboard/adaptive-textarea";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";
import {
  breakTypeCreateSchema,
  breakTypeUpdateSchema,
  type BreakTypeFormData,
  type BreakTypeUpdateData,
} from "../../schemas/break-type-schema";
import { TimePicker } from "@/components/time-picker";
import type { BreakTypeDefinition } from "@/shared/types/api/break-policy";
import { getLogger } from "@/shared/utils/logger";
import { useAuth } from "@/shared/hooks/use-auth";

const logger = getLogger("add-break-type-form");

interface AddBreakTypeFormProps {
  onSubmit: (data: BreakTypeFormData | BreakTypeUpdateData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  isOpen?: boolean;
  showButtons?: boolean;
  editingBreakType?: BreakTypeDefinition | null;
}

export function AddBreakTypeForm({
  onSubmit,
  onCancel,
  isLoading,
  isOpen = true,
  showButtons = true,
  editingBreakType,
}: AddBreakTypeFormProps) {
  const { user } = useAuth();
  const isEditMode = !!editingBreakType;

  const form = useForm<BreakTypeFormData | BreakTypeUpdateData>({
    resolver: zodResolver(
      isEditMode ? breakTypeUpdateSchema : breakTypeCreateSchema
    ) as Resolver<BreakTypeFormData | BreakTypeUpdateData>,
    mode: "onChange",
    defaultValues: editingBreakType
      ? {
          id: editingBreakType.id,
          name: editingBreakType.name,
          code: editingBreakType.code,
          description: editingBreakType.description || "",
          default_duration_minutes: editingBreakType.default_duration_minutes,
          min_duration_minutes: editingBreakType.min_duration_minutes,
          max_duration_minutes: editingBreakType.max_duration_minutes,
          is_paid: editingBreakType.is_paid,
          is_required: editingBreakType.is_required,
          counts_as_worked_time: editingBreakType.counts_as_worked_time,
          allowed_window_start: editingBreakType.allowed_window_start || "",
          allowed_window_end: editingBreakType.allowed_window_end || "",
          icon: editingBreakType.icon || "coffee",
          color: editingBreakType.color || "#6B7280",
          business_id: editingBreakType.business_id || user?.businessId || "",
        }
      : {
          name: "",
          code: "",
          description: "",
          default_duration_minutes: 15,
          min_duration_minutes: 5,
          max_duration_minutes: 30,
          is_paid: false,
          is_required: false,
          counts_as_worked_time: false,
          allowed_window_start: "",
          allowed_window_end: "",
          icon: "coffee",
          color: "#6B7280",
          business_id: user?.businessId || "",
        },
  });

  // Keyboard integration hook
  const keyboard = useKeyboardWithRHF({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs: {
      name: { keyboardMode: "qwerty" },
      code: { keyboardMode: "qwerty" },
      description: { keyboardMode: "qwerty" },
    },
  });

  // Close keyboard when dialog closes
  useEffect(() => {
    if (!isOpen) {
      keyboard.handleCloseKeyboard();
    }
  }, [isOpen, keyboard]);

  const handleSubmit = async (data: BreakTypeFormData | BreakTypeUpdateData) => {
    logger.info("Break type form submitted with data:", data);

    // Ensure business_id is set
    const formData = {
      ...data,
      business_id: data.business_id || user?.businessId || "",
    };

    try {
      await onSubmit(formData);
      keyboard.handleCloseKeyboard();
    } catch (error) {
      logger.error("Error in break type form submit:", error);
      form.setError("root", {
        message: "Failed to save break type. Please try again.",
      });
    }
  };

  return (
    <Form {...form}>
      <form
        id="add-break-type-form"
        onSubmit={form.handleSubmit(handleSubmit, (errors) => {
          logger.error("Break type form validation errors:", errors);
        })}
        className={showButtons ? "space-y-4" : "flex flex-col h-full"}
      >
        {/* Fixed Buttons Section - Only in drawer mode */}
        {!showButtons && (
          <div className="border-b bg-background shrink-0">
            <div className="flex space-x-2 px-6 pt-4 pb-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Saving..." : isEditMode ? "Save Changes" : "Create"}
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

          {/* Name and Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={() => (
                <FormItem>
                  <FormControl>
                    <AdaptiveFormField
                      {...form.register("name")}
                      label="Name *"
                      value={keyboard.formValues.name || ""}
                      error={form.formState.errors.name?.message}
                      onFocus={() => keyboard.handleFieldFocus("name")}
                      placeholder="Tea Break"
                      className={cn(
                        "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                        keyboard.activeField === "name" &&
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
              name="code"
              render={() => (
                <FormItem>
                  <FormControl>
                    <AdaptiveFormField
                      {...form.register("code")}
                      label="Code *"
                      value={keyboard.formValues.code || ""}
                      error={form.formState.errors.code?.message}
                      onFocus={() => keyboard.handleFieldFocus("code")}
                      placeholder="tea"
                      className={cn(
                        "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                        keyboard.activeField === "code" &&
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

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={() => (
              <FormItem>
                <FormControl>
                  <AdaptiveTextarea
                    {...form.register("description")}
                    label="Description"
                    value={keyboard.formValues.description || ""}
                    error={form.formState.errors.description?.message}
                    onFocus={() => keyboard.handleFieldFocus("description")}
                    placeholder="Short break for tea/coffee"
                    className={cn(
                      keyboard.activeField === "description" &&
                        "ring-2 ring-primary border-primary"
                    )}
                    readOnly
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Duration Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="default_duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default (min) *</FormLabel>
                  <FormControl>
                    <input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="min_duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min (min) *</FormLabel>
                  <FormControl>
                    <input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max (min) *</FormLabel>
                  <FormControl>
                    <input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Time Window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="allowed_window_start"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Window Start</FormLabel>
                  <FormControl>
                    <TimePicker
                      id="allowed_window_start"
                      label=""
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowed_window_end"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Window End</FormLabel>
                  <FormControl>
                    <TimePicker
                      id="allowed_window_end"
                      label=""
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Toggle Switches */}
          <div className="flex flex-wrap gap-4">
            <FormField
              control={form.control}
              name="is_paid"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>Paid Break</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_required"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>Required by Law</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="counts_as_worked_time"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>Counts as Worked Time</FormLabel>
                </FormItem>
              )}
            />
          </div>

          {/* Icon and Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    onOpenChange={() => keyboard.handleCloseKeyboard()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="coffee">☕ Coffee</SelectItem>
                      <SelectItem value="utensils">🍽️ Meal</SelectItem>
                      <SelectItem value="pause">⏸️ Pause</SelectItem>
                      <SelectItem value="clock">⏰ Clock</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <input
                      type="color"
                      {...field}
                      className="w-full h-10 rounded-md border border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
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
              {isLoading ? "Saving..." : isEditMode ? "Save Changes" : "Create"}
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
                  } else {
                    keyboard.handleCloseKeyboard();
                  }
                }}
                initialMode={
                  (
                    keyboard.activeFieldConfig as {
                      keyboardMode?: "qwerty" | "numeric" | "symbols";
                    }
                  )?.keyboardMode || "qwerty"
                }
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
