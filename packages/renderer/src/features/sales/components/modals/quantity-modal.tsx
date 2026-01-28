/**
 * Quantity Modal
 *
 * Allows users to modify the quantity or weight of a cart item.
 * For unit items: modify quantity
 * For weighted items: modify weight
 */

import { useState, useEffect } from "react";
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
import type { CartItemWithProduct } from "@/types/features/cart";
import { getEffectiveSalesUnit } from "@/shared/hooks/use-sales-unit-settings";
import { useSalesUnitSettings } from "@/shared/hooks/use-sales-unit-settings";
import { getLogger } from "@/shared/utils/logger";
import { NumericKeypad } from "../shared/numeric-keypad";

const logger = getLogger("QuantityModal");

interface QuantityModalProps {
  isOpen: boolean;
  item: CartItemWithProduct | null;
  businessId: string | undefined;
  onConfirm: (quantity?: number, weight?: number) => Promise<void>;
  onCancel: () => void;
}

export function QuantityModal({
  isOpen,
  item,
  businessId,
  onConfirm,
  onCancel,
}: QuantityModalProps) {
  const salesUnitSettings = useSalesUnitSettings(businessId);
  const [quantity, setQuantity] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      if (item.itemType === "UNIT") {
        setQuantity(item.quantity?.toString() || "1");
        setWeight("");
      } else if (item.itemType === "WEIGHT") {
        setWeight(item.weight?.toString() || "0");
        setQuantity("");
      } else {
        setQuantity(item.quantity?.toString() || "1");
        setWeight("");
      }
      // Reset typing state when modal opens with new item
      setHasStartedTyping(false);
    }
  }, [item]);

  const handleConfirm = async () => {
    if (!item) return;

    setIsSubmitting(true);
    try {
      if (item.itemType === "UNIT") {
        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error("Quantity must be greater than 0");
        }
        await onConfirm(Math.floor(qty), undefined);
      } else if (item.itemType === "WEIGHT") {
        const w = parseFloat(weight);
        if (isNaN(w) || w <= 0) {
          throw new Error("Weight must be greater than 0");
        }
        await onConfirm(undefined, w);
      }
    } catch (error) {
      logger.error("Error updating quantity:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) return null;

  const isWeighted = item.itemType === "WEIGHT";
  const salesUnit = item.unitOfMeasure || "each";
  const effectiveUnit = isWeighted
    ? getEffectiveSalesUnit(salesUnit, salesUnitSettings)
    : salesUnit;

  const handleKeypadInput = (value: string) => {
    if (value === "Clear") {
      if (isWeighted) {
        setWeight("");
      } else {
        setQuantity("");
      }
      setHasStartedTyping(false);
      return;
    }

    if (value === "Backspace") {
      if (isWeighted) {
        setWeight((prev) => {
          const newValue = prev.slice(0, -1);
          if (newValue === "") {
            setHasStartedTyping(false);
          }
          return newValue;
        });
      } else {
        setQuantity((prev) => {
          const newValue = prev.slice(0, -1);
          if (newValue === "") {
            setHasStartedTyping(false);
          }
          return newValue;
        });
      }
      return;
    }

    if (value === "Enter") {
      handleConfirm();
      return;
    }

    // Handle numeric input - replace on first keypress, append afterwards
    if (isWeighted) {
      setWeight((prev) => {
        // On first numeric input, replace the value
        if (!hasStartedTyping && /^[0-9]$/.test(value)) {
          setHasStartedTyping(true);
          return value;
        }
        
        // Allow decimal point only once
        if (value === "." && prev.includes(".")) {
          return prev;
        }
        
        // If starting fresh with decimal point
        if (!hasStartedTyping && value === ".") {
          setHasStartedTyping(true);
          return "0.";
        }
        
        // Prevent leading zeros (except 0.xxx)
        if (prev === "0" && value !== ".") {
          return value;
        }
        
        setHasStartedTyping(true);
        return prev + value;
      });
    } else {
      setQuantity((prev) => {
        // For quantity, only allow integers
        if (value === ".") {
          return prev;
        }
        
        // On first numeric input, replace the value
        if (!hasStartedTyping && /^[0-9]$/.test(value)) {
          setHasStartedTyping(true);
          return value;
        }
        
        // Handle "00" - append only if already typing
        if (value === "00") {
          if (!hasStartedTyping) {
            setHasStartedTyping(true);
            return "0";
          }
          return prev + "00";
        }
        
        // Prevent leading zeros
        if (prev === "0" && value !== "0") {
          return value;
        }
        
        setHasStartedTyping(true);
        return prev + value;
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Modify {isWeighted ? "Weight" : "Quantity"}</DialogTitle>
          <DialogDescription>
            {isWeighted
              ? `Update the weight for ${item.itemName}`
              : `Update the quantity for ${item.itemName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Form Input */}
            <div className="space-y-4">
              {isWeighted ? (
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight ({effectiveUnit})</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={weight}
                    onChange={(e) => {
                      setWeight(e.target.value);
                      setHasStartedTyping(true);
                    }}
                    placeholder="0.000"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleConfirm();
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    Current: {item.weight?.toFixed(3) || "0.000"} {effectiveUnit}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="1"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      setHasStartedTyping(true);
                    }}
                    placeholder="1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleConfirm();
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    Current: {item.quantity || 1}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Numeric Keypad */}
            <div className="space-y-2">
              <Label>Keypad</Label>
              <NumericKeypad
                onInput={handleKeypadInput}
                layout="numericField"
                includeClear={true}
                includeBackspace={true}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
