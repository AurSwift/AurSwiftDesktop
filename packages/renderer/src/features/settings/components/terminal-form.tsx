import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import { useAuth } from "@/shared/hooks/use-auth";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/features/adaptive-keyboard/hooks/use-keyboard-with-react-hook-form";
import type { KeyboardMode } from "@/features/adaptive-keyboard/keyboard-layouts";
import type { Terminal } from "@/types/api/terminals";
import { cn } from "@/shared/utils/cn";

const logger = getLogger("terminal-form");

interface TerminalFormData {
  name: string;
  terminalNumber: string;
  type: "pos" | "kiosk" | "handheld" | "kitchen_display" | "server";
  status: "active" | "inactive" | "maintenance" | "decommissioned";
}

const TERMINAL_TYPES = [
  { value: "pos", label: "POS Terminal" },
  { value: "kiosk", label: "Kiosk" },
  { value: "handheld", label: "Handheld Device" },
  { value: "kitchen_display", label: "Kitchen Display" },
  { value: "server", label: "Server" },
] as const;

const TERMINAL_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "maintenance", label: "Maintenance" },
  { value: "decommissioned", label: "Decommissioned" },
] as const;

interface TerminalFormProps {
  terminal: Terminal | null;
  onCancel?: () => void;
  onUpdate?: (terminal: Terminal) => void;
}

