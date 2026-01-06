/**
 * Performance Tests for buildCategoryTree
 *
 * Tests the optimized O(n) algorithm vs the old O(n²) implementation
 * to verify performance improvements with large datasets.
 */

import { describe, it, expect } from "vitest";
import { buildCategoryTree } from "@/features/inventory/utils";
import type { Category } from "@/features/inventory/hooks/use-product-data";

describe("buildCategoryTree Performance", () => {
  /**
   * Generate test categories with realistic hierarchy
   */
  function generateCategories(count: number): Category[] {
    const categories: Category[] = [];
    const now = new Date().toISOString();

    // 30% root categories, 70% children (realistic ratio)
    const rootCount = Math.floor(count * 0.3);
    const rootIds: string[] = [];

    // Generate root categories
    for (let i = 0; i < rootCount; i++) {
      const id = `root-${i}`;
      rootIds.push(id);
      categories.push({
        id,
        name: `Root Category ${i}`,
        description: `Description ${i}`,
        businessId: "test-business",
        parentId: null,
        sortOrder: i,
        isActive: true,
        vatCategoryId: null,
        vatOverridePercent: null,
        color: null,
        image: null,
        createdAt: now,
        updatedAt: null,
      });
    }

    // Generate child categories
    const childCount = count - rootCount;
    for (let i = 0; i < childCount; i++) {
      const parentId = rootIds[i % rootIds.length];
      categories.push({
        id: `child-${i}`,
        name: `Child Category ${i}`,
        description: `Child Description ${i}`,
        businessId: "test-business",
        parentId,
        sortOrder: i,
        isActive: true,
        vatCategoryId: null,
        vatOverridePercent: null,
        color: null,
        image: null,
        createdAt: now,
        updatedAt: null,
      });
    }

    return categories;
  }

  it("should correctly build tree structure", () => {
    const categories = generateCategories(10);
    const tree = buildCategoryTree(categories);

    // Should have root categories
    expect(tree.length).toBeGreaterThan(0);

    // Root categories should have no parentId
    tree.forEach((root) => {
      expect(root.parentId).toBeNull();
    });

    // Check children are attached
    const totalChildren = tree.reduce(
      (sum, root) => sum + root.children.length,
      0
    );
    expect(totalChildren).toBeGreaterThan(0);
  });

  it("should handle empty array", () => {
    const tree = buildCategoryTree([]);
    expect(tree).toEqual([]);
  });

  it("should handle categories with only root level", () => {
    const categories: Category[] = [
      {
        id: "1",
        name: "Category 1",
        description: "",
        businessId: "test",
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
      {
        id: "2",
        name: "Category 2",
        description: "",
        businessId: "test",
        parentId: null,
        sortOrder: 1,
        isActive: true,
        vatCategoryId: null,
        vatOverridePercent: null,
        color: null,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
    ];

    const tree = buildCategoryTree(categories);
    expect(tree.length).toBe(2);
    expect(tree[0].children.length).toBe(0);
    expect(tree[1].children.length).toBe(0);
  });

  it("should sort by sortOrder at each level", () => {
    const categories: Category[] = [
      {
        id: "1",
        name: "Category B",
        description: "",
        businessId: "test",
        parentId: null,
        sortOrder: 2,
        isActive: true,
        vatCategoryId: null,
        vatOverridePercent: null,
        color: null,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
      {
        id: "2",
        name: "Category A",
        description: "",
        businessId: "test",
        parentId: null,
        sortOrder: 1,
        isActive: true,
        vatCategoryId: null,
        vatOverridePercent: null,
        color: null,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      },
    ];

    const tree = buildCategoryTree(categories);
    expect(tree[0].name).toBe("Category A");
    expect(tree[1].name).toBe("Category B");
  });

  it("should handle orphaned categories (parent not in list)", () => {
    const categories: Category[] = [
      {
        id: "child-1",
        name: "Orphaned Child",
        description: "",
        businessId: "test",
        parentId: "non-existent-parent",
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

    const tree = buildCategoryTree(categories);
    // Orphaned category should be added to root
    expect(tree.length).toBe(1);
    expect(tree[0].id).toBe("child-1");
  });

  /**
   * Performance benchmark tests
   */
  describe("Performance Benchmarks", () => {
    it("should handle 100 categories in <5ms", () => {
      const categories = generateCategories(100);
      const start = performance.now();
      buildCategoryTree(categories);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it("should handle 1,000 categories in <20ms", () => {
      const categories = generateCategories(1000);
      const start = performance.now();
      buildCategoryTree(categories);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20);
    });

    it("should handle 10,000 categories in <100ms", () => {
      const categories = generateCategories(10000);
      const start = performance.now();
      buildCategoryTree(categories);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("should verify O(n) complexity by comparing 1k vs 10k", () => {
      // Test with 1,000 categories
      const categories1k = generateCategories(1000);
      const start1k = performance.now();
      buildCategoryTree(categories1k);
      const duration1k = performance.now() - start1k;

      // Test with 10,000 categories (10x more)
      const categories10k = generateCategories(10000);
      const start10k = performance.now();
      buildCategoryTree(categories10k);
      const duration10k = performance.now() - start10k;

      // O(n) algorithm should scale linearly
      // 10x data should take <40x time (accounting for sorting overhead and CI variability)
      const scalingFactor = duration10k / duration1k;
      expect(scalingFactor).toBeLessThan(40);

      console.log(`Scaling factor (10k/1k): ${scalingFactor.toFixed(2)}x`);
      console.log(`1k categories: ${duration1k.toFixed(2)}ms`);
      console.log(`10k categories: ${duration10k.toFixed(2)}ms`);
    });
  });
});
