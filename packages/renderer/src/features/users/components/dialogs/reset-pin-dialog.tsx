
import { useState } from "react";
import { Copy, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/shared/hooks/use-auth";

interface ResetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function ResetPinDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: ResetPinDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [temporaryPin, setTemporaryPin] = useState<string | null>(null);
  const { sessionToken } = useAuth(); // Need access to session token

  const handleReset = async () => {
    if (!sessionToken) {
        toast.error("Authentication error");
        return;
    }

    setIsLoading(true);
    try {
      const result = await window.authAPI.resetPin(sessionToken, userId);

      if (result.success && result.temporaryPin) {
        setTemporaryPin(result.temporaryPin);
        toast.success("PIN reset successfully");
      } else {
        toast.error(result.message || "Failed to reset PIN");
      }
    } catch (error) {
      console.error("Reset PIN error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPin = () => {
    if (temporaryPin) {
      navigator.clipboard.writeText(temporaryPin);
      toast.success("PIN copied to clipboard");
    }
  };

  const handleClose = () => {
    setTemporaryPin(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset PIN for {userName}</DialogTitle>
          <DialogDescription>
            This will generate a temporary PIN. The user will be required to change it on their next login.
          </DialogDescription>
        </DialogHeader>

        {!temporaryPin ? (
          <div className="py-4">
            <Alert variant="destructive">
                <RotateCcw className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                    This action cannot be undone. The user's current PIN will be invalidated immediately.
                </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-300">
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>
                    PIN has been reset directly. Please provide this temporary PIN to the user.
                </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label>Temporary PIN</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={temporaryPin}
                  className="font-mono text-center text-lg tracking-widest"
                />
                <Button variant="outline" size="icon" onClick={handleCopyPin}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                User will be prompted to change this upon login.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!temporaryPin ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleReset} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset PIN"
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
