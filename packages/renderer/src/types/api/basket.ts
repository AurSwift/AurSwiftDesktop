import type { APIResponse } from "./common";

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

export interface SavedBasket {
  id: string;
  name: string;
  basketCode: string;
  cartSessionId: string;
  businessId: string;
  savedBy: string;
  shiftId: string | null;
  savedAt: Date | string;
  expiresAt: Date | string | null;
  retrievedAt: Date | string | null;
  retrievedCount: number;
  status: "active" | "retrieved" | "expired" | "deleted";
  notes: string | null;
  customerEmail: string | null;
  qrCodeDataUrl: string | null;
}

export interface BasketWithItems {
  basket: SavedBasket;
  cartSession: any;
  items: any[];
}

export interface RetrieveBasketResult {
  basket: SavedBasket;
  items: any[];
  itemsAdded: number;
  warnings: string[];
}

export interface BasketAPI {
  saveBasket: (data: SaveBasketRequest) => Promise<APIResponse<BasketWithItems>>;
  getBasketByCode: (basketCode: string) => Promise<APIResponse<BasketWithItems>>;
  retrieveBasket: (data: RetrieveBasketRequest) => Promise<APIResponse<RetrieveBasketResult>>;
  getBasketById: (basketId: string) => Promise<APIResponse<BasketWithItems>>;
  getSavedBaskets: (data: GetBasketsRequest) => Promise<APIResponse<SavedBasket[]>>;
  updateBasket: (data: UpdateBasketRequest) => Promise<APIResponse<SavedBasket>>;
  deleteBasket: (basketId: string) => Promise<APIResponse<void>>;
  sendEmail: (data: { basketId: string; customerEmail: string }) => Promise<APIResponse<void>>;
  generateReceipt: (basketId: string) => Promise<APIResponse<{ html: string; basketCode: string; basketName: string }>>;
}






