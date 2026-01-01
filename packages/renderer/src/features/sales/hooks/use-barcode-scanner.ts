/**
 * Hook for managing barcode scanning
 * Handles both hardware scanner and manual barcode input
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useProductionScanner } from "@/services/hardware/scanner";
import { ScannerAudio } from "@/shared/services/scanner-audio";
import type { Product } from "@/types/domain";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-barcode-scanner");
import {
  isWeightedProduct,
  getProductSalesUnit,
} from "../utils/product-helpers";
import {
  useSalesUnitSettings,
  getEffectiveSalesUnit,
} from "@/shared/hooks/use-sales-unit-settings";
import { extractBasketCode } from "../utils/qr-code";

interface UseBarcodeScannerProps {
  products: Product[];
  businessId?: string;
  onProductFound: (product: Product, weight?: number) => Promise<void>;
  onBasketCodeScanned?: (basketCode: string) => Promise<void>;
  selectedWeightProduct: Product | null;
  weightInput: string;
  weightDisplayPrice: string; // Used in hook but not directly in this interface
  onSetSelectedWeightProduct: (product: Product | null) => void;
  onSetWeightInput: (value: string) => void;
  onSetWeightDisplayPrice: (value: string) => void;
  onClearCategorySelection?: () => void;
  audioEnabled?: boolean;
}

/**
 * Hook for managing barcode scanning
 * @param props - Barcode scanner configuration
 * @returns Barcode input state and handlers
 */
