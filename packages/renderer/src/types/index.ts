/**
 * Central Types Export
 * 
 * Main barrel export for all types in the application.
 * Import from here for clean, predictable imports.
 * 
 * @example
 * ```typescript
 * import { User, Product, AgeRestrictionLevel } from '@/types';
 * // or
 * import { User } from '@/types/domain';
 * ```
 */

// Domain types
export * from './domain';

// Enum types
export * from './enums';

// Feature types
export * from './features';

// API types (exclude duplicates that are already exported from features)
export * from './api/common';
export * from './api/auth-store';
export * from './api/auth';
export * from './api/product';
export * from './api/cart';
export * from './api/transaction';
export * from './api/batch';
export * from './api/shift';
export * from './api/category';
export * from './api/rbac';
export * from './api/supplier';
export * from './api/expiry-settings';
export * from './api/stock-movement';
export * from './api/schedule';
export * from './api/refund';
export * from './api/cash-drawer';
export * from './api/time-tracking';
export * from './api/age-verification';
// ImportProgress is exported from features/import, so skip api/import
export type { ImportAPI } from './api/import';
export * from './api/printer';
// OfficePrinterAPI is exported from features/printer/office, so skip api/office-printer
export type { OfficePrinterAPI as OfficePrinterAPIType } from './api/office-printer';
export * from './api/payment';
export * from './api/scale';
export * from './api/database';
export * from './api/pdf-receipt';
export * from './api/app';

// UI types (will be added as needed)
// export * from './ui';
