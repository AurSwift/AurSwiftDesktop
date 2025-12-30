/**
 * Saved Basket IPC Handlers
 *
 * Handles IPC communication for saved basket operations:
 * - Save basket with QR code generation
 * - Retrieve basket by QR code
 * - Email QR code
 * - Generate receipt
 */

import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import { emailService } from "../services/email-service.js";
import JsBarcode from "jsbarcode";
import { JSDOM } from "jsdom";

const logger = getLogger("basketHandlers");

export function registerBasketHandlers() {
  // ============================================================================
  // SAVED BASKET IPC HANDLERS
  // ============================================================================

  /**
   * Save a cart session as a saved basket
   */
  ipcMain.handle(
    "basket:save",
    async (
      event,
      data: {
        cartSessionId: string;
        basketName: string;
        businessId: string;
        savedBy: string;
        shiftId?: string | null;
        customerEmail?: string | null;
        notes?: string | null;
        expirationDays?: number;
      }
    ) => {
      try {
        const db = await getDatabase();
        const basket = await db.savedBaskets.saveBasket(
          data.cartSessionId,
          data.basketName,
          data.businessId,
          data.savedBy,
          data.shiftId || null,
          data.customerEmail || null,
          data.notes || null,
          data.expirationDays || 7
        );

        // Get cart items for summary
        const items = await db.cart.getItemsBySession(data.cartSessionId);

        return {
          success: true,
          data: {
            basket: JSON.parse(JSON.stringify(basket)),
            items: JSON.parse(JSON.stringify(items)),
            basketCode: basket.basketCode,
          },
        };
      } catch (error) {
        logger.error("Save basket IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to save basket",
        };
      }
    }
  );

  /**
   * Get saved basket by basket code (for QR code lookup)
   */
  ipcMain.handle("basket:getByCode", async (event, basketCode: string) => {
    try {
      const db = await getDatabase();
      const basket = await db.savedBaskets.getBasketByCode(basketCode);

      if (!basket) {
        return {
          success: false,
          message: "Basket not found or invalid code",
        };
      }

      // Get basket with items
      const basketWithItems = await db.savedBaskets.getBasketWithItems(
        basket.id
      );

      return {
        success: true,
        data: JSON.parse(JSON.stringify(basketWithItems)),
      };
    } catch (error) {
      logger.error("Get basket by code IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to get basket by code",
      };
    }
  });

  /**
   * Retrieve a saved basket (load items into new cart session)
   */
  ipcMain.handle(
    "basket:retrieve",
    async (
      event,
      data: {
        basketId: string;
        newCartSessionId: string;
        businessId: string;
      }
    ) => {
      try {
        const db = await getDatabase();
        const result = await db.savedBaskets.retrieveBasket(
          data.basketId,
          data.newCartSessionId,
          data.businessId
        );

        // Reload cart items to get updated session
        const items = await db.cart.getItemsBySession(data.newCartSessionId);

        return {
          success: true,
          data: {
            basket: JSON.parse(JSON.stringify(result.basket)),
            items: JSON.parse(JSON.stringify(items)),
            itemsAdded: result.itemsAdded,
            warnings: result.warnings,
          },
        };
      } catch (error) {
        logger.error("Retrieve basket IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to retrieve basket",
        };
      }
    }
  );

  /**
   * Get saved basket by ID with items
   */
  ipcMain.handle("basket:getById", async (event, basketId: string) => {
    try {
      const db = await getDatabase();
      const basketWithItems = await db.savedBaskets.getBasketWithItems(
        basketId
      );

      return {
        success: true,
        data: JSON.parse(JSON.stringify(basketWithItems)),
      };
    } catch (error) {
      logger.error("Get basket by ID IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to get basket",
      };
    }
  });

  /**
   * Get all saved baskets for a business
   */
  ipcMain.handle(
    "basket:getAll",
    async (
      event,
      data: {
        businessId: string;
        savedBy?: string;
        status?: "active" | "retrieved" | "expired" | "deleted";
        limit?: number;
        offset?: number;
      }
    ) => {
      try {
        const db = await getDatabase();
        const baskets = await db.savedBaskets.getSavedBaskets(data.businessId, {
          savedBy: data.savedBy,
          status: data.status,
          limit: data.limit,
          offset: data.offset,
        });

        return {
          success: true,
          data: JSON.parse(JSON.stringify(baskets)),
        };
      } catch (error) {
        logger.error("Get all baskets IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to get saved baskets",
        };
      }
    }
  );

  /**
   * Update saved basket
   */
  ipcMain.handle(
    "basket:update",
    async (
      event,
      data: {
        basketId: string;
        updates: {
          name?: string;
          notes?: string;
          customerEmail?: string;
          status?: "active" | "retrieved" | "expired" | "deleted";
        };
      }
    ) => {
      try {
        const db = await getDatabase();
        const basket = await db.savedBaskets.updateBasket(
          data.basketId,
          data.updates
        );

        return {
          success: true,
          data: JSON.parse(JSON.stringify(basket)),
        };
      } catch (error) {
        logger.error("Update basket IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to update basket",
        };
      }
    }
  );

  /**
   * Delete saved basket
   */
  ipcMain.handle("basket:delete", async (event, basketId: string) => {
    try {
      const db = await getDatabase();
      await db.savedBaskets.deleteBasket(basketId);

      return {
        success: true,
      };
    } catch (error) {
      logger.error("Delete basket IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete basket",
      };
    }
  });

  /**
   * Send basket QR code via email
   */
  ipcMain.handle(
    "basket:sendEmail",
    async (
      event,
      data: {
        basketId: string;
        customerEmail: string;
      }
    ) => {
      try {
        const db = await getDatabase();
        const basketWithItems = await db.savedBaskets.getBasketWithItems(
          data.basketId
        );

        if (!basketWithItems) {
          return {
            success: false,
            message: "Basket not found",
          };
        }

        // Calculate totals
        const subtotal = basketWithItems.items.reduce(
          (sum, item) => sum + (item.totalPrice || 0),
          0
        );
        const tax = basketWithItems.items.reduce(
          (sum, item) => sum + (item.taxAmount || 0),
          0
        );
        const total = subtotal + tax;

        // Get business info if available
        const business = db.businesses.getBusinessById(
          basketWithItems.basket.businessId
        );

        // Send email using email service
        const emailSent = await emailService.sendBasketEmail({
          basketCode: basketWithItems.basket.basketCode,
          basketName: basketWithItems.basket.name,
          customerEmail: data.customerEmail,
          items: basketWithItems.items.map((item) => ({
            name: item.itemName || "Item",
            quantity: item.quantity || undefined,
            weight: item.weight || undefined,
            unitOfMeasure: item.unitOfMeasure || undefined,
            unitPrice: item.unitPrice || 0,
            totalPrice: item.totalPrice || 0,
          })),
          subtotal,
          tax,
          total,
          expiresAt: basketWithItems.basket.expiresAt
            ? new Date(basketWithItems.basket.expiresAt)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          businessName: business?.businessName,
          businessAddress: business?.address,
          businessPhone: business?.phone,
          businessEmail: business?.email,
        });

        if (!emailSent) {
          return {
            success: false,
            message:
              "Failed to send email. Please check email service configuration.",
          };
        }

        // Check if email was actually sent or just logged (console mode)
        const isConsoleMode = !emailService.isConfiguredForSending();

        // Update basket with customer email if not already set
        if (!basketWithItems.basket.customerEmail) {
          await db.savedBaskets.updateBasket(data.basketId, {
            customerEmail: data.customerEmail,
          });
        }

        return {
          success: true,
          message: isConsoleMode
            ? `Email logged (console mode). Configure SMTP in settings for actual delivery.`
            : `Email sent successfully to ${data.customerEmail}`,
        };
      } catch (error) {
        logger.error("Send basket email IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to send email",
        };
      }
    }
  );

  /**
   * Generate receipt HTML for saved basket
   */
  ipcMain.handle("basket:generateReceipt", async (event, basketId: string) => {
    try {
      const db = await getDatabase();
      const basketWithItems = await db.savedBaskets.getBasketWithItems(
        basketId
      );

      if (!basketWithItems) {
        return {
          success: false,
          message: "Basket not found",
        };
      }

      // Generate receipt HTML
      const receiptHTML = await generateReceiptHTML(basketWithItems);

      return {
        success: true,
        data: {
          html: receiptHTML,
          basketCode: basketWithItems.basket.basketCode,
          basketName: basketWithItems.basket.name,
        },
      };
    } catch (error) {
      logger.error("Generate basket receipt IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to generate receipt",
      };
    }
  });
}

