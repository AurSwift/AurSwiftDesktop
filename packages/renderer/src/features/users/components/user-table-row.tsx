import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { Calendar, Mail, MoreHorizontal } from "lucide-react";

import {
  getUserRoleName,
  getUserRoleDisplayName,
  getRoleBadgeVariant,
} from "@/shared/utils/rbac-helpers";
import { getStaffDisplayName } from "../utils/user-helpers";
import type { StaffUser } from "../schemas/types";

interface UserTableRowProps {
  staffUser: StaffUser;
  selected: boolean;
  onToggleSelected: (userId: string) => void;
  showEmail: boolean;
  showCreated: boolean;
  showStatus: boolean;
  onView: (user: StaffUser) => void;
  onEdit: (user: StaffUser) => void;
  onDelete: (userId: string, userName: string) => void;
}

export function UserTableRow({
  staffUser,
  selected,
  onToggleSelected,
  showEmail,
  showCreated,
  showStatus,
  onView,
  onEdit,
  onDelete,
}: UserTableRowProps) {
  const displayName = getStaffDisplayName(staffUser);
  const roleName = getUserRoleName(staffUser);
  const roleDisplayName = getUserRoleDisplayName(staffUser);
  const roleBadgeVariant = getRoleBadgeVariant(roleName);

  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className="cursor-default"
      onClick={() => onView(staffUser)}
    >
      <TableCell className="w-10">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelected(staffUser.id)}
            aria-label={`Select ${displayName}`}
          />
        </div>
      </TableCell>

      <TableCell className="min-w-[150px] sm:min-w-[200px]">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <UserAvatar
            user={staffUser}
            className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-medium text-xs sm:text-sm md:text-base truncate">
              {displayName}
            </div>
            {!showEmail && (
              <div className="text-xs text-muted-foreground sm:hidden truncate">
                {staffUser.email}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {showEmail && (
        <TableCell className="hidden sm:table-cell min-w-[220px]">
          <div className="flex items-center space-x-2 min-w-0">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs sm:text-sm text-foreground/80 truncate">
              {staffUser.email}
            </span>
          </div>
        </TableCell>
      )}

      <TableCell className="whitespace-nowrap">
        <Badge
          variant={roleBadgeVariant}
          className="text-xs sm:text-sm"
          title={
            staffUser.primaryRole?.description ||
            `Role: ${roleDisplayName}${
              staffUser.primaryRoleId ? ` (ID: ${staffUser.primaryRoleId})` : ""
            }`
          }
        >
          {roleDisplayName}
        </Badge>
      </TableCell>

      {showCreated && (
        <TableCell className="hidden md:table-cell whitespace-nowrap text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>
              {new Date(staffUser.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </TableCell>
      )}

      {showStatus && (
        <TableCell className="whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span
              className={
                staffUser.isActive
                  ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
                  : "inline-block h-2 w-2 rounded-full bg-rose-500"
              }
              aria-hidden="true"
            />
            <span className="text-xs sm:text-sm text-foreground/80">
              {staffUser.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </TableCell>
      )}

      <TableCell className="text-right whitespace-nowrap w-12">
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Open actions for ${displayName}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onView(staffUser)}>
                View
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEdit(staffUser)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDelete(staffUser.id, displayName)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
