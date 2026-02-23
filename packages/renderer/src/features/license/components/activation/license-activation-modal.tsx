import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AdaptiveKeyboard,
  AdaptiveFormField,
} from "@/features/adaptive-keyboard";
import { getLogger } from "@/shared/utils/logger";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Power,
  TestTube,
} from "lucide-react";
import { useLicense } from "../../hooks/use-license";
import type { LicenseActivationFormProps } from "./license-activation-form";

const logger = getLogger("license-activation-modal");
const MIN_LICENSE_LENGTH = 28;

export interface LicenseActivationModalProps extends Pick<
  LicenseActivationFormProps,
  "onActivationSuccess" | "onTestMode"
> {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

function formatLicenseKey(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let formatted = "";
  if (cleaned.length > 0) formatted += cleaned.substring(0, 3);
  if (cleaned.length > 3) formatted += `-${cleaned.substring(3, 6)}`;
  if (cleaned.length > 6) formatted += `-${cleaned.substring(6, 8)}`;
  if (cleaned.length > 8) formatted += `-${cleaned.substring(8, 16)}`;
  if (cleaned.length > 16) formatted += `-${cleaned.substring(16, 24)}`;
  return formatted;
}

export function LicenseActivationModal({
  open,
  onActivationSuccess,
  onTestMode,
  onOpenChange,
}: LicenseActivationModalProps) {
  const { activate, getMachineInfo, isLoading, error, clearError } =
    useLicense();

  const [licenseKey, setLicenseKey] = useState("");
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const productSelected = true;
  const [showKeyboard, setShowKeyboard] = useState(false);

  const handleFieldFocus = useCallback(() => {
    setShowKeyboard(true);
  }, []);

  const handleCloseKeyboard = useCallback(() => {
    setShowKeyboard(false);
  }, []);

  const handleKeyboardInput = useCallback(
    (char: string) => {
      handleLicenseKeyChange(licenseKey + char);
    },
    [licenseKey],
  );

  const handleQuit = useCallback(async () => {
    try {
      await window.appAPI?.quit?.();
    } catch (err) {
      logger.warn("Failed to quit app from activation modal", err);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setShowKeyboard(false);
      return;
    }
    void getMachineInfo();
  }, [open, getMachineInfo]);

  const handleLicenseKeyChange = (value: string) => {
    setLicenseKey(formatLicenseKey(value));
    setActivationError(null);
    clearError();
  };

  const handleActivate = async () => {
    if (!licenseKey || licenseKey.length < MIN_LICENSE_LENGTH) {
      setActivationError("Please enter a valid license key");
      return;
    }
    setActivationError(null);
    const result = await activate(licenseKey);
    if (!result.success) {
      setActivationError(
        result.message || "Activation failed. Please check your license key.",
      );
      return;
    }
    setIsSuccess(true);
    setTimeout(() => onActivationSuccess(), 1500);
  };

  const handleKeyboardEnter = useCallback(() => {
    if (licenseKey.length >= MIN_LICENSE_LENGTH && !isLoading) {
      void handleActivate();
    } else {
      handleCloseKeyboard();
    }
  }, [licenseKey, isLoading, handleCloseKeyboard]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange?.(nextOpen);
      }}
    >
      <DialogContent
        data-testid="license-activation-modal"
        showCloseButton={false}
        overlayClassName="bg-black/40 backdrop-blur-[2px]"
        className="w-full max-w-[min(720px,96vw)] border border-gray-200 bg-white p-0 shadow-xl sm:max-w-[min(720px,96vw)] flex flex-col max-h-[90vh]"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="rounded-lg bg-white text-gray-900 flex flex-col min-h-0">
          {/* Header */}
          <DialogHeader className="flex flex-row items-start justify-between gap-4 border-b border-gray-200 px-6 pt-6 pb-4 shrink-0">
            <DialogTitle className="text-xl font-semibold tracking-tight text-gray-900">
              License Activator
            </DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">
                Aurswift
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void handleQuit()}
                className="h-9 w-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                aria-label="Quit application"
                title="Quit"
              >
                <Power className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="space-y-5 px-6 py-4 overflow-y-auto flex-1 min-h-0">
              {/* Instructional text */}
              <p className="text-sm leading-relaxed text-gray-700">
                You can enable license with the license key provided when the
                software is purchased. Enter your key below to activate.
              </p>

              {/* License key row - batch-style form field + adaptive keyboard */}
              <div className="space-y-2">
                <Label
                  htmlFor="license-key-input"
                  className="text-sm font-medium text-gray-700"
                >
                  Please enter the license key for the product you wish to
                  activate:
                </Label>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0 max-w-[360px]">
                    <AdaptiveFormField
                      id="license-key-input"
                      data-testid="license-key-input"
                      label=""
                      value={licenseKey}
                      placeholder="AUR-XXX-V2-XXXXXXXX-XXXXXXXX"
                      disabled={isLoading || isSuccess}
                      readOnly
                      onFocus={handleFieldFocus}
                      variant="borderOnly"
                      className="font-mono tracking-wide"
                    />
                  </div>
                </div>
              </div>

              {/* Errors */}
              {(activationError || error) && !isSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {activationError || error}
                </div>
              )}

              {isSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  License activated successfully. Redirecting…
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/80 px-6 py-4 shrink-0">
              <div className="flex items-center gap-2">
                {onTestMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                    onClick={() => {
                      handleCloseKeyboard();
                      onTestMode();
                    }}
                    disabled={isLoading || isSuccess}
                  >
                    <TestTube className="h-4 w-4" />
                    Test Mode
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    isLoading ||
                    isSuccess ||
                    !productSelected ||
                    licenseKey.length < MIN_LICENSE_LENGTH
                  }
                  className="bg-gray-900 text-white hover:bg-gray-800"
                  onClick={() => void handleActivate()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Activating…
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Activated
                    </>
                  ) : (
                    "Activate"
                  )}
                </Button>
              </div>
            </div>

            {/* Adaptive Keyboard - batch pattern */}
            {showKeyboard && !isSuccess && (
              <div className="border-t border-gray-200 bg-background px-2 py-2 shrink-0">
                <AdaptiveKeyboard
                  visible={showKeyboard}
                  initialMode="qwerty"
                  onInput={handleKeyboardInput}
                  onBackspace={() =>
                    handleLicenseKeyChange(licenseKey.slice(0, -1))
                  }
                  onClear={() => {
                    setLicenseKey("");
                    setActivationError(null);
                    clearError();
                  }}
                  onEnter={handleKeyboardEnter}
                  onClose={handleCloseKeyboard}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
