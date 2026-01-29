/**
 * Dashboard Features
 *
 * Central export for all dashboard-related features, components, and hooks.
 */

// Components
export {
  FeatureCard,
  DashboardGrid,
  StatsCards,
  ManagerStatsCards,
  DashboardLayout,
} from "./components";

// Widget Components
export {
  UserManagementCard,
  ManagementActionsCard,
  ReportsAnalyticsCard,
  AdvancedReportsCard,
  SystemSettingsCard,
  DatabaseManagementCard,
  QuickActionsCard,
} from "./widgets";

// Hooks
export { useUserPermissions, useFeatureVisibility } from "./hooks";

// Registry
export {
  FEATURE_REGISTRY,
  getFeaturesByCategory,
  getFeatureById,
  getAllFeatureIds,
} from "./registry";

// Types
export type {
  FeatureConfig,
  FeatureAction,
  FeatureStats,
  FeatureCategory,
} from "./types";

// Views (DashboardView only; role-specific views are lazy-loaded via DashboardPageWrapper)
export { DashboardView } from "./views";
