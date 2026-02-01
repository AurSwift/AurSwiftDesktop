/**
 * Quick Sell Button Grid
 *
 * 4×6 grid of configurable quick sell buttons.
 * Supports click-to-edit and visual drag indicators.
 */

import { useState } from "react";
import { cn } from "@/shared/utils/cn";
import { GripVertical, Package, FolderOpen } from "lucide-react";
import { QUICK_SELL_GRID, type QuickSellButtonWithDetails } from "../types";

interface QuickSellButtonGridProps {
  buttons: QuickSellButtonWithDetails[];
  onButtonClick: (button: QuickSellButtonWithDetails) => void;
  onSwapPositions: (buttonId1: string, buttonId2: string) => void;
}

export function QuickSellButtonGrid({
  buttons,
  onButtonClick,
  onSwapPositions,
}: QuickSellButtonGridProps) {
  const [draggedButtonId, setDraggedButtonId] = useState<string | null>(null);
  const [dragOverButtonId, setDragOverButtonId] = useState<string | null>(null);

  // Sort buttons by position and fill gaps with placeholders
  const sortedButtons = [...buttons].sort((a, b) => a.position - b.position);

  // Create a map for quick lookup
  const buttonByPosition = new Map(
    sortedButtons.map((btn) => [btn.position, btn]),
  );

  // Handle drag start
  const handleDragStart = (
    e: React.DragEvent<HTMLButtonElement>,
    button: QuickSellButtonWithDetails,
  ) => {
    setDraggedButtonId(button.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", button.id);
  };

  // Handle drag over
  const handleDragOver = (
    e: React.DragEvent<HTMLButtonElement>,
    button: QuickSellButtonWithDetails,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (button.id !== draggedButtonId) {
      setDragOverButtonId(button.id);
    }
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverButtonId(null);
  };

  // Handle drop
  const handleDrop = (
    e: React.DragEvent<HTMLButtonElement>,
    targetButton: QuickSellButtonWithDetails,
  ) => {
    e.preventDefault();
    const sourceButtonId = e.dataTransfer.getData("text/plain");

    if (sourceButtonId && sourceButtonId !== targetButton.id) {
      onSwapPositions(sourceButtonId, targetButton.id);
    }

    setDraggedButtonId(null);
    setDragOverButtonId(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedButtonId(null);
    setDragOverButtonId(null);
  };

  // Get display label for button
  const getButtonLabel = (button: QuickSellButtonWithDetails): string => {
    if (button.label) return button.label;
    if (button.linkType === "product" && button.product) {
      return button.product.name;
    }
    if (button.linkType === "category" && button.category) {
      return button.category.name;
    }
    return "Unassigned Button";
  };

  // Get button shape class
  const getShapeClass = (shape: string): string => {
    switch (shape) {
      case "rectangle":
        return "rounded-none";
      case "pill":
        return "rounded-full";
      case "rounded":
      default:
        return "rounded-lg";
    }
  };

  // Render a single button cell
  const renderButton = (position: number) => {
    const button = buttonByPosition.get(position);

    if (!button) {
      // Empty placeholder
      return (
        <div
          key={`empty-${position}`}
          className="h-full min-h-20 border-2 border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center text-muted-foreground/40 text-xs"
        >
          Empty
        </div>
      );
    }

    const isUnassigned = button.linkType === "unassigned";
    const isDragging = button.id === draggedButtonId;
    const isDragOver = button.id === dragOverButtonId;

    return (
      <button
        key={button.id}
        draggable
        onDragStart={(e) => handleDragStart(e, button)}
        onDragOver={(e) => handleDragOver(e, button)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, button)}
        onDragEnd={handleDragEnd}
        onClick={() => onButtonClick(button)}
        className={cn(
          "relative h-full min-h-20 p-2 text-sm font-medium transition-all",
          "border-2 flex flex-col items-center justify-center gap-1",
          "hover:scale-[1.02] hover:shadow-lg cursor-pointer",
          getShapeClass(button.shape),
          isDragging && "opacity-50 scale-95",
          isDragOver && "ring-2 ring-primary ring-offset-2",
          isUnassigned
            ? "bg-muted/50 border-dashed border-muted-foreground/30 text-muted-foreground"
            : "border-transparent shadow-md",
        )}
        style={
          !isUnassigned
            ? {
                backgroundColor: button.color,
                color: button.textColor,
              }
            : undefined
        }
      >
        {/* Drag handle indicator */}
        <div className="absolute top-1 right-1 opacity-30 hover:opacity-60">
          <GripVertical className="w-3 h-3" />
        </div>

        {/* Icon based on link type */}
        {button.linkType === "product" && (
          <Package className="w-4 h-4 mb-1 opacity-70" />
        )}
        {button.linkType === "category" && (
          <FolderOpen className="w-4 h-4 mb-1 opacity-70" />
        )}

        {/* Label */}
        <span className="text-center line-clamp-2 text-xs sm:text-sm px-1">
          {getButtonLabel(button)}
        </span>

        {/* Price for products */}
        {button.linkType === "product" && button.product && (
          <span className="text-[10px] opacity-80">
            £{button.product.basePrice.toFixed(2)}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="grid gap-2 sm:gap-3"
      style={{
        gridTemplateColumns: `repeat(${QUICK_SELL_GRID.COLUMNS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${QUICK_SELL_GRID.ROWS}, minmax(80px, 1fr))`,
      }}
    >
      {Array.from({ length: QUICK_SELL_GRID.BUTTONS_PER_PAGE }, (_, i) =>
        renderButton(i),
      )}
    </div>
  );
}