export function useBarcodeScanner({
  products,
  businessId,
  onProductFound,
  onBasketCodeScanned,
  selectedWeightProduct,
  weightInput,
  weightDisplayPrice: _weightDisplayPrice, // Prefixed with _ to indicate intentionally unused
  onSetSelectedWeightProduct,
  onSetWeightInput,
  onSetWeightDisplayPrice,
  onClearCategorySelection,
  audioEnabled = true,
}: UseBarcodeScannerProps) {
  const salesUnitSettings = useSalesUnitSettings(businessId);
  const [barcodeInput, setBarcodeInput] = useState("");

  /**
   * Handle hardware scanner input
   */
  const handleHardwareScan = useCallback(
    async (barcode: string): Promise<boolean> => {
      logger.info("🔍 Hardware scanner detected barcode:", barcode);

      // Check if this is a saved basket QR code
      const basketCode = extractBasketCode(barcode);
      if (basketCode && onBasketCodeScanned) {
        logger.info("📦 Detected basket QR code:", basketCode);
        try {
          await onBasketCodeScanned(basketCode);
          return true; // Successfully handled basket code
        } catch (error) {
          logger.error("Failed to retrieve basket:", error);
          return false;
        }
      }

      // Search by barcode, SKU, PLU, or ID
      // Barcode is the primary identifier scanned from product packaging
      const product = products.find(
        (p) =>
          p.barcode === barcode ||
          p.barcode?.toLowerCase() === barcode.toLowerCase() ||
          p.sku === barcode ||
          p.sku?.toLowerCase() === barcode.toLowerCase() ||
          p.plu === barcode ||
          p.plu?.toLowerCase() === barcode.toLowerCase() ||
          p.id === barcode
      );

      if (product) {
        const isWeighted = isWeightedProduct(product);

        if (isWeighted) {
          // For weight-based products, we need to handle this specially
          if (
            selectedWeightProduct?.id === product.id &&
            weightInput &&
            weightInput.length > 0
          ) {
            // If we already have the weight input for this product
            // Parse raw digits and divide by 100 (auto-decimal format)
            const rawDigits = weightInput.replace(/[^0-9]/g, "");
            const weightValue = rawDigits ? parseFloat(rawDigits) / 100 : 0;
            if (weightValue > 0) {
              await onProductFound(product, weightValue);
              onSetWeightInput("");
              onSetWeightDisplayPrice("0.00");
              onSetSelectedWeightProduct(null);
              return true;
            }
            return false; // Weight value is 0 or invalid
          } else {
            // Set as selected weight product and prompt for weight
            // Clear any existing category selection when switching to weighted product
            if (onClearCategorySelection) {
              onClearCategorySelection();
            }
            onSetWeightInput("");
            onSetWeightDisplayPrice("0.00");
            onSetSelectedWeightProduct(product);
            const productSalesUnit = getProductSalesUnit(product);
            const unit = getEffectiveSalesUnit(
              productSalesUnit,
              salesUnitSettings
            );
            toast.warning(
              `⚖️ Weight required for ${product.name}. Enter weight in ${unit} and scan again.`
            );
            return false; // Return false to play error sound and indicate incomplete scan
          }
        } else {
          // Normal product, add directly to cart
          await onProductFound(product);
          logger.info("✅ Product added to cart:", product.name);
          return true; // Success!
        }
      } else {
        logger.warn("❌ Product not found for barcode:", barcode);
        toast.error(`Product not found: ${barcode}`);
        return false; // Product not found
      }
    },
    [
      products,
      selectedWeightProduct,
      weightInput,
      onProductFound,
      onBasketCodeScanned,
      onSetSelectedWeightProduct,
      onSetWeightInput,
      onSetWeightDisplayPrice,
      onClearCategorySelection,
      salesUnitSettings,
    ]
  );

  /**
   * Handle manual barcode scan (from input field)
   */
  const handleBarcodeScan = useCallback(async () => {
    if (barcodeInput.trim() === "") return;

    // Check if this is a saved basket QR code
    const basketCode = extractBasketCode(barcodeInput);
    if (basketCode && onBasketCodeScanned) {
      logger.info("📦 Detected basket QR code:", basketCode);
      try {
        await onBasketCodeScanned(basketCode);
        setBarcodeInput("");
        return;
      } catch (error) {
        logger.error("Failed to retrieve basket:", error);
        return;
      }
    }

    // Search by barcode, SKU, PLU, or ID
    // Barcode is the primary identifier for manual entry
    const product = products.find(
      (p) =>
        p.barcode === barcodeInput ||
        p.barcode?.toLowerCase() === barcodeInput.toLowerCase() ||
        p.sku === barcodeInput ||
        p.sku?.toLowerCase() === barcodeInput.toLowerCase() ||
        p.plu === barcodeInput ||
        p.plu?.toLowerCase() === barcodeInput.toLowerCase() ||
        p.id === barcodeInput
    );

    if (product) {
      const isWeighted = isWeightedProduct(product);

      if (isWeighted) {
        if (weightInput && weightInput.length > 0) {
          // Parse raw digits and divide by 100 (auto-decimal format)
          const rawDigits = weightInput.replace(/[^0-9]/g, "");
          const weightValue = rawDigits ? parseFloat(rawDigits) / 100 : 0;
          if (weightValue > 0) {
            await onProductFound(product, weightValue);
            onSetWeightInput("");
            onSetWeightDisplayPrice("0.00");
            onSetSelectedWeightProduct(null);
          }
        } else {
          // Clear any existing category selection when switching to weighted product
          if (onClearCategorySelection) {
            onClearCategorySelection();
          }
          onSetWeightInput("");
          onSetWeightDisplayPrice("0.00");
          onSetSelectedWeightProduct(product);
          const productSalesUnit = getProductSalesUnit(product);
          const unit = getEffectiveSalesUnit(
            productSalesUnit,
            salesUnitSettings
          );
          toast.error(`Please enter weight in ${unit} for ${product.name}`);
        }
      } else {
        await onProductFound(product);
      }
      setBarcodeInput("");
    } else {
      toast.error("Product not found");
    }
  }, [
    barcodeInput,
    products,
    weightInput,
    onProductFound,
    onBasketCodeScanned,
    onSetSelectedWeightProduct,
    onSetWeightInput,
    onSetWeightDisplayPrice,
    onClearCategorySelection,
    salesUnitSettings,
  ]);

  // Initialize scanner hook
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { scanLog: _scanLog, clearScanLog: _clearScanLog } =
    useProductionScanner({
      onScan: handleHardwareScan,
      enableAudio: audioEnabled,
      minBarcodeLength: 4, // Allow shorter codes for PLU
      maxBarcodeLength: 20, // Allow longer codes for various barcode formats
      scanTimeout: 250, // Slightly longer timeout for reliability
    });

  // Initialize audio on component mount
  useEffect(() => {
    if (audioEnabled) {
      ScannerAudio.init().catch((error) =>
        logger.warn("Failed to initialize scanner audio", error)
      );
    }
  }, [audioEnabled]);

  return {
    barcodeInput,
    setBarcodeInput,
    handleBarcodeScan,
  };
}
