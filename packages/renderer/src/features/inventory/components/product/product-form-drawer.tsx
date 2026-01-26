import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveTextarea } from "@/features/adaptive-keyboard/adaptive-textarea";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import type { KeyboardMode } from "@/features/adaptive-keyboard/keyboard-layouts";
import { useKeyboardWithRHF } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageIcon, Upload } from "lucide-react";
import type { Product } from "@/types/domain";
import type {
  Category,
  VatCategory,
} from "@/features/inventory/hooks/use-product-data";
import { useProductForm } from "@/features/inventory/hooks/use-product-form";
import { useSalesUnitSettings } from "@/shared/hooks/use-sales-unit-settings";
import { SALES_UNIT_OPTIONS } from "@/types/domain/sales-unit";

interface ProductFormDrawerProps {
  isOpen: boolean;
  editingProduct: Product | null;
  categories: Category[];
  vatCategories: VatCategory[];
  businessId: string;
  onClose: () => void;
  onSave: (product: Product) => void;
  onUpdate: (productId: string, product: Product) => void;
}

const ProductFormDrawer: React.FC<ProductFormDrawerProps> = ({
  isOpen,
  editingProduct,
  categories = [],
  vatCategories = [],
  businessId,
  onClose,
  onSave,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<string>("basic");
  const salesUnitSettings = useSalesUnitSettings(businessId);

  const { form, handleSubmit, isSubmitting, isEditMode } = useProductForm({
    product: editingProduct,
    categories,
    vatCategories,
    businessId,
    onSubmit: async (data) => {
      // Transform form data to API format
      // If sales unit mode is Fixed, use the fixed unit from settings
      const effectiveSalesUnit =
        salesUnitSettings.mode === "Fixed"
          ? salesUnitSettings.fixedUnit
          : data.salesUnit || "PIECE";

      const productData = {
        name: data.name.trim(),
        description: (data.description || "").trim() || undefined,
        basePrice: data.basePrice,
        costPrice: data.costPrice || 0,
        sku: data.sku.trim(),
        barcode: (data.barcode || "").trim() || undefined,
        plu: (data.plu || "").trim() || undefined,
        image: (data.image || "").trim() || undefined,
        categoryId: data.categoryId,
        productType: data.productType || "STANDARD",
        salesUnit: effectiveSalesUnit,
        usesScale: data.usesScale || false,
        pricePerKg:
          data.usesScale && data.pricePerKg && data.pricePerKg > 0
            ? data.pricePerKg
            : undefined,
        isGenericButton: data.isGenericButton || false,
        genericDefaultPrice:
          data.isGenericButton &&
          data.genericDefaultPrice &&
          data.genericDefaultPrice > 0
            ? data.genericDefaultPrice
            : undefined,
        trackInventory:
          data.trackInventory !== undefined ? data.trackInventory : true,
        stockLevel: data.stockLevel || 0,
        minStockLevel: data.minStockLevel || 0,
        reorderPoint: data.reorderPoint || 0,
        vatCategoryId:
          data.vatCategoryId && data.vatCategoryId !== ""
            ? data.vatCategoryId
            : undefined,
        vatOverridePercent:
          data.vatOverridePercent && data.vatOverridePercent > 0
            ? data.vatOverridePercent
            : undefined,
        businessId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        allowPriceOverride: data.allowPriceOverride || false,
        allowDiscount:
          data.allowDiscount !== undefined ? data.allowDiscount : true,
        modifiers: data.modifiers || [],
        // Expiry tracking fields
        hasExpiry: data.hasExpiry || false,
        shelfLifeDays:
          data.hasExpiry && data.shelfLifeDays && data.shelfLifeDays > 0
            ? data.shelfLifeDays
            : undefined,
        requiresBatchTracking: data.requiresBatchTracking || false,
        stockRotationMethod: data.requiresBatchTracking
          ? data.stockRotationMethod
          : undefined,
        // Age restriction fields
        ageRestrictionLevel: data.ageRestrictionLevel || "NONE",
        requireIdScan: data.requireIdScan || false,
        restrictionReason:
          data.ageRestrictionLevel !== "NONE" && data.restrictionReason
            ? data.restrictionReason.trim()
            : undefined,
      };

      if (isEditMode && editingProduct) {
        const response = await window.productAPI.update(
          editingProduct.id,
          productData
        );
        if (response.success && response.product) {
          onUpdate(editingProduct.id, response.product);
        } else {
          const errorMsg = response.message || "Failed to update product";
          const lowerErrorMsg = errorMsg.toLowerCase();

          if (
            (lowerErrorMsg.includes("sku") &&
              lowerErrorMsg.includes("already exists")) ||
            lowerErrorMsg.includes("unique constraint failed: products.sku")
          ) {
            form.setError("sku", {
              type: "manual",
              message: "This SKU already exists. Please use a different SKU.",
            });
            setActiveTab("basic");
            throw new Error("SKU already exists");
          } else if (
            (lowerErrorMsg.includes("plu") &&
              lowerErrorMsg.includes("already exists")) ||
            lowerErrorMsg.includes("unique constraint failed: products.plu")
          ) {
            form.setError("plu", {
              type: "manual",
              message:
                "This PLU code already exists. Please use a different PLU.",
            });
            setActiveTab("basic");
            throw new Error("PLU code already exists");
          } else {
            throw new Error(errorMsg);
          }
        }
      } else {
        const response = await window.productAPI.create(productData);
        if (response.success && response.product) {
          onSave(response.product);
        } else {
          const errorMsg = response.message || "Failed to create product";
          const lowerErrorMsg = errorMsg.toLowerCase();

          if (
            (lowerErrorMsg.includes("sku") &&
              lowerErrorMsg.includes("already exists")) ||
            lowerErrorMsg.includes("unique constraint failed: products.sku")
          ) {
            form.setError("sku", {
              type: "manual",
              message: "This SKU already exists. Please use a different SKU.",
            });
            setActiveTab("basic");
            throw new Error("SKU already exists");
          } else if (
            (lowerErrorMsg.includes("plu") &&
              lowerErrorMsg.includes("already exists")) ||
            lowerErrorMsg.includes("unique constraint failed: products.plu")
          ) {
            form.setError("plu", {
              type: "manual",
              message:
                "This PLU code already exists. Please use a different PLU.",
            });
            setActiveTab("basic");
            throw new Error("PLU code already exists");
          } else {
            throw new Error(errorMsg);
          }
        }
      }
    },
    onSuccess: onClose,
  });

  // Update sales unit when fixed mode is enabled or when switch is turned on
  const usesScale = form.watch("usesScale");
  const setSalesUnit = form.setValue;
  useEffect(() => {
    if (
      salesUnitSettings.mode === "Fixed" &&
      !salesUnitSettings.isLoading &&
      usesScale
    ) {
      // Set the sales unit to the fixed unit from settings
      setSalesUnit("salesUnit", salesUnitSettings.fixedUnit, {
        shouldValidate: false,
      });
    }
  }, [
    salesUnitSettings.mode,
    salesUnitSettings.fixedUnit,
    salesUnitSettings.isLoading,
    usesScale,
    setSalesUnit,
  ]);

  // Helper function to format sales unit for display
  const formatSalesUnitForDisplay = (unit: string): string => {
    const unitOption = SALES_UNIT_OPTIONS.find((opt) => opt.value === unit);
    return unitOption ? unitOption.label : unit;
  };

  // Keyboard integration hook
  const keyboard = useKeyboardWithRHF({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs: {
      // Text fields
      name: { keyboardMode: "qwerty" },
      description: { keyboardMode: "qwerty" },
      sku: { keyboardMode: "qwerty" },
      plu: { keyboardMode: "qwerty" },
      barcode: { keyboardMode: "qwerty" },
      restrictionReason: { keyboardMode: "qwerty" },
      // Numeric fields
      basePrice: { keyboardMode: "numeric" },
      costPrice: { keyboardMode: "numeric" },
      pricePerKg: { keyboardMode: "numeric" },
      genericDefaultPrice: { keyboardMode: "numeric" },
      stockLevel: { keyboardMode: "numeric" },
      minStockLevel: { keyboardMode: "numeric" },
      reorderPoint: { keyboardMode: "numeric" },
      vatOverridePercent: { keyboardMode: "numeric" },
      shelfLifeDays: { keyboardMode: "numeric" },
    },
  });

  // Close keyboard when drawer closes
  useEffect(() => {
    if (!isOpen) {
      keyboard.handleCloseKeyboard();
    }
  }, [isOpen, keyboard]);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          form.setValue("image", e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    [form]
  );

  const handleClose = () => {
    keyboard.handleCloseKeyboard();
    setActiveTab("basic");
    onClose();
  };

  // Safety check - don't render if businessId is missing
  if (!businessId) {
    return null;
  }

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      direction="right"
    >
      <DrawerContent className="h-full w-[95%] sm:w-[900px] md:w-[1000px] lg:w-[1200px] xl:w-[1400px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>
            {editingProduct ? "Edit Product" : "Add New Product"}
          </DrawerTitle>
          <DrawerDescription>
            {editingProduct
              ? "Update the product information below."
              : "Fill in the details to create a new menu item."}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0">
          <Form {...form}>
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              {/* Fixed Tabs and Buttons Section */}
              <div className="border-b bg-background flex-shrink-0">
                <div className="px-6 pt-4">
                  <TabsList className="flex w-full gap-1 h-auto py-1.5 overflow-x-auto">
                    <TabsTrigger
                      value="basic"
                      className="flex-1 min-w-[80px] !whitespace-nowrap px-3 py-2 text-xs sm:text-sm"
                    >
                      Basic Info
                    </TabsTrigger>
                    <TabsTrigger
                      value="pricing"
                      className="flex-1 min-w-[100px] !whitespace-nowrap px-3 py-2 text-xs sm:text-sm"
                    >
                      Pricing & Stock
                    </TabsTrigger>
                    <TabsTrigger
                      value="expiry"
                      className="flex-1 min-w-[80px] !whitespace-nowrap px-3 py-2 text-xs sm:text-sm"
                    >
                      Expiry
                    </TabsTrigger>
                    <TabsTrigger
                      value="age-restriction"
                      className="flex-1 min-w-[80px] !whitespace-nowrap px-3 py-2 text-xs sm:text-sm"
                    >
                      Age
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Buttons visible on all tabs */}
                <div className="flex space-x-2 px-6 pt-4 pb-4 border-b">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Saving..."
                      : isEditMode
                      ? "Update Product"
                      : "Add Product"}
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
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-6">
                  <TabsContent value="basic" className="space-y-4 mt-0">
                    {/* Image Upload */}
                    <FormField
                      control={form.control}
                      name="image"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex flex-col items-center space-y-4">
                            <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                              {field.value ? (
                                <img
                                  src={field.value}
                                  alt="Product"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-12 h-12 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <FormLabel
                                htmlFor="image"
                                className="cursor-pointer"
                              >
                                <div className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md transition-colors">
                                  <Upload className="w-4 h-4" />
                                  <span className="text-sm">Upload Image</span>
                                </div>
                              </FormLabel>
                              <Input
                                id="image"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                                disabled={isSubmitting}
                              />
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={() => (
                          <FormItem className="col-span-2">
                            <FormControl>
                              <AdaptiveFormField
                                {...form.register("name")}
                                label="Product Name *"
                                value={keyboard.formValues.name || ""}
                                error={form.formState.errors.name?.message}
                                onFocus={() =>
                                  keyboard.handleFieldFocus("name")
                                }
                                placeholder="Enter product name"
                                disabled={isSubmitting}
                                className={cn(
                                  keyboard.activeField === "name" &&
                                    "ring-2 ring-primary border-primary"
                                )}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={() => (
                          <FormItem className="col-span-2">
                            <FormControl>
                              <AdaptiveTextarea
                                {...form.register("description")}
                                label="Description"
                                value={keyboard.formValues.description || ""}
                                error={
                                  form.formState.errors.description?.message
                                }
                                onFocus={() =>
                                  keyboard.handleFieldFocus("description")
                                }
                                placeholder="Enter product description"
                                disabled={isSubmitting}
                                className={cn(
                                  keyboard.activeField === "description" &&
                                    "ring-2 ring-primary border-primary"
                                )}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category *</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ""}
                              disabled={
                                !categories ||
                                categories.length === 0 ||
                                isSubmitting
                              }
                              onOpenChange={() =>
                                keyboard.handleCloseKeyboard()
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={
                                      !categories || categories.length === 0
                                        ? "No categories available"
                                        : "Select a category"
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {!categories || categories.length === 0 ? (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No categories found - please add a category
                                    first
                                  </div>
                                ) : (
                                  categories.map((category) => (
                                    <SelectItem
                                      key={category.id}
                                      value={category.id}
                                    >
                                      {category.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sku"
                        render={() => (
                          <FormItem>
                            <FormControl>
                              <AdaptiveFormField
                                {...form.register("sku")}
                                label="SKU *"
                                value={keyboard.formValues.sku || ""}
                                error={form.formState.errors.sku?.message}
                                onFocus={() => keyboard.handleFieldFocus("sku")}
                                placeholder="Enter SKU"
                                disabled={isSubmitting}
                                className={cn(
                                  keyboard.activeField === "sku" &&
                                    "ring-2 ring-primary border-primary"
                                )}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="plu"
                        render={() => (
                          <FormItem className="col-span-2">
                            <FormControl>
                              <AdaptiveFormField
                                {...form.register("plu")}
                                label="PLU Code (Optional)"
                                value={keyboard.formValues.plu || ""}
                                error={form.formState.errors.plu?.message}
                                onFocus={() => keyboard.handleFieldFocus("plu")}
                                placeholder="Enter PLU code"
                                disabled={isSubmitting}
                                className={cn(
                                  keyboard.activeField === "plu" &&
                                    "ring-2 ring-primary border-primary"
                                )}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="pricing" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      {!form.watch("usesScale") && (
                        <FormField
                          control={form.control}
                          name="basePrice"
                          render={() => (
                            <FormItem>
                              <FormControl>
                                <AdaptiveFormField
                                  {...form.register("basePrice")}
                                  label="Sale Price *"
                                  value={
                                    keyboard.formValues.basePrice?.toString() ||
                                    ""
                                  }
                                  error={
                                    form.formState.errors.basePrice?.message
                                  }
                                  onFocus={() =>
                                    keyboard.handleFieldFocus("basePrice")
                                  }
                                  placeholder="0.00"
                                  disabled={isSubmitting}
                                  className={cn(
                                    keyboard.activeField === "basePrice" &&
                                      "ring-2 ring-primary border-primary"
                                  )}
                                  readOnly
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="costPrice"
                        render={() => (
                          <FormItem>
                            <FormControl>
                              <AdaptiveFormField
                                {...form.register("costPrice")}
                                label="Cost Price *"
                                value={
                                  keyboard.formValues.costPrice?.toString() ||
                                  ""
                                }
                                error={form.formState.errors.costPrice?.message}
                                onFocus={() =>
                                  keyboard.handleFieldFocus("costPrice")
                                }
                                placeholder="0.00"
                                disabled={isSubmitting}
                                className={cn(
                                  keyboard.activeField === "costPrice" &&
                                    "ring-2 ring-primary border-primary"
                                )}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="barcode"
                        render={() => (
                          <FormItem>
                            <FormControl>
                              <AdaptiveFormField
                                {...form.register("barcode")}
                                label="Barcode (Optional)"
                                value={keyboard.formValues.barcode || ""}
                                error={form.formState.errors.barcode?.message}
                                onFocus={() =>
                                  keyboard.handleFieldFocus("barcode")
                                }
                                placeholder="Enter barcode"
                                disabled={isSubmitting}
                                className={cn(
                                  keyboard.activeField === "barcode" &&
                                    "ring-2 ring-primary border-primary"
                                )}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div>
                        <FormLabel>Profit Margin</FormLabel>
                        <div className="mt-1 p-2 bg-gray-50 rounded text-sm">
                          {form.watch("basePrice") > 0 &&
                          form.watch("costPrice") > 0
                            ? `${(
                                ((form.watch("basePrice") -
                                  form.watch("costPrice")) /
                                  form.watch("basePrice")) *
                                100
                              ).toFixed(1)}%`
                            : "N/A"}
                        </div>
                      </div>
                    </div>

                    {/* Weight-based Product Configuration */}
                    <div className="border-t pt-4">
                      <h4 className="text-lg font-medium mb-4">
                        Product Type & Weight Configuration
                      </h4>

                      <FormField
                        control={form.control}
                        name="productType"
                        render={({ field }) => (
                          <FormItem className="mb-4">
                            <FormLabel>Product Type</FormLabel>
                            <Select
                              onValueChange={(
                                value: "STANDARD" | "WEIGHTED" | "GENERIC"
                              ) => {
                                field.onChange(value);
                                form.setValue(
                                  "usesScale",
                                  value === "WEIGHTED"
                                );
                              }}
                              value={field.value}
                              disabled={isSubmitting}
                              onOpenChange={() =>
                                keyboard.handleCloseKeyboard()
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="STANDARD">
                                  Standard Product
                                </SelectItem>
                                <SelectItem value="WEIGHTED">
                                  Weighted Product
                                </SelectItem>
                                <SelectItem value="GENERIC">
                                  Generic Button
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="usesScale"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 mb-4">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  keyboard.handleCloseKeyboard();
                                  field.onChange(checked);
                                  form.setValue(
                                    "productType",
                                    checked ? "WEIGHTED" : "STANDARD"
                                  );
                                  if (checked) {
                                    // When enabling weighted mode, copy basePrice to pricePerKg if pricePerKg is empty
                                    const currentPricePerKg =
                                      form.getValues("pricePerKg");
                                    if (
                                      !currentPricePerKg ||
                                      currentPricePerKg === 0
                                    ) {
                                      form.setValue(
                                        "pricePerKg",
                                        form.getValues("basePrice") || 0
                                      );
                                    }
                                    // Keep basePrice as fallback (required by schema)
                                    // It will be hidden from UI but still stored
                                  } else {
                                    // When disabling weighted mode, clear pricePerKg
                                    form.setValue("pricePerKg", 0);
                                  }
                                }}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormLabel>Sold by Weight (Uses Scale)</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="usesScale"
                        render={({ field }) => (
                          <FormItem>
                            {field.value && (
                              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                                <FormField
                                  control={form.control}
                                  name="salesUnit"
                                  render={({ field: salesUnitField }) => {
                                    const isFixedMode =
                                      salesUnitSettings.mode === "Fixed" &&
                                      !salesUnitSettings.isLoading;
                                    const displayUnit = isFixedMode
                                      ? salesUnitSettings.fixedUnit
                                      : salesUnitField.value || "PIECE";

                                    // Show loading state while settings are being fetched
                                    if (salesUnitSettings.isLoading) {
                                      return (
                                        <FormItem>
                                          <FormLabel>Sales Unit</FormLabel>
                                          <FormControl>
                                            <div className="flex items-center h-10 px-3 py-2 text-sm bg-muted rounded-md border border-input">
                                              <span className="text-muted-foreground">
                                                Loading settings...
                                              </span>
                                            </div>
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      );
                                    }

                                    return (
                                      <FormItem>
                                        <FormLabel>Sales Unit</FormLabel>
                                        {isFixedMode ? (
                                          <>
                                            <FormControl>
                                              <div className="flex items-center h-10 px-3 py-2 text-sm bg-muted rounded-md border border-input">
                                                <span className="text-muted-foreground">
                                                  This product will be measured
                                                  in{" "}
                                                  <span className="font-semibold text-foreground">
                                                    {formatSalesUnitForDisplay(
                                                      displayUnit
                                                    )}
                                                  </span>
                                                </span>
                                                {/* Hidden input to maintain form state */}
                                                <input
                                                  type="hidden"
                                                  {...salesUnitField}
                                                  value={displayUnit}
                                                />
                                              </div>
                                            </FormControl>
                                            <p className="text-xs text-muted-foreground">
                                              Sales unit is fixed system-wide.
                                              To change this, update the General
                                              Settings.
                                            </p>
                                            <FormMessage />
                                          </>
                                        ) : (
                                          <>
                                            <Select
                                              onValueChange={
                                                salesUnitField.onChange
                                              }
                                              value={displayUnit}
                                              disabled={isSubmitting}
                                              onOpenChange={() =>
                                                keyboard.handleCloseKeyboard()
                                              }
                                            >
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select unit" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                {SALES_UNIT_OPTIONS.map(
                                                  (option) => (
                                                    <SelectItem
                                                      key={option.value}
                                                      value={option.value}
                                                    >
                                                      {option.label}
                                                    </SelectItem>
                                                  )
                                                )}
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </>
                                        )}
                                      </FormItem>
                                    );
                                  }}
                                />

                                <FormField
                                  control={form.control}
                                  name="pricePerKg"
                                  render={() => (
                                    <FormItem>
                                      <FormControl>
                                        <AdaptiveFormField
                                          {...form.register("pricePerKg")}
                                          label={`Price per ${
                                            salesUnitSettings.mode ===
                                              "Fixed" &&
                                            !salesUnitSettings.isLoading
                                              ? formatSalesUnitForDisplay(
                                                  salesUnitSettings.fixedUnit
                                                )
                                              : formatSalesUnitForDisplay(
                                                  form.watch("salesUnit") ||
                                                    "KG"
                                                )
                                          }`}
                                          value={
                                            keyboard.formValues.pricePerKg?.toString() ||
                                            ""
                                          }
                                          error={
                                            form.formState.errors.pricePerKg
                                              ?.message
                                          }
                                          onFocus={() =>
                                            keyboard.handleFieldFocus(
                                              "pricePerKg"
                                            )
                                          }
                                          placeholder="0.00"
                                          disabled={isSubmitting}
                                          className={cn(
                                            keyboard.activeField ===
                                              "pricePerKg" &&
                                              "ring-2 ring-primary border-primary"
                                          )}
                                          readOnly
                                        />
                                      </FormControl>
                                      <FormMessage />
                                      <p className="text-xs text-gray-500 mt-1">
                                        This will be multiplied by the weight
                                        during checkout
                                      </p>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </FormItem>
                        )}
                      />

                      {form.watch("productType") === "GENERIC" && (
                        <FormField
                          control={form.control}
                          name="genericDefaultPrice"
                          render={() => (
                            <FormItem>
                              <div className="p-4 bg-purple-50 rounded-lg">
                                <FormControl>
                                  <AdaptiveFormField
                                    {...form.register("genericDefaultPrice")}
                                    label="Default Price"
                                    value={
                                      keyboard.formValues.genericDefaultPrice?.toString() ||
                                      ""
                                    }
                                    error={
                                      form.formState.errors.genericDefaultPrice
                                        ?.message
                                    }
                                    onFocus={() =>
                                      keyboard.handleFieldFocus(
                                        "genericDefaultPrice"
                                      )
                                    }
                                    placeholder="0.00"
                                    disabled={isSubmitting}
                                    className={cn(
                                      keyboard.activeField ===
                                        "genericDefaultPrice" &&
                                        "ring-2 ring-primary border-primary"
                                    )}
                                    readOnly
                                  />
                                </FormControl>
                                <FormMessage />
                                <p className="text-xs text-gray-500 mt-1">
                                  Suggested price for generic items
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="stockLevel"
                        render={() => (
                          <FormItem>
                            <FormControl>
                              <AdaptiveFormField
                                {...form.register("stockLevel")}
                                label="Current Stock"
                                value={
                                  keyboard.formValues.stockLevel?.toString() ||
                                  ""
                                }
                                error={
                                  form.formState.errors.stockLevel?.message
                                }
                                onFocus={() =>
                                  keyboard.handleFieldFocus("stockLevel")
                                }
                                placeholder="0"
                                disabled={isSubmitting}
                                className={cn(
                                  keyboard.activeField === "stockLevel" &&
                                    "ring-2 ring-primary border-primary"
                                )}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="minStockLevel"
                        render={() => (
                          <FormItem>
                            <FormControl>
                              <AdaptiveFormField
                                {...form.register("minStockLevel")}
                                label="Minimum Stock Level"
                                value={
                                  keyboard.formValues.minStockLevel?.toString() ||
                                  ""
                                }
                                error={
                                  form.formState.errors.minStockLevel?.message
                                }
                                onFocus={() =>
                                  keyboard.handleFieldFocus("minStockLevel")
                                }
                                placeholder="5"
                                disabled={isSubmitting}
                                className={cn(
                                  keyboard.activeField === "minStockLevel" &&
                                    "ring-2 ring-primary border-primary"
                                )}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reorderPoint"
                        render={() => (
                          <FormItem>
                            <FormControl>
                              <AdaptiveFormField
                                {...form.register("reorderPoint")}
                                label="Reorder Point"
                                value={
                                  keyboard.formValues.reorderPoint?.toString() ||
                                  ""
                                }
                                error={
                                  form.formState.errors.reorderPoint?.message
                                }
                                onFocus={() =>
                                  keyboard.handleFieldFocus("reorderPoint")
                                }
                                placeholder="0"
                                disabled={isSubmitting}
                                className={cn(
                                  keyboard.activeField === "reorderPoint" &&
                                    "ring-2 ring-primary border-primary"
                                )}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-1">
                              Stock level at which to reorder
                            </p>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* VAT Configuration */}
                    <div className="border-t pt-4">
                      <h4 className="text-lg font-medium mb-4">
                        VAT Configuration
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="vatCategoryId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>VAT Category</FormLabel>
                              <Select
                                onValueChange={(value) =>
                                  field.onChange(value === "none" ? "" : value)
                                }
                                value={field.value || "none"}
                                disabled={isSubmitting}
                                onOpenChange={() =>
                                  keyboard.handleCloseKeyboard()
                                }
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="None (Use Category Default)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">
                                    None (Use Category Default)
                                  </SelectItem>
                                  {vatCategories && vatCategories.length > 0
                                    ? vatCategories.map((vat) => (
                                        <SelectItem key={vat.id} value={vat.id}>
                                          {vat.name} ({vat.ratePercent}%)
                                        </SelectItem>
                                      ))
                                    : null}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="vatOverridePercent"
                          render={() => (
                            <FormItem>
                              <FormControl>
                                <AdaptiveFormField
                                  {...form.register("vatOverridePercent")}
                                  label="VAT Override (%)"
                                  value={
                                    keyboard.formValues.vatOverridePercent?.toString() ||
                                    ""
                                  }
                                  error={
                                    form.formState.errors.vatOverridePercent
                                      ?.message
                                  }
                                  onFocus={() =>
                                    keyboard.handleFieldFocus(
                                      "vatOverridePercent"
                                    )
                                  }
                                  placeholder="Override VAT percent"
                                  disabled={isSubmitting}
                                  className={cn(
                                    keyboard.activeField ===
                                      "vatOverridePercent" &&
                                      "ring-2 ring-primary border-primary"
                                  )}
                                  readOnly
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-gray-500 mt-1">
                                Override VAT rate for this product
                              </p>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Product Settings */}
                    <div className="border-t pt-4">
                      <h4 className="text-lg font-medium mb-4">
                        Product Settings
                      </h4>
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name="trackInventory"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Track Inventory
                                </FormLabel>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    keyboard.handleCloseKeyboard();
                                    field.onChange(checked);
                                  }}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="allowPriceOverride"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Allow Price Override
                                </FormLabel>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    keyboard.handleCloseKeyboard();
                                    field.onChange(checked);
                                  }}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="allowDiscount"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Allow Discount
                                </FormLabel>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    keyboard.handleCloseKeyboard();
                                    field.onChange(checked);
                                  }}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Active
                                </FormLabel>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    keyboard.handleCloseKeyboard();
                                    field.onChange(checked);
                                  }}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="expiry" className="space-y-4 mt-0">
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-lg font-medium mb-4">
                          Expiry Tracking Settings
                        </h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Configure batch tracking and expiry date management
                          for this product.
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name="hasExpiry"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Product Has Expiry Date
                              </FormLabel>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  keyboard.handleCloseKeyboard();
                                  field.onChange(checked);
                                  if (!checked) {
                                    form.setValue(
                                      "requiresBatchTracking",
                                      false
                                    );
                                  }
                                }}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {form.watch("hasExpiry") && (
                        <>
                          <FormField
                            control={form.control}
                            name="shelfLifeDays"
                            render={() => (
                              <FormItem>
                                <FormControl>
                                  <AdaptiveFormField
                                    {...form.register("shelfLifeDays")}
                                    label="Expected Shelf Life (Days)"
                                    value={
                                      keyboard.formValues.shelfLifeDays?.toString() ||
                                      ""
                                    }
                                    error={
                                      form.formState.errors.shelfLifeDays
                                        ?.message
                                    }
                                    onFocus={() =>
                                      keyboard.handleFieldFocus("shelfLifeDays")
                                    }
                                    placeholder="e.g., 30"
                                    disabled={isSubmitting}
                                    className={cn(
                                      keyboard.activeField ===
                                        "shelfLifeDays" &&
                                        "ring-2 ring-primary border-primary"
                                    )}
                                    readOnly
                                  />
                                </FormControl>
                                <FormMessage />
                                <p className="text-xs text-gray-500 mt-1">
                                  Expected number of days before product expires
                                </p>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="requiresBatchTracking"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Require Batch/Lot Tracking
                                  </FormLabel>
                                  <p className="text-xs text-gray-500">
                                    When enabled, stock must be tracked by batch
                                    numbers with expiry dates
                                  </p>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={(checked) => {
                                      keyboard.handleCloseKeyboard();
                                      field.onChange(checked);
                                    }}
                                    disabled={isSubmitting}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {form.watch("requiresBatchTracking") && (
                            <FormField
                              control={form.control}
                              name="stockRotationMethod"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Stock Rotation Method</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value || "FIFO"}
                                    disabled={isSubmitting}
                                    onOpenChange={() =>
                                      keyboard.handleCloseKeyboard()
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="FEFO">
                                        FEFO (First Expiry, First Out) -
                                        Recommended
                                      </SelectItem>
                                      <SelectItem value="FIFO">
                                        FIFO (First In, First Out)
                                      </SelectItem>
                                      <SelectItem value="NONE">
                                        No Automatic Rotation
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                  <p className="text-xs text-gray-500 mt-1">
                                    FEFO automatically sells items with the
                                    earliest expiry date first
                                  </p>
                                </FormItem>
                              )}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="age-restriction"
                    className="space-y-4 mt-0"
                  >
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-lg font-medium mb-4">
                          Age Verification Settings
                        </h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Configure age restrictions for this product.
                          Age-restricted items require verification at checkout.
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name="ageRestrictionLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Age Requirement</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                if (value === "NONE") {
                                  form.setValue("requireIdScan", false);
                                  form.setValue("restrictionReason", "");
                                }
                              }}
                              value={field.value || "NONE"}
                              disabled={isSubmitting}
                              onOpenChange={() =>
                                keyboard.handleCloseKeyboard()
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="NONE">
                                  No Restriction
                                </SelectItem>
                                <SelectItem value="AGE_16">
                                  16+ (Age 16 and above)
                                </SelectItem>
                                <SelectItem value="AGE_18">
                                  18+ (Age 18 and above)
                                </SelectItem>
                                <SelectItem value="AGE_21">
                                  21+ (Age 21 and above)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-1">
                              Select the minimum age required to purchase this
                              product
                            </p>
                          </FormItem>
                        )}
                      />

                      {form.watch("ageRestrictionLevel") !== "NONE" && (
                        <>
                          <FormField
                            control={form.control}
                            name="restrictionReason"
                            render={() => (
                              <FormItem>
                                <FormControl>
                                  <AdaptiveFormField
                                    {...form.register("restrictionReason")}
                                    label="Restriction Reason"
                                    value={
                                      keyboard.formValues.restrictionReason ||
                                      ""
                                    }
                                    error={
                                      form.formState.errors.restrictionReason
                                        ?.message
                                    }
                                    onFocus={() =>
                                      keyboard.handleFieldFocus(
                                        "restrictionReason"
                                      )
                                    }
                                    placeholder="e.g., Alcoholic beverage, Tobacco product..."
                                    disabled={isSubmitting}
                                    className={cn(
                                      keyboard.activeField ===
                                        "restrictionReason" &&
                                        "ring-2 ring-primary border-primary"
                                    )}
                                    readOnly
                                  />
                                </FormControl>
                                <FormMessage />
                                <p className="text-xs text-gray-500 mt-1">
                                  Brief reason for the age restriction (for
                                  reporting and compliance)
                                </p>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="requireIdScan"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Require ID Scan for Verification
                                  </FormLabel>
                                  <p className="text-xs text-gray-500">
                                    When enabled, staff must scan a valid ID for
                                    verification. If disabled, manual date entry
                                    is allowed.
                                  </p>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={(checked) => {
                                      keyboard.handleCloseKeyboard();
                                      field.onChange(checked);
                                    }}
                                    disabled={isSubmitting}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <div className="text-orange-600 text-lg">⚠️</div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-orange-900 mb-1">
                                  Age Verification Required
                                </p>
                                <p className="text-xs text-orange-700">
                                  This product will require age verification at
                                  checkout. Staff must verify the customer's age
                                  before completing the sale.
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </div>
            </Tabs>

            {/* Adaptive Keyboard */}
            {keyboard.showKeyboard && (
              <div className="border-t bg-background px-2 py-2 shrink-0">
                <div className="max-w-full overflow-hidden">
                  <AdaptiveKeyboard
                    onInput={keyboard.handleInput}
                    onBackspace={keyboard.handleBackspace}
                    onClear={keyboard.handleClear}
                    onEnter={() => {
                      // Just close keyboard on enter, don't submit
                      keyboard.handleCloseKeyboard();
                    }}
                    initialMode={
                      keyboard.activeFieldConfig &&
                      typeof keyboard.activeFieldConfig === "object" &&
                      keyboard.activeFieldConfig !== null &&
                      "keyboardMode" in keyboard.activeFieldConfig
                        ? (
                            keyboard.activeFieldConfig as {
                              keyboardMode?: KeyboardMode;
                            }
                          ).keyboardMode ?? "qwerty"
                        : "qwerty"
                    }
                    visible={keyboard.showKeyboard}
                    onClose={keyboard.handleCloseKeyboard}
                  />
                </div>
              </div>
            )}
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ProductFormDrawer;
