/**
 * Cart item row component
 */

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { CartItemWithProduct } from "@/types";

interface CartItemRowProps {
  item: CartItemWithProduct;
  onRemove: (itemId: string) => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function CartItemRow({
  item,
  onRemove,
  isSelected = false,
  onSelect,
}: CartItemRowProps) {
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Don't trigger selection if clicking on the remove button
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).tagName === 'BUTTON'
    ) {
      return;
    }
    onSelect?.();
  };

  return (
    <tr
      className={`border-b border-slate-200 transition-colors cursor-pointer ${
        isSelected
          ? "bg-sky-100 hover:bg-sky-200"
          : "hover:bg-slate-50"
      }`}
      onClick={handleRowClick}
    >
      <td className="text-center text-xs sm:text-sm" style={{ width: "100px" }}>
        {item.itemType === "WEIGHT" && item.weight
          ? `${item.weight.toFixed(2)}`
          : item.itemType === "UNIT" && item.quantity
          ? `${item.quantity}x`
          : "-"}
      </td>
      <td className="font-medium text-xs sm:text-sm">
        <span className="line-clamp-2">
          {item.product?.name || item.itemName || "Unknown Product"}
        </span>
      </td>
      <td className="text-center text-xs sm:text-sm" style={{ width: "120px" }}>
        £{item.unitPrice.toFixed(2)}
        {item.itemType === "WEIGHT" && item.unitOfMeasure && (
          <span className="text-[10px] sm:text-xs text-slate-500">
            {" "}
            / {item.unitOfMeasure}
          </span>
        )}
      </td>
      <td
        className="text-center font-semibold text-xs sm:text-sm"
        style={{ width: "100px" }}
      >
        £{item.totalPrice.toFixed(2)}
      </td>
      <td className="text-center" style={{ width: "80px" }}>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(item.id)}
          className="min-h-[44px] min-w-[44px] h-10 w-10 sm:h-11 sm:w-11 p-0 text-red-500 hover:text-red-700 touch-manipulation"
        >
          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </td>
    </tr>
  );
}
