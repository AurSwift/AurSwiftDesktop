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
import { RoleEmptyState } from "./role-empty-state";
import { RoleTableRow } from "./role-table-row";

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  permissions: string[];
  businessId: string;
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

interface RoleTableProps {
  roles: Role[];
  roleUserCounts: Record<string, number>;
  isLoading: boolean;
  searchTerm: string;
  onResetFilters?: () => void;
  onViewRole: (role: Role) => void;
  onEditRole: (role: Role) => void;
  onDeleteRole: (role: Role) => void;
  onViewUsers: (role: Role) => void;
  onAddRole: () => void;
  canEdit: boolean;
  /** When set, pagination is controlled by parent (e.g. shown in mini bar). */
  pagination?: {
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

type SortKey = "name" | "permissions" | "users" | "createdAt" | "status";
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

export function RoleTable({
  roles,
  roleUserCounts,
  isLoading,
  searchTerm,
  onResetFilters,
  onViewRole,
  onEditRole,
  onDeleteRole,
  onViewUsers,
  onAddRole,
  canEdit,
  pagination: controlledPagination,
}: RoleTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const [showPermissions, setShowPermissions] = useState(true);
  const [showCreated, setShowCreated] = useState(true);
  const [showStatus, setShowStatus] = useState(true);

  const [internalPageSize, setInternalPageSize] = useState(10);
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);

  const pageSize = controlledPagination?.pageSize ?? internalPageSize;
  const currentPage = controlledPagination?.currentPage ?? internalCurrentPage;
  const setPageSize =
    controlledPagination?.onPageSizeChange ?? setInternalPageSize;
  const setCurrentPage =
    controlledPagination?.onPageChange ?? setInternalCurrentPage;
  const paginationInMiniBar = controlledPagination != null;

  const hasActiveFilters = Boolean(searchTerm);
  const activeFilterCount = searchTerm ? 1 : 0;

  const sortedRoles = useMemo(() => {
    const copy = [...roles];

    const dir = sortDir === "asc" ? 1 : -1;
    const getValue = (r: Role) => {
      switch (sortKey) {
        case "name":
          return r.displayName.toLowerCase();
        case "permissions":
          return r.permissions.length;
        case "users":
          return roleUserCounts[r.id] ?? 0;
        case "status":
          return r.isActive ? 1 : 0;
        case "createdAt":
        default:
          return new Date(r.createdAt).getTime();
      }
    };

    copy.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

    return copy;
  }, [roles, sortKey, sortDir, roleUserCounts]);

  const totalItems = sortedRoles.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages, setCurrentPage]);

  const pageRoles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedRoles.slice(start, end);
  }, [sortedRoles, currentPage, pageSize]);

  // Keep selection only for existing roles
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const existing = new Set(roles.map((r) => r.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (existing.has(id)) next.add(id);
      });
      return next;
    });
  }, [roles]);

  const visibleIds = pageRoles.map((r) => r.id);
  const selectedVisibleCount = visibleIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const allVisibleSelected =
    pageRoles.length > 0 && selectedVisibleCount === pageRoles.length;
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
    const rows = pageRoles.map((r) => ({
      name: r.displayName,
      description: r.description ?? "",
      permissions: r.permissions.length,
      users: roleUserCounts[r.id] ?? 0,
      status: r.isActive ? "Active" : "Inactive",
      type: r.isSystemRole ? "System" : "Custom",
      createdAt: new Date(r.createdAt).toISOString(),
    }));

    const headers = [
      "Name",
      "Description",
      "Permissions",
      "Users",
      "Status",
      "Type",
      "Created At",
    ];
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) =>
          [
            toCsvValue(r.name),
            toCsvValue(r.description),
            toCsvValue(r.permissions),
            toCsvValue(r.users),
            toCsvValue(r.status),
            toCsvValue(r.type),
            toCsvValue(r.createdAt),
          ].join(","),
        )
        .join("\n");

    downloadCsv(`roles-${new Date().toISOString().slice(0, 10)}.csv`, csv);
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
              <DropdownMenuItem onSelect={() => setSort("permissions")}>
                Permissions {sortKey === "permissions" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("users")}>
                Users {sortKey === "users" ? `(${sortDir})` : ""}
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
            disabled={pageRoles.length === 0}
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
              <DropdownMenuItem onSelect={() => setShowPermissions((v) => !v)}>
                {showPermissions ? "Hide" : "Show"} permissions
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
              Loading roles...
            </div>
          </div>
        ) : roles.length === 0 ? (
          <div className="p-4 sm:p-6 flex-1">
            <RoleEmptyState searchTerm={searchTerm} onAddRole={onAddRole} />
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
                        "cursor-pointer select-none",
                      )}
                      onClick={() => setSort("name")}
                    >
                      Role
                    </TableHead>
                    {showPermissions && (
                      <TableHead
                        className={cn(
                          "hidden sm:table-cell text-xs uppercase tracking-wide text-muted-foreground",
                          "cursor-pointer select-none",
                        )}
                        onClick={() => setSort("permissions")}
                      >
                        Permissions
                      </TableHead>
                    )}
                    <TableHead
                      className={cn(
                        "text-xs uppercase tracking-wide text-muted-foreground",
                        "cursor-pointer select-none",
                      )}
                      onClick={() => setSort("users")}
                    >
                      Users
                    </TableHead>
                    {showCreated && (
                      <TableHead
                        className={cn(
                          "hidden md:table-cell text-xs uppercase tracking-wide text-muted-foreground",
                          "cursor-pointer select-none",
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
                          "cursor-pointer select-none",
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
                  {pageRoles.map((role) => (
                    <RoleTableRow
                      key={role.id}
                      role={role}
                      userCount={roleUserCounts[role.id] ?? 0}
                      selected={selectedIds.has(role.id)}
                      onToggleSelected={toggleSelected}
                      showPermissions={showPermissions}
                      showCreated={showCreated}
                      showStatus={showStatus}
                      onView={onViewRole}
                      onEdit={onEditRole}
                      onDelete={onDeleteRole}
                      onViewUsers={onViewUsers}
                      canEdit={canEdit}
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
