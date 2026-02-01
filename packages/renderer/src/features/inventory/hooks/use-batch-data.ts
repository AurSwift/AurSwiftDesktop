import { useState, useCallback, useEffect } from "react";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-batch-data");
import type {
  ProductBatch,
  BatchResponse,
  ExpirySettings,
  Supplier,
} from "@/types/features/batches";

interface UseBatchDataProps {
  businessId?: string;
  productId?: string;
}

export const useBatchData = ({ businessId, productId }: UseBatchDataProps) => {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expirySettings, setExpirySettings] = useState<ExpirySettings | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    if (!businessId || !window.batchesAPI) {
      setBatches([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Pass productId as part of options object for proper filtering
      const response = await window.batchesAPI.getByBusiness(
        businessId,
        productId ? { productId } : undefined
      );

      if (response.success && response.batches) {
        setBatches(Array.isArray(response.batches) ? response.batches : []);
      } else {
        logger.warn("Failed to load batches:", response.error);
        setBatches([]);
        setError(response.error || "Failed to load batches");
      }
    } catch (err) {
      logger.error("Error loading batches:", err);
      setBatches([]);
      setError("Failed to load batches");
    } finally {
      setLoading(false);
    }
  }, [businessId, productId]);

  const loadSuppliers = useCallback(async () => {
    if (!businessId || !window.suppliersAPI) {
      setSuppliers([]);
      return;
    }

    try {
      const response = await window.suppliersAPI.getByBusiness(businessId);

      if (response.success && response.suppliers) {
        setSuppliers(
          Array.isArray(response.suppliers) ? response.suppliers : []
        );
      } else {
        logger.warn("Failed to load suppliers");
        setSuppliers([]);
      }
    } catch (err) {
      logger.error("Error loading suppliers:", err);
      setSuppliers([]);
    }
  }, [businessId]);

  const loadExpirySettings = useCallback(async () => {
    if (!businessId || !window.expirySettingsAPI) {
      setExpirySettings(null);
      return;
    }

    try {
      const response = await window.expirySettingsAPI.get(businessId);

      if (response.success && response.settings) {
        setExpirySettings(response.settings);
      } else {
        // Create default settings if none exist
        const defaultSettings: ExpirySettings = {
          id: "",
          businessId,
          criticalAlertDays: 3,
          warningAlertDays: 7,
          infoAlertDays: 14,
          notifyViaEmail: true,
          notifyViaPush: true,
          notifyViaDashboard: true,
          autoDisableExpired: true,
          allowSellNearExpiry: false,
          nearExpiryThreshold: 2,
          notificationRecipients: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setExpirySettings(defaultSettings);
      }
    } catch (err) {
      logger.error("Error loading expiry settings:", err);
      // Set default settings on error
      const defaultSettings: ExpirySettings = {
        id: "",
        businessId: businessId || "",
        criticalAlertDays: 3,
        warningAlertDays: 7,
        infoAlertDays: 14,
        notifyViaEmail: true,
        notifyViaPush: true,
        notifyViaDashboard: true,
        autoDisableExpired: true,
        allowSellNearExpiry: false,
        nearExpiryThreshold: 2,
        notificationRecipients: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setExpirySettings(defaultSettings);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      loadBatches();
      loadSuppliers();
      loadExpirySettings();
    }
  }, [businessId, loadBatches, loadSuppliers, loadExpirySettings]);

  const createBatch = useCallback(
    async (batchData: {
      productId: string;
      batchNumber?: string;
      manufacturingDate?: string;
      expiryDate: string;
      initialQuantity: number;
      supplierId?: string;
      purchaseOrderNumber?: string;
      costPrice?: number;
    }): Promise<BatchResponse> => {
      if (!businessId) {
        return {
          success: false,
          error: "Business ID is required",
        };
      }

      try {
        if (!window.batchesAPI) {
          return {
            success: false,
            error: "Batch API not available",
          };
        }

        const response = await window.batchesAPI.create({
          ...batchData,
          businessId,
          currentQuantity: batchData.initialQuantity, // Set currentQuantity to initialQuantity for new batches
        });

        if (response.success && response.batch) {
          setBatches((prev) => [...prev, response.batch!]);
        }

        return {
          success: response.success,
          batch: response.batch,
          message: response.message,
          error: response.error,
        };
      } catch (err) {
        logger.error("Error creating batch:", err);
        return {
          success: false,
          error: "Failed to create batch",
        };
      }
    },
    [businessId]
  );

  const updateBatch = useCallback(
    async (
      batchId: string,
      updates: {
        batchNumber?: string;
        manufacturingDate?: string;
        expiryDate?: string;
        currentQuantity?: number;
        supplierId?: string;
        purchaseOrderNumber?: string;
        costPrice?: number;
        status?: "ACTIVE" | "EXPIRED" | "SOLD_OUT" | "REMOVED";
      }
    ): Promise<BatchResponse> => {
      try {
        if (!window.batchesAPI) {
          return {
            success: false,
            error: "Batch API not available",
          };
        }

        const response = await window.batchesAPI.update(batchId, updates);

        if (response.success && response.batch) {
          setBatches((prev) =>
            prev.map((batch) =>
              batch.id === batchId ? response.batch! : batch
            )
          );
        }

        return {
          success: response.success,
          batch: response.batch,
          message: response.message,
          error: response.error,
        };
      } catch (err) {
        logger.error("Error updating batch:", err);
        return {
          success: false,
          error: "Failed to update batch",
        };
      }
    },
    []
  );

  const deleteBatch = useCallback(
    async (batchId: string): Promise<BatchResponse> => {
      try {
        if (!window.batchesAPI) {
          return {
            success: false,
            error: "Batch API not available",
          };
        }

        const response = await window.batchesAPI.delete(batchId);

        if (response.success) {
          setBatches((prev) => prev.filter((batch) => batch.id !== batchId));
        }

        return {
          success: response.success,
          message: response.message,
          error: response.error,
        };
      } catch (err) {
        logger.error("Error deleting batch:", err);
        return {
          success: false,
          error: "Failed to delete batch",
        };
      }
    },
    []
  );

  return {
    batches,
    suppliers,
    expirySettings,
    loading,
    error,
    setBatches,
    loadBatches,
    loadSuppliers,
    loadExpirySettings,
    createBatch,
    updateBatch,
    deleteBatch,
  };
};
