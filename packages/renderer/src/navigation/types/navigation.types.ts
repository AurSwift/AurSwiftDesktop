/**
 * Navigation System Types
 *
 * Type definitions for the centralized navigation system.
 * Provides type safety for view navigation in the Electron desktop app.
 */

import type { ComponentType } from "react";

/**
 * View hierarchy levels
 * - root: Top-level views (dashboard, transactions, etc.)
 * - nested: Views nested within a parent view
 * - modal: Modal dialogs
 * - drawer: Side drawers/panels
 */
export type ViewLevel = "root" | "nested" | "modal" | "drawer";

/**
 * View metadata for display and navigation
 */
export interface ViewMetadata {
  /** Display title of the view */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional icon identifier */
  icon?: string;
  /** Breadcrumb label for nested views */
  breadcrumb?: string;
}

/**
 * View chrome configuration
 * Controls shared UI that wraps a view (header, etc.).
 */
export interface ViewChromeConfig {
  /**
   * Whether to show the dashboard header for this view.
   * Defaults to true when omitted.
   */
  showDashboardHeader?: boolean;
}

/**
 * View configuration
 * Defines a view in the navigation system
 */
export interface ViewConfig {
  /** Unique view identifier */
  id: string;
  /** Hierarchy level of the view */
  level: ViewLevel;
  /** Parent view ID for nested views */
  parentId?: string;
  /** React component to render - accepts components that can receive ViewComponentProps and additional props */
  component: ComponentType<any>;
  /** View metadata */
  metadata: ViewMetadata;
  /** Shared chrome configuration */
  chrome?: ViewChromeConfig;
  /** Required RBAC permissions (any of these) */
  permissions?: string[];
  /** Required roles (any of these) */
  roles?: string[];
  /** Default parameters for the view */
  defaultParams?: Record<string, unknown>;
  /** Whether authentication is required */
  requiresAuth?: boolean;
}

/**
 * Navigation state for a view context
 */
export interface NavigationState {
  /** Current active view ID */
  currentView: string;
  /** History of visited views for back navigation */
  viewHistory: string[];
  /** Parameters passed to the current view */
  viewParams: Record<string, unknown>;
  /** Nested navigation states for parent views */
  nestedViews: Record<string, NavigationState>;
}

/**
 * Navigation context value
 * Provides navigation functionality to components
 */
export interface NavigationContextValue {
  /** Current navigation state */
  state: NavigationState;
  /** Navigate to a view */
  navigateTo: (viewId: string, params?: Record<string, unknown>) => void;
  /** Navigate back to previous view */
  goBack: () => void;
  /** Navigate to root view */
  goToRoot: () => void;
  /** Whether back navigation is possible */
  canGoBack: boolean;
  /** Get nested navigation context for a parent view */
  getNestedNavigation: (parentViewId: string) => NavigationContextValue;
}

/**
 * Props that view components receive
 * All views receive these props from the navigation system
 */
export interface ViewComponentProps {
  /** Function to navigate back */
  onBack: () => void;
  /** View parameters - allows additional props to be passed */
  [key: string]: unknown;
}
