/**
 * Quick Sell API
 *
 * Preload API for quick sell button configuration.
 */

import { ipcRenderer } from "electron";

export const quickSellAPI = {
  /**
   * Get all pages with buttons for a business
   */
  getPages: (businessId: string) =>
    ipcRenderer.invoke("quickSell:getPages", businessId),

  /**
   * Initialize default pages and buttons for a business
   */
  initializeDefaults: (businessId: string) =>
    ipcRenderer.invoke("quickSell:initializeDefaults", businessId),

  /**
   * Update a button's configuration
   */
  updateButton: (buttonData: {
    id: string;
    label?: string | null;
    color?: string;
    textColor?: string;
    shape?: string;
    linkType?: string;
    productId?: string | null;
    categoryId?: string | null;
    isActive?: boolean;
  }) => ipcRenderer.invoke("quickSell:updateButton", buttonData),

  /**
   * Swap positions of two buttons
   */
  swapPositions: (data: { buttonId1: string; buttonId2: string }) =>
    ipcRenderer.invoke("quickSell:swapPositions", data),

  /**
   * Reset a page to unassigned buttons
   */
  resetPage: (pageId: string) =>
    ipcRenderer.invoke("quickSell:resetPage", pageId),

  /**
   * Get a single button with product/category details
   */
  getButton: (buttonId: string) =>
    ipcRenderer.invoke("quickSell:getButton", buttonId),
};
