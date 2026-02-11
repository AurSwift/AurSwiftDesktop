import { useEffect, useMemo, useState } from "react";
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
  getUserRoleName,
} from "@/shared/utils/rbac-helpers";
import { getStaffDisplayName } from "../utils/user-helpers";

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
type SortDirection = "asc" | "desc";

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toCsvValue(value: unknown) {
  const str = String(value ?? "");
  // Escape quotes and wrap in quotes if needed
  const escaped = str.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const [showEmail, setShowEmail] = useState(true);
  const [showCreated, setShowCreated] = useState(true);
  const [showStatus, setShowStatus] = useState(true);

  const [internalPageSize, setInternalPageSize] = useState(10);
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);

  const pageSize = controlledPagination?.pageSize ?? internalPageSize;
  const currentPage = controlledPagination?.currentPage ?? internalCurrentPage;
  const setPageSize = controlledPagination?.onPageSizeChange ?? setInternalPageSize;
  const setCurrentPage = controlledPagination?.onPageChange ?? setInternalCurrentPage;
  const paginationInMiniBar = controlledPagination != null;

  const hasActiveFilters = Boolean(searchTerm) || filterRole !== "all";
  const activeFilterCount = (searchTerm ? 1 : 0) + (filterRole !== "all" ? 1 : 0);

  const sortedUsers = useMemo(() => {
    const copy = [...users];

    const dir = sortDir === "asc" ? 1 : -1;
    const getValue = (u: StaffUser) => {
      switch (sortKey) {
        case "name":
          return getStaffDisplayName(u).toLowerCase();
        case "email":
          return (u.email ?? "").toLowerCase();
        case "role":
          return getUserRoleDisplayName(u).toLowerCase();
        case "status":
          return u.isActive ? 1 : 0;
        case "createdAt":
        default:
          return new Date(u.createdAt).getTime();
      }
    };

    copy.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

    return copy;
  }, [users, sortKey, sortDir]);

  const totalItems = sortedUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedUsers.slice(start, end);
  }, [sortedUsers, currentPage, pageSize]);

  // Keep selection only for existing users
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const existing = new Set(users.map((u) => u.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (existing.has(id)) next.add(id);
      });
      return next;
    });
  }, [users]);

  const visibleIds = pageUsers.map((u) => u.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = pageUsers.length > 0 && selectedVisibleCount === pageUsers.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleExportCsv = () => {
    const rows = pageUsers.map((u) => {
      const name = getStaffDisplayName(u);
      const role = getUserRoleName(u);
      const roleLabel = getUserRoleDisplayName(u);
      return {
        name,
        email: u.email ?? "",
        role,
        roleLabel,
        status: u.isActive ? "Active" : "Inactive",
        createdAt: new Date(u.createdAt).toISOString(),
      };
    });

    const headers = ["Name", "Email", "Role", "Status", "Created At"];
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) =>
          [
            toCsvValue(r.name),
            toCsvValue(r.email),
            toCsvValue(r.roleLabel),
            toCsvValue(r.status),
            toCsvValue(r.createdAt),
          ].join(",")
        )
        .join("\n");

    downloadCsv(`staff-members-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const setSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "createdAt" ? "desc" : "asc");
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
              <DropdownMenuItem onSelect={() => setSort("name")}>
                Name {sortKey === "name" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("email")}>
                Email {sortKey === "email" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("role")}>
                Role {sortKey === "role" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("status")}>
                Status {sortKey === "status" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("createdAt")}>
                Created {sortKey === "createdAt" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedIds.size > 0 && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              {selectedIds.size} selected
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
              <DropdownMenuItem onSelect={() => setShowEmail((v) => !v)}>
                {showEmail ? "Hide" : "Show"} email
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowCreated((v) => !v)}>
                {showCreated ? "Hide" : "Show"} created
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowStatus((v) => !v)}>
                {showStatus ? "Hide" : "Show"} status
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
                          allVisibleSelected
                            ? true
                            : someVisibleSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label="Select all visible rows"
                      />
                    </TableHead>
                    <TableHead
                      className={cn(
                        "text-xs uppercase tracking-wide text-muted-foreground",
                        "cursor-pointer select-none"
                      )}
                      onClick={() => setSort("name")}
                    >
                      Staff member
                    </TableHead>
                    {showEmail && (
                      <TableHead
                        className={cn(
                          "hidden sm:table-cell text-xs uppercase tracking-wide text-muted-foreground",
                          "cursor-pointer select-none"
                        )}
                        onClick={() => setSort("email")}
                      >
                        Email
                      </TableHead>
                    )}
                    <TableHead
                      className={cn(
                        "text-xs uppercase tracking-wide text-muted-foreground",
                        "cursor-pointer select-none"
                      )}
                      onClick={() => setSort("role")}
                    >
                      Role
                    </TableHead>
                    {showCreated && (
                      <TableHead
                        className={cn(
                          "hidden md:table-cell text-xs uppercase tracking-wide text-muted-foreground",
                          "cursor-pointer select-none"
                        )}
                        onClick={() => setSort("createdAt")}
                      >
                        Created
                      </TableHead>
                    )}
                    {showStatus && (
                      <TableHead
                        className={cn(
                          "text-xs uppercase tracking-wide text-muted-foreground",
                          "cursor-pointer select-none"
                        )}
                        onClick={() => setSort("status")}
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
                      selected={selectedIds.has(staffUser.id)}
                      onToggleSelected={toggleSelected}
                      showEmail={showEmail}
                      showCreated={showCreated}
                      showStatus={showStatus}
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
                  {selectedIds.size} of {totalItems} row(s) selected
                </span>
                {!paginationInMiniBar && (
                  <span className="hidden sm:inline">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>
              {!paginationInMiniBar && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
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
