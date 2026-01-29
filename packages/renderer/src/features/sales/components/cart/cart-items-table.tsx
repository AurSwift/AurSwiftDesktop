/**
 * Cart items table component
 */

import { AnimatePresence } from "@/components/animate-presence";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { CartItemRow } from "./cart-item-row";
import type { CartItemWithProduct } from "@/types/features/cart";

interface CartItemsTableProps {
  items: CartItemWithProduct[];
  loading: boolean;
  onRemove: (itemId: string) => void;
  selectedItemId?: string | null;
  onItemSelect?: (item: CartItemWithProduct) => void;
}

export function CartItemsTable({
  items,
  loading,
  onRemove: _onRemove,
  selectedItemId,
  onItemSelect,
}: CartItemsTableProps) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
      <div className="shrink-0">
        <Table>
          <TableHeader className="bg-slate-700">
            <TableRow className="h-8 sm:h-10 border-b-0">
              <TableHead
                className="text-center font-semibold text-white h-8 sm:h-10 text-xs sm:text-sm"
                style={{ width: "100px" }}
              >
                Unit/Weight
              </TableHead>
              <TableHead className="text-left font-semibold text-white h-8 sm:h-10 text-xs sm:text-sm">
                Product
              </TableHead>
              <TableHead
                className="text-center font-semibold text-white h-8 sm:h-10 text-xs sm:text-sm"
                style={{ width: "120px" }}
              >
                Price
              </TableHead>
              <TableHead
                className="text-center font-semibold text-white h-8 sm:h-10 text-xs sm:text-sm"
                style={{ width: "100px" }}
              >
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <Table>
          <TableBody>
            <AnimatePresence as="fragment">
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-slate-400 text-center py-6 sm:py-8 text-xs sm:text-sm"
                  >
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mx-auto mb-2" />
                    Loading cart...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-slate-400 text-center py-6 sm:py-8 text-xs sm:text-sm"
                  >
                    No items in Basket. Scan or search for products.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    isSelected={selectedItemId === item.id}
                    onSelect={
                      onItemSelect ? () => onItemSelect(item) : undefined
                    }
                  />
                ))
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
