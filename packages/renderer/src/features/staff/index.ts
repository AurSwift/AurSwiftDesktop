/**
 * Staff Feature - Public API
 *
 * This is the main entry point for the staff feature.
 * Export all public APIs here for easy importing.
 */

// ============================================================================
// Config
// ============================================================================
export { staffFeature, staffViews } from "./config/feature-config";
export { STAFF_PERMISSIONS } from "./config/permissions";
export { STAFF_ROUTES } from "./config/navigation";
export type { StaffPermission } from "./config/permissions";
export type { StaffRoute } from "./config/navigation";

// ============================================================================
// Hooks
// ============================================================================
export { useCashierForm } from "./hooks/use-cashier-form";
export { useScheduleForm } from "./hooks/use-schedule-form";

// ============================================================================
// Views
// ============================================================================
export { default as ManageCashierView } from "./views/manage-cashier-view";
export { default as StaffSchedulesView } from "./views/staff-schedules-view";
export { default as BreakPolicySettingsView } from "./views/break-policy-settings-view";

// ============================================================================
// Schemas
// ============================================================================
export * from "./schemas/cashier-schema";
export * from "./schemas/schedule-schema";
