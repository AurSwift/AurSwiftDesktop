import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc";

export interface UseTableSortOptions<T, K extends string = string> {
  /**
   * Initial sort key
   */
  initialSortKey?: K;
  /**
   * Initial sort direction
   */
  initialSortDirection?: SortDirection;
  /**
   * Function to get the sort value for a given item and sort key
   */
  getSortValue: (item: T, sortKey: K) => string | number;
}

export interface UseTableSortReturn<T, K extends string = string> {
  /**
   * Current sort key
   */
  sortKey: K;
  /**
   * Current sort direction
   */
  sortDirection: SortDirection;
  /**
   * Sorted data
   */
  sortedData: T[];
  /**
   * Set the sort key (toggles direction if same key)
   */
  setSort: (key: K) => void;
  /**
   * Set sort key and direction explicitly
   */
  setSortKeyAndDirection: (key: K, direction: SortDirection) => void;
}

/**
 * Generic table sorting hook
 * Handles sorting logic for any table data
 *
 * @example
 * ```tsx
 * const { sortedData, sortKey, sortDirection, setSort } = useTableSort({
 *   data: users,
 *   initialSortKey: "createdAt",
 *   initialSortDirection: "desc",
 *   getSortValue: (user, key) => {
 *     switch (key) {
 *       case "name": return user.name.toLowerCase();
 *       case "email": return user.email.toLowerCase();
 *       case "createdAt": return new Date(user.createdAt).getTime();
 *       default: return "";
 *     }
 *   }
 * });
 * ```
 */
export function useTableSort<T, K extends string = string>(
  data: T[],
  options: UseTableSortOptions<T, K>,
): UseTableSortReturn<T, K> {
  const {
    initialSortKey,
    initialSortDirection = "asc",
    getSortValue,
  } = options;

  const [sortKey, setSortKey] = useState<K>(initialSortKey || ("" as K));
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    const copy = [...data];
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);

      // Handle numeric sorting
      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * directionMultiplier;
      }

      // Handle string sorting
      return String(aValue).localeCompare(String(bValue)) * directionMultiplier;
    });

    return copy;
  }, [data, sortKey, sortDirection, getSortValue]);

  const setSort = (key: K) => {
    if (key === sortKey) {
      // Toggle direction if same key
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // New key - set default direction
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const setSortKeyAndDirection = (key: K, direction: SortDirection) => {
    setSortKey(key);
    setSortDirection(direction);
  };

  return {
    sortKey,
    sortDirection,
    sortedData,
    setSort,
    setSortKeyAndDirection,
  };
}
