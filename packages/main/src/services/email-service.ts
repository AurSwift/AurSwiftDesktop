/**
 * Email Service
 *
 * Handles sending emails for saved baskets and other notifications
 * Supports SMTP and email service providers (Resend, SendGrid, etc.)
 */

import { getLogger } from "../utils/logger.js";
import bwipjs from "bwip-js";

const logger = getLogger("email-service");

interface EmailConfig {
  provider: "smtp" | "resend" | "sendgrid" | "console";
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  resendApiKey?: string;
  sendgridApiKey?: string;
  fromEmail: string;
  fromName: string;
}

interface BasketEmailData {
  basketCode: string;
  basketName: string;
  customerEmail: string;
  items: Array<{
    name: string;
    quantity?: number;
    weight?: number;
    unitOfMeasure?: string;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  expiresAt: Date;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
}

interface TransactionReceiptEmailData {
  customerEmail: string;
  receiptNumber: string;
  transactionId: string;
  date: string;
  time: string;
  items: Array<{
    name: string;
    quantity?: number;
    weight?: number;
    unit?: string;
    unitPrice: number;
    totalPrice: number;
    sku?: string;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  cashAmount?: number;
  cardAmount?: number;
  change?: number;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  vatNumber?: string;
  cashierName?: string;
}

class EmailService {
  private config: EmailConfig | null = null;
  private transporter: any = null;

  /**
   * Check if email service is configured for actual sending (not console mode)
   */
  isConfiguredForSending(): boolean {
    return this.config !== null && this.config.provider !== "console";
  }

  /**
   * Get current email provider mode
   */
  getProvider(): string | null {
    return this.config?.provider || null;
  }

  /**
   * Initialize email service with configuration
   * @returns Status object indicating if service is in degraded mode
   */
  async initialize(
    config: EmailConfig
  ): Promise<{ success: boolean; degraded: boolean; message?: string }> {
    this.config = config;

    if (config.provider === "smtp" && config.smtp) {
      // Dynamic import for nodemailer
      let nodemailerModule: any;
      try {
        nodemailerModule = await import("nodemailer");
      } catch (error) {
        logger.warn("nodemailer not installed, falling back to console mode");
        this.config = { ...config, provider: "console" };
        return {
          success: true,
          degraded: true,
          message: "Email service unavailable - nodemailer not installed",
        };
      }

      this.transporter = nodemailerModule.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.auth,
      });

      // Verify connection
      try {
        await this.transporter.verify();
        logger.info("Email service initialized successfully (SMTP)");
        return { success: true, degraded: false };
      } catch (error) {
        logger.warn(
          "Failed to verify SMTP connection (possibly offline), email sending will be attempted when needed:",
          error
        );
        // Don't throw - allow the service to continue in degraded mode
        // Emails will fail when attempted, but app will still work
        logger.info(
          "Email service initialized in degraded mode - emails may fail until network is restored"
        );
        return {
          success: true,
          degraded: true,
          message:
            "Email service offline - emails will not be sent until network is restored",
        };
      }
    } else if (config.provider === "console") {
      logger.info(
        "Email service initialized (console mode - emails will be logged)"
      );
      return { success: true, degraded: false };
    } else {
      logger.warn(
        `Email provider ${config.provider} not yet implemented, using console mode`
      );
      return {
        success: true,
        degraded: true,
        message: `Email provider ${config.provider} not implemented`,
      };
    }
  }

