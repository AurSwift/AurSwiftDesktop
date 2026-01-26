/**
 * Category Form Drawer Component
 *
 * Form drawer for creating and editing categories using React Hook Form.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveTextarea } from "@/features/adaptive-keyboard/adaptive-textarea";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
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
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCategoryForm } from "@/features/inventory/hooks/use-category-form";
import type { Category } from "@/features/inventory/hooks/use-product-data";
import type { VatCategory } from "@/features/inventory/hooks/use-product-data";
import { buildCategoryTree } from "@/features/inventory/utils";

interface CategoryFormDrawerProps {
  isOpen: boolean;
  category?: Category | null;
  categories: Category[];
  vatCategories: VatCategory[];
  businessId: string;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    parentId?: string | null;
    vatCategoryId?: string | null;
    vatOverridePercent?: number | null;
    color?: string | null;
    image?: string | null;
    isActive: boolean;
    sortOrder?: number;
  }) => Promise<void>;
  onUpdate: (
    id: string,
    data: {
      name: string;
      description?: string;
      parentId?: string | null;
      vatCategoryId?: string | null;
      vatOverridePercent?: number | null;
      color?: string | null;
      image?: string | null;
      isActive: boolean;
    }
  ) => Promise<void>;
}

export function CategoryFormDrawer({
  isOpen,
  category,
  categories,
  vatCategories,
  businessId,
  onClose,
  onSave,
  onUpdate,
}: CategoryFormDrawerProps) {
  const { form, handleSubmit, isSubmitting, isEditMode } = useCategoryForm({
    category,
    businessId,
    onSubmit: async (data) => {
      // Transform form data to API format
      const apiData = {
        name: data.name,
        description: data.description || undefined,
        parentId: data.parentId || null,
        vatCategoryId:
          data.vatCategoryId && data.vatCategoryId !== ""
            ? data.vatCategoryId
            : null,
        vatOverridePercent:
          data.vatOverridePercent && data.vatOverridePercent !== ""
            ? parseFloat(data.vatOverridePercent)
            : null,
        color: data.color && data.color !== "" ? data.color : null,
        image: data.image && data.image !== "" ? data.image : null,
        isActive: data.isActive ?? true,
        ...(isEditMode && category ? {} : { sortOrder: categories.length + 1 }),
      };

      if (isEditMode && category) {
        await onUpdate(category.id, apiData);
      } else {
        await onSave(apiData);
      }
    },
    onSuccess: onClose,
  });

  // Keyboard integration hook
  const keyboard = useKeyboardWithRHF({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs: {
      name: { keyboardMode: "qwerty" },
      description: { keyboardMode: "qwerty" },
      vatOverridePercent: { keyboardMode: "numeric" },
      color: { keyboardMode: "qwerty" },
      image: { keyboardMode: "qwerty" },
    },
  });

  // Close keyboard when drawer closes
  React.useEffect(() => {
    if (!isOpen) {
      keyboard.handleCloseKeyboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Filter out current category from parent options
  const parentOptions = buildCategoryTree(categories as any).filter(
    (cat) => !category || cat.id !== category.id
  );

  return (
    <Drawer open={isOpen} onOpenChange={onClose} direction="right">
      <DrawerContent className="h-full w-[95%] sm:w-[900px] md:w-[1000px] lg:w-[1200px] xl:w-[1400px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>
            {isEditMode ? "Edit Category" : "Add New Category"}
          </DrawerTitle>
          <DrawerDescription>
            {isEditMode
              ? "Update the category information below."
              : "Create a new category to organize your products."}
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
                    ? "Update Category"
                    : "Add Category"}
                </Button>
                <DrawerClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isSubmitting}
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                </DrawerClose>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={() => (
                  <FormItem>
                    <FormControl>
                      <AdaptiveFormField
                        {...form.register("name")}
                        label="Category Name *"
                        value={keyboard.formValues.name || ""}
                        error={form.formState.errors.name?.message}
                        onFocus={() => keyboard.handleFieldFocus("name")}
                        placeholder="Enter category name"
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
                  <FormItem>
                    <FormControl>
                      <AdaptiveTextarea
                        {...form.register("description")}
                        label="Description (Optional)"
                        value={keyboard.formValues.description || ""}
                        error={form.formState.errors.description?.message}
                        onFocus={() => keyboard.handleFieldFocus("description")}
                        placeholder="Enter category description"
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
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Category</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? undefined : value)
                      }
                      value={field.value || "none"}
                      disabled={isSubmitting}
                      onOpenChange={() => keyboard.handleCloseKeyboard()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None (Top-level)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (Top-level)</SelectItem>
                        {parentOptions.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vatCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Category</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? undefined : value)
                      }
                      value={field.value || "none"}
                      disabled={isSubmitting}
                      onOpenChange={() => keyboard.handleCloseKeyboard()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {vatCategories.map((vat) => (
                          <SelectItem key={vat.id} value={vat.id}>
                            {vat.name} ({vat.ratePercent}%)
                          </SelectItem>
                        ))}
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
                        value={keyboard.formValues.vatOverridePercent || ""}
                        error={
                          form.formState.errors.vatOverridePercent?.message
                        }
                        onFocus={() =>
                          keyboard.handleFieldFocus("vatOverridePercent")
                        }
                        placeholder="Override VAT percent (optional)"
                        disabled={isSubmitting}
                        className={cn(
                          keyboard.activeField === "vatOverridePercent" &&
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
                name="color"
                render={() => (
                  <FormItem>
                    <FormControl>
                      <AdaptiveFormField
                        {...form.register("color")}
                        label="Color"
                        value={keyboard.formValues.color || ""}
                        error={form.formState.errors.color?.message}
                        onFocus={() => keyboard.handleFieldFocus("color")}
                        placeholder="Enter color (optional)"
                        disabled={isSubmitting}
                        className={cn(
                          keyboard.activeField === "color" &&
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
                name="image"
                render={() => (
                  <FormItem>
                    <FormControl>
                      <AdaptiveFormField
                        {...form.register("image")}
                        label="Image URL"
                        value={keyboard.formValues.image || ""}
                        error={form.formState.errors.image?.message}
                        onFocus={() => keyboard.handleFieldFocus("image")}
                        placeholder="Enter image URL (optional)"
                        disabled={isSubmitting}
                        className={cn(
                          keyboard.activeField === "image" &&
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
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          keyboard.handleCloseKeyboard();
                          field.onChange(checked);
                        }}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {category && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Category Information
                  </h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      Created: {new Date(category.createdAt).toLocaleString()}
                    </div>
                    <div>
                      Last Updated:{" "}
                      {category.updatedAt
                        ? new Date(category.updatedAt).toLocaleString()
                        : "-"}
                    </div>
                    <div>Sort Order: {category.sortOrder}</div>
                    <div>
                      Status: {category.isActive ? "Active" : "Inactive"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Adaptive Keyboard */}
            {keyboard.showKeyboard && (
              <div className="border-t bg-background px-2 py-2 shrink-0">
                <div className="max-w-full overflow-hidden">
                  <AdaptiveKeyboard
                    onInput={keyboard.handleInput}
                    onBackspace={keyboard.handleBackspace}
                    onClear={keyboard.handleClear}
                    onEnter={() => {
                      // Submit form when Enter is pressed on the last field
                      if (keyboard.activeField === "image") {
                        handleSubmit();
                      }
                    }}
                    initialMode={
                      (keyboard.activeFieldConfig as any)?.keyboardMode ||
                      "qwerty"
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
}
