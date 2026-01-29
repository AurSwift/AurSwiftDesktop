/**
 * Save Basket Modal
 *
 * Modal for saving a cart session as a saved basket with QR code generation.
 * Provides options to email QR code or print receipt.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getLogger } from "@/shared/utils/logger";
import type { CartItemWithProduct } from "@/types/features/cart";

const logger = getLogger("save-basket-modal");

interface SaveBasketModalProps {
  isOpen: boolean;
  cartItems: CartItemWithProduct[];
  cartSessionId: string | null;
  businessId: string | undefined;
  userId: string | undefined;
  shiftId: string | null; // Reserved for future use
  onSave: (
    basketName: string,
    customerEmail?: string | null,
    notes?: string | null
  ) => Promise<{
    basket: {
      id: string;
      name: string;
      basketCode: string;
      expiresAt?: Date | string | null;
      savedAt: Date | string;
    };
    items: CartItemWithProduct[];
    basketCode: string;
  } | null>;
  onClose: () => void;
  onClearCart?: () => void; // Reserved for future use
}

type ModalStep = "name" | "success" | "email" | "receipt";

export function SaveBasketModal({
  isOpen,
  cartItems,
  cartSessionId,
  businessId,
  userId,
  shiftId,
  onSave,
  onClose,
  onClearCart,
}: SaveBasketModalProps) {
  // Reserved for future use
  void shiftId;
  void onClearCart;

  const [step, setStep] = useState<ModalStep>("name");
  const [basketName, setBasketName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedBasket, setSavedBasket] = useState<{
    basket: {
      id: string;
      name: string;
      basketCode: string;
      expiresAt?: Date | string | null;
      savedAt: Date | string;
    };
    items: CartItemWithProduct[];
    basketCode: string;
  } | null>(null);
  const [BarcodeComponent, setBarcodeComponent] = useState<React.ComponentType<{
    value: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
  }> | null>(null);

  // Try to load Barcode component dynamically
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const barcodeModule = await import("react-barcode");
        if (mounted) {
          // react-barcode exports Barcode as the default export
          const Barcode = barcodeModule.default;
          if (Barcode) {
            setBarcodeComponent(() => Barcode);
          } else {
            logger.warn("Barcode component not found in module");
          }
        }
      } catch (error) {
        // Package not installed - component will show fallback
        if (mounted) {
          logger.warn("react-barcode not installed, using fallback", error);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("name");
      setBasketName("");
      setCustomerEmail("");
      setNotes("");
      setSavedBasket(null);
    }
  }, [isOpen]);

  // Auto-generate basket name if empty
  useEffect(() => {
    if (isOpen && !basketName) {
      const timestamp = new Date().toLocaleString();
      setBasketName(`Basket ${timestamp}`);
    }
  }, [isOpen, basketName]);

  const handleSave = useCallback(async () => {
    if (!cartSessionId || !businessId || !userId) {
      toast.error("Cannot save basket: missing required data");
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Cart is empty. Add items before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await onSave(
        basketName || `Basket ${new Date().toLocaleString()}`,
        customerEmail || null,
        notes || null
      );

      if (result) {
        setSavedBasket(result);
        setStep("success");
      } else {
        toast.error("Failed to save basket");
      }
    } catch (error) {
      logger.error("Error saving basket:", error);
      toast.error("Failed to save basket");
    } finally {
      setIsSaving(false);
    }
  }, [
    basketName,
    customerEmail,
    notes,
    cartSessionId,
    businessId,
    userId,
    cartItems,
    onSave,
  ]);

  const handleEmail = useCallback(async () => {
    if (!savedBasket) {
      toast.error("No basket to send");
      return;
    }

    // If no email entered yet, show email input step
    if (!customerEmail) {
      setStep("email");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      if (!window.basketAPI) {
        toast.error(
          "Basket API not available. Please restart the application."
        );
        logger.error("window.basketAPI is not defined");
        return;
      }

      toast.info("Sending email...");
      const response = await window.basketAPI.sendEmail({
        basketId: savedBasket.basket.id,
        customerEmail,
      });

      if (response && response.success) {
        toast.success(`QR code sent to ${customerEmail}`);
        setStep("success");
      } else {
        const errorMsg = response?.message || "Failed to send email";
        toast.error(errorMsg);
        logger.error("Email send failed:", response);
      }
    } catch (error) {
      logger.error("Error sending email:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send email";
      toast.error(`Email error: ${errorMessage}`);
    }
  }, [savedBasket, customerEmail]);

  const handlePrintReceipt = useCallback(async () => {
    if (!savedBasket) {
      toast.error("No basket to print");
      return;
    }

    try {
      // Try to get receipt HTML from backend first
      let receiptHTML: string | null = null;

      if (window.basketAPI) {
        try {
          const response = await window.basketAPI.generateReceipt(
            savedBasket.basket.id
          );

          if (response && response.success && response.data) {
            receiptHTML = response.data.html;
          }
        } catch (apiError) {
          logger.warn(
            "Backend receipt generation failed, using fallback:",
            apiError
          );
        }
      }

      // Fallback to client-side generation if backend failed
      if (!receiptHTML) {
        receiptHTML = generateReceiptHTML(savedBasket, cartItems);
      }

      // Use iframe with srcdoc for better Electron compatibility (avoids popup blockers)
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.visibility = "hidden";
      iframe.srcdoc = receiptHTML;

      document.body.appendChild(iframe);

      let printed = false;

      const cleanup = () => {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1000);
      };

      const performPrint = () => {
        if (printed) return;
        printed = true;

        try {
          const printWindow = iframe.contentWindow;
          if (printWindow) {
            printWindow.focus();
            setTimeout(() => {
              printWindow.print();
              toast.success("Receipt ready for printing");
              cleanup();
            }, 250);
          } else {
            cleanup();
            toast.error("Failed to access print window");
          }
        } catch (printError) {
          logger.error("Error printing:", printError);
          cleanup();
          toast.error("Failed to print receipt");
        }
      };

      iframe.onload = performPrint;

      // Fallback timeout in case onload doesn't fire
      setTimeout(() => {
        if (!printed && iframe.parentNode) {
          performPrint();
        }
      }, 1000);
    } catch (error) {
      logger.error("Error generating receipt:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate receipt";
      toast.error(`Receipt error: ${errorMessage}`);
    }
  }, [savedBasket, cartItems]);

  const handleClose = useCallback(() => {
    setStep("name");
    setSavedBasket(null);
    onClose();
  }, [onClose]);

  const calculateTotals = () => {
    const subtotal = cartItems.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    );
    const tax = cartItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[90vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === "name" && (
          <>
            <DialogHeader>
              <DialogTitle>Save Basket</DialogTitle>
              <DialogDescription>
                Save the current cart for later retrieval. A QR code will be
                generated.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="basket-name">Basket Name</Label>
                <Input
                  id="basket-name"
                  value={basketName}
                  onChange={(e) => setBasketName(e.target.value)}
                  placeholder="Enter basket name (optional)"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-email">
                  Customer Email (Optional)
                </Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Email address to send QR code to
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this basket..."
                  rows={3}
                />
              </div>

              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm font-medium mb-2">Basket Summary:</p>
                <p className="text-sm text-muted-foreground">
                  {cartItems.length} item(s) • Total: £{totals.total.toFixed(2)}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Basket"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && savedBasket && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Basket Saved Successfully
              </DialogTitle>
              <DialogDescription>
                Your basket has been saved. Use the QR code below to retrieve it
                later.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basket Info */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Basket Name:</p>
                <p className="text-lg font-semibold">
                  {savedBasket.basket.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Code: {savedBasket.basketCode}
                </p>
                {savedBasket.basket.expiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Expires:{" "}
                    {format(new Date(savedBasket.basket.expiresAt), "PPp")}
                  </p>
                )}
              </div>

              {/* Barcode */}
              <div className="flex flex-col items-center space-y-4 p-6 border rounded-lg bg-white">
                {BarcodeComponent ? (
                  <BarcodeComponent
                    value={savedBasket.basketCode}
                    width={2}
                    height={100}
                    displayValue={false}
                  />
                ) : (
                  <div className="w-full max-w-md border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 rounded p-8">
                    <div className="text-center">
                      <p className="text-4xl font-bold mb-3 tracking-widest font-mono">
                        {savedBasket.basketCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Scan this barcode or enter manually
                      </p>
                    </div>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {savedBasket.basketCode}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Scan this barcode to retrieve your basket
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleEmail}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrintReceipt}
                  className="w-full"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}

        {step === "email" && savedBasket && (
          <>
            <DialogHeader>
              <DialogTitle>Send QR Code via Email</DialogTitle>
              <DialogDescription>
                Enter the customer's email address to send the QR code.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email-input">Email Address</Label>
                <Input
                  id="email-input"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("success")}>
                Back
              </Button>
              <Button
                onClick={async () => {
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(customerEmail)) {
                    toast.error("Please enter a valid email address");
                    return;
                  }
                  await handleEmail();
                }}
                disabled={!customerEmail}
              >
                Send Email
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "receipt" && savedBasket && (
          <div className="hidden print:block">
            {/* Receipt content will be in print window */}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Generate receipt HTML for printing.
 *
 * Typography: Inline font-size (e.g. 10px, 12px, 14px, 16px) in this template
 * are output-specific for physical receipt/QR print. They are intentionally
 * not rem-based and are excluded from the app-wide font responsiveness rules.
 */
function generateReceiptHTML(
  savedBasket: {
    basket: {
      name: string;
      basketCode: string;
      savedAt: Date | string;
      expiresAt?: Date | string | null;
    };
    basketCode: string;
  },
  items: CartItemWithProduct[]
): string {
  const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const tax = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  const total = subtotal + tax;

  const expiresAt = savedBasket.basket.expiresAt
    ? format(new Date(savedBasket.basket.expiresAt), "PPp")
    : "N/A";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Saved Basket Receipt</title>
  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 10px;
      }
    }
    body {
      font-family: monospace;
      font-size: 12px;
      line-height: 1.4;
      max-width: 80mm;
      margin: 0 auto;
      padding: 10px;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .qr-code {
      text-align: center;
      margin: 15px 0;
      padding: 10px;
      border: 1px solid #000;
    }
    .items {
      margin: 10px 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .totals {
      border-top: 1px dashed #000;
      margin-top: 10px;
      padding-top: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .footer {
      text-align: center;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px dashed #000;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>SAVED BASKET</h2>
    <p><strong>${savedBasket.basket.name}</strong></p>
    <p>Code: ${savedBasket.basketCode}</p>
    <p>Saved: ${format(new Date(savedBasket.basket.savedAt), "PPp")}</p>
    <p>Expires: ${expiresAt}</p>
  </div>

  <div class="qr-code">
    <div id="qrcode"></div>
    <p><strong>Scan to retrieve this basket</strong></p>
  </div>

  <div class="items">
    <h3>ITEMS:</h3>
    ${items
      .map(
        (item) => `
      <div class="item-row">
        <span>${item.itemName || "Item"}</span>
        <span>£${(item.totalPrice || 0).toFixed(2)}</span>
      </div>
      <div style="font-size: 10px; color: #666;">
        ${
          item.itemType === "WEIGHT"
            ? `${item.weight?.toFixed(3)} ${item.unitOfMeasure || "kg"}`
            : `${item.quantity}x`
        } @ £${(item.unitPrice || 0).toFixed(2)}
      </div>
    `
      )
      .join("")}
  </div>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>£${subtotal.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Tax:</span>
      <span>£${tax.toFixed(2)}</span>
    </div>
    <div class="total-row" style="font-weight: bold; font-size: 14px;">
      <span>Total:</span>
      <span>£${total.toFixed(2)}</span>
    </div>
  </div>

  <div class="footer">
    <p><strong>INSTRUCTIONS:</strong></p>
    <p>• Scan the QR code above to retrieve this basket</p>
    <p>• Or provide code: ${savedBasket.basketCode}</p>
    <p>• Expires: ${expiresAt}</p>
  </div>

  <script>
    // Generate QR code using qrcode library (if available)
    // For now, we'll use a simple text representation
    document.getElementById('qrcode').innerHTML = '<p style="font-size: 16px; font-weight: bold;">${
      savedBasket.basketCode
    }</p>';
  </script>
</body>
</html>
  `;
}
