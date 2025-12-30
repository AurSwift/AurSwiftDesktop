/**
 * Cart panel component
 * Main container for cart display
 */

import { CardContent } from "@/components/ui/card";
import { CartItemsTable } from "./cart-items-table";
import { CartSummary } from "./cart-summary";
import type { CartItemWithProduct } from "@/types/features/cart";

interface CartPanelProps {
  cartItems: CartItemWithProduct[];
  loadingCart: boolean;
  subtotal: number;
  tax: number;
  total: number;
  onRemoveItem: (itemId: string) => void;
  selectedItemId?: string | null;
  onItemSelect?: (item: CartItemWithProduct) => void;
}

export function CartPanel({
  cartItems,
  loadingCart,
  subtotal,
  tax,
  total,
  onRemoveItem,
  selectedItemId,
  onItemSelect,
}: CartPanelProps) {
  return (
    <div className="bg-white border-b-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
      <CardContent className="p-2 sm:p-3 flex-1 flex flex-col min-h-0">
        <CartItemsTable
          items={cartItems}
          loading={loadingCart}
          onRemove={onRemoveItem}
          selectedItemId={selectedItemId}
          onItemSelect={onItemSelect}
        />
        <CartSummary
          subtotal={subtotal}
          tax={tax}
          total={total}
          itemCount={cartItems.length}
          items={cartItems}
        />
      </CardContent>
    </div>
  );
}
