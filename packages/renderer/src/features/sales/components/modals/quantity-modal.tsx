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
import { isWeightedProduct } from "../../utils/product-helpers";
import { getEffectiveSalesUnit } from "@/shared/hooks/use-sales-unit-settings";
import { useSalesUnitSettings } from "@/shared/hooks/use-sales-unit-settings";

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
      console.error("Error updating quantity:", error);
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

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modify {isWeighted ? "Weight" : "Quantity"}</DialogTitle>
          <DialogDescription>
            {isWeighted
              ? `Update the weight for ${item.itemName}`
              : `Update the quantity for ${item.itemName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isWeighted ? (
            <div className="space-y-2">
              <Label htmlFor="weight">
                Weight ({effectiveUnit})
              </Label>
              <Input
                id="weight"
                type="number"
                step="0.001"
                min="0.001"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
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
                onChange={(e) => setQuantity(e.target.value)}
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

