import { describe, it, expect } from "vitest";
import { calculateCartTotals, calculateCategoryPrice } from "@/features/sales/utils/price-calculations";

describe("price-calculations", () => {
  describe("calculateCartTotals", () => {
    it("returns zeros for an empty cart", () => {
      expect(calculateCartTotals([] as any)).toEqual({
        subtotal: 0,
        tax: 0,
        total: 0,
      });
    });

    it("calculates subtotal by extracting tax from each item's totalPrice", () => {
      const items = [
        { totalPrice: 12, taxAmount: 2 },
        { totalPrice: 5, taxAmount: 0.5 },
      ] as any;

      const result = calculateCartTotals(items);

      // item subtotals: (12 - 2) + (5 - 0.5) = 14.5
      expect(result.subtotal).toBeCloseTo(14.5, 6);
      expect(result.tax).toBeCloseTo(2.5, 6);
      expect(result.total).toBeCloseTo(17.0, 6);
    });

    it("treats missing taxAmount as 0", () => {
      const items = [{ totalPrice: 10 }, { totalPrice: 2.25, taxAmount: 0.25 }] as any;

      const result = calculateCartTotals(items);
      expect(result.subtotal).toBeCloseTo((10 - 0) + (2.25 - 0.25), 6);
      expect(result.tax).toBeCloseTo(0 + 0.25, 6);
      expect(result.total).toBeCloseTo(12.25, 6);
    });
  });

  describe("calculateCategoryPrice", () => {
    it("calculates subtotal, tax, and total", () => {
      const result = calculateCategoryPrice(100, 0.2);
      expect(result.subtotal).toBe(100);
      expect(result.taxAmount).toBe(20);
      expect(result.totalPrice).toBe(120);
    });

    it("throws for non-positive price", () => {
      expect(() => calculateCategoryPrice(0)).toThrow(/invalid price/i);
      expect(() => calculateCategoryPrice(-1)).toThrow(/invalid price/i);
    });
  });
});

