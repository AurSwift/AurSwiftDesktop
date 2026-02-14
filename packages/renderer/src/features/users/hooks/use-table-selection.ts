import { useState, useEffect, useCallback, useMemo } from "react";

export interface UseTableSelectionOptions<T> {
  /**
   * Array of items
   */
  items: T[];
  /**
   * Function to get unique ID from item
   */
  getId: (item: T) => string;
  /**
   * Initial selected IDs
   */
  initialSelectedIds?: Set<string>;
}

export interface UseTableSelectionReturn {
  /**
   * Set of selected IDs
   */
  selectedIds: Set<string>;
  /**
   * Number of selected items
   */
  selectedCount: number;
  /**
   * Whether all items are selected
   */
  allSelected: boolean;
  /**
   * Whether some (but not all) items are selected
   */
  someSelected: boolean;
  /**
   * Whether a specific ID is selected
   */
  isSelected: (id: string) => boolean;
  /**
   * Toggle selection for a specific ID
   */
  toggleSelection: (id: string) => void;
  /**
   * Select all items
   */
  selectAll: () => void;
  /**
   * Deselect all items
   */
  deselectAll: () => void;
  /**
   * Toggle select all (select all if none/some selected, deselect all if all selected)
   */
  toggleSelectAll: () => void;
  /**
   * Set specific IDs as selected
   */
  setSelectedIds: (ids: Set<string>) => void;
}

/**
 * Generic table row selection hook
 * Handles row selection state and operations
 * Automatically cleans up selection when items are removed
 *
 * @example
 * ```tsx
 * const selection = useTableSelection({
 *   items: users,
 *   getId: (user) => user.id
 * });
 *
 * // Use in table
 * <Checkbox
 *   checked={selection.isSelected(user.id)}
 *   onCheckedChange={() => selection.toggleSelection(user.id)}
 * />
 * ```
 */
export function useTableSelection<T>(
  options: UseTableSelectionOptions<T>,
): UseTableSelectionReturn {
  const { items, getId, initialSelectedIds = new Set() } = options;

  const [selectedIds, setSelectedIds] =
    useState<Set<string>>(initialSelectedIds);

  // Get all current item IDs
  const allItemIds = useMemo(() => {
    return new Set(items.map(getId));
  }, [items, getId]);

  // Cleanup: Remove selected IDs that no longer exist in items
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;

      const next = new Set<string>();
      prev.forEach((id) => {
        if (allItemIds.has(id)) {
          next.add(id);
        }
      });

      // Only update if changed
      if (next.size !== prev.size) {
        return next;
      }

      return prev;
    });
  }, [allItemIds]);

  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getId)));
  }, [items, getId]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [allSelected, selectAll, deselectAll]);

  return {
    selectedIds,
    selectedCount,
    allSelected,
    someSelected,
    isSelected,
    toggleSelection,
    selectAll,
    deselectAll,
    toggleSelectAll,
    setSelectedIds,
  };
}
