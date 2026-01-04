/**
 * PDF Receipt Generation Service (Main Process)
 * Generates PDF receipts using pdfkit in Node.js environment
 * Exposes IPC handler for renderer process to request PDF generation
 */

import { ipcMain } from "electron";
import PDFDocument from "pdfkit";
import { getLogger } from "../utils/logger.js";
import { getDatabase } from "../database/index.js";
import bwipjs from "bwip-js";

const logger = getLogger("pdfReceiptService");

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  weight?: number;
  unit?: string;
  sku?: string;
}

interface ReceiptData {
  // Business ID (required to fetch business details)
  businessId: string;

  // Store Information (optional - will be fetched from database if not provided)
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  vatNumber?: string;

  // Transaction Details
  receiptNumber: string;
  transactionId: string;
  date: string;
  time: string;
  cashierId: string;
  cashierName?: string;

  // Items
  items: ReceiptItem[];

  // Financial
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: "cash" | "card" | "mobile" | "mixed";
  cashAmount?: number;
  cardAmount?: number;
  change?: number;

  // Additional
  loyaltyPoints?: number;
  loyaltyBalance?: number;
  returnPolicy?: string;
  footerMessage?: string;
}

/**
 * Fetch business details from database
 */
async function fetchBusinessDetails(businessId: string): Promise<{
  storeName: string;
  storeAddress: string;
  storePhone: string;
  vatNumber?: string;
}> {
  try {
    const db = await getDatabase();
    const business = db.businesses.getBusinessById(businessId);

    if (!business) {
      logger.warn(
        `Business not found for ID: ${businessId}, using fallback values`
      );
      return {
        storeName: "Business",
        storeAddress: "",
        storePhone: "",
        vatNumber: undefined,
      };
    }

    return {
      storeName: business.businessName || "Business",
      storeAddress: business.address || "",
      storePhone: business.phone || "",
      vatNumber: business.vatNumber || undefined,
    };
  } catch (error) {
    logger.error("Error fetching business details:", error);
    return {
      storeName: "Business",
      storeAddress: "",
      storePhone: "",
      vatNumber: undefined,
    };
  }
}

/**
 * Generate PDF receipt buffer
 */
