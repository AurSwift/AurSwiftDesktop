/**
 * Utility functions for expiry date calculations and batch management
 */

import type {
  ProductBatch,
  ExpiryAlert,
  NotificationType,
  BatchStatus,
} from "@/types/features/batches";

/**
 * Calculate days until expiry from a given expiry date
 */
export function calculateDaysUntilExpiry(expiryDate: string | Date): number {
  const expiry = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Determine expiry status based on days until expiry
 */
export function getExpiryStatus(
  expiryDate: string | Date,
  criticalDays: number = 3,
  warningDays: number = 7,
  infoDays: number = 14
): {
  status: "expired" | "critical" | "warning" | "info" | "good";
  daysUntil: number;
  notificationType: NotificationType;
} {
  const daysUntil = calculateDaysUntilExpiry(expiryDate);

  if (daysUntil < 0) {
    return {
      status: "expired",
      daysUntil,
      notificationType: "EXPIRED",
    };
  }

  if (daysUntil <= criticalDays) {
    return {
      status: "critical",
      daysUntil,
      notificationType: "CRITICAL",
    };
  }

  if (daysUntil <= warningDays) {
    return {
      status: "warning",
      daysUntil,
      notificationType: "WARNING",
    };
  }

  if (daysUntil <= infoDays) {
    return {
      status: "info",
      daysUntil,
      notificationType: "INFO",
    };
  }

  return {
    status: "good",
    daysUntil,
    notificationType: "INFO",
  };
}

/**
 * Generate expiry alert for a batch
 */
export function generateExpiryAlert(
  batch: ProductBatch,
  settings: {
    criticalAlertDays: number;
    warningAlertDays: number;
    infoAlertDays: number;
  }
): ExpiryAlert | null {
  const { status, daysUntil, notificationType } = getExpiryStatus(
    batch.expiryDate,
    settings.criticalAlertDays,
    settings.warningAlertDays,
    settings.infoAlertDays
  );

  // Only generate alerts for batches that need attention
  if (status === "good") {
    return null;
  }

  let severity: "low" | "medium" | "high" | "critical" = "low";
  let message = "";

  if (status === "expired") {
    severity = "critical";
    message = `${batch.product?.name || "Product"} batch ${batch.batchNumber} has expired. ${batch.currentQuantity} units need to be removed.`;
  } else if (status === "critical") {
    severity = "critical";
    message = `${batch.product?.name || "Product"} batch ${batch.batchNumber} expires in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}. ${batch.currentQuantity} units at risk.`;
  } else if (status === "warning") {
    severity = "high";
    message = `${batch.product?.name || "Product"} batch ${batch.batchNumber} expires in ${daysUntil} days. Consider creating a promotion.`;
  } else {
    severity = "medium";
    message = `${batch.product?.name || "Product"} batch ${batch.batchNumber} expires in ${daysUntil} days. Monitor closely.`;
  }

  return {
    batch,
    daysUntilExpiry: daysUntil,
    alertType: notificationType,
    severity,
    message,
  };
}

/**
 * Filter batches by expiry status
 */
export function filterBatchesByExpiryStatus(
  batches: ProductBatch[],
  status: "expired" | "critical" | "warning" | "info" | "good",
  settings: {
    criticalAlertDays: number;
    warningAlertDays: number;
    infoAlertDays: number;
  }
): ProductBatch[] {
  return batches.filter((batch) => {
    const expiryStatus = getExpiryStatus(
      batch.expiryDate,
      settings.criticalAlertDays,
      settings.warningAlertDays,
      settings.infoAlertDays
    );
    return expiryStatus.status === status;
  });
}

/**
 * Get batches expiring within a date range
 */
export function getBatchesExpiringInRange(
  batches: ProductBatch[],
  startDays: number,
  endDays: number
): ProductBatch[] {
  return batches.filter((batch) => {
    const daysUntil = calculateDaysUntilExpiry(batch.expiryDate);
    return daysUntil >= startDays && daysUntil <= endDays;
  });
}

/**
 * Sort batches by expiry date (FEFO - First Expiry First Out)
 */
export function sortBatchesByExpiry(
  batches: ProductBatch[],
  ascending: boolean = true
): ProductBatch[] {
  return [...batches].sort((a, b) => {
    const dateA = new Date(a.expiryDate).getTime();
    const dateB = new Date(b.expiryDate).getTime();
    return ascending ? dateA - dateB : dateB - dateA;
  });
}

/**
 * Calculate total stock from batches
 */
export function calculateTotalStockFromBatches(
  batches: ProductBatch[],
  statusFilter?: BatchStatus[]
): number {
  return batches
    .filter((batch) => !statusFilter || statusFilter.includes(batch.status))
    .reduce((total, batch) => total + batch.currentQuantity, 0);
}

/**
 * Format expiry date for display
 */
export function formatExpiryDate(
  expiryDate: string | Date,
  includeRelative: boolean = true
): string {
  const date = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  const formatted = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (!includeRelative) {
    return formatted;
  }

  const daysUntil = calculateDaysUntilExpiry(date);
  let relative = "";

  if (daysUntil < 0) {
    relative = ` (Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? "s" : ""} ago)`;
  } else if (daysUntil === 0) {
    relative = " (Expires today)";
  } else if (daysUntil === 1) {
    relative = " (Expires tomorrow)";
  } else if (daysUntil <= 7) {
    relative = ` (Expires in ${daysUntil} days)`;
  } else if (daysUntil <= 30) {
    relative = ` (Expires in ${Math.floor(daysUntil / 7)} week${Math.floor(daysUntil / 7) !== 1 ? "s" : ""})`;
  }

  return `${formatted}${relative}`;
}

/**
 * Generate batch number from product and date
 */
export function generateBatchNumber(
  productSku: string,
  expiryDate: string | Date,
  sequence: number = 1
): string {
  const date = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const skuPrefix = productSku.substring(0, 3).toUpperCase();
  const seq = String(sequence).padStart(3, "0");

  return `${skuPrefix}-${year}${month}${day}-${seq}`;
}

/**
 * Check if batch can be sold (not expired, has stock, etc.)
 */
export function canSellBatch(
  batch: ProductBatch,
  settings: {
    allowSellNearExpiry: boolean;
    nearExpiryThreshold: number;
  }
): { canSell: boolean; reason?: string } {
  if (batch.status !== "ACTIVE") {
    return {
      canSell: false,
      reason: `Batch is ${batch.status.toLowerCase()}`,
    };
  }

  if (batch.currentQuantity <= 0) {
    return {
      canSell: false,
      reason: "Batch is out of stock",
    };
  }

  const daysUntil = calculateDaysUntilExpiry(batch.expiryDate);

  if (daysUntil < 0) {
    return {
      canSell: false,
      reason: "Batch has expired",
    };
  }

  if (!settings.allowSellNearExpiry && daysUntil <= settings.nearExpiryThreshold) {
    return {
      canSell: false,
      reason: `Batch expires in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}. Selling near-expiry items is disabled.`,
    };
  }

  return { canSell: true };
}

/**
 * Get color for expiry status badge
 */
export function getExpiryStatusColor(
  status: "expired" | "critical" | "warning" | "info" | "good"
): string {
  switch (status) {
    case "expired":
      return "destructive";
    case "critical":
      return "destructive";
    case "warning":
      return "warning";
    case "info":
      return "info";
    case "good":
      return "success";
    default:
      return "default";
  }
}

