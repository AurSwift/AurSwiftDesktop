/**
 * Item Enquiry Modal
 * 
 * Displays detailed information about a cart item including product details,
 * pricing, batch information, and inventory status.
 */

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CartItemWithProduct } from "@/types/features/cart";
import { 
  Package, 
  DollarSign, 
  Hash, 
  Barcode, 
  Tag, 
  Calendar,
  Shield,
  Box,
  Info
} from "lucide-react";

interface ItemEnquiryModalProps {
  isOpen: boolean;
  item: CartItemWithProduct | null;
  onClose: () => void;
}

export function ItemEnquiryModal({
  isOpen,
  item,
  onClose,
}: ItemEnquiryModalProps) {
  if (!item) return null;

  const product = item.product;
  const isWeighted = item.itemType === "WEIGHT";
  const hasBatch = !!item.batchNumber || !!item.batchId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Item Enquiry
          </DialogTitle>
          <DialogDescription>
            Detailed information about {item.itemName || product?.name || "item"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Product Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Product Name</p>
                <p className="font-medium text-sm">{item.itemName || product?.name || "N/A"}</p>
              </div>
              {product?.description && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{product.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">SKU</p>
                <p className="text-sm font-mono">{product?.sku || "N/A"}</p>
              </div>
              {product?.barcode && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Barcode className="h-3 w-3" />
                    Barcode
                  </p>
                  <p className="text-sm font-mono">{product.barcode}</p>
                </div>
              )}
              {product?.plu && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">PLU</p>
                  <p className="text-sm font-mono">{product.plu}</p>
                </div>
              )}
              {product?.category && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Category
                  </p>
                  <p className="text-sm">{product.category}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Item Type</p>
                <Badge variant={isWeighted ? "default" : "secondary"}>
                  {isWeighted ? "Weighted" : "Unit"}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Quantity/Weight Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Box className="h-4 w-4" />
              Quantity / Weight
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isWeighted ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Weight</p>
                    <p className="text-sm font-medium">
                      {item.weight?.toFixed(3) || "0.000"} {item.unitOfMeasure || "kg"}
                    </p>
                  </div>
                  {item.scaleReadingWeight !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Scale Reading</p>
                      <p className="text-sm">
                        {item.scaleReadingWeight.toFixed(3)} {item.unitOfMeasure || "kg"}
                        {item.scaleReadingStable && (
                          <Badge variant="outline" className="ml-2 text-xs">Stable</Badge>
                        )}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                  <p className="text-sm font-medium">{item.quantity || 1}</p>
                </div>
              )}
              {item.unitOfMeasure && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Unit of Measure</p>
                  <p className="text-sm">{item.unitOfMeasure}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Pricing Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Unit Price</p>
                <p className="text-sm font-medium">
                  £{item.unitPrice.toFixed(2)}
                  {isWeighted && item.unitOfMeasure && (
                    <span className="text-muted-foreground text-xs ml-1">
                      / {item.unitOfMeasure}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Price</p>
                <p className="text-sm font-semibold">£{item.totalPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tax Amount</p>
                <p className="text-sm">£{item.taxAmount.toFixed(2)}</p>
              </div>
              {product?.costPrice !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cost Price</p>
                  <p className="text-sm">£{product.costPrice.toFixed(2)}</p>
                </div>
              )}
              {product?.taxRate !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tax Rate</p>
                  <p className="text-sm">{product.taxRate}%</p>
                </div>
              )}
            </div>
          </div>

          {/* Batch Information */}
          {hasBatch && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Batch Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {item.batchNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Batch Number</p>
                      <p className="text-sm font-mono">{item.batchNumber}</p>
                    </div>
                  )}
                  {item.expiryDate && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Expiry Date
                      </p>
                      <p className="text-sm">
                        {format(new Date(item.expiryDate), "PP")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Age Restriction */}
          {item.ageRestrictionLevel && item.ageRestrictionLevel !== "NONE" && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Age Restriction
                </h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Restriction Level</p>
                    <Badge variant="outline" className="capitalize">
                      {item.ageRestrictionLevel.toLowerCase().replace("_", " ")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Age Verified</p>
                    <Badge variant={item.ageVerified ? "default" : "destructive"}>
                      {item.ageVerified ? "Verified" : "Not Verified"}
                    </Badge>
                  </div>
                  {product?.restrictionReason && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Reason</p>
                      <p className="text-sm">{product.restrictionReason}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Inventory Information */}
          {product?.trackInventory && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  Inventory
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {product.stockLevel !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Stock Level</p>
                      <p className="text-sm font-medium">{product.stockLevel}</p>
                    </div>
                  )}
                  {product.minStockLevel !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Minimum Stock</p>
                      <p className="text-sm">{product.minStockLevel}</p>
                    </div>
                  )}
                  {product.reorderPoint !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Reorder Point</p>
                      <p className="text-sm">{product.reorderPoint}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Timestamps */}
          <Separator />
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timestamps
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Added to Cart</p>
                <p className="text-sm">
                  {format(new Date(item.addedAt), "PPp")}
                </p>
              </div>
              {item.updatedAt && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
                  <p className="text-sm">
                    {format(new Date(item.updatedAt), "PPp")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


