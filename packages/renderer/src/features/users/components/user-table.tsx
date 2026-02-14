import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/shared/utils/cn";
import { Download, Filter, SlidersHorizontal, View } from "lucide-react";
import { EmptyState } from "./empty-state";
import { UserTableRow } from "./user-table-row";
import type { StaffUser } from "../schemas/types";
import {
  getUserRoleDisplayName,
} from "@/shared/utils/rbac-helpers";
import { getStaffDisplayName } from "../utils/user-helpers";

// Import new hooks and utilities
import { useTableSort } from "../hooks/use-table-sort";
import { useTablePagination } from "../hooks/use-table-pagination";
import { useTableSelection } from "../hooks/use-table-selection";
import { useTableColumns } from "../hooks/use-table-columns";
import { exportToCSV, formatDateForCSV } from "../utils/csv-export";

interface UserTableProps {
  users: StaffUser[];
  isLoading: boolean;
  searchTerm: string;
  filterRole: string;
  onResetFilters?: () => void;
  onViewUser: (user: StaffUser) => void;
  onEditUser: (user: StaffUser) => void;
  onDeleteUser: (userId: string, userName: string) => void;
  onAddUser: () => void;
  /** When set, pagination is controlled by parent (e.g. shown in mini bar). */
  pagination?: {
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

type SortKey = "name" | "email" | "role" | "createdAt" | "status";

/**
 * User Table Component (Refactored)
 * Now uses extracted hooks for better separation of concerns
 * - useTableSort: Sorting logic
 * - useTablePagination: Pagination with race condition fix
 * - useTableSelection: Row selection management
 * - useTableColumns: Column visibility
 */
export function UserTable({
  users,
  isLoading,
  searchTerm,
  filterRole,
  onResetFilters,
  onViewUser,
  onEditUser,
  onDeleteUser,
  onAddUser,
  pagination: controlledPagination,
}: UserTableProps) {
  const hasActiveFilters = Boolean(searchTerm) || filterRole !== "all";
  const activeFilterCount =
    (searchTerm ? 1 : 0) + (filterRole !== "all" ? 1 : 0);
  const paginationInMiniBar = controlledPagination != null;

  // Sorting hook
  const sort = useTableSort<StaffUser, SortKey>(users, {
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
    getSortValue: (user, key) => {
      switch (key) {
        case "name":
          return getStaffDisplayName(user).toLowerCase();
        case "email":
          return (user.email ?? "").toLowerCase();
        case "role":
          return getUserRoleDisplayName(user).toLowerCase();
        case "status":
          return user.isActive ? 1 : 0;
        case "createdAt":
        default:
          return new Date(user.createdAt).getTime();
      }
    },
  });

  // Pagination hook with controlled mode support
  const pagination = useTablePagination<StaffUser>({
    totalItems: sort.sortedData.length,
    initialPageSize: 10,
    initialPage: 1,
    controlled: controlledPagination,
  });

  // Get paginated data for current page
  const pageUsers = pagination.getPaginatedData(sort.sortedData);

  // Selection hook
  const selection = useTableSelection({
    items: pageUsers,
    getId: (user) => user.id,
  });

  // Column visibility hook with localStorage persistence
  const columns = useTableColumns({
    initialColumns: {
      email: true,
      created: true,
      status: true,
    },
    storageKey: "user-table-columns",
  });

  // CSV Export handler
  const handleExportCsv = () => {
    const rows = pageUsers.map((user) => ({
      Name: getStaffDisplayName(user),
      Email: user.email ?? "",
      Role: getUserRoleDisplayName(user),
      Status: user.isActive ? "Active" : "Inactive",
      "Created At": formatDateForCSV(user.createdAt),
    }));

    exportToCSV(
      rows,
      ["Name", "Email", "Role", "Status", "Created At"],
      "staff-members",
    );
  };

  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2 border-b bg-muted/20 shrink-0">
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
              <DropdownMenuLabel>Active filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                Search: {searchTerm ? `"${searchTerm}"` : "—"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Role: {filterRole === "all" ? "All roles" : filterRole}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!hasActiveFilters || !onResetFilters}
                onSelect={() => onResetFilters?.()}
              >
                Clear filters
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
              <DropdownMenuItem onSelect={() => sort.setSort("name")}>
                Name {sort.sortKey === "name" ? `(${sort.sortDirection})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => sort.setSort("email")}>
                Email{" "}
                {sort.sortKey === "email" ? `(${sort.sortDirection})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => sort.setSort("role")}>
                Role {sort.sortKey === "role" ? `(${sort.sortDirection})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => sort.setSort("status")}>
                Status{" "}
                {sort.sortKey === "status" ? `(${sort.sortDirection})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => sort.setSort("createdAt")}>
                Created{" "}
                {sort.sortKey === "createdAt" ? `(${sort.sortDirection})` : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {selection.selectedCount > 0 && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              {selection.selectedCount} selected
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleExportCsv}
            disabled={pageUsers.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <View className="h-4 w-4 mr-2" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => columns.toggleColumn("email")}>
                {columns.isColumnVisible("email") ? "Hide" : "Show"} email
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => columns.toggleColumn("created")}
              >
                {columns.isColumnVisible("created") ? "Hide" : "Show"} created
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => columns.toggleColumn("status")}>
                {columns.isColumnVisible("status") ? "Hide" : "Show"} status
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="w-full flex-1 min-h-0 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center flex-1 min-h-[200px]">
            <div className="text-xs sm:text-sm text-muted-foreground">
              Loading staff members...
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="p-4 sm:p-6 flex-1">
            <EmptyState
              searchTerm={searchTerm}
              filterRole={filterRole}
              onAddUser={onAddUser}
            />
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-auto">
              <Table className="min-w-[760px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-background">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          selection.allSelected
                            ? true
                            : selection.someSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={selection.toggleSelectAll}
                        aria-label="Select all visible rows"
                      />
                    </TableHead>
                    <TableHead
                      className={cn(
                        "text-xs uppercase tracking-wide text-muted-foreground",
                        "cursor-pointer select-none",
                      )}
                      onClick={() => sort.setSort("name")}
                    >
                      Staff member
                    </TableHead>
                    {columns.isColumnVisible("email") && (
                      <TableHead
                        className={cn(
                          "hidden sm:table-cell text-xs uppercase tracking-wide text-muted-foreground",
                          "cursor-pointer select-none",
                        )}
                        onClick={() => sort.setSort("email")}
                      >
                        Email
                      </TableHead>
                    )}
                    <TableHead
                      className={cn(
                        "text-xs uppercase tracking-wide text-muted-foreground",
                        "cursor-pointer select-none",
                      )}
                      onClick={() => sort.setSort("role")}
                    >
                      Role
                    </TableHead>
                    {columns.isColumnVisible("created") && (
                      <TableHead
                        className={cn(
                          "hidden md:table-cell text-xs uppercase tracking-wide text-muted-foreground",
                          "cursor-pointer select-none",
                        )}
                        onClick={() => sort.setSort("createdAt")}
                      >
                        Created
                      </TableHead>
                    )}
                    {columns.isColumnVisible("status") && (
                      <TableHead
                        className={cn(
                          "text-xs uppercase tracking-wide text-muted-foreground",
                          "cursor-pointer select-none",
                        )}
                        onClick={() => sort.setSort("status")}
                      >
                        Status
                      </TableHead>
                    )}
                    <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageUsers.map((staffUser) => (
                    <UserTableRow
                      key={staffUser.id}
                      staffUser={staffUser}
                      selected={selection.isSelected(staffUser.id)}
                      onToggleSelected={selection.toggleSelection}
                      showEmail={columns.isColumnVisible("email")}
                      showCreated={columns.isColumnVisible("created")}
                      showStatus={columns.isColumnVisible("status")}
                      onView={onViewUser}
                      onEdit={onEditUser}
                      onDelete={onDeleteUser}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Footer: selection count only when pagination is in mini bar */}
            <div className="border-t bg-background shrink-0">
              <div className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground flex items-center justify-between gap-3">
                <span>
                  {selection.selectedCount} of {sort.sortedData.length} row(s)
                  selected
                </span>
                {!paginationInMiniBar && (
                  <span className="hidden sm:inline">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                )}
              </div>
              {!paginationInMiniBar && (
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  pageSize={pagination.pageSize}
                  totalItems={sort.sortedData.length}
                  onPageChange={pagination.setCurrentPage}
                  onPageSizeChange={(size) => {
                    pagination.setPageSize(size);
                    pagination.setCurrentPage(1);
                  }}
                  showPageSizeSelector={true}
                  showPageInfo={false}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
