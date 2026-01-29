/**
 * Receipt Preview Modal
 * Shows a plain-text preview of the exact thermal receipt content that will be printed.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Eye, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { TransactionData } from "@/types/domain/transaction";

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionData: TransactionData;
}

export function ReceiptPreviewModal({
  isOpen,
  onClose,
  transactionData,
}: ReceiptPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [text, setText] = useState<string>("");
  const [barcodePngBase64, setBarcodePngBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPreview = useMemo(() => Boolean(transactionData?.id), [transactionData?.id]);

  const loadPreview = useCallback(async () => {
    if (!window.printerAPI?.previewReceipt) {
      setError("Printer preview API not available");
      return;
    }
    if (!canPreview) {
      setError("Cannot preview: missing transaction data");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await window.printerAPI.previewReceipt(transactionData);
      if (!res?.success || !res.text) {
        throw new Error(res?.error || "Failed to generate receipt preview");
      }
      setText(res.text);
      setBarcodePngBase64(res.barcodePngBase64 ?? null);
    } catch (e) {
      setText("");
      setBarcodePngBase64(null);
      setError(e instanceof Error ? e.message : "Failed to generate receipt preview");
    } finally {
      setIsLoading(false);
    }
  }, [canPreview, transactionData]);

  useEffect(() => {
    if (!isOpen) return;
    void loadPreview();
  }, [isOpen, loadPreview]);

  const handleCopy = useCallback(async () => {
    try {
      if (!text.trim()) {
        toast.error("Nothing to copy");
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Receipt preview copied");
    } catch {
      toast.error("Failed to copy");
    }
  }, [text]);

  // Insert barcode image before the THANK YOU line (to match printed layout).
  const thankYouMarker = "THANK YOU FOR SHOPPING WITH US";
  const thankYouIndex = useMemo(() => text.indexOf(thankYouMarker), [text]);
  const beforeThankYou = useMemo(() => {
    if (!text) return "";
    if (thankYouIndex <= 0) return text;
    return text.slice(0, thankYouIndex).trimEnd();
  }, [text, thankYouIndex]);
  const fromThankYou = useMemo(() => {
    if (!text) return "";
    if (thankYouIndex <= 0) return "";
    return text.slice(thankYouIndex);
  }, [text, thankYouIndex]);

  // Ensure dialog renders above the full-screen receipt options overlay.
  return createPortal(
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-sky-600" />
            Receipt Preview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            This is a plain-text preview of the exact receipt content (ESC/POS formatting
            commands removed). Alignment/wrapping should match the printed receipt.
          </p>

          <div className="rounded-md border bg-slate-50 p-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating preview...
              </div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : (
              <div className="space-y-3">
                <pre className="overflow-auto whitespace-pre font-mono text-xs leading-4 text-slate-900">
                  {beforeThankYou}
                </pre>

                {barcodePngBase64 ? (
                  <div className="flex justify-center">
                    <img
                      src={`data:image/png;base64,${barcodePngBase64}`}
                      alt={`Receipt barcode ${transactionData.receiptNumber}`}
                      className="max-w-full"
                    />
                  </div>
                ) : null}

                <pre className="max-h-[60vh] overflow-auto whitespace-pre font-mono text-xs leading-4 text-slate-900">
                  {fromThankYou}
                </pre>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadPreview()}
            disabled={isLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button type="button" onClick={handleCopy} disabled={!text.trim() || isLoading}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
    document.body
  );
}

