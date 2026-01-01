/**
 * Receipt options modal component
 * Shown after successful transaction completion for all payment types
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Printer,
  Download,
  Mail,
  X,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { TransactionData } from "@/types/domain/transaction";
import { EmailReceiptModal } from "../modals/email-receipt-modal";

interface ReceiptOptionsModalProps {
  isOpen: boolean;
  transactionData: TransactionData | null;
  onPrint: () => void;
  onDownload: () => void;
  onEmail: () => void;
  onClose: () => void;
  onCancel: () => void;
  printerStatus?: {
    connected: boolean;
    error: string | null;
  };
}

export function ReceiptOptionsModal({
  isOpen,
  transactionData,
  onPrint,
  onDownload,
  onEmail,
  onClose,
  onCancel,
  printerStatus = { connected: true, error: null },
}: ReceiptOptionsModalProps) {
  const [showEmailModal, setShowEmailModal] = useState(false);

  if (!isOpen || !transactionData) return null;

  // Determine payment method and if it's a cash payment
  const paymentMethod = transactionData.paymentMethods[0]?.type || "cash";
  const isCashPayment = paymentMethod === "cash";

  // Format payment method name for display
  const getPaymentMethodName = (method: string) => {
    switch (method) {
      case "card":
        return "Card Payment";
      case "mobile":
        return "Mobile Payment";
      case "digital":
        return "Digital Payment";
      case "voucher":
        return "Voucher";
      case "split":
        return "Split Payment";
      default:
        return "Cash Payment";
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          toast.warning(
            "Please select an option or click the X to skip receipt"
          );
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 sm:mx-auto overflow-hidden max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 sm:p-6 relative">
          <button
            onClick={onCancel}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:rotate-90 duration-200 touch-manipulation"
            aria-label="Skip receipt"
            title="Skip receipt"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <div className="flex items-center gap-3 sm:gap-4 text-white pr-10 sm:pr-12">
            <div className="p-2 sm:p-3 bg-white/20 rounded-full shrink-0">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold">
                Payment Successful!
              </h2>
              <p className="text-green-100 text-xs sm:text-sm mt-1">
                Receipt #{transactionData.receiptNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Transaction Summary */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 sm:p-5 mb-4 sm:mb-6 border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <span className="text-slate-600 font-medium text-sm sm:text-base">
                Total Paid:
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                £{transactionData.total.toFixed(2)}
              </span>
            </div>
            <div className="pt-3 border-t border-slate-200 space-y-2">
              {isCashPayment ? (
                <>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-slate-600">Cash Received:</span>
                    <span className="font-semibold text-slate-700">
                      £{transactionData.amountPaid.toFixed(2)}
                    </span>
                  </div>
                  {transactionData.change > 0 && (
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-slate-600">Change Given:</span>
                      <span className="font-bold text-green-600 text-base sm:text-lg">
                        £{transactionData.change.toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-slate-600">Payment Method:</span>
                  <span className="font-semibold text-slate-700">
                    {getPaymentMethodName(paymentMethod)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Receipt Options */}
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-slate-600 font-medium mb-3 sm:mb-4 text-center">
              How would you like to receive the receipt?
            </p>

            {/* Print Receipt Button */}
            <div className="space-y-2">
              <Button
                onClick={onPrint}
                disabled={!printerStatus.connected}
                className="w-full min-h-[44px] h-14 sm:h-16 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed text-white flex items-center justify-between px-4 sm:px-6 text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transition-all touch-manipulation"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg shrink-0">
                    <Printer className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span>Print Receipt</span>
                </div>
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              </Button>
              {!printerStatus.connected && (
                <p className="text-[10px] sm:text-xs text-amber-600 text-center px-2">
                  ⚠️ Printer is not connected. You can download the receipt or
                  print later from transaction history.
                </p>
              )}
            </div>

            {/* Download Receipt Button */}
            <Button
              onClick={onDownload}
              variant="outline"
              className="w-full min-h-[44px] h-14 sm:h-16 border-2 border-slate-300 hover:border-sky-400 hover:bg-sky-50 flex items-center justify-between px-4 sm:px-6 text-sm sm:text-base font-semibold transition-all touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-sky-100 rounded-lg shrink-0">
                  <Download className="h-4 w-4 sm:h-5 sm:w-5 text-sky-600" />
                </div>
                <span className="text-slate-700">Download PDF</span>
              </div>
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 shrink-0" />
            </Button>

            {/* Email Receipt Button */}
            <Button
              onClick={() => setShowEmailModal(true)}
              variant="outline"
              className="w-full min-h-[44px] h-14 sm:h-16 border-2 border-slate-300 hover:border-purple-400 hover:bg-purple-50 flex items-center justify-between px-4 sm:px-6 text-sm sm:text-base font-semibold transition-all touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg shrink-0">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
                <span className="text-slate-700">Email Receipt</span>
              </div>
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 shrink-0" />
            </Button>

            {/* Divider */}
            <div className="relative py-3 sm:py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-[10px] sm:text-xs">
                <span className="bg-white px-3 text-slate-500">or</span>
              </div>
            </div>

            {/* Skip / Complete Button */}
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full h-12 sm:h-14 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs sm:text-sm font-medium transition-all touch-manipulation"
            >
              <span className="truncate">
                No Receipt - Continue to Next Customer
              </span>
            </Button>
          </div>

          {/* Footer Note */}
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-200">
            <p className="text-[10px] sm:text-xs text-center text-slate-500">
              Transaction saved. You can print this receipt later from{" "}
              <span className="font-semibold">Transaction History</span>
            </p>
          </div>
        </div>
      </div>

      {/* Email Receipt Modal */}
      <EmailReceiptModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        transactionId={transactionData.id}
        receiptNumber={transactionData.receiptNumber}
      />
    </div>
  );
}
