/**
 * Quick Sell API Type Definitions
 *
 * TypeScript interfaces for the Quick Sell IPC API.
 */

import type { APIResponse } from "./common";

/** Button shape variants */
export type ButtonShape = "rectangle" | "rounded" | "pill";

/** Type of item the button links to */
export type ButtonLinkType = "product" | "category" | "unassigned";

/** Quick Sell Page */
export interface QuickSellPage {
  id: string;
  name: string;
  pageIndex: number;
  isMainScreen: boolean;
  isActive: boolean;
  businessId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Quick Sell Button */
export interface QuickSellButton {
  id: string;
  pageId: string;
  position: number;
  label: string | null;
  color: string;
  textColor: string;
  shape: ButtonShape;
  linkType: ButtonLinkType;
  productId: string | null;
  categoryId: string | null;
  isActive: boolean;
  businessId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Quick Sell Button with resolved product/category details */
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

/** Quick Sell Page with its buttons */
export interface QuickSellPageWithButtons extends QuickSellPage {
  buttons: QuickSellButtonWithDetails[];
}

/** Update button input */
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

/** Swap positions input */
export interface SwapButtonPositionsInput {
  buttonId1: string;
  buttonId2: string;
}

/** Quick Sell API */
export interface QuickSellAPI {
  /** Get all pages with buttons for a business */
  getPages(businessId: string): Promise<
    APIResponse & {
      pages?: QuickSellPageWithButtons[];
    }
  >;

  /** Initialize default pages and buttons for a business */
  initializeDefaults(businessId: string): Promise<
    APIResponse & {
      pages?: QuickSellPageWithButtons[];
    }
  >;

  /** Update a button's configuration */
  updateButton(buttonData: UpdateQuickSellButtonInput): Promise<
    APIResponse & {
      button?: QuickSellButtonWithDetails;
    }
  >;

  /** Swap positions of two buttons */
  swapPositions(data: SwapButtonPositionsInput): Promise<APIResponse>;

  /** Reset a page to unassigned buttons */
  resetPage(pageId: string): Promise<APIResponse>;

  /** Get a single button with product/category details */
  getButton(buttonId: string): Promise<
    APIResponse & {
      button?: QuickSellButtonWithDetails;
    }
  >;
}
