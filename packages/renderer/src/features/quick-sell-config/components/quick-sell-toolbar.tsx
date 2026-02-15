/**
 * QuickSellToolbar
 *
 * Toolbar for Filters (link type), Sort, Reset page, and Export.
 * Matches RoleTable toolbar style (DataTableToolbar).
 */

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { Download, Filter, RotateCcw, SlidersHorizontal } from "lucide-react";
import type {
  QuickSellButtonWithDetails,
  QuickSellLinkTypeFilter,
  QuickSellSortKey,
} from "../types";

interface QuickSellToolbarProps {
  linkTypeFilter: QuickSellLinkTypeFilter;
  onLinkTypeFilterChange: (value: QuickSellLinkTypeFilter) => void;
  sortKey: QuickSellSortKey;
  onSortKeyChange: (value: QuickSellSortKey) => void;
  onResetPage: () => void;
  onExport: () => void;
  currentPageName: string | null;
  hasCurrentPage: boolean;
  buttonCount: number;
}

export function QuickSellToolbar({
  linkTypeFilter,
  onLinkTypeFilterChange,
  sortKey,
  onSortKeyChange,
  onResetPage,
  onExport,
  hasCurrentPage,
  currentPageName,
  buttonCount,
}: QuickSellToolbarProps) {
  const hasLinkTypeFilter = linkTypeFilter !== "all";
  const activeFilterCount = hasLinkTypeFilter ? 1 : 0;

  return (
    <DataTableToolbar>
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-xs">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Link type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onLinkTypeFilterChange("all")}
            >
              All {linkTypeFilter === "all" ? "✓" : ""}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onLinkTypeFilterChange("product")}
            >
              Product {linkTypeFilter === "product" ? "✓" : ""}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onLinkTypeFilterChange("category")}
            >
              Category {linkTypeFilter === "category" ? "✓" : ""}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onLinkTypeFilterChange("unassigned")}
            >
              Unassigned {linkTypeFilter === "unassigned" ? "✓" : ""}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSortKeyChange("position")}>
              Position {sortKey === "position" ? "✓" : ""}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSortKeyChange("label")}>
              Label {sortKey === "label" ? "✓" : ""}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onResetPage}
          disabled={!hasCurrentPage}
          aria-label={`Reset ${currentPageName ?? "page"} to unassigned buttons`}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset page
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onExport}
          disabled={buttonCount === 0}
          aria-label="Export current page config"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </DataTableToolbar>
  );
}

/**
 * Filter current page buttons by link type and search (client-side).
 * Grid always displays in position order; sortKey is used for Export only.
 */
export function filterButtons(
  buttons: QuickSellButtonWithDetails[],
  linkTypeFilter: QuickSellLinkTypeFilter,
  searchTerm: string,
): QuickSellButtonWithDetails[] {
  const searchLower = searchTerm.toLowerCase().trim();

  return buttons.filter((btn) => {
    if (linkTypeFilter !== "all" && btn.linkType !== linkTypeFilter) return false;
    if (!searchLower) return true;
    const label = getButtonDisplayLabel(btn);
    const productName = btn.product?.name?.toLowerCase() ?? "";
    const categoryName = btn.category?.name?.toLowerCase() ?? "";
    return (
      label.toLowerCase().includes(searchLower) ||
      productName.includes(searchLower) ||
      categoryName.includes(searchLower)
    );
  });
}

/**
 * Sort buttons for export (by position or label).
 */
export function sortButtonsForExport(
  buttons: QuickSellButtonWithDetails[],
  sortKey: QuickSellSortKey,
): QuickSellButtonWithDetails[] {
  if (sortKey === "label") {
    return [...buttons].sort((a, b) =>
      getButtonDisplayLabel(a).localeCompare(getButtonDisplayLabel(b)),
    );
  }
  return [...buttons].sort((a, b) => a.position - b.position);
}

export function getButtonDisplayLabel(
  button: QuickSellButtonWithDetails,
): string {
  if (button.label) return button.label;
  if (button.linkType === "product" && button.product) return button.product.name;
  if (button.linkType === "category" && button.category)
    return button.category.name;
  return "Unassigned Button";
}
