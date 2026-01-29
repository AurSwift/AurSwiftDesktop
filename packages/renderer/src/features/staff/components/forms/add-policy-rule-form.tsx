import { useEffect, useRef } from "react";
import { useForm, type Resolver, type UseFormSetValue } from "react-hook-form";
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
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";
import {
  policyRuleCreateSchema,
  policyRuleUpdateSchema,
  type PolicyRuleFormData,
  type PolicyRuleUpdateData,
} from "../../schemas/policy-rule-schema";
import type { BreakPolicyRule, BreakTypeDefinition } from "@/shared/types/api/break-policy";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("add-policy-rule-form");

interface AddPolicyRuleFormProps {
  onSubmit: (data: PolicyRuleFormData | PolicyRuleUpdateData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  isOpen?: boolean;
  showButtons?: boolean;
  editingRule?: BreakPolicyRule | null;
  breakTypes: BreakTypeDefinition[];
  policyId: number;
}

export function AddPolicyRuleForm({
  onSubmit,
  onCancel,
  isLoading,
  isOpen = true,
  showButtons = true,
  editingRule,
  breakTypes,
  policyId,
}: AddPolicyRuleFormProps) {
  const isEditMode = !!editingRule;

  const form = useForm<PolicyRuleFormData | PolicyRuleUpdateData>({
    resolver: zodResolver(
      isEditMode ? policyRuleUpdateSchema : policyRuleCreateSchema
    ) as Resolver<PolicyRuleFormData | PolicyRuleUpdateData>,
    mode: "onChange",
    defaultValues: editingRule
      ? {
          id: editingRule.id,
          break_type_id: editingRule.break_type_id,
          min_shift_hours: editingRule.min_shift_hours,
          max_shift_hours: editingRule.max_shift_hours ?? null,
          allowed_count: editingRule.allowed_count,
          is_mandatory: editingRule.is_mandatory,
          earliest_after_hours: editingRule.earliest_after_hours ?? null,
          latest_before_end_hours: editingRule.latest_before_end_hours ?? null,
          policy_id: policyId,
        }
      : {
          break_type_id: breakTypes[0]?.id || 0,
          min_shift_hours: 4,
          max_shift_hours: null,
          allowed_count: 1,
          is_mandatory: false,
          earliest_after_hours: null,
          latest_before_end_hours: null,
          policy_id: policyId,
        },
  });

  // Keyboard integration hook for numeric fields (wrapper converts string→number for numeric fields)
  const setValueWithCoercion: UseFormSetValue<PolicyRuleFormData | PolicyRuleUpdateData> = (
    name,
    value,
    options?
  ) => {
    if (
      name === "min_shift_hours" ||
      name === "max_shift_hours" ||
      name === "earliest_after_hours" ||
      name === "latest_before_end_hours"
    ) {
      const numValue =
        typeof value === "string"
          ? value
            ? parseFloat(value)
            : name === "max_shift_hours" ||
                name === "earliest_after_hours" ||
                name === "latest_before_end_hours"
              ? null
              : 0
          : (value as number | null);
      form.setValue(name, numValue as never, options);
    } else if (name === "allowed_count") {
      const numVal =
        typeof value === "string" ? (value ? parseInt(value, 10) : 0) : (value as number);
      form.setValue(name, numVal as never, options);
    } else {
      form.setValue(name, value as never, options);
    }
  };
  const keyboard = useKeyboardWithRHF({
    setValue: setValueWithCoercion,
    watch: form.watch,
    fieldConfigs: {
      min_shift_hours: { keyboardMode: "numeric" },
      max_shift_hours: { keyboardMode: "numeric" },
      allowed_count: { keyboardMode: "numeric" },
      earliest_after_hours: { keyboardMode: "numeric" },
      latest_before_end_hours: { keyboardMode: "numeric" },
    },
  });

  // Close keyboard when dialog closes
  useEffect(() => {
    if (!isOpen) {
      keyboard.handleCloseKeyboard();
    }
  }, [isOpen, keyboard]);

  // Reset form when editingRule changes (only when switching between different rules or add/edit mode)
  const previousRuleIdRef = useRef<number | null>(null);
  const previousModeRef = useRef<boolean>(isEditMode);
  
  useEffect(() => {
    const currentRuleId = editingRule?.id ?? null;
    const modeChanged = previousModeRef.current !== isEditMode;
    const ruleChanged = previousRuleIdRef.current !== currentRuleId;

    // Only reset if we're switching to a different rule or changing modes
    if (ruleChanged || modeChanged) {
      if (editingRule) {
        form.reset({
          id: editingRule.id,
          break_type_id: editingRule.break_type_id,
          min_shift_hours: editingRule.min_shift_hours,
          max_shift_hours: editingRule.max_shift_hours ?? null,
          allowed_count: editingRule.allowed_count,
          is_mandatory: editingRule.is_mandatory,
          earliest_after_hours: editingRule.earliest_after_hours ?? null,
          latest_before_end_hours: editingRule.latest_before_end_hours ?? null,
          policy_id: policyId,
        });
      } else {
        form.reset({
          break_type_id: breakTypes[0]?.id || 0,
          min_shift_hours: 4,
          max_shift_hours: null,
          allowed_count: 1,
          is_mandatory: false,
          earliest_after_hours: null,
          latest_before_end_hours: null,
          policy_id: policyId,
        });
      }

      // Update refs
      previousRuleIdRef.current = currentRuleId;
      previousModeRef.current = isEditMode;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRule?.id, isEditMode, policyId, breakTypes]);

  const handleSubmit = async (data: PolicyRuleFormData | PolicyRuleUpdateData) => {
    logger.info("Policy rule form submitted with data:", data);

    try {
      await onSubmit(data);
      keyboard.handleCloseKeyboard();
    } catch (error) {
      logger.error("Error in policy rule form submit:", error);
      form.setError("root", {
        message: "Failed to save policy rule. Please try again.",
      });
    }
  };

  return (
    <Form {...form}>
      <form
        id="add-policy-rule-form"
        onSubmit={form.handleSubmit(handleSubmit, (errors) => {
          logger.error("Policy rule form validation errors:", errors);
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

          {/* Break Type */}
          <FormField
            control={form.control}
            name="break_type_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Break Type *</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(parseInt(value));
                    keyboard.handleCloseKeyboard();
                  }}
                  value={field.value?.toString() || ""}
                  disabled={breakTypes.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select break type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {breakTypes.length === 0 ? (
                      <SelectItem value="no-types" disabled>
                        No break types available
                      </SelectItem>
                    ) : (
                      breakTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Min and Max Shift Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="min_shift_hours"
              render={() => (
                <FormItem>
                  <FormLabel>Min Shift Hours *</FormLabel>
                  <FormControl>
                    <AdaptiveFormField
                      {...form.register("min_shift_hours")}
                      label=""
                      value={
                        keyboard.formValues.min_shift_hours ||
                        form.watch("min_shift_hours")?.toString() ||
                        ""
                      }
                      placeholder="4.0"
                      readOnly
                      onClick={() => keyboard.handleFieldFocus("min_shift_hours")}
                      onFocus={() => keyboard.handleFieldFocus("min_shift_hours")}
                      className={cn(
                        "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                        keyboard.activeField === "min_shift_hours" &&
                          "ring-2 ring-primary border-primary"
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_shift_hours"
              render={() => (
                <FormItem>
                  <FormLabel>Max Shift Hours (optional)</FormLabel>
                  <FormControl>
                    <AdaptiveFormField
                      {...form.register("max_shift_hours")}
                      label=""
                      value={
                        keyboard.formValues.max_shift_hours ||
                        (form.watch("max_shift_hours") !== null && form.watch("max_shift_hours") !== undefined
                          ? form.watch("max_shift_hours")?.toString()
                          : "") ||
                        ""
                      }
                      placeholder="No limit"
                      readOnly
                      onClick={() => keyboard.handleFieldFocus("max_shift_hours")}
                      onFocus={() => keyboard.handleFieldFocus("max_shift_hours")}
                      className={cn(
                        "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                        keyboard.activeField === "max_shift_hours" &&
                          "ring-2 ring-primary border-primary"
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Allowed Count and Mandatory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="allowed_count"
              render={() => (
                <FormItem>
                  <FormLabel>Allowed Count *</FormLabel>
                  <FormControl>
                    <AdaptiveFormField
                      {...form.register("allowed_count")}
                      label=""
                      value={
                        keyboard.formValues.allowed_count ||
                        form.watch("allowed_count")?.toString() ||
                        ""
                      }
                      placeholder="1"
                      readOnly
                      onClick={() => keyboard.handleFieldFocus("allowed_count")}
                      onFocus={() => keyboard.handleFieldFocus("allowed_count")}
                      className={cn(
                        "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                        keyboard.activeField === "allowed_count" &&
                          "ring-2 ring-primary border-primary"
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_mandatory"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 pt-8">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>Mandatory Break</FormLabel>
                </FormItem>
              )}
            />
          </div>

          {/* Timing Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="earliest_after_hours"
              render={() => (
                <FormItem>
                  <FormLabel>Earliest After (hours)</FormLabel>
                  <FormControl>
                    <AdaptiveFormField
                      {...form.register("earliest_after_hours")}
                      label=""
                      value={
                        keyboard.formValues.earliest_after_hours ||
                        (form.watch("earliest_after_hours") !== null && form.watch("earliest_after_hours") !== undefined
                          ? form.watch("earliest_after_hours")?.toString()
                          : "") ||
                        ""
                      }
                      placeholder="Any time"
                      readOnly
                      onClick={() => keyboard.handleFieldFocus("earliest_after_hours")}
                      onFocus={() => keyboard.handleFieldFocus("earliest_after_hours")}
                      className={cn(
                        "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                        keyboard.activeField === "earliest_after_hours" &&
                          "ring-2 ring-primary border-primary"
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="latest_before_end_hours"
              render={() => (
                <FormItem>
                  <FormLabel>Latest Before End (hours)</FormLabel>
                  <FormControl>
                    <AdaptiveFormField
                      {...form.register("latest_before_end_hours")}
                      label=""
                      value={
                        keyboard.formValues.latest_before_end_hours ||
                        (form.watch("latest_before_end_hours") !== null && form.watch("latest_before_end_hours") !== undefined
                          ? form.watch("latest_before_end_hours")?.toString()
                          : "") ||
                        ""
                      }
                      placeholder="Any time"
                      readOnly
                      onClick={() => keyboard.handleFieldFocus("latest_before_end_hours")}
                      onFocus={() => keyboard.handleFieldFocus("latest_before_end_hours")}
                      className={cn(
                        "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                        keyboard.activeField === "latest_before_end_hours" &&
                          "ring-2 ring-primary border-primary"
                      )}
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
                  if (keyboard.activeField === "latest_before_end_hours") {
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
                  )?.keyboardMode || "numeric"
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
