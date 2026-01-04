/**
 * Email Receipt Modal Component
 * Prompts user to enter customer email to send transaction receipt
 * Follows single responsibility principle - handles only email input and sending
 */

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";

const logger = getLogger("EmailReceiptModal");

interface EmailReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  receiptNumber: string;
}

/**
 * Email receipt modal component
 * Handles email input validation and sending receipt email
 */
export function EmailReceiptModal({
  isOpen,
  onClose,
  transactionId,
  receiptNumber,
}: EmailReceiptModalProps) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  /**
   * Validate email format
   */
  const isValidEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  /**
   * Handle sending email receipt
   */
  const handleSendEmail = useCallback(async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!transactionId) {
      toast.error("Unable to send receipt: Transaction ID is missing");
      logger.error(
        `Transaction ID is required for sending receipt. Receipt: ${receiptNumber}`
      );
      return;
    }

    setIsSending(true);

    try {
      if (!window.transactionAPI) {
        throw new Error("Transaction API not available");
      }

      toast.info("Sending receipt email...");

      const response = await window.transactionAPI.sendReceipt({
        transactionId,
        customerEmail: email,
      });

      if (response && response.success) {
        toast.success(`Receipt sent to ${email}`);
        setEmail(""); // Clear email after success
        onClose();
      } else {
        const errorMsg = response?.message || "Failed to send email";
        toast.error(errorMsg);
        logger.error("Email send failed:", response);
      }
    } catch (error) {
      logger.error("Error sending receipt email:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send email";
      toast.error(`Email error: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  }, [email, isValidEmail, transactionId, onClose]);

  /**
   * Handle closing modal
   */
  const handleClose = useCallback(() => {
    if (!isSending) {
      setEmail("");
      setShowKeyboard(false);
      onClose();
    }
  }, [isSending, onClose]);

  /**
   * Handle dialog open change - only close if keyboard is not showing
   */
  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !showKeyboard) {
        handleClose();
      }
    },
    [showKeyboard, handleClose]
  );

  /**
   * Handle adaptive keyboard input
   */
  const handleKeyboardInput = useCallback((key: string) => {
    setEmail((prev) => prev + key);
  }, []);

  const handleKeyboardBackspace = useCallback(() => {
    setEmail((prev) => prev.slice(0, -1));
  }, []);

  const handleKeyboardClear = useCallback(() => {
    setEmail("");
  }, []);

  const handleKeyboardClose = useCallback(() => {
    setShowKeyboard(false);
  }, []);

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={handleDialogOpenChange}
        modal={!showKeyboard}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Email Receipt
            </DialogTitle>
            <DialogDescription>
              Enter the customer's email address to send receipt #
              {receiptNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-email">Customer Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={email}
                readOnly
                onClick={() => !isSending && setShowKeyboard(true)}
                placeholder="customer@example.com"
                disabled={isSending}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                A copy of the receipt will be sent to this email address
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendEmail}
              disabled={!email.trim() || isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showKeyboard &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-end pointer-events-none">
            <div className="w-full pointer-events-auto">
              <AdaptiveKeyboard
                onInput={handleKeyboardInput}
                onBackspace={handleKeyboardBackspace}
                onClear={handleKeyboardClear}
                onEnter={handleKeyboardClose}
                onClose={handleKeyboardClose}
                inputType="email"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
