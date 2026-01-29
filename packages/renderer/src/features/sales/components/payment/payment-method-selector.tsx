/**
 * Payment method selector component
 * Viva Wallet is the primary contactless payment method for card payments
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Smartphone, Radio } from "lucide-react";
import type { PaymentMethod } from "@/types/domain/payment";
import { TerminalSelectorModal } from "./terminal-selector-modal";
import { useVivaWallet } from "../../hooks/use-viva-wallet";

interface PaymentMethodSelectorProps {
  cardReaderReady: boolean; // Kept for backward compatibility, but Viva Wallet replaces it
  onSelect: (method: PaymentMethod["type"]) => void;
  onCancel: () => void;
}

export function PaymentMethodSelector({
  cardReaderReady: _cardReaderReady, // eslint-disable-line @typescript-eslint/no-unused-vars
  onSelect,
  onCancel,
}: PaymentMethodSelectorProps) {
  const [showTerminalSelector, setShowTerminalSelector] = useState(false);
  const { selectedTerminal, connectionStatus, isDiscovering, connectTerminal } =
    useVivaWallet();

  const handleCardPaymentSelect = () => {
    // Viva Wallet handles all card payments (contactless)
    if (!selectedTerminal) {
      // Show terminal selector if no terminal selected
      setShowTerminalSelector(true);
    } else if (connectionStatus === "connected") {
      // Terminal connected, proceed with Viva Wallet payment
      onSelect("viva_wallet");
    } else {
      // Terminal not connected, try to connect
      connectTerminal(selectedTerminal.id).then((connected) => {
        if (connected) {
          onSelect("viva_wallet");
        }
      });
    }
  };

  const handleTerminalSelected = () => {
    setShowTerminalSelector(false);
    // Terminal is already connected when selected from modal
    onSelect("viva_wallet");
  };

  const isVivaWalletReady =
    selectedTerminal && connectionStatus === "connected";

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Button
          variant="outline"
          className="h-14 sm:h-16 bg-white border-slate-300 hover:bg-slate-50 text-slate-700 text-sm sm:text-base touch-manipulation"
          onClick={() => onSelect("cash")}
        >
          <div className="flex flex-col items-center">
            <span>Cash</span>
            <span className="text-caption text-slate-500">
              Physical currency
            </span>
          </div>
        </Button>

        {/* Viva Wallet Card Payment - Replaces traditional card payment */}
        <Button
          variant="outline"
          className={`h-14 sm:h-16 border-slate-300 text-slate-700 text-sm sm:text-base touch-manipulation ${
            isVivaWalletReady
              ? "bg-white hover:bg-slate-50"
              : "bg-gray-100 cursor-not-allowed opacity-60"
          }`}
          onClick={handleCardPaymentSelect}
          disabled={!isVivaWalletReady && !isDiscovering}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              <span>Card</span>
            </div>
            <span className="text-caption text-slate-500">
              {isVivaWalletReady
                ? selectedTerminal?.name || "Ready"
                : isDiscovering
                ? "Discovering..."
                : "Select Terminal"}
            </span>
            {selectedTerminal && (
              <div className="flex items-center gap-1 mt-0.5">
                {selectedTerminal.terminalType === "device-based" ? (
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-1 py-0 flex items-center gap-0.5"
                  >
                    <Smartphone className="h-2.5 w-2.5" />
                    Device
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-purple-50 text-purple-700 border-purple-200 text-xs px-1 py-0 flex items-center gap-0.5"
                  >
                    <Radio className="h-2.5 w-2.5" />
                    Dedicated
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Button>

        {/* Mobile Pay - Currently disabled, will use Viva Wallet in future */}
        <Button
          variant="outline"
          className="h-14 sm:h-16 bg-gray-100 border-slate-300 text-slate-400 text-sm sm:text-base touch-manipulation cursor-not-allowed opacity-60"
          disabled
        >
          <div className="flex flex-col items-center">
            <span>Mobile Pay</span>
            <span className="text-caption text-slate-500">
              Coming Soon
            </span>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-14 sm:h-16 bg-white border-slate-300 hover:bg-slate-50 text-slate-700 text-sm sm:text-base touch-manipulation"
          onClick={() => onSelect("voucher")}
        >
          <div className="flex flex-col items-center">
            <span>Voucher</span>
            <span className="text-caption text-slate-500">
              Gift card/Coupon
            </span>
          </div>
        </Button>

        <Button
          variant="ghost"
          className="col-span-2 mt-2 h-10 sm:h-12 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-sm sm:text-base touch-manipulation"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>

      {/* Terminal Selector Modal */}
      <TerminalSelectorModal
        open={showTerminalSelector}
        onClose={() => setShowTerminalSelector(false)}
        onSelect={handleTerminalSelected}
      />
    </>
  );
}
