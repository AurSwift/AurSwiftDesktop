/**
 * @deprecated Use @/types/features/printer/office instead
 * @see /Users/admin/Documents/Developer/Electron/aurswift/packages/renderer/src/types/features/printer/office.ts
 *
 * Migration: Replace imports with:
 * ```typescript
 * import { OfficePrinter, PrintJobConfig, OfficePrinterAPI } from '@/types/features/printer';
 * ```
 *
 * This file will be removed in a future version.
 */

// Re-export from new location for backward compatibility
export * from "./features/printer/office";
