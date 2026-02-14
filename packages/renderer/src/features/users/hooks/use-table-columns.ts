import { useState, useCallback } from "react";

export interface UseTableColumnsOptions {
  /**
   * Initial column visibility state
   */
  initialColumns: Record<string, boolean>;
  /**
   * Optional storage key for persisting column visibility
   */
  storageKey?: string;
}

export interface UseTableColumnsReturn {
  /**
   * Current column visibility state
   */
  columns: Record<string, boolean>;
  /**
   * Check if a column is visible
   */
  isColumnVisible: (columnKey: string) => boolean;
  /**
   * Toggle a column's visibility
   */
  toggleColumn: (columnKey: string) => void;
  /**
   * Set a column's visibility explicitly
   */
  setColumnVisible: (columnKey: string, visible: boolean) => void;
  /**
   * Set all columns visibility
   */
  setColumns: (columns: Record<string, boolean>) => void;
  /**
   * Show all columns
   */
  showAllColumns: () => void;
  /**
   * Hide all columns
   */
  hideAllColumns: () => void;
  /**
   * Reset to initial state
   */
  resetColumns: () => void;
}

/**
 * Generic table column visibility hook
 * Manages column visibility state with optional persistence
 *
 * @example
 * ```tsx
 * const columns = useTableColumns({
 *   initialColumns: {
 *     email: true,
 *     created: true,
 *     status: true
 *   },
 *   storageKey: 'user-table-columns'
 * });
 *
 * // Use in table
 * {columns.isColumnVisible('email') && <TableCell>{user.email}</TableCell>}
 *
 * // Toggle in dropdown
 * <DropdownMenuItem onSelect={() => columns.toggleColumn('email')}>
 *   <Checkbox checked={columns.isColumnVisible('email')} />
 *   Show Email
 * </DropdownMenuItem>
 * ```
 */
export function useTableColumns(
  options: UseTableColumnsOptions,
): UseTableColumnsReturn {
  const { initialColumns, storageKey } = options;

  // Load from localStorage if storageKey is provided
  const getInitialState = (): Record<string, boolean> => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Merge with initial columns to handle new columns
          return { ...initialColumns, ...parsed };
        }
      } catch (error) {
        console.warn(`Failed to load column state from localStorage:`, error);
      }
    }
    return initialColumns;
  };

  const [columns, setColumnsState] =
    useState<Record<string, boolean>>(getInitialState);

  // Save to localStorage if storageKey is provided
  const saveToStorage = useCallback(
    (newColumns: Record<string, boolean>) => {
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(newColumns));
        } catch (error) {
          console.warn(`Failed to save column state to localStorage:`, error);
        }
      }
    },
    [storageKey],
  );

  const setColumns = useCallback(
    (newColumns: Record<string, boolean>) => {
      setColumnsState(newColumns);
      saveToStorage(newColumns);
    },
    [saveToStorage],
  );

  const isColumnVisible = useCallback(
    (columnKey: string): boolean => {
      return columns[columnKey] !== false; // default to true if not defined
    },
    [columns],
  );

  const toggleColumn = useCallback(
    (columnKey: string) => {
      const newColumns = {
        ...columns,
        [columnKey]: !isColumnVisible(columnKey),
      };
      setColumns(newColumns);
    },
    [columns, isColumnVisible, setColumns],
  );

  const setColumnVisible = useCallback(
    (columnKey: string, visible: boolean) => {
      const newColumns = {
        ...columns,
        [columnKey]: visible,
      };
      setColumns(newColumns);
    },
    [columns, setColumns],
  );

  const showAllColumns = useCallback(() => {
    const newColumns = Object.keys(columns).reduce(
      (acc, key) => {
        acc[key] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );
    setColumns(newColumns);
  }, [columns, setColumns]);

  const hideAllColumns = useCallback(() => {
    const newColumns = Object.keys(columns).reduce(
      (acc, key) => {
        acc[key] = false;
        return acc;
      },
      {} as Record<string, boolean>,
    );
    setColumns(newColumns);
  }, [columns, setColumns]);

  const resetColumns = useCallback(() => {
    setColumns(initialColumns);
  }, [initialColumns, setColumns]);

  return {
    columns,
    isColumnVisible,
    toggleColumn,
    setColumnVisible,
    setColumns,
    showAllColumns,
    hideAllColumns,
    resetColumns,
  };
}