  /**
   * Send saved basket email with barcode
   */
  async sendBasketEmail(data: BasketEmailData): Promise<boolean> {
    if (!this.config) {
      logger.error("Email service not initialized");
      return false;
    }

    try {
      // Generate barcode PNG first - we need it for both CID attachment and HTML
      let barcodePngBuffer: Buffer | null = null;
      try {
        barcodePngBuffer = await bwipjs.toBuffer({
          bcid: "code128",
          text: data.basketCode,
          scale: 3,
          height: 12,
          includetext: false,
          backgroundcolor: "ffffff",
        });
        logger.info(
          `Barcode PNG generated, size: ${barcodePngBuffer.length} bytes`
        );
      } catch (error) {
        logger.error("Failed to generate barcode PNG:", error);
      }

      const emailHTML = this.generateBasketEmailHTML(
        data,
        barcodePngBuffer !== null
      );
      const emailText = this.generateBasketEmailText(data);

      // Build mail options with CID attachment for barcode
      // Gmail and most email clients block base64 data URIs but support CID attachments
      const mailOptions: {
        from: string;
        to: string;
        subject: string;
        text: string;
        html: string;
        attachments?: Array<{
          filename: string;
          content: Buffer;
          cid: string;
        }>;
      } = {
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: data.customerEmail,
        subject: `Your Saved Basket - ${data.basketName}`,
        text: emailText,
        html: emailHTML,
      };

      // Add barcode as CID attachment if generated successfully
      if (barcodePngBuffer) {
        mailOptions.attachments = [
          {
            filename: "barcode.png",
            content: barcodePngBuffer,
            cid: "barcode@basket", // Referenced in HTML as cid:barcode@basket
          },
        ];
      }

      if (this.config.provider === "console") {
        // Log email instead of sending
        logger.info("=== EMAIL (Console Mode) ===");
        logger.info(`To: ${data.customerEmail}`);
        logger.info(`Subject: ${mailOptions.subject}`);
        logger.info(`HTML Content Length: ${emailHTML.length} bytes`);
        logger.info(`Attachments: ${mailOptions.attachments?.length || 0}`);
        return true;
      }

      if (this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        logger.info(`Email sent successfully: ${info.messageId}`);
        return true;
      }

      logger.error("No email transporter available");
      return false;
    } catch (error) {
      logger.error("Failed to send email:", error);
      return false;
    }
  }

  /**
   * Send transaction receipt email
   */
  async sendTransactionReceipt(
    data: TransactionReceiptEmailData
  ): Promise<boolean> {
    if (!this.config) {
      logger.error("Email service not initialized");
      return false;
    }

    try {
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
          `Receipt barcode PNG generated, size: ${barcodePngBuffer.length} bytes`
        );
      } catch (error) {
        logger.error("Failed to generate receipt barcode PNG:", error);
      }

      const emailHTML = this.generateTransactionReceiptHTML(
        data,
        barcodePngBuffer !== null
      );
      const emailText = this.generateTransactionReceiptText(data);

      // Build mail options with CID attachment for barcode
      const mailOptions: {
        from: string;
        to: string;
        subject: string;
        text: string;
        html: string;
        attachments?: Array<{
          filename: string;
          content: Buffer;
          cid: string;
        }>;
      } = {
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: data.customerEmail,
        subject: `Receipt #${data.receiptNumber} - ${
          data.businessName || "Your Purchase"
        }`,
        text: emailText,
        html: emailHTML,
      };

      // Add barcode as CID attachment if generated successfully
      if (barcodePngBuffer) {
        mailOptions.attachments = [
          {
            filename: "receipt-barcode.png",
            content: barcodePngBuffer,
            cid: "barcode@receipt", // Referenced in HTML as cid:barcode@receipt
          },
        ];
      }

      if (this.config.provider === "console") {
        // Log email instead of sending
        logger.info("=== TRANSACTION RECEIPT EMAIL (Console Mode) ===");
        logger.info(`To: ${data.customerEmail}`);
        logger.info(`Subject: ${mailOptions.subject}`);
        logger.info(`Receipt Number: ${data.receiptNumber}`);
        logger.info(`Transaction ID: ${data.transactionId}`);
        logger.info(`HTML Content Length: ${emailHTML.length} bytes`);
        return true;
      }

      if (this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        logger.info(
          `Transaction receipt email sent successfully: ${info.messageId}`
        );
        return true;
      }

