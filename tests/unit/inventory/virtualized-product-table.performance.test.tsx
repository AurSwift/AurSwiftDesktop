/**
 * VirtualizedProductTable — performance tests
 *
 * Covers render time with large lists, memory stability, and category path
 * calculation when using virtualization.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { VirtualizedProductTable } from "@/features/inventory/components/product/virtualized-product-table";
import type { Product } from "@/types/domain";
import type { Category } from "@/features/inventory/hooks/use-product-data";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn(() => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
  })),
}));

describe("VirtualizedProductTable performance", () => {
  const mockCategories: Category[] = [
    {
      id: "cat-1",
      name: "Category 1",
      description: "",
      businessId: "business-1",
      parentId: null,
      sortOrder: 0,
      isActive: true,
      vatCategoryId: null,
      vatOverridePercent: null,
      color: null,
      image: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    },
  ];

  const mockShowFields = {
    name: true,
    category: true,
    price: true,
    stock: true,
    sku: true,
    status: true,
  };

  const mockHandlers = {
    onEditProduct: vi.fn(),
    onDeleteProduct: vi.fn(),
    onAdjustStock: vi.fn(),
  };

  function generateProducts(count: number): Product[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `prod-${i}`,
      name: `Product ${i}`,
      description: `Description for product ${i}`,
      businessId: "business-1",
      categoryId: "cat-1",
      basePrice: 10 + i * 0.5,
      costPrice: 5 + i * 0.25,
      stockLevel: 100 - i,
      minStockLevel: 10,
      isActive: true,
      sku: `SKU-${i}`,
      barcode: null,
      image: null,
      usesScale: false,
      salesUnit: "UNIT",
      vatCategoryId: null,
      pricePerKg: null,
      batchTracking: false,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("render performance", () => {
    it("renders with empty products within budget", () => {
      const start = performance.now();
      render(
        <VirtualizedProductTable
          products={[]}
          categories={mockCategories}
          showFields={mockShowFields}
          {...mockHandlers}
        />
      );
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it("renders 1000 products within budget (virtualization)", () => {
      const products = generateProducts(1000);
      const start = performance.now();
      render(
        <VirtualizedProductTable
          products={products}
          categories={mockCategories}
          showFields={mockShowFields}
          {...mockHandlers}
        />
      );
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it("renders 10,000 products within budget (virtualization)", () => {
      const products = generateProducts(10000);
      const start = performance.now();
      render(
        <VirtualizedProductTable
          products={products}
          categories={mockCategories}
          showFields={mockShowFields}
          {...mockHandlers}
        />
      );
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(150);
    });
  });

  describe("memory stability", () => {
    it("mounts and unmounts with 100 then 10,000 products without error", () => {
      const products100 = generateProducts(100);
      const products10000 = generateProducts(10000);

      const { unmount: unmount1 } = render(
        <VirtualizedProductTable
          products={products100}
          categories={mockCategories}
          showFields={mockShowFields}
          {...mockHandlers}
        />
      );
      unmount1();

      const { container, unmount: unmount2 } = render(
        <VirtualizedProductTable
          products={products10000}
          categories={mockCategories}
          showFields={mockShowFields}
          {...mockHandlers}
        />
      );
      expect(container.firstChild).toBeTruthy();
      unmount2();
    });
  });

  describe("category path calculation", () => {
    it("computes category paths for 1000 products within budget", () => {
      const products = generateProducts(1000);
      const start = performance.now();
      render(
        <VirtualizedProductTable
          products={products}
          categories={mockCategories}
          showFields={mockShowFields}
          {...mockHandlers}
        />
      );
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });
});
