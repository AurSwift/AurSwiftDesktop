/**
 * ESC/POS receipt formatting helpers.
 *
 * Intentionally returns a latin1 string so it can be converted to bytes in
 * either main (Node Buffer) or renderer (Uint8Array) contexts.
 */

export type ReceiptPaperWidthMm = 58 | 80 | number;

export type ReceiptPaymentMethod =
  | "cash"
  | "card"
  | "mobile"
  | "voucher"
  | "split"
  | "viva_wallet"
  | "unknown";

export interface EscposReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  weight?: number;
  unit?: string;
  sku?: string;
}

export interface EscposReceiptInput {
  paperWidthMm?: ReceiptPaperWidthMm;
  charactersPerLine?: number;

  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  vatNumber?: string;
  headerLines?: string[]; // Optional extra header lines (e.g. town, website, survey URL)

  receiptNumber: string;
  transactionId: string;
  date: string;
  time: string;
  dateTimeIso?: string; // Optional, used for card-slip section
  cashierName?: string;

  items: EscposReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;

  paymentMethod: ReceiptPaymentMethod;
  cashAmount?: number;
  cardAmount?: number;
  change?: number;

  /**
   * Optional "customer copy" banner shown above the card slip section.
   */
  customerCopyLine?: string;

  /**
   * Optional card slip section (for card / viva_wallet payments).
   * Printed only when at least one field is provided.
   */
  cardSlip?: {
    provider?: string; // e.g. "VIVA WALLET"
    brand?: string; // e.g. "VISA"
    last4?: string; // e.g. "1234"
    type?: string; // e.g. "DEBIT" | "CREDIT"
    authCode?: string;
    terminalId?: string; // TID
    terminalTransactionId?: string; // TRN / terminal transaction id
  };

  /**
   * Optional VAT summary table (Lidl-style).
   * If omitted, a simplified single-rate summary is printed when tax>0.
   */
  vatSummary?: Array<{
    code: string; // A/B/C...
    ratePercent: number; // 0, 5, 20...
    sales: number; // net sales (ex VAT)
    vat: number; // VAT amount
  }>;

  /**
   * Optional barcode printed near the bottom of the receipt.
   * Intended for receipt number / transaction reference.
   */
  barcodeValue?: string;

  footerLines?: string[];
}

export function estimateCharactersPerLine(paperWidthMm?: ReceiptPaperWidthMm): number {
  if (!paperWidthMm) return 48; // default to 80mm printers (Metapace T-3)
  return paperWidthMm >= 80 ? 48 : 32;
}

function repeat(char: string, count: number): string {
  return Array.from({ length: Math.max(0, count) })
    .fill(char)
    .join("");
}

function centerText(text: string, width: number): string {
  const t = (text || "").trim();
  if (t.length >= width) return t.slice(0, width);
  const pad = Math.floor((width - t.length) / 2);
  return repeat(" ", pad) + t;
}

