import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/features/adaptive-keyboard/hooks/use-keyboard-with-react-hook-form";
import type { KeyboardMode } from "@/features/adaptive-keyboard/keyboard-layouts";
import { useAuth } from "@/shared/hooks/use-auth";
import { useUserPermissions } from "@/features/dashboard/hooks/use-user-permissions";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import { Eye, EyeOff } from "lucide-react";

const logger = getLogger("receipt-email-settings-form");

type FormData = {
  gmailUser: string;
  gmailAppPassword: string;
};

function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 1) return trimmed;
  return `${trimmed.slice(0, 1)}***${trimmed.slice(at)}`;
}

function normalizeEmail(value: string): string {
  return value.trim();
}

export function ReceiptEmailSettingsForm() {
  const { user, sessionToken } = useAuth();
  const permissions = useUserPermissions();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [configuredEmail, setConfiguredEmail] = useState<string | null>(null);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const keyboardSpacerId = "receipt-email-gmail-keyboard-spacer";

  const form = useForm<FormData>({
    defaultValues: {
      gmailUser: "",
      gmailAppPassword: "",
    },
    mode: "onChange",
  });

  const fieldConfigs: Partial<
    Record<keyof FormData, { keyboardMode?: KeyboardMode }>
  > = {
    gmailUser: { keyboardMode: "qwerty" },
    gmailAppPassword: { keyboardMode: "qwerty" },
  };

  const keyboard = useKeyboardWithRHF<FormData>({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs,
  });

  const keyboardSpacerHeightPx = useMemo(() => {
    // Approximate height of the AdaptiveKeyboard + a small safety gap.
    // This ensures fields/buttons are not hidden behind the fixed keyboard overlay.
    return 340;
  }, []);

  const load = useCallback(async () => {
    try {
      if (!sessionToken || !user?.businessId) {
        setConfiguredEmail(null);
        form.reset({ gmailUser: "", gmailAppPassword: "" });
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const res = await window.emailSettingsAPI.get(sessionToken, user.businessId);
      if (res?.success && res.data) {
        setConfiguredEmail(res.data.gmailUser || null);
        form.reset({
          gmailUser: res.data.gmailUser || "",
          gmailAppPassword: "",
        });
      }
    } catch (error) {
      logger.error("Failed to load email settings:", error);
      toast.error("Failed to load email settings");
    } finally {
      setIsLoading(false);
    }
  }, [form, sessionToken, user?.businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        if (!sessionToken || !user?.businessId) {
          throw new Error("Not authenticated");
        }
        if (!permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE)) {
          throw new Error("You do not have permission to change these settings.");
        }
        setIsSaving(true);
        const nextEmail = normalizeEmail(data.gmailUser);
        const res = await window.emailSettingsAPI.set(
          sessionToken,
          user.businessId,
          {
            gmailUser: nextEmail,
            gmailAppPassword: data.gmailAppPassword,
          }
        );

        if (!res?.success) {
          throw new Error(res?.message || "Failed to save email settings");
        }

        // Re-fetch from main so UI reflects persisted state (not just local input).
        const refreshed = await window.emailSettingsAPI
          .get(sessionToken, user.businessId)
          .catch(() => null);

        const persistedEmail =
          refreshed?.success && refreshed.data?.gmailUser
            ? refreshed.data.gmailUser
            : null;

        if (!persistedEmail) {
          // If this happens, something prevented persistence (IPC not registered, DB issue, etc).
          toast.warning(
            "Saved, but couldn't read back the configured email. Please restart the app and try again."
          );
        } else {
          if (res.data?.degraded) {
            toast.warning(
              res.message ||
                "Saved Gmail settings, but SMTP verification failed. Check credentials and network."
            );
          } else {
            toast.success(res.message || "Email settings saved");
          }
        }

        setConfiguredEmail(persistedEmail || nextEmail || null);
        form.reset({
          gmailUser: persistedEmail || nextEmail,
          gmailAppPassword: "", // Never re-display stored app password
        });
        keyboard.handleCloseKeyboard();
      } catch (error) {
        logger.error("Failed to save email settings:", error);
        toast.error(error instanceof Error ? error.message : "Failed to save");
      } finally {
        setIsSaving(false);
      }
    },
    [form, keyboard, load, permissions, sessionToken, user?.businessId]
  );

  const handleClear = useCallback(async () => {
    try {
      if (!sessionToken || !user?.businessId) {
        throw new Error("Not authenticated");
      }
      if (!permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE)) {
        throw new Error("You do not have permission to change these settings.");
      }
      setIsSaving(true);
      const res = await window.emailSettingsAPI.clear(sessionToken, user.businessId);
      if (!res?.success) {
        throw new Error(res?.message || "Failed to clear settings");
      }
      toast.success(res.message || "Email settings cleared");
      await load();
    } catch (error) {
      logger.error("Failed to clear email settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to clear");
    } finally {
      setIsSaving(false);
    }
  }, [load, permissions, sessionToken, user?.businessId]);

  const handleTest = useCallback(async () => {
    try {
      if (!sessionToken || !user?.businessId) {
        throw new Error("Not authenticated");
      }
      if (!permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE)) {
        throw new Error("You do not have permission to change these settings.");
      }
      setIsTesting(true);
      const res = await window.emailSettingsAPI.testConnection(
        sessionToken,
        user.businessId
      );
      if (!res?.success) {
        throw new Error(res?.message || "SMTP test failed");
      }
      toast.success(res.message || "SMTP verified");
    } catch (error) {
      logger.error("Email test failed:", error);
      toast.error(error instanceof Error ? error.message : "SMTP test failed");
    } finally {
      setIsTesting(false);
    }
  }, [permissions, sessionToken, user?.businessId]);

  // When keyboard opens or active field changes, ensure the focused field (and buttons)
  // are not hidden behind the fixed bottom keyboard.
  useEffect(() => {
    if (!keyboard.showKeyboard || !keyboard.activeField) return;

    const targetId =
      keyboard.activeField === "gmailUser" ? "gmailUser" : "gmailAppPassword";

    // Let React paint the keyboard first, then scroll.
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => cancelAnimationFrame(raf);
  }, [keyboard.activeField, keyboard.showKeyboard]);

  const activeInputType =
    keyboard.activeField === "gmailUser"
      ? "email"
      : keyboard.activeField === "gmailAppPassword"
      ? "text"
      : "text";

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Configure Gmail SMTP to send receipts from your business email. Use a Gmail{" "}
        <span className="font-medium">App Password</span> (not your normal password).
      </div>

      {!permissions.isLoading &&
        !permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE) && (
          <div className="text-sm text-muted-foreground">
            You don’t have permission to change these settings.
          </div>
        )}

      {configuredEmail ? (
        <div className="text-sm">
          Currently configured: <span className="font-medium">{maskEmail(configuredEmail)}</span>
        </div>
      ) : (
        <div className="text-sm">Currently configured: <span className="font-medium">Not set</span></div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="gmailUser"
            rules={{ required: "Gmail address is required" }}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AdaptiveFormField
                    label="Gmail Address"
                    id="gmailUser"
                    {...field}
                    type="email"
                    placeholder="yourbusiness@gmail.com"
                    disabled={
                      isLoading ||
                      isSaving ||
                      permissions.isLoading ||
                      !permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE)
                    }
                    onChange={(e) => field.onChange(e.target.value)}
                    onFocus={() => keyboard.handleFieldFocus("gmailUser")}
                    error={form.formState.errors.gmailUser?.message}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gmailAppPassword"
            rules={{ required: "App Password is required" }}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AdaptiveFormField
                    label="Gmail App Password"
                    id="gmailAppPassword"
                    {...field}
                    type={showAppPassword ? "text" : "password"}
                    placeholder="16-character app password"
                    disabled={
                      isLoading ||
                      isSaving ||
                      permissions.isLoading ||
                      !permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE)
                    }
                    autoComplete="new-password"
                    onChange={(e) => field.onChange(e.target.value)}
                    onFocus={() => keyboard.handleFieldFocus("gmailAppPassword")}
                    error={form.formState.errors.gmailAppPassword?.message}
                    rightElement={
                      <button
                        type="button"
                        className="rounded-md p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                        aria-label={
                          showAppPassword
                            ? "Hide Gmail App Password"
                            : "Show Gmail App Password"
                        }
                        disabled={
                          isLoading ||
                          isSaving ||
                          permissions.isLoading ||
                          !permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE)
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowAppPassword((v) => !v)}
                      >
                        {showAppPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    }
                  />
                </FormControl>
                <div className="text-xs text-muted-foreground">
                  For security, we store this encrypted on the device (when supported by your OS) and never display it again.
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={
                isLoading ||
                isSaving ||
                permissions.isLoading ||
                !permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE)
              }
            >
              {isSaving ? "Saving..." : "Save Gmail Settings"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={
                isLoading ||
                isSaving ||
                isTesting ||
                permissions.isLoading ||
                !permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE)
              }
            >
              {isTesting ? "Testing..." : "Test SMTP"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleClear}
              disabled={
                isLoading ||
                isSaving ||
                permissions.isLoading ||
                !permissions.hasPermission(PERMISSIONS.SETTINGS_MANAGE)
              }
            >
              Clear
            </Button>
          </div>
        </form>
      </Form>

      {/* Spacer so content can scroll above the fixed keyboard */}
      {keyboard.showKeyboard && (
        <div
          id={keyboardSpacerId}
          style={{ height: keyboardSpacerHeightPx }}
          aria-hidden="true"
        />
      )}

      {keyboard.showKeyboard && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-lg">
          <AdaptiveKeyboard
            onInput={keyboard.handleInput}
            onBackspace={keyboard.handleBackspace}
            onClear={keyboard.handleClear}
            onEnter={() => {
              // Simple 2-field flow: next → done
              if (keyboard.activeField === "gmailUser") {
                keyboard.handleFieldFocus("gmailAppPassword");
                return;
              }
              keyboard.handleCloseKeyboard();
            }}
            onTab={() => {
              if (keyboard.activeField === "gmailUser") {
                keyboard.handleFieldFocus("gmailAppPassword");
              }
            }}
            initialMode={keyboard.activeFieldConfig?.keyboardMode || "qwerty"}
            inputType={activeInputType}
            onClose={keyboard.handleCloseKeyboard}
            visible={keyboard.showKeyboard}
          />
        </div>
      )}
    </div>
  );
}