export function TerminalForm({
  terminal,
  onCancel,
  onUpdate,
}: TerminalFormProps) {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<{
    localIP: string;
    macAddress: string;
  }>({ localIP: "Loading...", macAddress: "Loading..." });

  const form = useForm<TerminalFormData>({
    defaultValues: {
      name: "",
      terminalNumber: "",
      type: "pos",
      status: "active",
    },
    mode: "onChange",
  });

  // Configure keyboard modes for different field types
  const fieldConfigs: Partial<
    Record<keyof TerminalFormData, { keyboardMode?: KeyboardMode }>
  > = {
    terminalNumber: { keyboardMode: "numeric" },
  };

  const keyboard = useKeyboardWithRHF({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs,
  });

  // Load network information on mount
  useEffect(() => {
    const loadNetworkInfo = async () => {
      try {
        const response = await window.terminalsAPI.getNetworkInfo();
        if (response.success && response.data) {
          setNetworkInfo(response.data);
        }
      } catch (error) {
        logger.error("Failed to load network info:", error);
      }
    };
    loadNetworkInfo();
  }, []);

  // Load terminal data when terminal prop changes
  useEffect(() => {
    if (terminal) {
      logger.info("Loading terminal data:", terminal);

      // Extract terminal number from name or settings
      const terminalNumber = terminal.settings?.terminalNumber || "";

      form.reset({
        name: terminal.name ?? "",
        terminalNumber,
        type: terminal.type ?? "pos",
        status: terminal.status ?? "active",
      });
    } else {
      form.reset({
        name: "",
        terminalNumber: "",
        type: "pos",
        status: "active",
      });
    }
  }, [terminal, form]);

  const onSubmit = async (data: TerminalFormData) => {
    if (!user?.businessId || !terminal) {
      toast.error("Business ID or terminal not found");
      return;
    }

    // Get session token
    const token = await window.authStore.get("token");
    if (!token) {
      toast.error("Session expired. Please log in again.");
      return;
    }

    try {
      setIsSaving(true);

      logger.info("Submitting terminal update:", {
        terminalId: terminal.id,
        data,
        fieldCount: Object.keys(data).length,
      });

      // Merge settings to preserve existing settings
      const existingSettings = terminal.settings || {};
      const updatedSettings = {
        ...existingSettings,
        terminalNumber: data.terminalNumber,
      };

      const response = await window.terminalsAPI.update(token, terminal.id, {
        name: data.name,
        type: data.type,
        status: data.status,
        settings: updatedSettings,
      });

      logger.info("Terminal update response:", response);

      if (!response.success) {
        throw new Error(response.message || "Failed to update terminal");
      }

      // Reload terminal data to show updated values
      const reloadResponse = await window.terminalsAPI.getById(
        token,
        terminal.id
      );

      if (reloadResponse.success && reloadResponse.terminal) {
        const updatedTerminal = reloadResponse.terminal;
        const reloadedTerminalNumber =
          updatedTerminal.settings?.terminalNumber || "";

        form.reset({
          name: updatedTerminal.name ?? "",
          terminalNumber: reloadedTerminalNumber,
          type: updatedTerminal.type ?? "pos",
          status: updatedTerminal.status ?? "active",
        });
        // Notify parent component of update
        if (onUpdate) {
          onUpdate(updatedTerminal);
        }
      }

      toast.success("Terminal information updated successfully");
    } catch (error) {
      logger.error("Error saving terminal:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update terminal information"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // When keyboard opens or active field changes, ensure the focused field is visible
  useEffect(() => {
    if (!keyboard.showKeyboard || !keyboard.activeField) return;

    const targetId = keyboard.activeField as string;

    // Let React paint the keyboard first, then scroll.
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => cancelAnimationFrame(raf);
  }, [keyboard.activeField, keyboard.showKeyboard]);

  const activeInputType =
    keyboard.activeField === "terminalNumber" ? "tel" : "text";

  return (
    <div className={cn("space-y-6", keyboard.showKeyboard && "pb-[340px]")}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Terminal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Basic Information
            </h3>

            {/* Terminal Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <AdaptiveFormField
                    label="Terminal Name"
                    id="name"
                    placeholder="e.g., Counter 1, Main Register"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                    onFocus={() => keyboard.handleFieldFocus("name")}
                    error={form.formState.errors.name?.message}
                  />
                  <FormDescription className="text-xs">
                    A friendly name to identify this terminal in your store
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Terminal Number */}
            <FormField
              control={form.control}
              name="terminalNumber"
              render={({ field }) => (
                <FormItem>
                  <AdaptiveFormField
                    label="Terminal Number"
                    id="terminalNumber"
                    type="tel"
                    placeholder="e.g., 001, 002"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                    onFocus={() => keyboard.handleFieldFocus("terminalNumber")}
                    error={form.formState.errors.terminalNumber?.message}
                  />
                  <FormDescription className="text-xs">
                    Unique number for this terminal (useful for multi-terminal
                    setups)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Terminal Type and Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terminal Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSaving}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select terminal type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TERMINAL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSaving}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TERMINAL_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Advanced Settings - Collapsible */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-between text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Advanced Settings
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    showAdvanced && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  These technical details are automatically detected and managed
                  by the system.
                </p>

                {/* Display Only - Local IP */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Local IP Address
                  </label>
                  <div className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-500 dark:text-slate-400">
                    {networkInfo.localIP}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    The IP address of this device on your local network
                    (read-only)
                  </p>
                </div>

                {/* Display Only - MAC Address */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    MAC Address
                  </label>
                  <div className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-500 dark:text-slate-400 font-mono">
                    {networkInfo.macAddress}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Hardware address of your network adapter (read-only)
                  </p>
                </div>

                {/* Machine ID - Hidden from UI but used in background */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                    Machine fingerprint and device ID are managed automatically
                    for license activation
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSaving || !terminal}>
              {isSaving ? "Saving..." : "Save Terminal Information"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Adaptive Keyboard */}
      {keyboard.showKeyboard && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-lg">
          <AdaptiveKeyboard
            onInput={keyboard.handleInput}
            onBackspace={keyboard.handleBackspace}
            onClear={keyboard.handleClear}
            onEnter={() => {
              // Move to next field or submit if last field
              const fields: (keyof TerminalFormData)[] = [
                "name",
                "terminalNumber",
              ];
              const currentIndex = fields.findIndex(
                (f) => f === keyboard.activeField
              );
              if (currentIndex < fields.length - 1) {
                keyboard.handleFieldFocus(fields[currentIndex + 1]);
              } else {
                form.handleSubmit(onSubmit)();
              }
            }}
            onTab={() => {
              // Same as enter for tab navigation
              const fields: (keyof TerminalFormData)[] = [
                "name",
                "terminalNumber",
              ];
              const currentIndex = fields.findIndex(
                (f) => f === keyboard.activeField
              );
              if (currentIndex < fields.length - 1) {
                keyboard.handleFieldFocus(fields[currentIndex + 1]);
              }
            }}
            initialMode={
              keyboard.activeFieldConfig?.keyboardMode ||
              (activeInputType === "tel" ? "numeric" : "qwerty")
            }
            inputType={activeInputType}
            onClose={keyboard.handleCloseKeyboard}
            visible={keyboard.showKeyboard}
          />
        </div>
      )}
    </div>
  );
}
