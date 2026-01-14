/**
 * License Activation Screen
 *
 * Full-screen component for license key entry and activation.
 * Shown on first launch or when no valid license is found.
 */

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLicense, type MachineInfo } from "../hooks/use-license";
import {
  KeyRound,
  Monitor,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Power,
} from "lucide-react";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { getLogger } from "@/shared/utils/logger";
import { getAppVersion } from "@/shared/utils/version";

const logger = getLogger("license-activation");

interface LicenseActivationScreenProps {
  onActivationSuccess: () => void;
}

export function LicenseActivationScreen({
  onActivationSuccess,
}: LicenseActivationScreenProps) {
  const { activate, getMachineInfo, isLoading, error, clearError } =
    useLicense();

  const [licenseKey, setLicenseKey] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [machineInfo, setMachineInfo] = useState<MachineInfo | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  // Load machine info on mount
  useEffect(() => {
    getMachineInfo().then(setMachineInfo);
  }, [getMachineInfo]);

  // Format license key as user types (auto-uppercase, add dashes)
  const handleLicenseKeyChange = (value: string) => {
    // Remove any existing formatting
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Add formatting: AUR-{PLAN}-V2-{8CHARS}-{8CHARS}
    let formatted = "";
    if (cleaned.length > 0) {
      formatted += cleaned.substring(0, 3); // AUR
    }
    if (cleaned.length > 3) {
      formatted += "-" + cleaned.substring(3, 6); // -BAS/PRO/ENT
    }
    if (cleaned.length > 6) {
      formatted += "-" + cleaned.substring(6, 8); // -V2
    }
    if (cleaned.length > 8) {
      formatted += "-" + cleaned.substring(8, 16); // -XXXXXXXX (8 chars)
    }
    if (cleaned.length > 16) {
      formatted += "-" + cleaned.substring(16, 24); // -XXXXXXXX (8 chars)
    }

    setLicenseKey(formatted);
    setActivationError(null);
    clearError();
  };

  // Adaptive keyboard handlers
  const handleKeyboardInput = (value: string) => {
    handleLicenseKeyChange(licenseKey + value);
  };

  const handleKeyboardBackspace = () => {
    handleLicenseKeyChange(licenseKey.slice(0, -1));
  };

  const handleKeyboardClear = () => {
    setLicenseKey("");
    setActivationError(null);
    clearError();
  };

  const handleKeyboardEnter = () => {
    setKeyboardVisible(false);
    if (licenseKey && licenseKey.length >= 28) {
      handleActivate();
    }
  };

  // Handle activation
  const handleActivate = async () => {
    if (!licenseKey || licenseKey.length < 28) {
      setActivationError("Please enter a valid license key");
      return;
    }

    setActivationError(null);

    const result = await activate(licenseKey, terminalName || undefined);

    if (result.success) {
      setIsSuccess(true);
      // Short delay to show success state
      setTimeout(() => {
        onActivationSuccess();
      }, 1500);
    } else {
      setActivationError(
        result.message || "Activation failed. Please check your license key."
      );
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleActivate();
    }
  };

  const handleCloseApp = async () => {
    try {
      await window.appAPI.quit();
    } catch (error) {
      logger.error("Failed to close app:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col">
      {/* Power Button Header */}
      <div className="w-full flex justify-end p-4 sm:p-6">
        <Button
          onClick={handleCloseApp}
          variant="ghost"
          size="lg"
          className="hover:bg-destructive/10 hover:text-destructive h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16"
          title="Close Application"
        >
          <Power className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-8">
          {/* Branded Logo/Header Section */}
          <div className="text-center space-y-4">
            {/* Logo Container with Black Background */}
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-2xl bg-black flex items-center justify-center shadow-2xl ring-4 ring-primary/20 overflow-hidden">
                <img
                  src="/logo.png"
                  alt="AuraSwift Logo"
                  className="w-full h-full object-contain p-3 sm:p-4 md:p-5 lg:p-6"
                  onError={(e) => {
                    // Fallback to key icon if logo fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <div className="hidden w-full h-full items-center justify-center">
                  <KeyRound className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 text-white" />
                </div>
              </div>
            </div>
            {/* Brand Name and Version */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
                Aurswift EPOS
              </h1>
              <p className="text-sm sm:text-base md:text-base text-muted-foreground font-medium">
                Version {getAppVersion()}
              </p>
            </div>
          </div>

          {/* Activation Card */}
          <Card className="shadow-xl border-2">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl md:text-xl">
                <KeyRound className="w-5 h-5 text-primary" />
                License Activation
              </CardTitle>
              <CardDescription className="text-sm pb-0">
                Find your license key in your aurswift dashboard at{" "}
                <a
                  href="https://aurswift.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  aurswift.com
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* Success State */}
              {isSuccess && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  <AlertDescription className="text-sm sm:text-base text-green-700 dark:text-green-400">
                    License activated successfully! Redirecting...
                  </AlertDescription>
                </Alert>
              )}

              {/* Error State */}
              {(activationError || error) && !isSuccess && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  <AlertDescription className="text-sm sm:text-base">
                    {activationError || error}
                  </AlertDescription>
                </Alert>
              )}

              {/* License Key Input */}
              <div className="space-y-1">
                <Label htmlFor="license-key" className="text-sm sm:text-base">
                  License Key
                </Label>
                <Input
                  ref={licenseInputRef}
                  id="license-key"
                  type="text"
                  placeholder="AUR-XXX-V2-XXXXXXXX-XX"
                  value={licenseKey}
                  onChange={(e) => handleLicenseKeyChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setKeyboardVisible(true)}
                  className="font-mono text-base sm:text-lg md:text-lg tracking-wider h-11 sm:h-12"
                  disabled={isLoading || isSuccess}
                  autoFocus
                />
              </div>

              {/* Terminal Name Input */}
              <div className="space-y-1">
                <Label htmlFor="terminal-name" className="text-sm sm:text-base">
                  Terminal Name{" "}
                  <span className="text-muted-foreground font-normal text-xs sm:text-sm">
                    (optional)
                  </span>
                </Label>
                <div className="relative">
                  <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <Input
                    id="terminal-name"
                    type="text"
                    placeholder={machineInfo?.hostname || "Main Counter"}
                    value={terminalName}
                    onChange={(e) => setTerminalName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-10 sm:pl-11 text-sm sm:text-base h-11 sm:h-12"
                    disabled={isLoading || isSuccess}
                  />
                </div>
              </div>

              {/* Activate Button */}
              <Button
                onClick={handleActivate}
                disabled={isLoading || isSuccess || licenseKey.length < 20}
                className="w-full text-sm sm:text-base h-11 sm:h-12"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                    Activating...
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Activated!
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Activate License
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Adaptive Keyboard */}
          {keyboardVisible && !isSuccess && (
            <div className="rounded-lg overflow-hidden shadow-lg">
              <AdaptiveKeyboard
                onInput={handleKeyboardInput}
                onBackspace={handleKeyboardBackspace}
                onClear={handleKeyboardClear}
                onEnter={handleKeyboardEnter}
                initialMode="qwerty"
                inputType="text"
                visible={keyboardVisible}
                onClose={() => setKeyboardVisible(false)}
              />
            </div>
          )}

          {/* Help Link */}
          <p className="text-center text-xs sm:text-sm md:text-base text-muted-foreground">
            Need help?{" "}
            <a
              href="https://aurswift.com/support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
