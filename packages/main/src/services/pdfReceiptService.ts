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
      // RECEIPT TITLE & BARCODE SECTION
      // ========================================
      doc.font("Helvetica-Bold").fontSize(18);
      doc.text("RECEIPT", leftMargin, y, {
        width: pageWidth,
        align: "center",
      });
      y += 30;

      // Add barcode in a bordered box (matching email receipt style)
      const barcodeBoxY = y;
      const barcodeBoxHeight = barcodePngBuffer ? 130 : 80;

      // Draw border around barcode area
      doc
        .rect(leftMargin + 60, barcodeBoxY, pageWidth - 120, barcodeBoxHeight)
        .stroke("#2c3e50");

      y += 15;

      // Add barcode image if generated, otherwise show text
      if (barcodePngBuffer) {
        const barcodeWidth = 300;
        const barcodeX = leftMargin + (pageWidth - barcodeWidth) / 2;
        doc.image(barcodePngBuffer, barcodeX, y, {
          width: barcodeWidth,
          align: "center",
        });
        y += 50;
      } else {
        // Fallback to text if barcode generation failed
        doc.font("Courier-Bold").fontSize(16);
        doc.text(data.receiptNumber, leftMargin, y, {
          width: pageWidth,
          align: "center",
        });
        y += 25;
      }

      // Receipt number below barcode
      doc.font("Helvetica-Bold").fontSize(12);
      doc.text(`Receipt #${data.receiptNumber}`, leftMargin, y, {
        width: pageWidth,
        align: "center",
      });
      y += 20;

      // Date and time
      doc.font("Helvetica").fontSize(9).fillColor("#666666");
      doc.text(`${data.date} ${data.time}`, leftMargin, y, {
        width: pageWidth,
        align: "center",
      });
      doc.fillColor("#000000");
      y += 25;

      // ========================================
      // TRANSACTION INFO BOX
      // ========================================
      const infoBoxY = y;
      const infoBoxHeight = data.cashierName ? 70 : 55;

      doc
        .rect(leftMargin, infoBoxY, pageWidth, infoBoxHeight)
        .fillAndStroke("#f8f9fa", "#dee2e6");

      y += 12;

      doc.font("Helvetica").fontSize(10).fillColor("#000000");

      // Date & Time row
      doc.font("Helvetica-Bold").text("Date & Time:", leftMargin + 15, y);
      doc
        .font("Helvetica")
        .text(`${data.date} ${data.time}`, leftMargin + 250, y, {
          width: 200,
          align: "right",
        });
      y += 18;

      // Cashier row (if provided)
      if (data.cashierName) {
        doc.font("Helvetica-Bold").text("Cashier:", leftMargin + 15, y);
        doc.font("Helvetica").text(data.cashierName, leftMargin + 250, y, {
          width: 200,
          align: "right",
        });
        y += 18;
      }

      // Payment Method row
      const paymentMethodDisplay =
        data.paymentMethod === "card"
          ? "Card"
          : data.paymentMethod === "cash"
          ? "Cash"
          : data.paymentMethod === "mobile"
          ? "Mobile Payment"
          : "Mixed Payment";
      doc.font("Helvetica-Bold").text("Payment Method:", leftMargin + 15, y);
      doc.font("Helvetica").text(paymentMethodDisplay, leftMargin + 250, y, {
        width: 200,
        align: "right",
      });

      y = infoBoxY + infoBoxHeight + 25;

      // ========================================
      // ITEMS SECTION HEADER
      // ========================================
      doc.font("Helvetica-Bold").fontSize(13);
      doc.text("Items Purchased:", leftMargin, y);
      y += 20;

      // Table header with background
      const headerY = y;
      doc
        .rect(leftMargin, headerY, pageWidth, 22)
        .fillAndStroke("#f8f9fa", "#dee2e6");

      y += 7;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000");
      doc.text("Item", leftMargin + 5, y);
      doc.text("Qty", leftMargin + 280, y, { width: 60, align: "center" });
      doc.text("Unit Price", leftMargin + 340, y, {
        width: 80,
        align: "right",
      });
      doc.text("Total", leftMargin + 420, y, { width: 80, align: "right" });

      y = headerY + 22 + 3;

      doc
        .moveTo(leftMargin, y)
        .lineTo(612 - rightMargin, y)
        .stroke("#dee2e6");
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

        // Item name (with wrapping support)
        doc.text(item.name, leftMargin, y, { width: 260, continued: false });
        const nameHeight = doc.heightOfString(item.name, { width: 260 });

        // SKU on next line if exists
        let skuHeight = 0;
        if (item.sku) {
          y += nameHeight + 2;
          doc.fontSize(8).fillColor("#666666");
          doc.text(`SKU: ${item.sku}`, leftMargin + 10, y);
          skuHeight = 10;
          doc.fontSize(10).fillColor("#000000");
        }

        // Quantity (aligned to same line as item name)
        const qtyText = `${item.quantity} × £${item.unitPrice.toFixed(2)}`;
        doc.text(qtyText, leftMargin + 280, itemStartY, {
          width: 60,
          align: "center",
        });

        // Unit Price
        doc.text(
          `£${item.unitPrice.toFixed(2)}`,
          leftMargin + 340,
          itemStartY,
          {
            width: 80,
            align: "right",
          }
        );

        // Total Price
        doc.text(
          `£${item.totalPrice.toFixed(2)}`,
          leftMargin + 420,
          itemStartY,
          {
            width: 80,
            align: "right",
          }
        );

        // Move Y position for next item
        y = itemStartY + Math.max(nameHeight, 12) + skuHeight + 8;
      }

      y += 10;

      // ========================================
      // TOTALS SECTION (in table footer style)
      // ========================================

      // Top border for totals
      doc
        .moveTo(leftMargin, y)
        .lineTo(612 - rightMargin, y)
        .stroke("#dee2e6");
      y += 12;

      doc.font("Helvetica-Bold").fontSize(11);

      // Subtotal row
      doc.text("Subtotal:", leftMargin + 280, y);
      doc.text(`£${data.subtotal.toFixed(2)}`, leftMargin + 420, y, {
        width: 80,
        align: "right",
      });
      y += 18;

      // Tax row
      doc.text("Tax:", leftMargin + 280, y);
      doc.text(`£${data.tax.toFixed(2)}`, leftMargin + 420, y, {
        width: 80,
        align: "right",
      });
      y += 15;

      // Total row with background
      const totalRowY = y;
      doc
        .rect(leftMargin, totalRowY, pageWidth, 28)
        .fillAndStroke("#f8f9fa", "#dee2e6");

      y += 8;
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#000000");
      doc.text("Total:", leftMargin + 280, y);
      doc.text(`£${data.total.toFixed(2)}`, leftMargin + 420, y, {
        width: 80,
        align: "right",
      });

      y = totalRowY + 28 + 15;

      // ========================================
      // PAYMENT DETAILS (highlighted box like email)
      // ========================================
      if (
        data.cashAmount ||
        data.cardAmount ||
        (data.change && data.change > 0)
      ) {
        const paymentBoxY = y;
        let paymentBoxHeight = 50;

        if (data.cashAmount && data.change && data.change > 0) {
          paymentBoxHeight = 75;
        }

        // Blue highlighted box for payment details
        doc
          .rect(leftMargin, paymentBoxY, pageWidth, paymentBoxHeight)
          .fillAndStroke("#e7f3ff", "#2196F3");

        y += 12;
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000");

        if (data.paymentMethod === "cash" && data.cashAmount) {
          doc.text("Cash Received:", leftMargin + 15, y);
          doc.text(`£${data.cashAmount.toFixed(2)}`, leftMargin + 350, y, {
            width: 100,
            align: "right",
          });
          y += 20;

          if (data.change && data.change > 0) {
            doc.text("Change:", leftMargin + 15, y);
            doc.text(`£${data.change.toFixed(2)}`, leftMargin + 350, y, {
              width: 100,
              align: "right",
            });
          }
        } else if (data.cardAmount) {
          doc.text("Card Payment:", leftMargin + 15, y);
          doc.text(`£${data.cardAmount.toFixed(2)}`, leftMargin + 350, y, {
            width: 100,
            align: "right",
          });
        }

        y = paymentBoxY + paymentBoxHeight + 15;
      }

      // ========================================
      // FOOTER SECTION
      // ========================================
      doc
        .moveTo(leftMargin, y)
        .lineTo(612 - rightMargin, y)
        .stroke("#000000");
      y += 20;

      // Thank you message (matching email receipt)
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#1976D2");
      doc.text("Thank you for your purchase!", leftMargin, y, {
        width: pageWidth,
        align: "center",
      });
      y += 25;
      doc.fillColor("#000000");

      // Only show footer message if provided
      if (data.footerMessage) {
        doc.font("Helvetica").fontSize(11);
        doc.text(data.footerMessage, leftMargin, y, {
          width: pageWidth,
          align: "center",
        });
        y += 20;
      }

      if (data.returnPolicy) {
        doc.fontSize(8).font("Helvetica").fillColor("#666666");
        doc.text(data.returnPolicy, leftMargin, y, {
          width: pageWidth,
          align: "center",
        });
        doc.fillColor("#000000");
        y += 20;
      }

      doc.fontSize(8).font("Helvetica").fillColor("#999999");
      doc.text(`Transaction ID: ${data.transactionId}`, leftMargin, y, {
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
