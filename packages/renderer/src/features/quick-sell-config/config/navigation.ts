/**
 * Quick Sell Config Navigation Routes
 *
 * Centralized route definitions for the quick sell configuration feature.
 */

export const QUICK_SELL_ROUTES = {
  /** Quick sell button configuration view */
  CONFIG: "settings:quick-sell-config",
} as const;

export type QuickSellRoute =
  (typeof QUICK_SELL_ROUTES)[keyof typeof QUICK_SELL_ROUTES];
