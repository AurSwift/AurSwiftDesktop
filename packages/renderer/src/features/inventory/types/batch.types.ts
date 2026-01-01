/**
 * Product Batch/Lot Tracking Types
 *
 * @deprecated Use @/types/features/batches instead
 * @see /Users/admin/Documents/Developer/Electron/aurswift/packages/renderer/src/types/features/batches/index.ts
 *
 * Migration: Replace imports with:
 * ```typescript
 * import { ProductBatch, Supplier, ExpirySettings } from '@/types/features/batches';
 * ```
 *
 * Based on the database schema for product expiry tracking
 */

export type BatchStatus = "ACTIVE" | "EXPIRED" | "SOLD_OUT" | "REMOVED";

export type NotificationType = "INFO" | "WARNING" | "CRITICAL" | "EXPIRED";

export type NotificationStatus =
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "ACKNOWLEDGED";

export type NotificationChannel = "EMAIL" | "PUSH" | "DASHBOARD";

export type StockRotationMethod = "FIFO" | "FEFO" | "NONE";

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  businessId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductBatch {
  id: string;
  productId: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate: string;
  initialQuantity: number;
  currentQuantity: number;
  supplierId?: string;
  purchaseOrderNumber?: string;
  costPrice?: number;
  status: BatchStatus;
  businessId: string;
  createdAt: string;
  updatedAt: string;
  // Relations (populated when fetched with relations)
  product?: {
    id: string;
    name: string;
    sku: string;
    image?: string;
  };
  supplier?: Supplier;
}

export interface ExpirySettings {
  id: string;
  businessId: string;
  criticalAlertDays: number;
  warningAlertDays: number;
  infoAlertDays: number;
  notifyViaEmail: boolean;
  notifyViaPush: boolean;
  notifyViaDashboard: boolean;
  autoDisableExpired: boolean;
  allowSellNearExpiry: boolean;
  nearExpiryThreshold: number;
  notificationRecipients: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpiryNotification {
  id: string;
  productBatchId: string;
  notificationType: NotificationType;
  daysUntilExpiry: number;
  message: string;
  status: NotificationStatus;
  channels: NotificationChannel[];
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  businessId: string;
  scheduledFor: string;
  sentAt?: string;
  createdAt: string;
  // Relations
  batch?: ProductBatch;
  acknowledgedByUser?: {
    id: string;
    name: string;
  };
}

export interface BatchFormData {
  productId: string;
  batchNumber?: string; // Auto-generated if not provided
  manufacturingDate?: string;
  expiryDate: string;
  initialQuantity: number;
  supplierId?: string;
  purchaseOrderNumber?: string;
  costPrice?: number;
}

export interface BatchUpdateData {
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  currentQuantity?: number;
  supplierId?: string;
  purchaseOrderNumber?: string;
  costPrice?: number;
  status?: BatchStatus;
}

export interface ExpiryAlert {
  batch: ProductBatch;
  daysUntilExpiry: number;
  alertType: NotificationType;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
}

export interface BatchStockMovement {
  id: string;
  productId: string;
  batchId?: string;
  movementType: "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "TRANSFER" | "WASTE";
  quantity: number;
  reason?: string;
  reference?: string;
  fromBatchId?: string;
  toBatchId?: string;
  userId: string;
  businessId: string;
  timestamp: string;
  createdAt: string;
}

export interface BatchAnalytics {
  totalBatches: number;
  activeBatches: number;
  expiredBatches: number;
  expiringThisWeek: number;
  expiringNext30Days: number;
  totalValueAtRisk: number;
  wasteValue: number;
  batchesByStatus: Record<BatchStatus, number>;
  batchesByExpiryRange: {
    expired: number;
    critical: number; // 0-3 days
    warning: number; // 4-7 days
    info: number; // 8-14 days
    good: number; // >14 days
  };
}

export interface BatchResponse {
  success: boolean;
  message?: string;
  batch?: ProductBatch;
  batches?: ProductBatch[];
  error?: string;
  errors?: string[];
}

export interface ExpirySettingsResponse {
  success: boolean;
  message?: string;
  settings?: ExpirySettings;
  error?: string;
}

export interface ExpiryNotificationResponse {
  success: boolean;
  message?: string;
  notification?: ExpiryNotification;
  notifications?: ExpiryNotification[];
  alerts?: ExpiryAlert[];
  error?: string;
}

export interface SupplierResponse {
  success: boolean;
  message?: string;
  supplier?: Supplier;
  suppliers?: Supplier[];
  error?: string;
}
