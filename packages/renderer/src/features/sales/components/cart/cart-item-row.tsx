/**
 * Cart item row component
 */

import type { CartItemWithProduct } from "@/types";

interface CartItemRowProps {
  item: CartItemWithProduct;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function CartItemRow({
  item,
  isSelected = false,
  onSelect,
}: CartItemRowProps) {
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).tagName === "BUTTON"
    ) {
      return;
    }
    onSelect?.();
  };

  return (
    <tr
      className={`border-b border-slate-200 transition-colors cursor-pointer ${
        isSelected ? "bg-slate-200 hover:bg-slate-300" : "hover:bg-slate-50"
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
          <span className="text-caption text-slate-500">
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
    </tr>
  );
}
