import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail } from "lucide-react";
import {
  DataTable,
  useDataTable,
  columnHelpers,
  ColumnHeader,
  TableSearchInput,
  TableFacetedFilter,
  TableExportButton,
  ColumnToggle,
  TableRowActions,
} from "@/components/data-table";
import type { StaffUser } from "../schemas/types";
import {
  getUserRoleDisplayName,
  getRoleBadgeVariant,
} from "@/shared/utils/rbac-helpers";
import { getStaffDisplayName } from "../utils/user-helpers";
import type { FilterOption } from "@/components/data-table";

interface UserDataTableProps {
  users: StaffUser[];
  isLoading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterRole: string;
  roleOptions: FilterOption[];
  onViewUser: (user: StaffUser) => void;
  onEditUser: (user: StaffUser) => void;
  onDeleteUser: (userId: string, userName: string) => void;
  /** When set, pagination is controlled by parent (e.g. shown in mini bar). */
  pagination?: {
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

/**
 * User Data Table Component
 * Uses the new reusable DataTable system
 */
export function UserDataTable({
  users,
  isLoading,
  searchTerm,
  onSearchChange,
  filterRole,
  roleOptions,
  onViewUser,
  onEditUser,
  onDeleteUser,
  pagination: controlledPagination,
}: UserDataTableProps) {
  // Define columns
  const columns = useMemo<ColumnDef<StaffUser>[]>(
    () => [
      // Selection column
      columnHelpers.selection<StaffUser>(),

      // Staff member column with avatar
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => (
          <ColumnHeader column={column} title="Staff Member" />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const displayName = getStaffDisplayName(user);

          return (
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-[150px] sm:min-w-[200px]">
              <UserAvatar
                user={user}
                className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 shrink-0"
              />
              <div className="min-w-0">
                <div className="font-medium text-xs sm:text-sm md:text-base truncate">
                  {displayName}
                </div>
                <div className="text-xs text-muted-foreground sm:hidden truncate">
                  {user.email}
                </div>
              </div>
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const nameA = getStaffDisplayName(rowA.original).toLowerCase();
          const nameB = getStaffDisplayName(rowB.original).toLowerCase();
          return nameA.localeCompare(nameB);
        },
      },

      // Email column
      {
        accessorKey: "email",
        id: "email",
        header: ({ column }) => (
          <ColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2 min-w-[220px]">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs sm:text-sm text-foreground/80 truncate">
              {row.original.email}
            </span>
          </div>
        ),
        enableSorting: true,
        enableHiding: true,
      },

      // Role column with badge
      {
        accessorKey: "role",
        id: "role",
        header: ({ column }) => (
          <ColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const roleDisplayName = getUserRoleDisplayName(user);
          const roleBadgeVariant = getRoleBadgeVariant(
            user.primaryRole?.name || "",
          );

          return (
            <Badge
              variant={roleBadgeVariant}
              className="text-xs sm:text-sm whitespace-nowrap"
              title={
                user.primaryRole?.description ||
                `Role: ${roleDisplayName}${
                  user.primaryRoleId ? ` (ID: ${user.primaryRoleId})` : ""
                }`
              }
            >
              {roleDisplayName}
            </Badge>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const roleA = getUserRoleDisplayName(rowA.original).toLowerCase();
          const roleB = getUserRoleDisplayName(rowB.original).toLowerCase();
          return roleA.localeCompare(roleB);
        },
        filterFn: (row, _id, value) => {
          if (!value || value.length === 0) return true;
          const userRole = row.original.primaryRole?.name || "";
          return value.includes(userRole);
        },
      },

      // Created date column
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: ({ column }) => (
          <ColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2 whitespace-nowrap text-xs sm:text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>
              {new Date(row.original.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        ),
        enableSorting: true,
        enableHiding: true,
      },

      // Status column
      {
        accessorKey: "isActive",
        id: "status",
        header: ({ column }) => (
          <ColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const isActive = row.original.isActive;
          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span
                className={
                  isActive
                    ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
                    : "inline-block h-2 w-2 rounded-full bg-rose-500"
                }
                aria-hidden="true"
              />
              <span className="text-xs sm:text-sm text-foreground/80">
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
          );
        },
        enableSorting: true,
        enableHiding: true,
        sortingFn: (rowA, rowB) => {
          return rowA.original.isActive === rowB.original.isActive
            ? 0
            : rowA.original.isActive
              ? -1
              : 1;
        },
      },

      // Actions column
      columnHelpers.actions<StaffUser>({
        cell: ({ row }) => {
          const user = row.original;
          const displayName = getStaffDisplayName(user);

          return (
            <div className="text-right whitespace-nowrap w-12">
              <TableRowActions
                row={user}
                actions={[
                  {
                    label: "View",
                    onSelect: (user) => onViewUser(user),
                  },
                  {
                    label: "Edit",
                    onSelect: (user) => onEditUser(user),
                  },
                  { type: "separator" },
                  {
                    label: "Delete",
                    variant: "destructive",
                    onSelect: (user) => onDeleteUser(user.id, displayName),
                  },
                ]}
              />
            </div>
          );
        },
      }),
    ],
    [onViewUser, onEditUser, onDeleteUser],
  );

  // Initialize table
  const { table } = useDataTable({
    data: users,
    columns,
    pagination: controlledPagination
      ? {
          mode: "client",
          pageSize: controlledPagination.pageSize,
          pageIndex: controlledPagination.currentPage - 1, // Convert to 0-based
          onPaginationChange: (state) => {
            controlledPagination.onPageChange(state.pageIndex + 1); // Convert to 1-based
            controlledPagination.onPageSizeChange(state.pageSize);
          },
        }
      : {
          mode: "client",
          pageSize: 10,
        },
    sorting: {
      mode: "client",
      initialState: [{ id: "createdAt", desc: true }],
    },
    filtering: {
      mode: "client",
      globalFilter: searchTerm,
      onGlobalFilterChange: onSearchChange,
    },
    selection: {
      enabled: true,
      mode: "multiple",
    },
    columnVisibility: {
      storageKey: "user-table-columns",
      initialState: {
        email: true,
        createdAt: true,
        status: true,
      },
    },
    getRowId: (row) => row.id,
  });

  // Apply role filter
  useMemo(() => {
    if (filterRole && filterRole !== "all") {
      table.getColumn("role")?.setFilterValue([filterRole]);
    } else {
      table.getColumn("role")?.setFilterValue(undefined);
    }
  }, [filterRole, table]);

  const paginationInMiniBar = controlledPagination != null;

  return (
    <DataTable table={table} isLoading={isLoading}>
      {/* Toolbar */}
      <DataTable.Toolbar>
        <div className="flex items-center gap-2 flex-wrap">
          <TableSearchInput placeholder="Search users..." />
          <TableFacetedFilter
            column="role"
            title="Role"
            options={roleOptions}
          />
        </div>

        <div className="flex items-center gap-2 justify-end">
          <TableExportButton filename="staff-members" />
          <ColumnToggle />
        </div>
      </DataTable.Toolbar>

      {/* Table Content */}
      <DataTable.Content minWidth="760px" />

      {/* Footer */}
      <DataTable.Footer showSelectionInfo={true}>
        {!paginationInMiniBar && <DataTable.Pagination />}
      </DataTable.Footer>
    </DataTable>
  );
}
