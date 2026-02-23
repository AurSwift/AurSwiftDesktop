/**
 * Inventory Feature Navigation Routes
 *
 * Centralized route definitions for the inventory feature.
 * These routes are used for navigation throughout the feature.
 */

export const INVENTORY_ROUTES = {
  /** Main inventory dashboard */
  DASHBOARD: "inventory:dashboard",

  /** Product list view */
  PRODUCTS: "inventory:management:products",

  /** Product details view */
  PRODUCT_DETAILS: "inventory:management:product-details",

  /** Batch management view */
  BATCHES: "inventory:management:batches",

  /** Category management view */
  CATEGORIES: "inventory:management:categories",

  /** Stock movement history view */
  HISTORY: "inventory:management:stock-history",

  /** Product expiry dashboard view */
  EXPIRY_DASHBOARD: "inventory:batches:expiry-alerts",

  /** Product management root view */
  PRODUCT_MANAGEMENT: "inventory:management",

  /** Product dashboard nested view */
  PRODUCT_DASHBOARD: "inventory:management:dashboard",

  /** Product list nested view */
  PRODUCT_LIST: "inventory:management:products",

  /** Product details nested view */
  PRODUCT_DETAILS_NESTED: "inventory:management:product-details",

  /** Category management nested view */
  CATEGORY_MANAGEMENT: "inventory:management:categories",

  /** Batch management root view */
  BATCH_MANAGEMENT: "inventory:management:batches",

  /** Batch dashboard nested view */
  BATCH_DASHBOARD: "inventory:batches:dashboard",

  /** Batch list nested view */
  BATCH_LIST: "inventory:batches:list",

  /** Expiry alerts nested view */
  EXPIRY_ALERTS: "inventory:batches:expiry-alerts",

  /** Stock movement history nested view */
  STOCK_MOVEMENT_HISTORY: "inventory:management:stock-history",
} as const;

export type InventoryRoute =
  (typeof INVENTORY_ROUTES)[keyof typeof INVENTORY_ROUTES];
