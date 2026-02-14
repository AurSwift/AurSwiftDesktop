import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "@/shared/hooks/use-auth";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { MiniBar } from "@/components/mini-bar";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("role-management-view");
import {
  RoleFilters,
  RoleTable,
  CreateRoleDrawer,
  EditRoleDialog,
  DeleteRoleDialog,
  ViewRoleUsersDialog,
} from "../components";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useUsersByRole,
} from "../hooks";
import type { RoleCreateFormData, RoleUpdateFormData } from "../schemas";

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

export default function RoleManagementView({ onBack }: { onBack: () => void }) {
  const safeFocusRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const isAdmin = getUserRoleName(user) === "admin";
  const { data: roles, isLoading, refetch } = useRoles();
  const { mutate: createRole, isPending: isCreating } = useCreateRole();
  const { mutate: updateRole, isPending: isUpdating } = useUpdateRole();
  const { mutate: deleteRole, isPending: isDeleting } = useDeleteRole();

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewUsersDialogOpen, setIsViewUsersDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleUserCounts, setRoleUserCounts] = useState<Record<string, number>>(
    {},
  );
  const { getUsersByRole } = useUsersByRole();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredRoles =
    roles?.filter((role) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        role.name.toLowerCase().includes(searchLower) ||
        role.displayName.toLowerCase().includes(searchLower) ||
        role.description?.toLowerCase().includes(searchLower)
      );
    }) ?? [];

  const totalItems = filteredRoles.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [totalItems]);

  const handleCreateRole = async (data: RoleCreateFormData) => {
    return new Promise<void>((resolve, reject) => {
      createRole(data, {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          // Prevent any "Enter" key repeat from activating the Back button after the drawer closes
          requestAnimationFrame(() => safeFocusRef.current?.focus());
          refetch();
          resolve();
        },
        onError: (error: unknown) => {
          reject(error);
        },
      });
    });
  };

  const handleEditRole = (roleId: string, data: RoleUpdateFormData) => {
    updateRole(
      { roleId, data },
      {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setSelectedRole(null);
          refetch();
        },
      },
    );
  };

  const handleDeleteRole = (roleId: string) => {
    deleteRole(roleId, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        setSelectedRole(null);
        refetch();
      },
    });
  };

  const openEditDialog = (role: Role) => {
    logger.info("[openEditDialog] Opening edit dialog for role:", role);
    setSelectedRole(role);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
  };

  const openViewUsersDialog = (role: Role) => {
    setSelectedRole(role);
    setIsViewUsersDialogOpen(true);
  };

  const openViewDialog = (role: Role) => {
    // View details can open the edit dialog in view-only mode or a separate view dialog
    // For now, let's just open the view users dialog
    openViewUsersDialog(role);
  };

  // Load user counts for all roles
  useEffect(() => {
    if (!roles || roles.length === 0) return;

    const loadUserCounts = async () => {
      const counts: Record<string, number> = {};
      for (const role of roles) {
        try {
          const users = await getUsersByRole(role.id);
          counts[role.id] = users?.length || 0;
        } catch (error) {
          logger.error(`Failed to load user count for role ${role.id}:`, error);
          counts[role.id] = 0;
        }
      }
      setRoleUserCounts(counts);
    };

    loadUserCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  return (
    <div className="container mx-auto p-1 max-w-[1600px] flex flex-col flex-1 min-h-0 gap-4 sm:gap-6">
      {/* Focus target to avoid accidental navigation on drawer close */}
      <div
        ref={safeFocusRef}
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
      />
      <MiniBar
        className="shrink-0"
        title="Role Management"
        onBack={onBack}
        backAriaLabel="Back to Dashboard"
        action={{
          label: "New",
          onClick: () => setIsCreateDialogOpen(true),
          icon: <Plus className="h-4 w-4" />,
          ariaLabel: "Create new role",
        }}
        center={
          <div className="w-full max-w-md">
            <RoleFilters
              variant="miniBar"
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          </div>
        }
        right={
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              {totalItems === 0
                ? "0 / 0"
                : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalItems)} / ${totalItems}`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || totalPages <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || totalPages <= 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Roles Table - fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col">
        <RoleTable
          roles={filteredRoles}
          roleUserCounts={roleUserCounts}
          isLoading={isLoading}
          searchTerm={searchTerm}
          onResetFilters={() => setSearchTerm("")}
          onViewRole={openViewDialog}
          onEditRole={openEditDialog}
          onDeleteRole={openDeleteDialog}
          onViewUsers={openViewUsersDialog}
          onAddRole={() => setIsCreateDialogOpen(true)}
          canEdit={isAdmin}
          pagination={{
            currentPage,
            pageSize,
            onPageChange: setCurrentPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setCurrentPage(1);
            },
          }}
        />
      </div>

      {/* Dialogs */}
      <CreateRoleDrawer
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            // Reset state when drawer closes
            setSelectedRole(null);
          }
        }}
        onSubmit={handleCreateRole}
        isLoading={isCreating}
      />

      <EditRoleDialog
        role={selectedRole}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={handleEditRole}
        isLoading={isUpdating}
      />

      <DeleteRoleDialog
        role={selectedRole}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteRole}
        isLoading={isDeleting}
      />

      <ViewRoleUsersDialog
        role={selectedRole}
        open={isViewUsersDialogOpen}
        onOpenChange={setIsViewUsersDialogOpen}
      />
    </div>
  );
}
