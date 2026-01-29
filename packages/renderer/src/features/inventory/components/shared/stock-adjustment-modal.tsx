import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product } from "@/types/domain";
import {
  AdaptiveKeyboard,
  AdaptiveFormField,
} from "@/features/adaptive-keyboard";
import type { KeyboardMode } from "@/features/adaptive-keyboard";

interface StockAdjustmentModalProps {
  product: Product | null;
  adjustmentType: "add" | "remove";
  // We ignore these props for local state management to prevent render loops
  quantity?: string;
  reason?: string;
  onClose: () => void;
  onTypeChange: (type: "add" | "remove") => void;
  // These are kept for API compatibility but we won't use them for live updates
  onQuantityChange?: (value: string) => void;
  onReasonChange?: (value: string) => void;
  onConfirm: (
    productId: string,
    type: "add" | "remove",
    quantity: number,
    reason: string
  ) => void;
}

const ADD_REASONS = [
  "Stock Received (Delivery)",
  "Inventory Count Correction (Found)",
  "Return from Customer",
  "Transfer In",
  "Other (Add Note)",
];

const REMOVE_REASONS = [
  "Damaged / Broken",
  "Expired",
  "Theft / Loss",
  "Inventory Count Correction (Lost)",
  "Transfer Out",
  "Waste / Spoilage",
  "Internal Use",
  "Other (Add Note)",
];

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  product,
  adjustmentType,
  onClose,
  onTypeChange,
  onConfirm,
}) => {
  // Local state for form fields
  const [localQuantity, setLocalQuantity] = useState("0");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customNote, setCustomNote] = useState("");

  // Keyboard state
  const [activeField, setActiveField] = useState<"quantity" | "note" | null>(
    null
  );
  const [showKeyboard, setShowKeyboard] = useState(false);

  // Reset state when adjustment type changes
  useEffect(() => {
    setSelectedReason("");
    setCustomNote("");
    setLocalQuantity("0");
  }, [adjustmentType]);

  const handleFieldFocus = useCallback(
    (field: "quantity" | "note") => {
      setActiveField(field);
      setShowKeyboard(true);

      // Auto-clear "0" when focusing quantity
      if (field === "quantity" && localQuantity === "0") {
        setLocalQuantity("");
      }
    },
    [localQuantity]
  );

  const handleCloseKeyboard = useCallback(() => {
    setShowKeyboard(false);
    setActiveField(null);

    // Restore "0" if empty on blur
    if (localQuantity === "") {
      setLocalQuantity("0");
    }
  }, [localQuantity]);

  const handleInput = useCallback(
    (char: string) => {
      if (activeField === "quantity") {
        setLocalQuantity((prev) => {
          // If current value is "0", replace it unless adding a decimal (not supported here yet)
          if (prev === "0") return char;
          return prev + char;
        });
      } else if (activeField === "note") {
        setCustomNote((prev) => prev + char);
      }
    },
    [activeField]
  );

  const handleBackspace = useCallback(() => {
    if (activeField === "quantity") {
      setLocalQuantity((prev) => {
        const newVal = prev.slice(0, -1);
        return newVal === "" ? "" : newVal;
      });
    } else if (activeField === "note") {
      setCustomNote((prev) => prev.slice(0, -1));
    }
  }, [activeField]);

  const handleClear = useCallback(() => {
    if (activeField === "quantity") {
      setLocalQuantity("");
    } else if (activeField === "note") {
      setCustomNote("");
    }
  }, [activeField]);

  const getKeyboardMode = (): KeyboardMode => {
    return activeField === "quantity" ? "numeric" : "qwerty";
  };

  const handleReasonSelect = (value: string) => {
    setSelectedReason(value);
    if (value.includes("Other")) {
      // Focus note field if "Other" is selected
      setTimeout(() => handleFieldFocus("note"), 100);
    } else {
      setCustomNote("");
    }
  };

  if (!product) return null;

  const handleConfirm = () => {
    const quantityNum = parseInt(localQuantity);

    // Validation
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    // Prevent negative stock
    if (adjustmentType === "remove" && product.stockLevel !== undefined && quantityNum > product.stockLevel) {
      toast.error(
        `Cannot remove ${quantityNum} items. Only ${product.stockLevel} in stock.`
      );
      return;
    }

    if (!selectedReason) {
      toast.error("Please select a reason");
      return;
    }

    const finalReason =
      selectedReason.includes("Other") && customNote
        ? `${selectedReason}: ${customNote}`
        : selectedReason;

    onConfirm(product.id, adjustmentType, quantityNum, finalReason);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const currentReasons =
    adjustmentType === "add" ? ADD_REASONS : REMOVE_REASONS;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col transition-all duration-200 max-h-[95vh] w-full sm:w-[500px] md:w-[600px] lg:w-[700px] ${
          showKeyboard ? "max-w-[95vw]" : "max-w-[90vw]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b shrink-0">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
            Adjust Stock: {product.name}
          </h3>
          <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="bg-blue-50 px-3 py-2 rounded-lg">
              <span className="text-blue-600">Current Stock:</span>{" "}
              <span className="font-semibold text-blue-900">
                {product.stockLevel}
              </span>
            </div>
            <div className="bg-amber-50 px-3 py-2 rounded-lg">
              <span className="text-amber-600">Minimum Level:</span>{" "}
              <span className="font-semibold text-amber-900">
                {product.minStockLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Adjustment Type Tabs */}
          <div className="flex gap-2 sm:gap-3">
            <Button
              type="button"
              size="lg"
              className="flex-1 h-10 sm:h-12 text-sm sm:text-base"
              variant={adjustmentType === "add" ? "default" : "outline"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCloseKeyboard();
                onTypeChange("add");
              }}
            >
              Add Stock
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1 h-10 sm:h-12 text-sm sm:text-base"
              variant={adjustmentType === "remove" ? "default" : "outline"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCloseKeyboard();
                onTypeChange("remove");
              }}
            >
              Remove Stock
            </Button>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {/* Quantity Input */}
            <div>
              <Label htmlFor="stock-quantity" className="text-sm font-medium">
                Quantity to {adjustmentType === "add" ? "Add" : "Remove"}
              </Label>
              <AdaptiveFormField
                id="stock-quantity"
                label=""
                placeholder="Enter quantity"
                value={localQuantity}
                readOnly
                onFocus={() => handleFieldFocus("quantity")}
                className="mt-1.5 text-sm sm:text-base"
              />
            </div>

            {/* Reason Select */}
            <div>
              <Label htmlFor="stock-reason" className="text-sm font-medium">
                Reason
              </Label>
              <Select value={selectedReason} onValueChange={handleReasonSelect}>
                <SelectTrigger className="w-full mt-1.5 h-10 sm:h-11 text-sm sm:text-base">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {currentReasons.map((r) => (
                    <SelectItem key={r} value={r} className="text-sm sm:text-base">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional Note (shown if Other is selected) */}
            {selectedReason.includes("Other") && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <Label htmlFor="stock-note" className="text-sm font-medium">
                  Note / Details
                </Label>
                <AdaptiveFormField
                  id="stock-note"
                  label=""
                  placeholder="Enter details..."
                  value={customNote}
                  readOnly
                  onFocus={() => handleFieldFocus("note")}
                  className="mt-1.5 text-sm sm:text-base"
                />
              </div>
            )}
          </div>
        </div>

        {/* Adaptive Keyboard */}
        {showKeyboard && (
          <div className="border-t bg-background px-2 py-2 shrink-0">
            <div className="max-w-full overflow-hidden">
              <AdaptiveKeyboard
                visible={showKeyboard}
                initialMode={getKeyboardMode()}
                onInput={handleInput}
                onBackspace={handleBackspace}
                onClear={handleClear}
                onEnter={handleCloseKeyboard}
                onClose={handleCloseKeyboard}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 sm:p-6 border-t bg-gray-50/50 rounded-b-xl flex gap-2 sm:gap-3 shrink-0">
          <Button
            type="button"
            size="lg"
            className="flex-1 h-10 sm:h-12 text-sm sm:text-base"
            onClick={handleConfirm}
          >
            Confirm Adjustment
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1 h-10 sm:h-12 text-sm sm:text-base"
            onClick={handleClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StockAdjustmentModal;
