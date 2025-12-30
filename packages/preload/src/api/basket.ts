import { ipcRenderer } from "electron";
import type { SavedBasket, CartSession, CartItem } from "@app/main/src/database/schema.js";

export interface SaveBasketRequest {
  cartSessionId: string;
  basketName: string;
  businessId: string;
  savedBy: string;
  shiftId?: string | null;
  customerEmail?: string | null;
  notes?: string | null;
  expirationDays?: number;
}

export interface RetrieveBasketRequest {
  basketId: string;
  newCartSessionId: string;
  businessId: string;
}

export interface GetBasketsRequest {
  businessId: string;
  savedBy?: string;
  status?: "active" | "retrieved" | "expired" | "deleted";
  limit?: number;
  offset?: number;
}

export interface UpdateBasketRequest {
  basketId: string;
  updates: {
    name?: string;
    notes?: string;
    customerEmail?: string;
    status?: "active" | "retrieved" | "expired" | "deleted";
  };
}

export interface BasketWithItems {
  basket: SavedBasket;
  cartSession: CartSession;
  items: CartItem[];
}

export interface RetrieveBasketResult {
  basket: SavedBasket;
  items: CartItem[];
  itemsAdded: number;
  warnings: string[];
}

export const basketAPI = {
  /**
   * Save a cart session as a saved basket
   */
  saveBasket: (data: SaveBasketRequest) =>
    ipcRenderer.invoke("basket:save", data),

  /**
   * Get saved basket by basket code (for QR code lookup)
   */
  getBasketByCode: (basketCode: string) =>
    ipcRenderer.invoke("basket:getByCode", basketCode),

  /**
   * Retrieve a saved basket (load items into new cart session)
   */
  retrieveBasket: (data: RetrieveBasketRequest) =>
    ipcRenderer.invoke("basket:retrieve", data),

  /**
   * Get saved basket by ID with items
   */
  getBasketById: (basketId: string) =>
    ipcRenderer.invoke("basket:getById", basketId),

  /**
   * Get all saved baskets for a business
   */
  getSavedBaskets: (data: GetBasketsRequest) =>
    ipcRenderer.invoke("basket:getAll", data),

  /**
   * Update saved basket
   */
  updateBasket: (data: UpdateBasketRequest) =>
    ipcRenderer.invoke("basket:update", data),

  /**
   * Delete saved basket
   */
  deleteBasket: (basketId: string) =>
    ipcRenderer.invoke("basket:delete", basketId),

  /**
   * Send basket QR code via email
   */
  sendEmail: (data: { basketId: string; customerEmail: string }) =>
    ipcRenderer.invoke("basket:sendEmail", data),

  /**
   * Generate receipt HTML for saved basket
   */
  generateReceipt: (basketId: string) =>
    ipcRenderer.invoke("basket:generateReceipt", basketId),
};

