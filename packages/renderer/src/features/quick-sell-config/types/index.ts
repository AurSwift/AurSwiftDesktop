/**
 * Quick Sell Button Configuration Types
 *
 * Types for the quick sell buttons feature that allows
 * configuring customizable button layouts for rapid product selection.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Grid configuration: 4 columns × 6 rows = 24 buttons per page */
export const QUICK_SELL_GRID = {
  COLUMNS: 4,
  ROWS: 6,
  BUTTONS_PER_PAGE: 24,
} as const;

/** Maximum number of pages: Main Screen + 6 Sub Pages */
export const QUICK_SELL_MAX_PAGES = 7;

/** Page names for display */
export const QUICK_SELL_PAGE_NAMES = [
  "Main Screen",
  "Sub Page 1",
  "Sub Page 2",
  "Sub Page 3",
  "Sub Page 4",
  "Sub Page 5",
  "Sub Page 6",
] as const;

// ============================================================================
// ENUMS
// ============================================================================

/** Button shape variants */
export type ButtonShape = "rectangle" | "rounded" | "pill";

/** Type of item the button links to */
export type ButtonLinkType = "product" | "category" | "unassigned";

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Quick Sell Page
 * Represents a page containing up to 24 quick sell buttons
 */
export interface QuickSellPage {
  id: string;
  name: string;
  pageIndex: number; // 0 = Main, 1-6 = Sub Pages
  isMainScreen: boolean;
  isActive: boolean;
  businessId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Quick Sell Button
 * Represents a configurable button in the quick sell grid
 */
export interface QuickSellButton {
  id: string;
  pageId: string;
  position: number; // 0-23 for grid position

  // Appearance
  label: string | null;
  color: string;
  textColor: string;
  shape: ButtonShape;

  // Link configuration
  linkType: ButtonLinkType;
  productId: string | null;
  categoryId: string | null;

  // Status
  isActive: boolean;
  businessId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Quick Sell Button with resolved references
 * Used in UI when displaying button details
 */
export interface QuickSellButtonWithDetails extends QuickSellButton {
  product?: {
    id: string;
    name: string;
    basePrice: number;
    image?: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
}

/**
 * Quick Sell Page with its buttons
 */
export interface QuickSellPageWithButtons extends QuickSellPage {
  buttons: QuickSellButtonWithDetails[];
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input for creating a new quick sell button
 */
export interface CreateQuickSellButtonInput {
  pageId: string;
  position: number;
  label?: string | null;
  color?: string;
  textColor?: string;
  shape?: ButtonShape;
  linkType: ButtonLinkType;
  productId?: string | null;
  categoryId?: string | null;
}

/**
 * Input for updating a quick sell button
 */
export interface UpdateQuickSellButtonInput {
  id: string;
  label?: string | null;
  color?: string;
  textColor?: string;
  shape?: ButtonShape;
  linkType?: ButtonLinkType;
  productId?: string | null;
  categoryId?: string | null;
  isActive?: boolean;
}

/**
 * Input for swapping button positions (drag-and-drop)
 */
export interface SwapButtonPositionsInput {
  buttonId1: string;
  buttonId2: string;
}

/**
 * Input for moving a button to a new position
 */
export interface MoveButtonInput {
  buttonId: string;
  newPosition: number;
  newPageId?: string; // Optional: move to different page
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Button editor modal state
 */
export interface ButtonEditorState {
  isOpen: boolean;
  button: QuickSellButtonWithDetails | null;
  mode: "create" | "edit";
}

/** Link type filter for toolbar (all = no filter) */
export type QuickSellLinkTypeFilter =
  | "all"
  | "product"
  | "category"
  | "unassigned";

/** Sort key for current page buttons */
export type QuickSellSortKey = "position" | "label";

/**
 * Preset colors for button customization
 */
export const BUTTON_COLOR_PRESETS = [
  { name: "Blue", color: "#3b82f6", textColor: "#ffffff" },
  { name: "Cyan", color: "#06b6d4", textColor: "#ffffff" },
  { name: "Green", color: "#22c55e", textColor: "#ffffff" },
  { name: "Yellow", color: "#eab308", textColor: "#000000" },
  { name: "Orange", color: "#f97316", textColor: "#ffffff" },
  { name: "Red", color: "#ef4444", textColor: "#ffffff" },
  { name: "Pink", color: "#ec4899", textColor: "#ffffff" },
  { name: "Purple", color: "#a855f7", textColor: "#ffffff" },
  { name: "Gray", color: "#6b7280", textColor: "#ffffff" },
  { name: "Slate", color: "#64748b", textColor: "#ffffff" },
] as const;

/**
 * Shape options for button customization
 */
export const BUTTON_SHAPE_OPTIONS: { value: ButtonShape; label: string }[] = [
  { value: "rectangle", label: "Rectangle" },
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
];
