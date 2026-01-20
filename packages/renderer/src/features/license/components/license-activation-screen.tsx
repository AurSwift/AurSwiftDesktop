/**
 * License Activation Screen
 *
 * Full-screen component for license key entry and activation.
 * Shown on first launch or when no valid license is found.
 */

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TestTube,
} from "lucide-react";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { getLogger } from "@/shared/utils/logger";
import { getAppVersion } from "@/shared/utils/version";

const logger = getLogger("license-activation");

interface LicenseActivationScreenProps {
  onActivationSuccess: () => void;
  onTestMode?: () => void;
}

export function LicenseActivationScreen({
  onActivationSuccess,
  onTestMode,
}: LicenseActivationScreenProps) {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;
  const { activate, getMachineInfo, isLoading, error, clearError } =
    useLicense();

  const [licenseKey, setLicenseKey] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [machineInfo, setMachineInfo] = useState<MachineInfo | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const terminalNameInputRef = useRef<HTMLInputElement>(null);
  const keyboardBottomContainerRef = useRef<HTMLDivElement>(null);
  const keyboardSideContainerRef = useRef<HTMLDivElement>(null);

  // Load machine info on mount
  useEffect(() => {
    getMachineInfo().then(setMachineInfo);
  }, [getMachineInfo]);

  // Hide keyboard when user clicks/taps outside inputs + keyboard
  useEffect(() => {
    if (!keyboardVisible) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      const clickedLicenseInput = licenseInputRef.current?.contains(target);
      const clickedTerminalInput =
        terminalNameInputRef.current?.contains(target);
      const clickedKeyboard =
        keyboardBottomContainerRef.current?.contains(target) ||
        keyboardSideContainerRef.current?.contains(target);

      if (clickedLicenseInput || clickedTerminalInput || clickedKeyboard)
        return;
      setKeyboardVisible(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [keyboardVisible]);

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
        result.message || "Activation failed. Please check your license key.",
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

  const showKeyboard = () => {
    if (!isSuccess) setKeyboardVisible(true);
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col">
      {/* Power Button Header */}
      <div className="w-full flex justify-end p-4 sm:p-6 [@media(max-height:560px)]:p-3">
        <Button
          onClick={handleCloseApp}
          variant="ghost"
          size="lg"
          className="hover:bg-destructive/10 hover:text-destructive h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 [@media(max-height:560px)]:h-10 [@media(max-height:560px)]:w-10"
          title="Close Application"
        >
          <Power className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 [@media(max-height:560px)]:w-5 [@media(max-height:560px)]:h-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex p-4 justify-center items-center transition-all duration-300 ease-out">
          <div
            className={[
              "w-full transition-all duration-300 ease-out",
              keyboardVisible && !isSuccess
                ? "max-w-[95vw] [@media(min-width:900px)]:max-w-[90vw]"
                : "max-w-lg",
            ].join(" ")}
          >
            <div
              className={[
                "flex flex-col gap-4 [@media(min-width:900px)]:flex-row [@media(min-width:900px)]:gap-6 transition-all duration-300 ease-out [@media(min-width:900px)]:items-center [@media(min-width:900px)]:justify-center",
              ].join(" ")}
            >
              {/* Left column: Brand + Form */}
              <div
                className={[
                  "w-full space-y-[clamp(1rem,2.2vw,1.75rem)] [@media(max-height:560px)]:space-y-3 transition-all duration-300 ease-out",
                  keyboardVisible && !isSuccess
                    ? "max-w-md [@media(min-width:900px)]:max-w-[400px]"
                    : "max-w-lg",
                ].join(" ")}
              >
                {/* Branded Logo/Header Section */}
                <div className="text-center space-y-[clamp(0.5rem,1.4vw,0.9rem)] [@media(max-height:560px)]:space-y-1.5">
                  {/* Logo Container with Black Background */}
                  <div className="flex justify-center mb-[clamp(0.5rem,1.6vw,1.25rem)] [@media(max-height:560px)]:mb-2">
                    <div className="relative w-[clamp(3rem,6vw,6rem)] h-[clamp(3rem,6vw,6rem)] rounded-2xl bg-black flex items-center justify-center shadow-2xl ring-4 ring-primary/20 [@media(max-height:560px)]:w-12 [@media(max-height:560px)]:h-12 [@media(max-height:560px)]:ring-2">
                      <img
                        src={logoSrc}
                        alt="Aurswift Logo"
                        className="w-[80%] h-[80%] object-contain [@media(max-height:560px)]:w-[75%] [@media(max-height:560px)]:h-[75%]"
                        onError={(e) => {
                          // Fallback to key icon if logo fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const fallback =
                            target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                      <div className="hidden w-full h-full items-center justify-center">
                        <KeyRound className="w-[clamp(1.75rem,3vw,3rem)] h-[clamp(1.75rem,3vw,3rem)] text-white [@media(max-height:560px)]:w-7 [@media(max-height:560px)]:h-7" />
                      </div>
                    </div>
                  </div>
                  {/* Brand Name and Version */}
                  <div className="space-y-[clamp(0.25rem,0.8vw,0.5rem)] [@media(max-height:560px)]:space-y-1">
                    <h1 className="text-[clamp(1.35rem,3.2vw,2.7rem)] font-bold tracking-tight bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent [@media(min-width:1400px)]:text-[clamp(1.25rem,2.2vw,2.35rem)] [@media(max-height:560px)]:text-[clamp(1.15rem,2.8vw,2rem)]">
                      Aurswift EPOS
                    </h1>
                    <p className="text-[clamp(0.65rem,1vw,0.82rem)] text-muted-foreground font-medium [@media(min-width:1400px)]:text-[clamp(0.62rem,0.7vw,0.78rem)] [@media(max-height:560px)]:text-[0.68rem]">
                      Version {getAppVersion()}
                    </p>
                  </div>
                </div>

                {/* Activation Card */}
                <Card className="shadow-xl border-2">
                  <CardHeader className="space-y-1 pb-1 [@media(max-height:560px)]:pb-1">
                    <CardTitle className="flex items-center gap-2 text-[clamp(0.95rem,1.6vw,1.1rem)]">
                      <KeyRound className="w-5 h-5 text-primary [@media(max-height:560px)]:w-4 [@media(max-height:560px)]:h-4" />
                      License Activation
                    </CardTitle>
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
                      <Label
                        htmlFor="license-key"
                        className="text-[clamp(0.75rem,1.1vw,0.9rem)]"
                      >
                        License Key
                      </Label>
                      <Input
                        ref={licenseInputRef}
                        id="license-key"
                        type="text"
                        placeholder="AUR-XXX-V2-XXXXXXXX-XXXXXXXX"
                        value={licenseKey}
                        onChange={(e) => handleLicenseKeyChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={showKeyboard}
                        onPointerDown={showKeyboard}
                        className="font-mono text-[clamp(0.85rem,1.2vw,1rem)] tracking-wider h-11 sm:h-12 [@media(max-height:560px)]:h-10"
                        disabled={isLoading || isSuccess}
                      />
                    </div>

                    {/* Terminal Name Input */}
                    <div className="space-y-1">
                      <Label
                        htmlFor="terminal-name"
                        className="text-[clamp(0.75rem,1.1vw,0.9rem)]"
                      >
                        Terminal Name{" "}
                        <span className="text-muted-foreground font-normal text-xs sm:text-sm">
                          (optional)
                        </span>
                      </Label>
                      <div className="relative">
                        <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                        <Input
                          ref={terminalNameInputRef}
                          id="terminal-name"
                          type="text"
                          placeholder={machineInfo?.hostname || "Main Counter"}
                          value={terminalName}
                          onChange={(e) => setTerminalName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onFocus={showKeyboard}
                          onPointerDown={showKeyboard}
                          className="pl-10 sm:pl-11 text-[clamp(0.8rem,1.05vw,0.95rem)] h-11 sm:h-12 [@media(max-height:560px)]:h-10"
                          disabled={isLoading || isSuccess}
                        />
                      </div>
                    </div>

                    {/* Activate Button */}
                    <Button
                      onClick={handleActivate}
                      disabled={
                        isLoading || isSuccess || licenseKey.length < 28
                      }
                      className="w-full text-[clamp(0.8rem,1.05vw,0.95rem)] h-11 sm:h-12 [@media(max-height:560px)]:h-10"
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

                    {/* Test Mode Button */}
                    {onTestMode && (
                      <Button
                        onClick={onTestMode}
                        disabled={isLoading || isSuccess}
                        variant="outline"
                        className="w-full text-[clamp(0.8rem,1.05vw,0.95rem)] h-11 sm:h-12 [@media(max-height:560px)]:h-10"
                        size="lg"
                      >
                        <TestTube className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        Test Mode
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Help Link */}
                <p className="text-center text-[clamp(0.7rem,1vw,0.9rem)] text-muted-foreground [@media(max-height:560px)]:text-[0.7rem]">
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

              {/* Right column: Keyboard side panel (wide screens) */}
              <div
                className={[
                  "shrink-0 flex items-center transition-all duration-300 ease-out",
                  keyboardVisible && !isSuccess
                    ? "[@media(min-width:900px)]:flex-1 [@media(min-width:900px)]:max-w-[55vw]"
                    : "",
                ].join(" ")}
              >
                {/* Small screens: keyboard takes bottom area, form scrolls above */}
                <div className="[@media(min-width:900px)]:hidden flex flex-col">
                  {keyboardVisible && !isSuccess && (
                    <div
                      ref={keyboardBottomContainerRef}
                      className="rounded-lg overflow-hidden shadow-lg shrink-0 mt-4"
                    >
                      <AdaptiveKeyboard
                        onInput={handleKeyboardInput}
                        onBackspace={handleKeyboardBackspace}
                        onClear={handleKeyboardClear}
                        onEnter={handleKeyboardEnter}
                        initialMode="qwerty"
                        inputType="text"
                        visible={keyboardVisible}
                        onClose={() => setKeyboardVisible(false)}
                        className="license-keyboard"
                      />
                    </div>
                  )}
                </div>

                {/* Wide screens: side panel slides in */}
                <div
                  className={[
                    "hidden [@media(min-width:900px)]:block overflow-visible transition-all duration-300 ease-out",
                    keyboardVisible && !isSuccess
                      ? "w-full opacity-100 translate-x-0"
                      : "w-0 opacity-0 translate-x-8 pointer-events-none",
                  ].join(" ")}
                  aria-hidden={!keyboardVisible || isSuccess}
                >
                  <div
                    ref={keyboardSideContainerRef}
                    className="rounded-lg overflow-hidden shadow-lg w-full"
                  >
                    <AdaptiveKeyboard
                      onInput={handleKeyboardInput}
                      onBackspace={handleKeyboardBackspace}
                      onClear={handleKeyboardClear}
                      onEnter={handleKeyboardEnter}
                      initialMode="qwerty"
                      inputType="text"
                      visible={keyboardVisible && !isSuccess}
                      onClose={() => setKeyboardVisible(false)}
                      className="license-keyboard"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