async function generatePDFReceipt(data: ReceiptData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch business details from database
      const businessDetails = await fetchBusinessDetails(data.businessId);

      // Use provided store info or fallback to database values
      const storeName = data.storeName || businessDetails.storeName;
      const storeAddress = data.storeAddress || businessDetails.storeAddress;
      const storePhone = data.storePhone || businessDetails.storePhone;
      const vatNumber = data.vatNumber || businessDetails.vatNumber;

      // Generate barcode PNG from receipt number
      let barcodePngBuffer: Buffer | null = null;
      try {
        barcodePngBuffer = await bwipjs.toBuffer({
          bcid: "code128",
          text: data.receiptNumber,
          scale: 3,
          height: 12,
          includetext: false,
          backgroundcolor: "ffffff",
        });
        logger.info(
          `Receipt barcode PNG generated for PDF, size: ${barcodePngBuffer.length} bytes`
        );
      } catch (error) {
        logger.error("Failed to generate barcode PNG for PDF:", error);
      }

      const doc = new PDFDocument({
        size: "LETTER",
        margins: {
          top: 50,
          bottom: 50,
          left: 60,
          right: 60,
        },
      });

      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      let y = 50; // Start position
      const pageWidth = 612 - 120; // Letter width minus margins
      const leftMargin = 60;
      const rightMargin = 60;

      // ========================================
      // HEADER SECTION
      // ========================================
      doc.font("Helvetica-Bold").fontSize(24);
      doc.text(storeName, leftMargin, y, {
        width: pageWidth,
        align: "center",
      });
      y += 35;

      if (storeAddress) {
        doc.font("Helvetica").fontSize(10);
        doc.text(storeAddress, leftMargin, y, {
          width: pageWidth,
          align: "center",
        });
        y += 15;
      }

      if (storePhone) {
        doc.font("Helvetica").fontSize(10);
        doc.text(storePhone, leftMargin, y, {
          width: pageWidth,
          align: "center",
        });
        y += 15;
      }

      if (vatNumber) {
        doc.font("Helvetica").fontSize(10);
        doc.text(`VAT: ${vatNumber}`, leftMargin, y, {
          width: pageWidth,
          align: "center",
        });
        y += 15;
      }

      y += 10;
      doc
        .moveTo(leftMargin, y)
        .lineTo(612 - rightMargin, y)
        .stroke("#000000");
      y += 20;

      // ========================================
      // TRANSACTION DETAILS SECTION
      // ========================================
      // Order Ref (Receipt Number)
      doc.font("Helvetica").fontSize(10);
      doc.text(`Order Ref: ${data.receiptNumber}`, leftMargin, y);
      y += 15;

      // Till No (default to Till01 if not provided)
      const tillNo = (data as any).tillNo || "Till01";
      doc.text(`Till No: ${tillNo}`, leftMargin, y);
      y += 15;

      y += 10;

      // ========================================
      // ITEMS TABLE HEADER
      // ========================================
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Description", leftMargin, y);
      doc.text("Qty", leftMargin + 300, y, { width: 50, align: "center" });
      doc.text("Total", leftMargin + 400, y, { width: 100, align: "right" });
      y += 15;

      // Draw line under header
      doc
        .moveTo(leftMargin, y)
        .lineTo(612 - rightMargin, y)
        .stroke("#000000");
      y += 8;

      // ========================================
      // ITEMS LIST
      // ========================================
      doc.font("Helvetica").fontSize(10);

      for (const item of data.items) {
        // Check if we need a new page
        if (y > 680) {
          doc.addPage();
          y = 50;
        }

        const itemStartY = y;

        // Item description (with wrapping support)
        doc.text(item.name, leftMargin, y, { 
          width: 280,
          continued: false 
        });
        const nameHeight = doc.heightOfString(item.name, { width: 280 });

        // Quantity (centered)
        doc.text(
          item.quantity.toString(),
          leftMargin + 300,
          itemStartY,
          { width: 50, align: "center" }
        );

        // Total Price (right aligned)
        doc.text(
          `£${item.totalPrice.toFixed(2)}`,
          leftMargin + 400,
          itemStartY,
          { width: 100, align: "right" }
        );

        // Move Y position for next item
        y = itemStartY + Math.max(nameHeight, 12) + 10;
      }

      y += 10;

      // ========================================
      // SUMMARY SECTION
      // ========================================
      doc.font("Helvetica-Bold").fontSize(11);

      // Grand Total
      doc.text(`Grand Total: £${data.total.toFixed(2)}`, leftMargin, y);
      y += 15;

      // Number Of Items
      const numberOfItems = data.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      doc.text(`Number Of Items: ${numberOfItems}`, leftMargin, y);
      y += 15;

      // Total
      doc.text(`Total: £${data.total.toFixed(2)}`, leftMargin, y);
      y += 15;

      // VAT Value
      doc.text(`VAT Value: £${data.tax.toFixed(2)}`, leftMargin, y);
      y += 20;

      // ========================================
      // PAYMENT DETAILS SECTION
      // ========================================
      doc.font("Helvetica-Bold").fontSize(11);
      doc.text("Payment Details:", leftMargin, y);
      y += 15;

      doc.font("Helvetica").fontSize(10);
      
      // Payment Method
      const paymentMethodDisplay =
        data.paymentMethod === "card"
          ? "Card"
          : data.paymentMethod === "cash"
          ? "Cash"
          : data.paymentMethod === "mobile"
          ? "Mobile Payment"
          : data.paymentMethod === "viva_wallet"
          ? "Viva Wallet"
          : "Mixed Payment";
      doc.text(`Paid by: ${paymentMethodDisplay}`, leftMargin, y);
      y += 15;

      // Change (only show if cash payment and change > 0)
      if (data.paymentMethod === "cash" && data.change && data.change > 0) {
        doc.text(`Change: £${data.change.toFixed(2)}`, leftMargin, y);
        y += 15;
      } else if (data.change && data.change > 0) {
        doc.text(`Change: £${data.change.toFixed(2)}`, leftMargin, y);
        y += 15;
      }

      y += 10;

      // ========================================
      // FOOTER SECTION
      // ========================================
      y += 20;

      // Add barcode above date and time
      if (barcodePngBuffer) {
        const barcodeWidth = 250;
        const barcodeX = leftMargin + (pageWidth - barcodeWidth) / 2;
        doc.image(barcodePngBuffer, barcodeX, y, {
          width: barcodeWidth,
          align: "center",
        });
        y += 60;
      }

      // Date and Time
      doc.font("Helvetica").fontSize(10);
      const footerDateTime = `${data.date} ${data.time}`;
      doc.text(footerDateTime, leftMargin, y, {
        width: pageWidth,
        align: "center",
      });
      y += 20;

      // Thank you message
      doc.font("Helvetica-Bold").fontSize(12);
      doc.text("THANK YOU FOR YOUR VISIT", leftMargin, y, {
        width: pageWidth,
        align: "center",
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Initialize IPC handlers for PDF receipt generation
 */
export function initializePDFReceiptService() {
  // Handle PDF generation request from renderer
  ipcMain.handle(
    "receipt:generate-pdf",
    async (_event, receiptData: ReceiptData) => {
      try {
        if (!receiptData.businessId) {
          logger.error("❌ Business ID is required for PDF receipt generation");
          return {
            success: false,
            error: "Business ID is required",
          };
        }

        logger.info("📄 Generating PDF receipt:", receiptData.receiptNumber);

        const pdfBuffer = await generatePDFReceipt(receiptData);

        logger.info(
          "✅ PDF receipt generated successfully, size:",
          pdfBuffer.length,
          "bytes"
        );

        // Return buffer as base64 string for safe IPC transfer
        return {
          success: true,
          data: pdfBuffer.toString("base64"),
        };
      } catch (error) {
        logger.error("❌ Error generating PDF receipt:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  logger.info("✅ PDF Receipt Service initialized");
}

// Auto-initialize when module is imported
initializePDFReceiptService();
