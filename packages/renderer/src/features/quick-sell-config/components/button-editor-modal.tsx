/**
 * Button Editor Modal
 *
 * Modal for editing quick sell button properties:
 * - Link type (product, category, unassigned)
 * - Appearance (color, text color, shape)
 * - Custom label
 */

import { useState, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/shared/utils/cn";
import { Package, FolderOpen, CircleSlash, Palette, Link2 } from "lucide-react";
import {
  type QuickSellButtonWithDetails,
  type ButtonLinkType,
  type ButtonShape,
  BUTTON_COLOR_PRESETS,
  BUTTON_SHAPE_OPTIONS,
} from "../types";
import { ProductSearchCombobox } from "./product-search-combobox";
import { CategorySearchCombobox } from "./category-search-combobox";

interface ButtonEditorModalProps {
  isOpen: boolean;
  button: QuickSellButtonWithDetails | null;
  onClose: () => void;
  onSave: (updates: Partial<QuickSellButtonWithDetails>) => void;
}

interface FormData {
  label: string;
  color: string;
  textColor: string;
  shape: ButtonShape;
  linkType: ButtonLinkType;
  productId: string | null;
  categoryId: string | null;
}

export function ButtonEditorModal({
  isOpen,
  button,
  onClose,
  onSave,
}: ButtonEditorModalProps) {
  const [activeTab, setActiveTab] = useState<"link" | "appearance">("link");
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    label: "",
    color: "#3b82f6",
    textColor: "#ffffff",
    shape: "rounded",
    linkType: "unassigned",
    productId: null,
    categoryId: null,
  });

  // Reset form when button changes
  useEffect(() => {
    if (button) {
      setFormData({
        label: button.label || "",
        color: button.color || "#3b82f6",
        textColor: button.textColor || "#ffffff",
        shape: button.shape || "rounded",
        linkType: button.linkType || "unassigned",
        productId: button.productId,
        categoryId: button.categoryId,
      });
    }
  }, [button]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave({
        label: formData.label || null,
        color: formData.color,
        textColor: formData.textColor,
        shape: formData.shape,
        linkType: formData.linkType,
        productId: formData.linkType === "product" ? formData.productId : null,
        categoryId:
          formData.linkType === "category" ? formData.categoryId : null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkTypeChange = (type: ButtonLinkType) => {
    setFormData((prev) => ({
      ...prev,
      linkType: type,
      productId: type === "product" ? prev.productId : null,
      categoryId: type === "category" ? prev.categoryId : null,
    }));
  };

  const handleColorPresetClick = (
    preset: (typeof BUTTON_COLOR_PRESETS)[number],
  ) => {
    setFormData((prev) => ({
      ...prev,
      color: preset.color,
      textColor: preset.textColor,
    }));
  };

  // Preview button
  const getPreviewLabel = () => {
    if (formData.label) return formData.label;
    if (formData.linkType === "product" && button?.product) {
      return button.product.name;
    }
    if (formData.linkType === "category" && button?.category) {
      return button.category.name;
    }
    return "Button Preview";
  };

  const getShapeClass = (shape: ButtonShape) => {
    switch (shape) {
      case "rectangle":
        return "rounded-none";
      case "pill":
        return "rounded-full";
      default:
        return "rounded-lg";
    }
  };

  if (!button) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Quick Sell Button</DialogTitle>
          <DialogDescription>
            Configure what this button links to and how it appears.
          </DialogDescription>
        </DialogHeader>

        {/* Preview */}
        <div className="flex justify-center py-4">
          <div
            className={cn(
              "w-32 h-20 flex items-center justify-center text-sm font-medium shadow-md transition-all",
              getShapeClass(formData.shape),
              formData.linkType === "unassigned" &&
                "border-2 border-dashed border-muted-foreground/30",
            )}
            style={{
              backgroundColor:
                formData.linkType === "unassigned"
                  ? "transparent"
                  : formData.color,
              color:
                formData.linkType === "unassigned"
                  ? "var(--muted-foreground)"
                  : formData.textColor,
            }}
          >
            <span className="text-center line-clamp-2 px-2">
              {getPreviewLabel()}
            </span>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "link" | "appearance")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Link
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Appearance
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="space-y-4 mt-4">
            {/* Link Type Selection */}
            <div className="space-y-2">
              <Label>Button Type</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleLinkTypeChange("product")}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors",
                    formData.linkType === "product"
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-muted-foreground/50",
                  )}
                >
                  <Package className="w-5 h-5" />
                  <span className="text-xs">Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLinkTypeChange("category")}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors",
                    formData.linkType === "category"
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-muted-foreground/50",
                  )}
                >
                  <FolderOpen className="w-5 h-5" />
                  <span className="text-xs">Category</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLinkTypeChange("unassigned")}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors",
                    formData.linkType === "unassigned"
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-muted-foreground/50",
                  )}
                >
                  <CircleSlash className="w-5 h-5" />
                  <span className="text-xs">Unassigned</span>
                </button>
              </div>
            </div>

            {/* Product Selector */}
            {formData.linkType === "product" && (
              <div className="space-y-2">
                <Label>Select Product</Label>
                <ProductSearchCombobox
                  selectedProductId={formData.productId}
                  onSelect={(productId: string | null) =>
                    setFormData((prev) => ({ ...prev, productId }))
                  }
                />
              </div>
            )}

            {/* Category Selector */}
            {formData.linkType === "category" && (
              <div className="space-y-2">
                <Label>Select Category</Label>
                <CategorySearchCombobox
                  selectedCategoryId={formData.categoryId}
                  onSelect={(categoryId: string | null) =>
                    setFormData((prev) => ({ ...prev, categoryId }))
                  }
                />
              </div>
            )}
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4 mt-4">
            {/* Custom Label */}
            <div className="space-y-2">
              <Label htmlFor="label">Custom Label (optional)</Label>
              <Input
                id="label"
                placeholder="Leave empty to use product/category name"
                value={formData.label}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, label: e.target.value }))
                }
              />
            </div>

            {/* Shape */}
            <div className="space-y-2">
              <Label>Shape</Label>
              <Select
                value={formData.shape}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, shape: v as ButtonShape }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUTTON_SHAPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color Presets */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {BUTTON_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleColorPresetClick(preset)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                      formData.color === preset.color
                        ? "border-foreground scale-110"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            {/* Custom Color Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Background</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        color: e.target.value,
                      }))
                    }
                    className="w-12 h-9 p-1"
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        color: e.target.value,
                      }))
                    }
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="textColor">Text</Label>
                <div className="flex gap-2">
                  <Input
                    id="textColor"
                    type="color"
                    value={formData.textColor}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        textColor: e.target.value,
                      }))
                    }
                    className="w-12 h-9 p-1"
                  />
                  <Input
                    type="text"
                    value={formData.textColor}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        textColor: e.target.value,
                      }))
                    }
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