      logger.error("No email transporter available");
      return false;
    } catch (error) {
      logger.error("Failed to send transaction receipt email:", error);
      return false;
    }
  }

  /**
   * Generate HTML email template for saved basket
   * @param data - Basket email data
   * @param hasBarcodeAttachment - Whether barcode PNG is attached as CID
   */
  private generateBasketEmailHTML(
    data: BasketEmailData,
    hasBarcodeAttachment: boolean
  ): string {
    const businessName = data.businessName || "Our Store";
    const businessAddress = data.businessAddress || "";
    const businessPhone = data.businessPhone || "";
    const businessEmail = data.businessEmail || this.config?.fromEmail || "";

    const expiresDate = data.expiresAt.toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Use CID reference for barcode image - this is the ONLY reliable way
    // to display images in Gmail and most email clients
    // Gmail blocks: inline SVG, base64 data URIs
    // Gmail supports: CID attachments (Content-ID embedded images)
    const barcodeImageTag = hasBarcodeAttachment
      ? `<img src="cid:barcode@basket" alt="Barcode: ${data.basketCode}" style="display: block; margin: 0 auto; max-width: 100%;" />`
      : `<div style="font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #2c3e50; padding: 20px; font-family: monospace;">${data.basketCode}</div>`;

    const itemsHTML = data.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${
          item.name
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
          ${
            item.weight
              ? `${item.weight.toFixed(3)} ${item.unitOfMeasure || "kg"}`
              : `${item.quantity || 1}x`
          }
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">£${item.unitPrice.toFixed(
          2
        )}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">£${item.totalPrice.toFixed(
          2
        )}</td>
      </tr>
    `
      )
      .join("");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Saved Basket</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #2c3e50; margin: 0 0 10px 0;">${businessName}</h1>
    ${
      businessAddress
        ? `<p style="margin: 5px 0; color: #666;">${businessAddress}</p>`
        : ""
    }
    ${
      businessPhone
        ? `<p style="margin: 5px 0; color: #666;">Phone: ${businessPhone}</p>`
        : ""
    }
  </div>

  <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #2c3e50; margin-top: 0;">Your Saved Basket</h2>
    <p>Hello,</p>
    <p>Your basket has been saved. You can retrieve it by scanning the barcode below when you return to the store.</p>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Basket Name:</strong> ${
        data.basketName
      }</p>
      <p style="margin: 5px 0;"><strong>Basket Code:</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 14px;">${
        data.basketCode
      }</code></p>
      <p style="margin: 5px 0;"><strong>Expires:</strong> ${expiresDate}</p>
    </div>

    <div style="text-align: center; margin: 30px 0; padding: 20px; background: white; border: 2px solid #2c3e50; border-radius: 8px;">
      ${barcodeImageTag}
      <p style="font-size: 18px; font-weight: bold; letter-spacing: 2px; color: #2c3e50; margin: 15px 0 5px 0;">${
        data.basketCode
      }</p>
      <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">Scan this barcode at the store</p>
    </div>

    <div style="margin: 30px 0;">
      <h3 style="color: #2c3e50; margin-bottom: 15px;">Items in your basket:</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Item</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Quantity</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Unit Price</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding: 10px; text-align: right; border-top: 2px solid #dee2e6;"><strong>Subtotal:</strong></td>
            <td style="padding: 10px; text-align: right; border-top: 2px solid #dee2e6;"><strong>£${data.subtotal.toFixed(
              2
            )}</strong></td>
          </tr>
          <tr>
            <td colspan="3" style="padding: 10px; text-align: right;"><strong>Tax:</strong></td>
            <td style="padding: 10px; text-align: right;"><strong>£${data.tax.toFixed(
              2
            )}</strong></td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td colspan="3" style="padding: 10px; text-align: right; font-size: 18px;"><strong>Total:</strong></td>
            <td style="padding: 10px; text-align: right; font-size: 18px;"><strong>£${data.total.toFixed(
              2
            )}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2196F3; margin: 20px 0;">
      <h3 style="color: #1976D2; margin-top: 0;">How to retrieve your basket:</h3>
      <ol style="margin: 10px 0; padding-left: 20px;">
        <li>Visit our store</li>
        <li>Show the barcode above to the cashier, or</li>
        <li>Scan the barcode using our barcode scanner</li>
        <li>Your basket will be loaded automatically</li>
      </ol>
      <p style="margin: 10px 0 0 0; color: #666;"><strong>Note:</strong> This basket expires on ${expiresDate}. Please retrieve it before then.</p>
    </div>
  </div>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; font-size: 12px;">
    <p>${businessName}</p>
    ${businessAddress ? `<p>${businessAddress}</p>` : ""}
    ${businessPhone ? `<p>Phone: ${businessPhone}</p>` : ""}
    ${businessEmail ? `<p>Email: ${businessEmail}</p>` : ""}
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate plain text email for saved basket
   */
  private generateBasketEmailText(data: BasketEmailData): string {
    const businessName = data.businessName || "Our Store";
    const expiresDate = data.expiresAt.toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const itemsText = data.items
      .map(
        (item) =>
          `  - ${item.name}: ${
            item.weight
              ? `${item.weight.toFixed(3)} ${item.unitOfMeasure || "kg"}`
              : `${item.quantity || 1}x`
          } @ £${item.unitPrice.toFixed(2)} = £${item.totalPrice.toFixed(2)}`
      )
      .join("\n");

    return `
