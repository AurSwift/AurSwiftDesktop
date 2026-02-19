import { ipcRenderer } from "electron";
export const cartAPI = {
  // Cart Session Operations
  createSession: (sessionData: {
    cashierId: string;
    shiftId?: string | null; // Optional for admin/owner mode
    businessId: string;
    stationId?: string;
  }) => ipcRenderer.invoke("cart:createSession", sessionData),

  getSession: (sessionId: string) =>
    ipcRenderer.invoke("cart:getSession", sessionId),

  getActiveSession: (cashierId: string) =>
    ipcRenderer.invoke("cart:getActiveSession", cashierId),

  updateSession: (
    sessionId: string,
    updates: {
      status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
      totalAmount?: number;
      taxAmount?: number;
      customerAgeVerified?: boolean;
      verificationMethod?: "NONE" | "MANUAL" | "SCAN" | "OVERRIDE";
      verifiedBy?: string;
      completedAt?: Date | string;
    }
  ) => ipcRenderer.invoke("cart:updateSession", sessionId, updates),

  completeSession: (sessionId: string) =>
    ipcRenderer.invoke("cart:completeSession", sessionId),

  cancelSession: (sessionId: string) =>
    ipcRenderer.invoke("cart:cancelSession", sessionId),

  // Cart Item Operations
  addItem: (itemData: {
    cartSessionId: string;
    // Either productId OR categoryId must be provided (mutually exclusive)
    productId?: string;
    categoryId?: string;
    itemName?: string; // For category items or when product is deleted
    itemType: "UNIT" | "WEIGHT";
    quantity?: number;
    weight?: number;
    unitOfMeasure?: string;
    unitPrice: number;
    totalPrice: number;
    taxAmount: number;
    batchId?: string;
    batchNumber?: string;
    expiryDate?: Date | string;
    ageRestrictionLevel?: "NONE" | "AGE_16" | "AGE_18" | "AGE_21";
    ageVerified?: boolean;
    scaleReadingWeight?: number;
    scaleReadingStable?: boolean;
  }) => ipcRenderer.invoke("cart:addItem", itemData),

  getItems: (sessionId: string) =>
    ipcRenderer.invoke("cart:getItems", sessionId),

  updateItem: (
    itemId: string,
    updates: {
      quantity?: number;
      weight?: number;
      unitPrice?: number;
      totalPrice?: number;
      taxAmount?: number;
      ageVerified?: boolean;
    }
  ) => ipcRenderer.invoke("cart:updateItem", itemId, updates),

  removeItem: (itemId: string) => ipcRenderer.invoke("cart:removeItem", itemId),

  clearCart: (sessionId: string) =>
    ipcRenderer.invoke("cart:clearCart", sessionId),
};
