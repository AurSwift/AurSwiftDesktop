import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { Mail, Calendar, Eye, Edit, Trash2 } from "lucide-react";

import {
  getUserRoleName,
  getUserRoleDisplayName,
  getRoleBadgeVariant,
} from "@/shared/utils/rbac-helpers";
import { getStaffDisplayName } from "../utils/user-helpers";
import type { StaffUser } from "../schemas/types";

interface UserTableRowProps {
  staffUser: StaffUser;
  onView: (user: StaffUser) => void;
  onEdit: (user: StaffUser) => void;
  onDelete: (userId: string, userName: string) => void;
}

export function UserTableRow({
  staffUser,
  onView,
  onEdit,
  onDelete,
}: UserTableRowProps) {
  const displayName = getStaffDisplayName(staffUser);
  const roleName = getUserRoleName(staffUser);
  const roleDisplayName = getUserRoleDisplayName(staffUser);
  const roleBadgeVariant = getRoleBadgeVariant(roleName);

  return (
    <TableRow>
      <TableCell className="min-w-[150px] sm:min-w-[200px]">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <UserAvatar
            user={staffUser}
            className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-medium text-xs sm:text-sm md:text-base lg:text-base truncate">
              {displayName}
            </div>
            <div className="text-caption text-gray-500 sm:hidden truncate">
              {staffUser.email}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell min-w-[180px]">
        <div className="flex items-center space-x-2">
          <Mail className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-gray-400 shrink-0" />
          <span className="text-xs sm:text-sm md:text-base lg:text-base truncate">
            {staffUser.email}
          </span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge
          variant={roleBadgeVariant}
          className="text-xs sm:text-sm md:text-base lg:text-base"
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
      <TableCell className="hidden md:table-cell whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-gray-400 shrink-0" />
          <span className="text-xs sm:text-sm md:text-base lg:text-base">
            {new Date(staffUser.createdAt).toLocaleDateString()}
          </span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge
          variant={staffUser.isActive ? "default" : "destructive"}
          className="text-xs sm:text-sm md:text-base lg:text-base"
        >
          {staffUser.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <div className="flex items-center justify-end space-x-1 sm:space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(staffUser)}
            className="text-xs sm:text-sm md:text-base h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0"
          >
            <Eye className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(staffUser)}
            className="text-xs sm:text-sm md:text-base h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0"
          >
            <Edit className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 text-xs sm:text-sm md:text-base h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0"
            onClick={() => onDelete(staffUser.id, displayName)}
          >
            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
