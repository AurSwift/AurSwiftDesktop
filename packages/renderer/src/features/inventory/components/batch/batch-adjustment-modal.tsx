import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { ProductBatch } from "@/types/features/batches";
import {
  AdaptiveKeyboard,
  AdaptiveFormField,
} from "@/features/adaptive-keyboard";
import type { KeyboardMode } from "@/features/adaptive-keyboard";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, TrendingDown, Edit3 } from "lucide-react";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("batch-adjustment-modal");

interface BatchAdjustmentModalProps {
  batch: ProductBatch | null;
  adjustmentType: "add" | "remove" | "set";
  quantity: string;
  reason: string;
  onClose: () => void;
  onTypeChange: (type: "add" | "remove" | "set") => void;
  onQuantityChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onConfirm: (
    batchId: string,
    type: "add" | "remove" | "set",
    quantity: number,
    reason: string
  ) => Promise<void>;
}

const BatchAdjustmentModal: React.FC<BatchAdjustmentModalProps> = ({
  batch,
  adjustmentType,
  quantity,
  reason,
  onClose,
  onTypeChange,
  onQuantityChange,
  onReasonChange,
  onConfirm,
}) => {
  // Keyboard state
  const [activeField, setActiveField] = useState<"quantity" | "reason" | null>(
    null
  );
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldFocus = useCallback((field: "quantity" | "reason") => {
    setActiveField(field);
    setShowKeyboard(true);
  }, []);

  const handleCloseKeyboard = useCallback(() => {
    setShowKeyboard(false);
    setActiveField(null);
  }, []);

  const handleInput = useCallback(
    (char: string) => {
      if (activeField === "quantity") {
        onQuantityChange(quantity + char);
      } else if (activeField === "reason") {
        onReasonChange(reason + char);
      }
    },
    [activeField, quantity, reason, onQuantityChange, onReasonChange]
  );

  const handleBackspace = useCallback(() => {
    if (activeField === "quantity") {
      onQuantityChange(quantity.slice(0, -1));
    } else if (activeField === "reason") {
      onReasonChange(reason.slice(0, -1));
    }
  }, [activeField, quantity, reason, onQuantityChange, onReasonChange]);

  const handleClear = useCallback(() => {
    if (activeField === "quantity") {
      onQuantityChange("");
    } else if (activeField === "reason") {
      onReasonChange("");
    }
  }, [activeField, onQuantityChange, onReasonChange]);

  const getKeyboardMode = (): KeyboardMode => {
    return activeField === "quantity" ? "numeric" : "qwerty";
  };

  // Calculate new quantity
  const calculateNewQuantity = (): number => {
    if (!batch) return 0;
    const quantityNum = parseInt(quantity) || 0;

    switch (adjustmentType) {
      case "add":
        return batch.currentQuantity + quantityNum;
      case "remove":
        return Math.max(0, batch.currentQuantity - quantityNum);
      case "set":
        return quantityNum;
      default:
        return batch.currentQuantity;
    }
  };

  const newQuantity = calculateNewQuantity();
  const quantityDiff = newQuantity - (batch?.currentQuantity || 0);

  if (!batch) return null;

  const handleConfirm = async () => {
    const quantityNum = parseInt(quantity);

    // Validation
    if (!quantityNum || quantityNum <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    if (adjustmentType === "remove" && quantityNum > batch.currentQuantity) {
      toast.error(
        `Cannot remove ${quantityNum} units. Only ${batch.currentQuantity} available.`
      );
      return;
    }

    const reasonText = reason.trim();
    if (!reasonText) {
      toast.error("Please provide a reason for this adjustment");
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(batch.id, adjustmentType, quantityNum, reasonText);
      onClose();
    } catch (error) {
      logger.error("Adjustment error:", error);
      // Error toast handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleClose();
        }
      }}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl mx-4 flex flex-col h-[90vh] max-h-[90vh] transition-all duration-200 ${
          showKeyboard ? "w-[700px] max-w-[95vw]" : "w-[500px] max-w-[90vw]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b shrink-0">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Adjust Batch Stock
          </h3>
          <div className="mt-3 space-y-2">
            {/* Batch Info */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Batch:</span>
              <Badge variant="outline">{batch.batchNumber}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Product:</span>
              <span className="font-medium">
                {batch.product?.name || "Unknown Product"}
              </span>
            </div>
            {/* Current Stock */}
            <div className="bg-blue-50 px-3 py-2 rounded-lg">
              <span className="text-blue-600">Current Stock:</span>{" "}
              <span className="font-semibold text-blue-900">
                {batch.currentQuantity}
              </span>
            </div>
            {/* Projected Stock */}
            {quantity && (
              <div
                className={`px-3 py-2 rounded-lg ${
                  quantityDiff > 0
                    ? "bg-green-50"
                    : quantityDiff < 0
                    ? "bg-orange-50"
                    : "bg-gray-50"
                }`}
              >
                <span
                  className={`${
                    quantityDiff > 0
                      ? "text-green-600"
                      : quantityDiff < 0
                      ? "text-orange-600"
                      : "text-gray-600"
                  }`}
                >
                  New Stock:
                </span>{" "}
                <span
                  className={`font-semibold ${
                    quantityDiff > 0
                      ? "text-green-900"
                      : quantityDiff < 0
                      ? "text-orange-900"
                      : "text-gray-900"
                  }`}
                >
                  {newQuantity}
                </span>
                <span
                  className={`ml-2 text-sm ${
                    quantityDiff > 0
                      ? "text-green-600"
                      : quantityDiff < 0
                      ? "text-orange-600"
                      : "text-gray-600"
                  }`}
                >
                  ({quantityDiff > 0 ? "+" : ""}
                  {quantityDiff})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Buttons Section */}
        <div className="border-b bg-background shrink-0">
          <div className="p-6 flex gap-3">
            <Button
              type="button"
              size="lg"
              className="flex-1 h-12"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Processing..."
                : `Confirm ${
                    adjustmentType === "add"
                      ? "Addition"
                      : adjustmentType === "remove"
                      ? "Removal"
                      : "Adjustment"
                  }`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1 h-12"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Adjustment Type Tabs */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Adjustment Type</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="lg"
                className="h-20 flex flex-col items-center justify-center"
                variant={adjustmentType === "add" ? "default" : "outline"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCloseKeyboard();
                  onTypeChange("add");
                }}
                disabled={isSubmitting}
              >
                <TrendingUp className="w-5 h-5 mb-1" />
                <span className="text-sm">Add Stock</span>
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-20 flex flex-col items-center justify-center"
                variant={adjustmentType === "remove" ? "default" : "outline"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCloseKeyboard();
                  onTypeChange("remove");
                }}
                disabled={isSubmitting}
              >
                <TrendingDown className="w-5 h-5 mb-1" />
                <span className="text-sm">Remove Stock</span>
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-20 flex flex-col items-center justify-center"
                variant={adjustmentType === "set" ? "default" : "outline"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCloseKeyboard();
                  onTypeChange("set");
                }}
                disabled={isSubmitting}
              >
                <Edit3 className="w-5 h-5 mb-1" />
                <span className="text-sm">Set Quantity</span>
              </Button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {adjustmentType === "add" &&
                "Add stock to this batch (e.g., found missing items)"}
              {adjustmentType === "remove" &&
                "Remove stock from this batch (e.g., damaged/waste)"}
              {adjustmentType === "set" &&
                "Set exact quantity (e.g., after physical count)"}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Quantity Input */}
            <div>
              <Label htmlFor="batch-quantity" className="text-sm font-medium">
                Quantity{" "}
                {adjustmentType === "set" ? "to Set" : `to ${adjustmentType}`}
              </Label>
              <AdaptiveFormField
                variant="borderOnly"
                id="batch-quantity"
                label=""
                placeholder={
                  adjustmentType === "set"
                    ? `Enter exact quantity (current: ${batch.currentQuantity})`
                    : "Enter quantity"
                }
                value={quantity}
                readOnly
                onFocus={() => handleFieldFocus("quantity")}
                className="mt-1.5 text-xs sm:text-sm md:text-base"
                disabled={isSubmitting}
              />
            </div>

            {/* Reason Input */}
            <div>
              <Label htmlFor="batch-reason" className="text-sm font-medium">
                Reason for Adjustment
              </Label>
              <Textarea
                id="batch-reason"
                placeholder="E.g., Damaged items, Stock count correction, Waste removal"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                onFocus={() => handleFieldFocus("reason")}
                className="mt-1.5 min-h-[80px]"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be recorded for audit purposes
              </p>
            </div>
          </div>

          {/* Warning for removal */}
          {adjustmentType === "remove" && quantity && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-800">
                <strong>Warning:</strong> Removing {parseInt(quantity) || 0}{" "}
                units will leave{" "}
                {Math.max(0, batch.currentQuantity - (parseInt(quantity) || 0))}{" "}
                units in this batch.
                {parseInt(quantity) > batch.currentQuantity && (
                  <span className="block mt-1 font-semibold text-red-600">
                    ⚠️ Cannot remove more than available stock!
                  </span>
                )}
              </div>
            </div>
          )}
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
      </div>
    </div>
  );
};

export default BatchAdjustmentModal;
