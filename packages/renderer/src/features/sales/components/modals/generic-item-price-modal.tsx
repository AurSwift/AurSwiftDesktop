import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";
import { NumericKeypad } from "../shared/numeric-keypad";
import type { Product } from "@/types/domain";

interface GenericItemPriceModalProps {
  isOpen: boolean;
  product: Product;
  onConfirm: (price: number) => void;
  onCancel: () => void;
}

export const GenericItemPriceModal: React.FC<GenericItemPriceModalProps> = ({
  isOpen,
  product,
  onConfirm,
  onCancel,
}) => {
  const [price, setPrice] = useState("");
  const [displayPrice, setDisplayPrice] = useState("0.00");

  // Initialize with default price if available
  useEffect(() => {
    if (isOpen && product.genericDefaultPrice) {
      setPrice(product.genericDefaultPrice.toString());
      setDisplayPrice(product.genericDefaultPrice.toFixed(2));
    } else if (isOpen) {
      setPrice("");
      setDisplayPrice("0.00");
    }
  }, [isOpen, product.genericDefaultPrice]);

  const handleKeypadInput = (value: string) => {
    if (value === "Clear") {
      setPrice("");
      setDisplayPrice("0.00");
      return;
    }

    if (value === "Backspace" || value === "<-" || value === "←") {
      const next = price.slice(0, -1);
      setPrice(next);
      setDisplayPrice(next ? (parseFloat(next) || 0).toFixed(2) : "0.00");
      return;
    }

    if (value === "Enter") {
      handleConfirm();
      return;
    }

    // Handle numeric input
    let newPrice = price;
    if (value === "00") {
      newPrice = price + "00";
    } else if (value === ".") {
      if (!price.includes(".")) {
        newPrice = price === "" ? "0." : price + ".";
      }
    } else {
      newPrice = price + value;
    }

    setPrice(newPrice);
    const numValue = parseFloat(newPrice) || 0;
    setDisplayPrice(numValue.toFixed(2));
  };

  const handleConfirm = () => {
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      return;
    }
    onConfirm(priceValue);
    // Reset on confirm
    setPrice("");
    setDisplayPrice("0.00");
  };

  const handleQuickPrice = (amount: number) => {
    setPrice(amount.toString());
    setDisplayPrice(amount.toFixed(2));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-[calc(100vw-2rem)] mx-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calculator className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="line-clamp-1">Enter Price for {product.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Enter the price for this generic item
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-4">
          {/* Price Display */}
          <div className="bg-slate-50 p-4 sm:p-6 rounded-lg text-center">
            <Label className="text-xs sm:text-sm text-slate-600 mb-2 block">
              Entered Price
            </Label>
            <div className="text-3xl sm:text-4xl font-bold text-slate-900">
              £{displayPrice}
            </div>
          </div>

          {/* Quick Price Buttons */}
          {product.genericDefaultPrice && (
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">Quick Select</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  product.genericDefaultPrice * 0.5,
                  product.genericDefaultPrice,
                  product.genericDefaultPrice * 1.5,
                  product.genericDefaultPrice * 2,
                ].map((amount, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPrice(amount)}
                    className="text-caption h-9 sm:h-10 touch-manipulation"
                  >
                    £{amount.toFixed(2)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Numeric Keypad (reusable numeric-field layout) */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm">Enter Amount</Label>
            <NumericKeypad
              layout="numericField"
              includeClear
              includeBackspace
              onInput={handleKeypadInput}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto min-h-[44px] h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!price || parseFloat(price) <= 0}
            className="bg-sky-600 hover:bg-sky-700 w-full sm:w-auto min-h-[44px] h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
          >
            <span className="truncate">Add to Cart (£{displayPrice})</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
