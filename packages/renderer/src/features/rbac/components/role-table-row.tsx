import { Badge } from "@/components/ui/badge";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Eye, Edit, Trash2, Users } from "lucide-react";
import { format } from "date-fns";

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

interface RoleTableRowProps {
  role: Role;
  userCount: number;
  selected: boolean;
  onToggleSelected: (id: string) => void;
  showPermissions: boolean;
  showCreated: boolean;
  showStatus: boolean;
  onView: (role: Role) => void;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  onViewUsers: (role: Role) => void;
  canEdit: boolean;
}

export function RoleTableRow({
  role,
  userCount,
  selected,
  onToggleSelected,
  showPermissions,
  showCreated,
  showStatus,
  onView,
  onEdit,
  onDelete,
  onViewUsers,
  canEdit,
}: RoleTableRowProps) {
  return (
    <TableRow className="group hover:bg-muted/50">
      <TableCell className="w-10">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelected(role.id)}
          aria-label={`Select ${role.displayName}`}
        />
      </TableCell>

      {/* Role name & description */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="font-medium text-sm sm:text-base flex items-center gap-2">
              {role.displayName}
              {role.isSystemRole && (
                <Badge variant="secondary" className="text-xs">
                  System
                </Badge>
              )}
            </div>
            {role.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {role.description}
              </p>
            )}
          </div>
        </div>
      </TableCell>

      {/* Permissions count */}
      {showPermissions && (
        <TableCell className="hidden sm:table-cell">
          <Badge variant="outline">{role.permissions.length}</Badge>
        </TableCell>
      )}

      {/* User count */}
      <TableCell>
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{userCount}</span>
        </div>
      </TableCell>

      {/* Created */}
      {showCreated && (
        <TableCell className="hidden md:table-cell text-xs sm:text-sm text-muted-foreground">
          {format(new Date(role.createdAt), "dd MMM yyyy")}
        </TableCell>
      )}

      {/* Status */}
      {showStatus && (
        <TableCell>
          <Badge
            variant={role.isActive ? "default" : "secondary"}
            className="text-xs"
          >
            {role.isActive ? "Active" : "Inactive"}
          </Badge>
        </TableCell>
      )}

      {/* Actions */}
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onView(role)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onViewUsers(role)}>
              <Users className="mr-2 h-4 w-4" />
              View Users
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onEdit(role)} disabled={!canEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Role
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDelete(role)}
              disabled={role.isSystemRole || !canEdit}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Role
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
