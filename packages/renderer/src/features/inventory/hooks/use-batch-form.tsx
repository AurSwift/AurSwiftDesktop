/**
 * Batch Form Hook
 *
 * Custom hook for managing batch form state, validation, and submission
 * using React Hook Form with Zod validation.
 */

import { useForm } from "react-hook-form";
import { configuredZodResolver } from "@/shared/validation/resolvers";
import {
  batchCreateSchema,
  batchUpdateSchema,
  type BatchFormData,
  type BatchUpdateData,
} from "../schemas/batch-schema";
import { useFormNotification } from "@/shared/hooks/use-form-notification";
import type { ProductBatch } from "@/types/features/batches";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-batch-form");

interface UseBatchFormOptions {
  /**
   * Batch to edit (if in edit mode)
   */
  batch?: ProductBatch | null;

  /**
   * Product ID (required for creating new batches)
   */
  productId?: string;

  /**
   * Business ID (required for all operations)
   */
  businessId: string;

  /**
   * Callback when form is submitted successfully
   */
  onSubmit: (data: BatchFormData | BatchUpdateData) => Promise<void>;

  /**
   * Optional callback after successful submission
   */
  onSuccess?: () => void;
}

/**
 * Get default form values for creating a new batch
 */
const getDefaultValues = (
  productId: string,
  businessId: string
): BatchFormData => {
  const today = new Date().toISOString().split("T")[0];
  const defaultExpiry = new Date();
  defaultExpiry.setDate(defaultExpiry.getDate() + 30);
  const defaultExpiryStr = defaultExpiry.toISOString().split("T")[0];

  return {
    productId,
    batchNumber: "",
    manufacturingDate: today,
    expiryDate: defaultExpiryStr,
    initialQuantity: 0,
    supplierId: "none",
    purchaseOrderNumber: "",
    costPrice: undefined,
    businessId,
  };
};

/**
 * Map batch entity to form data
 */
const mapBatchToFormData = (batch: ProductBatch): BatchUpdateData => ({
  id: batch.id,
  batchNumber: batch.batchNumber,
  manufacturingDate: batch.manufacturingDate
    ? new Date(batch.manufacturingDate).toISOString().split("T")[0]
    : undefined,
  expiryDate: new Date(batch.expiryDate).toISOString().split("T")[0],
  currentQuantity: batch.currentQuantity,
  supplierId: batch.supplierId || "none",
  purchaseOrderNumber: batch.purchaseOrderNumber || "",
  costPrice: batch.costPrice,
  status: batch.status,
});

/**
 * Hook for managing batch form
 *
 * @example
 * ```tsx
 * const { form, handleSubmit, isSubmitting } = useBatchForm({
 *   batch: editingBatch,
 *   productId: selectedProduct?.id,
 *   businessId: user.businessId,
 *   onSubmit: async (data) => {
 *     await saveBatch(data);
 *   },
 *   onSuccess: () => {
 *     setIsDrawerOpen(false);
 *   },
 * });
 * ```
 */
export function useBatchForm({
  batch,
  productId = "",
  businessId,
  onSubmit,
  onSuccess,
}: UseBatchFormOptions) {
  const isEditMode = !!batch;
  const schema = isEditMode ? batchUpdateSchema : batchCreateSchema;

  const form = useForm<BatchFormData | BatchUpdateData>({
    resolver: configuredZodResolver(schema),
    defaultValues: batch
      ? mapBatchToFormData(batch)
      : getDefaultValues(productId, businessId),
    mode: "onChange", // Validate on change for keyboard input
  });

  const { notifySuccess, notifyError } = useFormNotification({
    entityName: "Batch",
  });

  const handleSubmit = form.handleSubmit(
    async (data) => {
      try {
        logger.info("Batch form data:", data);
        await onSubmit(data);
        notifySuccess(isEditMode ? "update" : "create");

        // Reset form after successful creation (not on update)
        if (!isEditMode && productId) {
          form.reset(getDefaultValues(productId, businessId));
        }

        onSuccess?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An error occurred";
        logger.error("Batch form submission error:", error);
        notifyError(errorMessage);
      }
    },
    (errors) => {
      // Log validation errors for debugging
      logger.error("Batch form validation errors:", errors);
    }
  );

  return {
    form,
    handleSubmit,
    isSubmitting: form.formState.isSubmitting,
    errors: form.formState.errors,
    isEditMode,
  };
}
