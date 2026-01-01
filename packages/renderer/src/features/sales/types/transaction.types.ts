/**
 * Transaction-related type definitions
 *
 * @deprecated Use @/types/domain instead
 * @see /Users/admin/Documents/Developer/Electron/aurswift/packages/renderer/src/types/domain
 *
 * Migration: Replace imports with:
 * ```typescript
 * import { PaymentMethod } from '@/types/domain/payment';
 * import { Category } from '@/types/domain/category';
 * ```
 */

export interface PaymentMethod {
  type: "cash" | "card" | "mobile" | "voucher" | "split";
  amount?: number;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  businessId: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  parentId?: string | null;
}
