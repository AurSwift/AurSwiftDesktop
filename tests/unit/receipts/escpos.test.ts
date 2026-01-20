import { describe, expect, it } from "vitest";
import {
  buildEscposReceiptLatin1,
  estimateCharactersPerLine,
} from "../../../packages/shared/src/receipts/escpos";

describe("ESC/POS receipt formatting", () => {
  it("estimates characters-per-line for common paper widths", () => {
    expect(estimateCharactersPerLine(80)).toBe(48);
    expect(estimateCharactersPerLine(58)).toBe(32);
  });

  it("builds an 80mm receipt with separators, barcode, and cut command", () => {
    const width = 48;
    const receipt = buildEscposReceiptLatin1({
      charactersPerLine: width,
      storeName: "Test Store",
      receiptNumber: "RCP-001",
      transactionId: "tx_123",
      date: "01/01/2026",
      time: "12:34",
      items: [
        {
          name: "Very Long Product Name That Should Wrap Across Lines Cleanly",
          quantity: 1,
          unitPrice: 1.23,
          totalPrice: 1.23,
        },
      ],
      subtotal: 1.23,
      tax: 0,
      total: 1.23,
      paymentMethod: "cash",
      cashAmount: 2,
      change: 0.77,
    });

    expect(receipt).toContain("-".repeat(width));
    // Code128 barcode command (GS k 73)
    expect(receipt).toContain("\x1D\x6B\x49");
    // Partial cut command (GS V 66)
    expect(receipt).toContain("\x1D\x56\x42");

    // Barcode should appear before THANK YOU footer
    expect(receipt.indexOf("\x1D\x6B\x49")).toBeLessThan(
      receipt.indexOf("THANK YOU FOR SHOPPING WITH US")
    );
  });

  it("includes customer copy + card slip section when provided", () => {
    const receipt = buildEscposReceiptLatin1({
      charactersPerLine: 48,
      storeName: "Test Store",
      receiptNumber: "RCP-002",
      transactionId: "tx_456",
      date: "01/01/2026",
      time: "12:34",
      dateTimeIso: "2026-01-01T12:34:56.000Z",
      items: [
        {
          name: "Milk 2L",
          quantity: 1,
          unitPrice: 1.5,
          totalPrice: 1.5,
        },
      ],
      subtotal: 1.5,
      tax: 0,
      total: 1.5,
      paymentMethod: "viva_wallet",
      cardSlip: {
        provider: "VIVA WALLET",
        brand: "VISA",
        last4: "1234",
        type: "DEBIT",
        authCode: "ABC123",
        terminalId: "TID-01",
        terminalTransactionId: "TRN-01",
      },
    });

    expect(receipt).toContain("*CUSTOMER COPY*");
    expect(receipt).toContain("VIVA WALLET");
    expect(receipt).toContain("AUTH CODE");
    expect(receipt).toContain("************1234");
  });
});

