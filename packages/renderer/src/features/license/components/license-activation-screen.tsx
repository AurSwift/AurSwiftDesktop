/**
 * License Activation Screen
 *
 * Full-screen component for license key entry and activation.
 * Shown on first launch or when no valid license is found.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Globe,
  Cpu,
  HardDrive,
  Info,
} from "lucide-react";

interface LicenseActivationScreenProps {
  onActivationSuccess: () => void;
  onSkip?: () => void; // Optional: Allow skipping for demo/trial mode
}

export function LicenseActivationScreen({
  onActivationSuccess,
  onSkip,
}: LicenseActivationScreenProps) {
  const { activate, getMachineInfo, isLoading, error, clearError } = useLicense();

  const [licenseKey, setLicenseKey] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [machineInfo, setMachineInfo] = useState<MachineInfo | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Load machine info on mount
  useEffect(() => {
    getMachineInfo().then(setMachineInfo);
  }, [getMachineInfo]);

  // Format license key as user types (auto-uppercase, add dashes)
  const handleLicenseKeyChange = (value: string) => {
    // Remove any existing formatting
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Add formatting: AUR-XXX-V2-XXXXXXXX-XX
    let formatted = "";
    if (cleaned.length > 0) {
      formatted += cleaned.substring(0, 3); // AUR
    }
    if (cleaned.length > 3) {
      formatted += "-" + cleaned.substring(3, 6); // -XXX
    }
    if (cleaned.length > 6) {
      formatted += "-" + cleaned.substring(6, 8); // -V2
    }
    if (cleaned.length > 8) {
      formatted += "-" + cleaned.substring(8, 16); // -XXXXXXXX
    }
    if (cleaned.length > 16) {
      formatted += "-" + cleaned.substring(16, 18); // -XX
    }

    setLicenseKey(formatted);
    setActivationError(null);
    clearError();
  };

  // Handle activation
  const handleActivate = async () => {
    if (!licenseKey || licenseKey.length < 20) {
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
      setActivationError(result.message || "Activation failed. Please check your license key.");
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleActivate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo/Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AuraSwift EPOS</h1>
          <p className="text-muted-foreground">
            Enter your license key to activate this terminal
          </p>
        </div>

        {/* Activation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              License Activation
            </CardTitle>
            <CardDescription>
              Find your license key in your AuraSwift dashboard at{" "}
              <span className="font-medium text-primary">auraswift.com</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Success State */}
            {isSuccess && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  License activated successfully! Redirecting...
                </AlertDescription>
              </Alert>
            )}

            {/* Error State */}
            {(activationError || error) && !isSuccess && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{activationError || error}</AlertDescription>
              </Alert>
            )}

            {/* License Key Input */}
            <div className="space-y-2">
              <Label htmlFor="license-key">License Key</Label>
              <Input
                id="license-key"
                type="text"
                placeholder="AUR-XXX-V2-XXXXXXXX-XX"
                value={licenseKey}
                onChange={(e) => handleLicenseKeyChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="font-mono text-lg tracking-wider"
                disabled={isLoading || isSuccess}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Format: AUR-PRO-V2-XXXXXXXX-XX
              </p>
            </div>

            {/* Terminal Name Input */}
            <div className="space-y-2">
              <Label htmlFor="terminal-name">
                Terminal Name{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="terminal-name"
                  type="text"
                  placeholder={machineInfo?.hostname || "Main Counter"}
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10"
                  disabled={isLoading || isSuccess}
                />
              </div>
            </div>

            {/* Activate Button */}
            <Button
              onClick={handleActivate}
              disabled={isLoading || isSuccess || licenseKey.length < 20}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Activated!
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Activate License
                </>
              )}
            </Button>

            {/* Skip Option (if enabled) */}
            {onSkip && !isSuccess && (
              <Button
                variant="ghost"
                onClick={onSkip}
                disabled={isLoading}
                className="w-full text-muted-foreground"
              >
                Skip for now (Demo Mode)
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Machine Info Card */}
        {machineInfo && (
          <Card className="bg-slate-50/50 dark:bg-slate-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="w-4 h-4" />
                This Terminal
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium truncate">{machineInfo.hostname}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">OS:</span>
                  <span className="font-medium capitalize">{machineInfo.platform}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Arch:</span>
                  <span className="font-medium">{machineInfo.arch}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">RAM:</span>
                  <span className="font-medium">{machineInfo.totalMemoryGB} GB</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                Machine ID: {machineInfo.fingerprintPreview}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Link */}
        <p className="text-center text-sm text-muted-foreground">
          Need help?{" "}
          <a
            href="https://auraswift.com/support"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}