Your Saved Basket - ${data.basketName}

Hello,

Your basket has been saved. You can retrieve it by scanning the barcode when you return to the store.

Basket Details:
- Basket Name: ${data.basketName}
- Basket Code: ${data.basketCode}
- Expires: ${expiresDate}

Basket Code: ${data.basketCode}
(Scan this code at the store)

Items in your basket:
${itemsText}

Subtotal: £${data.subtotal.toFixed(2)}
Tax: £${data.tax.toFixed(2)}
Total: £${data.total.toFixed(2)}

How to retrieve your basket:
1. Visit our store
2. Show the barcode above to the cashier, or
3. Scan the barcode using our barcode scanner
4. Your basket will be loaded automatically

Note: This basket expires on ${expiresDate}. Please retrieve it before then.

Thank you for shopping with ${businessName}!
    `.trim();
  }

  /**
   * Generate HTML email template for transaction receipt
   * @param data - Transaction receipt email data
   * @param hasBarcodeAttachment - Whether barcode PNG is attached as CID
   */
  private generateTransactionReceiptHTML(
    data: TransactionReceiptEmailData,
    hasBarcodeAttachment: boolean
  ): string {
    const businessName = data.businessName || "Our Store";
    const businessAddress = data.businessAddress || "";
    const businessPhone = data.businessPhone || "";
    const businessEmail = data.businessEmail || this.config?.fromEmail || "";
    const vatNumber = data.vatNumber || "";

    const paymentMethodDisplay = this.formatPaymentMethod(data.paymentMethod);

    // Use CID reference for barcode image - reliable way for Gmail
    const barcodeImageTag = hasBarcodeAttachment
      ? `<img src="cid:barcode@receipt" alt="Barcode: ${data.receiptNumber}" style="display: block; margin: 0 auto; max-width: 100%;" />`
      : `<div style="font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #2c3e50; padding: 15px; font-family: monospace;">${data.receiptNumber}</div>`;

    const itemsHTML = data.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${
          item.name
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${
          item.quantity || 1
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">£${item.totalPrice.toFixed(
          2
        )}</td>
      </tr>
    `
      )
      .join("");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt #${data.receiptNumber}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #2c3e50; margin: 0 0 10px 0;">${businessName}</h1>
    ${
      businessAddress
        ? `<p style="margin: 5px 0; color: #666;">${businessAddress}</p>`
        : ""
    }
    ${
      businessPhone
        ? `<p style="margin: 5px 0; color: #666;">Phone: ${businessPhone}</p>`
        : ""
    }
    ${
      businessEmail
        ? `<p style="margin: 5px 0; color: #666;">Email: ${businessEmail}</p>`
        : ""
    }
    ${
      vatNumber
        ? `<p style="margin: 5px 0; color: #666;">VAT: ${vatNumber}</p>`
        : ""
    }
  </div>

  <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="margin-bottom: 20px;">
      <p style="margin: 5px 0;"><strong>Order Ref:</strong> ${
        data.receiptNumber
      }</p>
      <p style="margin: 5px 0;"><strong>Till No:</strong> Till01</p>
    </div>

    <div style="margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="padding: 8px 0; text-align: left; border-bottom: 1px solid #000; font-weight: bold;">Description</th>
            <th style="padding: 8px 0; text-align: center; border-bottom: 1px solid #000; font-weight: bold;">Qty</th>
            <th style="padding: 8px 0; text-align: right; border-bottom: 1px solid #000; font-weight: bold;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </div>

    <div style="margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Grand Total:</strong> £${data.total.toFixed(
        2
      )}</p>
      <p style="margin: 5px 0;"><strong>Number Of Items:</strong> ${data.items.reduce(
        (sum, item) => sum + (item.quantity || 1),
        0
      )}</p>
      <p style="margin: 5px 0;"><strong>Total:</strong> £${data.total.toFixed(
        2
      )}</p>
      <p style="margin: 5px 0;"><strong>VAT Value:</strong> £${data.tax.toFixed(
        2
      )}</p>
    </div>

    <div style="margin: 20px 0;">
      <p style="margin: 5px 0; font-weight: bold;">Payment Details:</p>
      <p style="margin: 5px 0;">Paid by: ${paymentMethodDisplay}</p>
      ${
        data.change && data.change > 0
          ? `<p style="margin: 5px 0;">Change: £${data.change.toFixed(2)}</p>`
          : ""
      }
    </div>

    <div style="text-align: center; margin: 30px 0; padding: 20px;">
      <div style="margin-bottom: 15px;">
        ${barcodeImageTag}
      </div>
      <p style="margin: 10px 0; font-size: 12px;">${data.date} ${data.time}</p>
      <p style="margin: 10px 0; font-size: 14px; font-weight: bold;">THANK YOU FOR YOUR VISIT</p>
    </div>
  </div>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; font-size: 12px;">
    <p>This is an electronic receipt for your records.</p>
    <p>${businessName}</p>
    ${businessAddress ? `<p>${businessAddress}</p>` : ""}
    ${businessPhone ? `<p>Phone: ${businessPhone}</p>` : ""}
    ${businessEmail ? `<p>Email: ${businessEmail}</p>` : ""}
    <p style="margin-top: 15px; font-size: 10px; color: #999;">Transaction ID: ${
      data.transactionId
    }</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate plain text email for transaction receipt
   */
  private generateTransactionReceiptText(
    data: TransactionReceiptEmailData
  ): string {
    const businessName = data.businessName || "Our Store";

    const itemsText = data.items
      .map(
        (item) =>
          `  ${item.name}\n  Qty: ${
            item.quantity || 1
          } | Total: £${item.totalPrice.toFixed(2)}`
      )
      .join("\n\n");

    const numberOfItems = data.items.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    );

    return `
${businessName}

Order Ref: ${data.receiptNumber}
Till No: Till01
${itemsText}

Grand Total: £${data.total.toFixed(2)}
Number Of Items: ${numberOfItems}
Total: £${data.total.toFixed(2)}
VAT Value: £${data.tax.toFixed(2)}

Payment Details:
Paid by: ${this.formatPaymentMethod(data.paymentMethod)}${
      data.change && data.change > 0
        ? `\nChange: £${data.change.toFixed(2)}`
        : ""
    }

[Receipt Barcode: ${data.receiptNumber}]
${data.date} ${data.time}
THANK YOU FOR YOUR VISIT
    `.trim();
  }

  /**
   * Format payment method for display
   */
  private formatPaymentMethod(method: string): string {
    switch (method.toLowerCase()) {
      case "cash":
        return "Cash";
      case "card":
        return "Card";
      case "mobile":
        return "Mobile Payment";
      case "viva_wallet":
        return "Viva Wallet";
      case "split":
        return "Split Payment";
      case "voucher":
        return "Voucher";
      default:
        return method;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
