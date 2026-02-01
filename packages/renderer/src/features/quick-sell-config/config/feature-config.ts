/**
 * Quick Sell Config Feature Configuration
 *
 * View registration for the quick sell button configuration feature.
 */

import { lazy } from "react";
import { QUICK_SELL_PERMISSIONS } from "./permissions";
import { QUICK_SELL_ROUTES } from "./navigation";
import type { ViewConfig } from "@/navigation/types";

/**
 * Quick Sell Config Views Registry
 *
 * Views for the quick sell configuration feature.
 * Spread into the main VIEW_REGISTRY.
 */
export const quickSellViews: Record<string, ViewConfig> = {
  [QUICK_SELL_ROUTES.CONFIG]: {
    id: QUICK_SELL_ROUTES.CONFIG,
    level: "root",
    component: lazy(() => import("../views/quick-sell-config-view")),
    metadata: {
      title: "Quick Sell Buttons",
      description: "Configure quick sell button layouts",
    },
    permissions: [QUICK_SELL_PERMISSIONS.MANAGE],
    requiresAuth: true,
  },
};