/**
 * Generate receipt HTML for saved basket
 */
async function generateReceiptHTML(basketWithItems: {
  basket: any;
  cartSession: any;
  items: any[];
}): Promise<string> {
  const { basket, items } = basketWithItems;

  const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const tax = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  const total = subtotal + tax;

  const savedDate = new Date(basket.savedAt).toLocaleString();
  const expiresDate = basket.expiresAt
    ? new Date(basket.expiresAt).toLocaleString()
    : "N/A";

  // Generate barcode as SVG
  let barcodeSVG = "";
  try {
    const dom = new JSDOM();
    const document = dom.window.document;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    JsBarcode(svg, basket.basketCode, {
      format: "CODE128",
      width: 2,
      height: 80,
      displayValue: false, // Only show barcode diagram, text shown separately
      margin: 10,
      background: "#ffffff",
      lineColor: "#000000",
    });

    barcodeSVG = svg.outerHTML;
  } catch (error) {
    logger.warn("Failed to generate barcode:", error);
    // Fallback to text-only
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Saved Basket Receipt - ${basket.basketCode}</title>
  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 10px;
      }
    }
    body {
      font-family: monospace;
      font-size: 12px;
      line-height: 1.4;
      max-width: 80mm;
      margin: 0 auto;
      padding: 10px;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .barcode-container {
      text-align: center;
      margin: 15px 0;
      padding: 10px;
      border: 1px solid #000;
      background: white;
    }
    .barcode-text {
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 2px;
      margin: 10px 0;
    }
    .items {
      margin: 10px 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .item-details {
      font-size: 10px;
      color: #666;
      margin-left: 10px;
    }
    .totals {
      border-top: 1px dashed #000;
      margin-top: 10px;
      padding-top: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .footer {
      text-align: center;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px dashed #000;
      font-size: 10px;
    }
    .instructions {
      background: #f5f5f5;
      padding: 10px;
      margin: 10px 0;
      border: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>SAVED BASKET</h2>
    <p><strong>${basket.name}</strong></p>
    <p>Code: ${basket.basketCode}</p>
    <p>Saved: ${savedDate}</p>
    <p>Expires: ${expiresDate}</p>
  </div>

  <div class="barcode-container">
    ${
      barcodeSVG
        ? barcodeSVG
        : `<div class="barcode-text">${basket.basketCode}</div>`
    }
    <p style="margin-top: 10px;"><strong>Scan this barcode to retrieve your basket</strong></p>
    <p style="font-size: 10px; color: #666;">Code: ${basket.basketCode}</p>
  </div>

  <div class="items">
    <h3>ITEMS:</h3>
    ${items
      .map(
        (item) => `
      <div class="item-row">
        <span>${item.itemName || "Item"}</span>
        <span>£${(item.totalPrice || 0).toFixed(2)}</span>
      </div>
      <div class="item-details">
        ${
          item.itemType === "WEIGHT"
            ? `${item.weight?.toFixed(3) || "0.000"} ${
                item.unitOfMeasure || "kg"
              }`
            : `${item.quantity || 1}x`
        } @ £${(item.unitPrice || 0).toFixed(2)}
      </div>
    `
      )
      .join("")}
  </div>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>£${subtotal.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Tax:</span>
      <span>£${tax.toFixed(2)}</span>
    </div>
    <div class="total-row" style="font-weight: bold; font-size: 14px;">
      <span>Total:</span>
      <span>£${total.toFixed(2)}</span>
    </div>
  </div>

  <div class="instructions">
    <p><strong>INSTRUCTIONS:</strong></p>
    <p>• Scan the barcode above to retrieve this basket</p>
    <p>• Or provide code: ${basket.basketCode}</p>
    <p>• Expires: ${expiresDate}</p>
  </div>

  <div class="footer">
    <p>Thank you for shopping with us!</p>
  </div>
</body>
</html>
  `;
}
