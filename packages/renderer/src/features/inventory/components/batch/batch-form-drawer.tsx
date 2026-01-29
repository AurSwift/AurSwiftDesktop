import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProductBatch, Supplier } from "@/types/features/batches";
import { generateBatchNumber } from "@/features/inventory/utils/expiry-calculations";
import type { Product } from "@/types/domain";
import { useBatchForm } from "@/features/inventory/hooks/use-batch-form";
import {
  AdaptiveKeyboard,
  AdaptiveFormField,
} from "@/features/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";
import type {
  BatchFormData,
  BatchUpdateData,
} from "@/features/inventory/schemas/batch-schema";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("batch-form-drawer");

interface BatchFormDrawerProps {
  isOpen: boolean;
  editingBatch: ProductBatch | null;
  product: Product | null;
  products?: Product[]; // For product selection when creating new batch
  loadingProducts?: boolean; // Show loading state while products are loading
  suppliers: Supplier[];
  businessId: string;
  onClose: () => void;
  onSave: (batch: ProductBatch) => void;
  onUpdate: (batchId: string, batch: ProductBatch) => void;
}

const BatchFormDrawer: React.FC<BatchFormDrawerProps> = ({
  isOpen,
  editingBatch,
  product: initialProduct,
  products = [],
  loadingProducts = false,
  suppliers,
  businessId,
  onClose,
  onSave,
  onUpdate,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    initialProduct || null
  );
  const [autoGenerateBatchNumber, setAutoGenerateBatchNumber] = useState(true);

  const { form, handleSubmit, isSubmitting, isEditMode } = useBatchForm({
    batch: editingBatch,
    productId: selectedProduct?.id || "",
    businessId,
    onSubmit: async (data) => {
      // Transform form data to API format
      const batchData = {
        productId:
          "productId" in data ? data.productId : editingBatch?.productId || "",
        batchNumber:
          data.batchNumber ||
          (selectedProduct && "expiryDate" in data && data.expiryDate
            ? generateBatchNumber(selectedProduct.sku, data.expiryDate)
            : ""),
        manufacturingDate:
          "manufacturingDate" in data && data.manufacturingDate
            ? new Date(data.manufacturingDate).toISOString()
            : undefined,
        expiryDate:
          "expiryDate" in data && data.expiryDate
            ? new Date(data.expiryDate).toISOString()
            : editingBatch
            ? new Date(editingBatch.expiryDate).toISOString()
            : new Date().toISOString(),
        initialQuantity: "initialQuantity" in data ? data.initialQuantity : 0,
        currentQuantity:
          isEditMode && editingBatch
            ? editingBatch.currentQuantity
            : "initialQuantity" in data
            ? data.initialQuantity
            : 0,
        supplierId:
          data.supplierId && data.supplierId !== "none"
            ? data.supplierId
            : undefined,
        purchaseOrderNumber: data.purchaseOrderNumber || undefined,
        costPrice:
          data.costPrice && data.costPrice > 0 ? data.costPrice : undefined,
        businessId,
      };

      if (isEditMode && editingBatch) {
        const response = await window.batchesAPI?.update(
          editingBatch.id,
          batchData
        );
        if (response?.success && response.batch) {
          onUpdate(editingBatch.id, response.batch);
        } else {
          throw new Error(response?.error || "Failed to update batch");
        }
      } else {
        logger.info("Creating batch with data:", batchData);
        const response = await window.batchesAPI?.create(batchData);
        logger.info("Batch API response:", response);
        if (response?.success && response.batch) {
          onSave(response.batch);
        } else {
          throw new Error(
            response?.error || response?.message || "Failed to create batch"
          );
        }
      }
    },
    onSuccess: onClose,
  });

  // Keyboard integration
  const keyboard = useKeyboardWithRHF<BatchFormData | BatchUpdateData>({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs: {
      batchNumber: { keyboardMode: "qwerty" },
      initialQuantity: { keyboardMode: "numeric" },
      purchaseOrderNumber: { keyboardMode: "qwerty" },
      costPrice: { keyboardMode: "numeric" },
    } as any, // Cast needed due to union type BatchFormData | BatchUpdateData
  });

  // Close keyboard when drawer closes
  useEffect(() => {
    if (!isOpen) {
      keyboard.handleCloseKeyboard();
    }
  }, [isOpen, keyboard]);

  // Update form when product selection changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedProduct(initialProduct || null);
      setAutoGenerateBatchNumber(true);
      return;
    }

    // When editing, set product from initialProduct (which should be looked up from editingBatch.productId)
    if (editingBatch && initialProduct) {
      setSelectedProduct(initialProduct);
    } else if (initialProduct && !editingBatch) {
      // When creating new batch
      setSelectedProduct(initialProduct);
      form.setValue("productId", initialProduct.id);
      if (initialProduct.costPrice) {
        form.setValue("costPrice", initialProduct.costPrice);
      }
    }
  }, [isOpen, initialProduct, editingBatch, form]);

  // Auto-generate batch number when expiry date or product changes
  useEffect(() => {
    if (
      !isEditMode &&
      autoGenerateBatchNumber &&
      selectedProduct &&
      form.watch("expiryDate")
    ) {
      const expiryDate = form.watch("expiryDate");
      if (expiryDate) {
        const batchNumber = generateBatchNumber(
          selectedProduct.sku,
          expiryDate
        );
        form.setValue("batchNumber", batchNumber);
      }
    }
  }, [
    autoGenerateBatchNumber,
    selectedProduct,
    form.watch("expiryDate"),
    isEditMode,
    form,
  ]);

  const handleClose = () => {
    setSelectedProduct(initialProduct || null);
    setAutoGenerateBatchNumber(true);
    onClose();
  };

  if (!businessId) {
    return null;
  }

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      direction="right"
    >
      <DrawerContent className="h-full w-[95%] sm:w-[600px] md:w-[700px] lg:w-[800px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>
            {isEditMode ? "Edit Batch" : "Create New Batch"}
          </DrawerTitle>
          <DrawerDescription>
            {isEditMode
              ? "Update the batch information below."
              : "Enter batch details to track product expiry."}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0">
          <Form {...form}>
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
            {/* Fixed Buttons Section */}
            <div className="border-b bg-background shrink-0">
              <div className="flex space-x-2 px-6 pt-4 pb-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : isEditMode
                    ? "Update Batch"
                    : "Create Batch"}
                </Button>
                <DrawerClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </DrawerClose>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
              {/* Product Selection */}
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product *</FormLabel>
                    {editingBatch ? (
                      // Read-only when editing
                      <div className="mt-1 p-3 bg-gray-50 rounded-md">
                        {selectedProduct ? (
                          <div className="flex items-center space-x-3">
                            {selectedProduct.image && (
                              <img
                                src={selectedProduct.image}
                                alt={selectedProduct.name}
                                className="w-12 h-12 rounded object-cover"
                              />
                            )}
                            <div>
                              <div className="font-medium">
                                {selectedProduct.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {selectedProduct.sku}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">
                            No product selected
                          </span>
                        )}
                      </div>
                    ) : (
                      // Product selector when creating new batch
                      <Select
                        onValueChange={(value) => {
                          const product = products.find((p) => p.id === value);
                          setSelectedProduct(product || null);
                          field.onChange(value);
                          if (product) {
                            if (product.costPrice) {
                              form.setValue("costPrice", product.costPrice);
                            }
                            // Auto-generate batch number if enabled
                            if (autoGenerateBatchNumber) {
                              const expiryDate = form.watch("expiryDate");
                              if (expiryDate) {
                                form.setValue(
                                  "batchNumber",
                                  generateBatchNumber(product.sku, expiryDate)
                                );
                              } else {
                                // Set default expiry if not set
                                const defaultExpiry = new Date();
                                defaultExpiry.setDate(
                                  defaultExpiry.getDate() + 30
                                );
                                const defaultExpiryStr = defaultExpiry
                                  .toISOString()
                                  .split("T")[0];
                                form.setValue("expiryDate", defaultExpiryStr);
                                form.setValue(
                                  "batchNumber",
                                  generateBatchNumber(
                                    product.sku,
                                    defaultExpiryStr
                                  )
                                );
                              }
                            }
                          }
                        }}
                        value={field.value || ""}
                        disabled={isSubmitting || loadingProducts}
                        onOpenChange={() => keyboard.handleCloseKeyboard()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                loadingProducts
                                  ? "Loading products..."
                                  : "Select a product"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingProducts ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground flex items-center gap-2">
                              <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                              Loading products...
                            </div>
                          ) : products.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No products available
                            </div>
                          ) : (
                            products.slice(0, 100).map((prod) => (
                              <SelectItem key={prod.id} value={prod.id}>
                                <div className="flex items-center space-x-2">
                                  {prod.image && (
                                    <img
                                      src={prod.image}
                                      alt={prod.name}
                                      className="w-6 h-6 rounded object-cover"
                                    />
                                  )}
                                  <span>{prod.name}</span>
                                  <span className="text-xs text-gray-500">
                                    ({prod.sku})
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                          {!loadingProducts && products.length > 100 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground border-t">
                              Showing first 100 of {products.length} products
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Batch Number */}
              <FormField
                control={form.control}
                name="batchNumber"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel>Batch Number</FormLabel>
                      {!isEditMode && (
                        <label className="flex items-center space-x-2 text-sm">
                          <Checkbox
                            checked={autoGenerateBatchNumber}
                            onCheckedChange={(checked) => {
                              keyboard.handleCloseKeyboard();
                              setAutoGenerateBatchNumber(checked as boolean);
                              if (checked && selectedProduct) {
                                const expiryDate = form.watch("expiryDate");
                                if (expiryDate) {
                                  form.setValue(
                                    "batchNumber",
                                    generateBatchNumber(
                                      selectedProduct.sku,
                                      expiryDate
                                    )
                                  );
                                }
                              }
                            }}
                            disabled={isSubmitting}
                          />
                          <span>Auto-generate</span>
                        </label>
                      )}
                    </div>
                    <FormControl>
                      <AdaptiveFormField
                        id="batchNumber"
                        label=""
                        value={field.value || ""}
                        placeholder="Enter batch number"
                        disabled={
                          (autoGenerateBatchNumber && !isEditMode) ||
                          isSubmitting
                        }
                        readOnly
                        onFocus={() => keyboard.handleFieldFocus("batchNumber")}
                        error={form.formState.errors.batchNumber?.message}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="manufacturingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manufacturing Date (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          disabled={isSubmitting}
                          value={field.value || ""}
                          onFocus={() => keyboard.handleCloseKeyboard()}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          disabled={isSubmitting}
                          onFocus={() => keyboard.handleCloseKeyboard()}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            // Auto-update batch number if auto-generate is enabled
                            if (
                              autoGenerateBatchNumber &&
                              selectedProduct &&
                              e.target.value
                            ) {
                              form.setValue(
                                "batchNumber",
                                generateBatchNumber(
                                  selectedProduct.sku,
                                  e.target.value
                                )
                              );
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Quantity */}
              {isEditMode ? (
                <div>
                  <FormLabel>Current Quantity</FormLabel>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    {editingBatch?.currentQuantity ?? 0} units
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Initial quantity cannot be changed after batch creation
                  </p>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="initialQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Quantity *</FormLabel>
                      <FormControl>
                        <AdaptiveFormField
                          id="initialQuantity"
                          label=""
                          value={String(field.value || "")}
                          placeholder="Enter quantity"
                          disabled={isSubmitting}
                          readOnly
                          onFocus={() =>
                            keyboard.handleFieldFocus("initialQuantity")
                          }
                          error={
                            (form.formState.errors as any).initialQuantity
                              ?.message
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {/* Supplier */}
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? "" : value)
                      }
                      value={field.value || "none"}
                      disabled={isSubmitting}
                      onOpenChange={() => keyboard.handleCloseKeyboard()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No suppliers available
                          </div>
                        ) : (
                          <>
                            <SelectItem value="none">None</SelectItem>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Purchase Order & Cost */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchaseOrderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Order # (Optional)</FormLabel>
                      <FormControl>
                        <AdaptiveFormField
                          id="purchaseOrderNumber"
                          label=""
                          value={field.value || ""}
                          placeholder="PO-12345"
                          disabled={isSubmitting}
                          readOnly
                          onFocus={() =>
                            keyboard.handleFieldFocus("purchaseOrderNumber")
                          }
                          error={
                            form.formState.errors.purchaseOrderNumber?.message
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price (Optional)</FormLabel>
                      <FormControl>
                        <AdaptiveFormField
                          id="costPrice"
                          label=""
                          value={String(field.value || "")}
                          placeholder="0.00"
                          disabled={isSubmitting}
                          readOnly
                          onFocus={() => keyboard.handleFieldFocus("costPrice")}
                          error={form.formState.errors.costPrice?.message}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Adaptive Keyboard */}
            {keyboard.showKeyboard && (
              <div className="border-t bg-background px-2 py-2 shrink-0">
                <AdaptiveKeyboard
                  visible={keyboard.showKeyboard}
                  initialMode={
                    (keyboard.activeFieldConfig as any)?.keyboardMode ||
                    "qwerty"
                  }
                  onInput={keyboard.handleInput}
                  onBackspace={keyboard.handleBackspace}
                  onClear={keyboard.handleClear}
                  onEnter={keyboard.handleCloseKeyboard}
                  onClose={keyboard.handleCloseKeyboard}
                />
              </div>
            )}
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default BatchFormDrawer;