function wrapText(text: string, width: number): string[] {
  const t = (text || "").trim();
  if (!t) return [""];
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (w.length > width) {
      lines.push(w.slice(0, width));
      line = w.slice(width);
    } else {
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatLine(left: string, right: string, width: number): string {
  const l = left ?? "";
  const r = right ?? "";
  const space = Math.max(1, width - l.length - r.length);
  if (l.length + r.length >= width) {
    return `${l.slice(0, Math.max(0, width - r.length - 1))} ${r}`.slice(0, width);
  }
  return `${l}${repeat(" ", space)}${r}`;
}

function padRight(text: string, width: number): string {
  const t = text ?? "";
  if (t.length >= width) return t.slice(0, width);
  return t + repeat(" ", width - t.length);
}

function padLeft(text: string, width: number): string {
  const t = text ?? "";
  if (t.length >= width) return t.slice(t.length - width);
  return repeat(" ", width - t.length) + t;
}

function formatColumns(
  cols: Array<{ text: string; width: number; align?: "left" | "right" }>,
  totalWidth: number
): string {
  const rendered = cols
    .map((c) => {
      const align = c.align ?? "left";
      return align === "right" ? padLeft(c.text, c.width) : padRight(c.text, c.width);
    })
    .join("");
  return rendered.slice(0, totalWidth);
}

function hasCardSlipSection(input: EscposReceiptInput): boolean {
  const s = input.cardSlip;
  if (!s) return false;
  return Boolean(
    s.provider ||
      s.brand ||
      s.last4 ||
      s.type ||
      s.authCode ||
      s.terminalId ||
      s.terminalTransactionId
  );
}

function maskPanFromLast4(last4?: string): string | null {
  const digits = (last4 || "").replace(/\D/g, "");
  if (digits.length !== 4) return null;
  return `************${digits}`;
}

function buildEscposBarcodeCode128Latin1(value: string): string {
  const v = (value || "").trim();
  if (!v) return "";

  // Code128 subset B prefix: {B
  const data = `{B${v}`;
  const n = data.length;
  if (n <= 0 || n > 255) return "";

  let out = "";
  out += "\x1D\x48\x00"; // GS H 0  -> HRI off (barcode only)
  out += "\x1D\x68\x50"; // GS h 80 -> barcode height
  out += "\x1D\x77\x02"; // GS w 2  -> module width
  out += "\x1D\x6B\x49"; // GS k 73 -> Code128
  out += String.fromCharCode(n);
  out += data;
  out += "\n";
  return out;
}

function normalizePaymentMethod(method: string): ReceiptPaymentMethod {
  const m = (method || "").toLowerCase();
  if (
    m === "cash" ||
    m === "card" ||
    m === "mobile" ||
    m === "voucher" ||
    m === "split" ||
    m === "viva_wallet"
  ) {
    return m;
  }
  return "unknown";
}

export function buildEscposReceiptLatin1(input: EscposReceiptInput): string {
  const width = input.charactersPerLine ?? estimateCharactersPerLine(input.paperWidthMm);
  const sep = repeat("-", width);

  let receipt = "";

  // Initialize
  receipt += "\x1B\x40"; // ESC @

  // Header
  receipt += "\x1B\x61\x01"; // center
  receipt += "\x1D\x21\x11"; // double height+width
  receipt += centerText(input.storeName, width) + "\n";
  receipt += "\x1D\x21\x00"; // normal

  if (input.storeAddress) receipt += centerText(input.storeAddress, width) + "\n";
  if (input.storePhone) receipt += centerText(input.storePhone, width) + "\n";
  if (input.vatNumber) receipt += centerText(`VAT NO: ${input.vatNumber}`, width) + "\n";
  if (input.headerLines?.length) {
    for (const line of input.headerLines) {
      wrapText(line, width).forEach((l) => (receipt += centerText(l, width) + "\n"));
    }
  }
  receipt += "\n";

  // Transaction info
  receipt += "\x1B\x61\x00"; // left
  receipt += sep + "\n";
  receipt += formatLine("RECEIPT NO", input.receiptNumber, width) + "\n";
  receipt += formatLine("DATE", input.date, width) + "\n";
  receipt += formatLine("TIME", input.time, width) + "\n";
  if (input.cashierName) receipt += formatLine("CASHIER", input.cashierName, width) + "\n";
  receipt += sep + "\n";

  // Items
  for (const item of input.items) {
    const amount = `£${item.totalPrice.toFixed(2)}`;

    // First line attempts: name (left) + amount (right)
    const maxName = Math.max(1, width - amount.length - 1);
    const nameLines = wrapText(item.name, maxName);
    if (nameLines.length > 0) {
      receipt += formatLine(nameLines[0], amount, width) + "\n";
      for (const extra of nameLines.slice(1)) {
        receipt += extra + "\n";
      }
    } else {
      receipt += formatLine("", amount, width) + "\n";
    }

    // Quantity/unit price line (compact)
    const qtyPart =
      item.weight && item.unit
        ? `${item.quantity} x £${item.unitPrice.toFixed(2)}/${item.unit}`
        : `${item.quantity} x £${item.unitPrice.toFixed(2)}`;
    receipt += `  ${qtyPart}\n`;

    if (item.weight && item.unit) {
      receipt += `  WT ${item.weight.toFixed(3)} ${item.unit}\n`;
    }
    if (item.sku) receipt += `  SKU ${item.sku}\n`;
  }

  // Totals
  receipt += sep + "\n";
  receipt += formatLine("SUBTOTAL", `£${input.subtotal.toFixed(2)}`, width) + "\n";
  receipt += formatLine("TOTAL VAT", `£${input.tax.toFixed(2)}`, width) + "\n";
  receipt += "\x1B\x45\x01"; // bold on
  receipt += formatLine("TOTAL", `£${input.total.toFixed(2)}`, width) + "\n";
  receipt += "\x1B\x45\x00"; // bold off
  receipt += sep + "\n";

  // Payment
  const method = normalizePaymentMethod(input.paymentMethod);
  if (method === "cash") {
    const cash = input.cashAmount ?? input.total;
    receipt += formatLine("CASH", `£${cash.toFixed(2)}`, width) + "\n";
    if ((input.change ?? 0) > 0) {
      receipt += formatLine("CHANGE", `£${(input.change ?? 0).toFixed(2)}`, width) + "\n";
    }
  } else if (method === "card" || method === "viva_wallet" || method === "mobile") {
    const amt = input.cardAmount ?? input.total;
    receipt += formatLine("CARD", `£${amt.toFixed(2)}`, width) + "\n";
  } else if (method !== "unknown") {
    receipt += formatLine(method.toUpperCase(), `£${input.total.toFixed(2)}`, width) + "\n";
  }

  receipt += "\n";

  // Customer copy + card slip (for card payments)
  if (hasCardSlipSection(input)) {
    const customerCopy =
      input.customerCopyLine?.trim() || "*CUSTOMER COPY* - PLEASE RETAIN RECEIPT";
    receipt += "\x1B\x61\x01"; // center
    receipt += centerText(customerCopy, width) + "\n";
    receipt += "\x1B\x61\x00"; // left
    receipt += "\n";

    if (input.cardSlip?.provider) {
      receipt += "\x1B\x61\x01";
      receipt += centerText(input.cardSlip.provider, width) + "\n";
      receipt += "\x1B\x61\x00";
    }

    const slipDate = input.dateTimeIso ? new Date(input.dateTimeIso) : null;
    if (slipDate && !isNaN(slipDate.getTime())) {
      const dd = String(slipDate.getDate()).padStart(2, "0");
      const mm = String(slipDate.getMonth() + 1).padStart(2, "0");
      const yy = String(slipDate.getFullYear()).slice(-2);
      const hh = String(slipDate.getHours()).padStart(2, "0");
      const mi = String(slipDate.getMinutes()).padStart(2, "0");
      const ss = String(slipDate.getSeconds()).padStart(2, "0");
      receipt += formatLine("DATE", `${dd}/${mm}/${yy}`, width) + "\n";
      receipt += formatLine("TIME", `${hh}:${mi}:${ss}`, width) + "\n";
    } else {
      receipt += formatLine("DATE", input.date, width) + "\n";
      receipt += formatLine("TIME", input.time, width) + "\n";
    }

    const brand = input.cardSlip?.brand?.toUpperCase();
    const masked = maskPanFromLast4(input.cardSlip?.last4);
    if (brand || masked) {
      receipt += formatLine("CARD", `${brand ?? ""} ${masked ?? ""}`.trim(), width) + "\n";
    }
    if (input.cardSlip?.type) {
      receipt += formatLine("TYPE", input.cardSlip.type.toUpperCase(), width) + "\n";
    }
    if (input.cardSlip?.authCode) {
      receipt += formatLine("AUTH CODE", input.cardSlip.authCode, width) + "\n";
    }
    if (input.cardSlip?.terminalId) {
      receipt += formatLine("TID", input.cardSlip.terminalId, width) + "\n";
    }
    if (input.cardSlip?.terminalTransactionId) {
      receipt += formatLine("TRN", input.cardSlip.terminalTransactionId, width) + "\n";
    }

    receipt += "\n";
  }

  // VAT summary (Lidl-style)
  const defaultVatSummary =
    input.subtotal > 0
      ? [
          {
            code: "A",
            ratePercent:
              input.subtotal > 0 ? Math.round((input.tax / input.subtotal) * 100) : 0,
            sales: input.subtotal,
            vat: input.tax,
          },
        ]
      : null;
  const vatRows =
    input.vatSummary?.length && input.vatSummary.length > 0
      ? input.vatSummary
      : defaultVatSummary;
  if (vatRows && vatRows.length > 0) {
    receipt += sep + "\n";
    receipt += "VAT SUMMARY\n";
    receipt += formatColumns(
      [
        { text: "VAT", width: 6, align: "left" },
        { text: "SALES", width: Math.floor((width - 6) / 2), align: "right" },
        { text: "VAT", width: width - 6 - Math.floor((width - 6) / 2), align: "right" },
      ],
      width
    ) + "\n";
    for (const r of vatRows) {
      const label = `${r.code} ${r.ratePercent}%`;
      receipt += formatColumns(
        [
          { text: label, width: 10, align: "left" },
          { text: `£${r.sales.toFixed(2)}`, width: Math.floor((width - 10) / 2), align: "right" },
          {
            text: `£${r.vat.toFixed(2)}`,
            width: width - 10 - Math.floor((width - 10) / 2),
            align: "right",
          },
        ],
        width
      ) + "\n";
    }
    receipt += "\n";
  }

  // Barcode (receipt number by default) — printed before the footer "THANK YOU" line
  const barcodeValue = (input.barcodeValue || input.receiptNumber || "").trim();
  if (barcodeValue) {
    receipt += "\n";
    receipt += buildEscposBarcodeCode128Latin1(barcodeValue);
  }

  // Footer
  receipt += "\x1B\x61\x01"; // center
  receipt += centerText("THANK YOU FOR SHOPPING WITH US", width) + "\n";
  if (input.footerLines?.length) {
    receipt += "\n";
    for (const line of input.footerLines) {
      wrapText(line, width).forEach((l) => (receipt += centerText(l, width) + "\n"));
    }
  }

  // Finish
  receipt += "\x1B\x61\x00"; // left
  receipt += "\x1B\x64\x03"; // feed 3 lines
  receipt += "\x1D\x56\x42"; // partial cut

  return receipt;
}

/**
 * Convert an ESC/POS latin1 receipt payload into a human-readable plain-text
 * preview by stripping control bytes and skipping barcode payloads.
 *
 * This is intended for UI preview only (not for printing).
 */
export function stripEscposToPlainText(receiptLatin1: string): string {
  const bytes = Array.from(receiptLatin1 || "", (c) => c.charCodeAt(0) & 0xff);

  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];

    // ESC ...
    if (b === 0x1b) {
      const cmd = bytes[i + 1];
      if (cmd === undefined) break;

      // ESC @
      if (cmd === 0x40) {
        i += 1;
        continue;
      }

      // ESC a n, ESC E n, ESC d n
      if (cmd === 0x61 || cmd === 0x45 || cmd === 0x64) {
        i += 2;
        continue;
      }

      // Unknown ESC sequence: drop ESC + next byte
      i += 1;
      continue;
    }

    // GS ...
    if (b === 0x1d) {
      const cmd = bytes[i + 1];
      if (cmd === undefined) break;

      // GS ! n, GS H n, GS h n, GS w n
      if (cmd === 0x21 || cmd === 0x48 || cmd === 0x68 || cmd === 0x77) {
        i += 2;
        continue;
      }

      // GS V m (cut)
      if (cmd === 0x56) {
        i += 2;
        continue;
      }

      // GS k ... (barcode) -> skip payload
      if (cmd === 0x6b) {
        const m = bytes[i + 2];
        if (m === undefined) break;

        // Code128: GS k 0x49 n d1..dn
        if (m === 0x49) {
          const n = bytes[i + 3];
          if (n === undefined) break;
          i += 3 + n;
          continue;
        }

        // Unknown barcode type: drop GS k m
        i += 2;
        continue;
      }

      // Unknown GS sequence: drop GS + next byte
      i += 1;
      continue;
    }

    // Preserve newlines, drop other control characters.
    if (b === 0x0a) {
      out += "\n";
      continue;
    }
    if (b === 0x0d) continue;
    if (b < 0x20) continue;

    out += String.fromCharCode(b);
  }

  // Trim trailing whitespace per line for readability in UI.
  return out
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trimEnd();
}

