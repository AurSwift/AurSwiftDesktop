import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useLicense, type MachineInfo } from "../../hooks/use-license";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Monitor,
  TestTube,
} from "lucide-react";

const MIN_LICENSE_LENGTH = 28;

export interface LicenseActivationFormProps {
  onActivationSuccess: () => void;
  onTestMode?: () => void;
}

export function LicenseActivationForm({
  onActivationSuccess,
  onTestMode,
}: LicenseActivationFormProps) {
  const { activate, getMachineInfo, isLoading, error, clearError } =
    useLicense();

  const [licenseKey, setLicenseKey] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [machineInfo, setMachineInfo] = useState<MachineInfo | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    void getMachineInfo().then((info) => {
      if (isMounted) {
        setMachineInfo(info);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [getMachineInfo]);

  useEffect(() => {
    return () => {
      if (activationTimerRef.current) {
        clearTimeout(activationTimerRef.current);
      }
    };
  }, []);

  const handleLicenseKeyChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    let formatted = "";
    if (cleaned.length > 0) formatted += cleaned.substring(0, 3);
    if (cleaned.length > 3) formatted += `-${cleaned.substring(3, 6)}`;
    if (cleaned.length > 6) formatted += `-${cleaned.substring(6, 8)}`;
    if (cleaned.length > 8) formatted += `-${cleaned.substring(8, 16)}`;
    if (cleaned.length > 16) formatted += `-${cleaned.substring(16, 24)}`;

    setLicenseKey(formatted);
    setActivationError(null);
    clearError();
  };

  const handleActivate = async () => {
    if (!licenseKey || licenseKey.length < MIN_LICENSE_LENGTH) {
      setActivationError("Please enter a valid license key");
      return;
    }

    setActivationError(null);

    const result = await activate(licenseKey, terminalName || undefined);
    if (!result.success) {
      setActivationError(
        result.message || "Activation failed. Please check your license key.",
      );
      return;
    }

    setIsSuccess(true);
    activationTimerRef.current = setTimeout(() => {
      onActivationSuccess();
    }, 1500);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !isLoading) {
      void handleActivate();
    }
  };

  return (
    <div data-testid="license-activation-form" className="w-full">
      <div
        className="grid gap-4 transition-all duration-300 ease-out [@media(min-width:900px)]:grid-cols-[minmax(360px,460px)_minmax(460px,1fr)] [@media(min-width:900px)]:items-start"
      >
        <Card className="border-2 shadow-xl">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <KeyRound className="h-5 w-5 text-primary" />
              License Activation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isSuccess && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
                <AlertDescription className="text-sm text-green-700 dark:text-green-400 sm:text-base">
                  License activated successfully! Redirecting...
                </AlertDescription>
              </Alert>
            )}

            {(activationError || error) && !isSuccess && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                <AlertDescription className="text-sm sm:text-base">
                  {activationError || error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <Label htmlFor="license-key">License Key</Label>
              <Input
                id="license-key"
                type="text"
                placeholder="AUR-XXX-V2-XXXXXXXX-XXXXXXXX"
                value={licenseKey}
                onChange={(event) => handleLicenseKeyChange(event.target.value)}
                onKeyDown={handleKeyDown}
                className="h-11 font-mono tracking-wider sm:h-12"
                disabled={isLoading || isSuccess}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="terminal-name">
                Terminal Name{" "}
                <span className="text-muted-foreground font-normal text-xs sm:text-sm">
                  (optional)
                </span>
              </Label>
              <div className="relative">
                <Monitor className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:h-5 sm:w-5" />
                <Input
                  id="terminal-name"
                  type="text"
                  placeholder={machineInfo?.hostname || "Main Counter"}
                  value={terminalName}
                  onChange={(event) => setTerminalName(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11 pl-10 sm:h-12 sm:pl-11"
                  disabled={isLoading || isSuccess}
                />
              </div>
            </div>

            <Button
              onClick={() => void handleActivate()}
              disabled={
                isLoading || isSuccess || licenseKey.length < MIN_LICENSE_LENGTH
              }
              className="h-11 w-full sm:h-12"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin sm:h-5 sm:w-5" />
                  Activating...
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Activated!
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Activate License
                </>
              )}
            </Button>

            {onTestMode && (
              <Button
                onClick={onTestMode}
                disabled={isLoading || isSuccess}
                variant="outline"
                className="h-11 w-full sm:h-12"
                size="lg"
              >
                <TestTube className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Test Mode
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-lg border border-border shadow-lg">
          <AdaptiveKeyboard
            onInput={(value) => handleLicenseKeyChange(licenseKey + value)}
            onBackspace={() => handleLicenseKeyChange(licenseKey.slice(0, -1))}
            onClear={() => {
              setLicenseKey("");
              setActivationError(null);
              clearError();
            }}
            onEnter={() => {
              if (licenseKey.length >= MIN_LICENSE_LENGTH) {
                void handleActivate();
              }
            }}
            initialMode="qwerty"
            inputType="text"
            visible={!isSuccess}
            className="license-keyboard"
          />
        </div>
      </div>
    </div>
  );
}
