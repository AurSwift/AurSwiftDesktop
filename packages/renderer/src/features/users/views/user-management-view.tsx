import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/shared/hooks/use-auth";
import { useUserPermissions } from "@/features/dashboard/hooks/use-user-permissions";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import { MiniBar } from "@/components/mini-bar";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("user-management-view");
import {
  UserStatsCards,
  UserFilters,
  UserTable,
  AddUserDrawer,
  EditUserDrawer,
  ViewUserDrawer,
} from "../components";
import {
  useStaffUsers,
  useUserFilters,
  useUserDialogs,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from "../hooks";
import type { UserCreateFormData, UserUpdateFormData } from "../schemas";

export default function UserManagementView({ onBack }: { onBack: () => void }) {
  const safeFocusRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } =
    useUserPermissions();
  const { staffUsers, isLoading: isLoadingUsers, refetch } = useStaffUsers();
  const {
    searchTerm,
    setSearchTerm,
    filterRole,
    setFilterRole,
    filteredUsers,
  } = useUserFilters(staffUsers);
  const {
    isAddDialogOpen,
    isEditDialogOpen,
    isViewDialogOpen,
    selectedUser,
    openAddDialog,
    closeAddDialog,
    openEditDialog,
    closeEditDialog,
    openViewDialog,
    closeViewDialog,
    setIsAddDialogOpen,
    setIsEditDialogOpen,
    setIsViewDialogOpen,
  } = useUserDialogs();
  const { createStaffUser, isLoading: isCreating } = useCreateUser();
  const { updateStaffUser, isLoading: isUpdating } = useUpdateUser();
  const { deleteStaffUser } = useDeleteUser();

  const canManageUsers = hasPermission(PERMISSIONS.USERS_MANAGE);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [totalItems]);

  // Handle loading state
  if (!user || isLoadingPermissions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs sm:text-sm md:text-base lg:text-base text-muted-foreground">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Handle access denied
  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h3>
          <p className="text-xs sm:text-sm md:text-base lg:text-base text-gray-600">
            You don't have permission to access user management.
          </p>
        </div>
      </div>
    );
  }

  // Handle create user
  const handleCreateUser = async (data: UserCreateFormData) => {
    logger.info("handleCreateUser called with:", data);
    try {
      const result = await createStaffUser(data);
      logger.info("Create result:", result);
      if (result.success) {
        // Close immediately for better UX; refresh list in background
        closeAddDialog();
        // Prevent any "Enter" key repeat from activating the Back button after the drawer closes
        requestAnimationFrame(() => safeFocusRef.current?.focus());
        void refetch();
      } else {
        logger.error("Create failed:", result.errors);
        // Error is already shown by the hook via toast
      }
    } catch (error) {
      logger.error("Error in handleCreateUser:", error);
      // Error handling is done in the hook
    }
  };

  // Handle update user
  const handleUpdateUser = async (data: UserUpdateFormData) => {
    logger.info("handleUpdateUser called with:", data);
    const result = await updateStaffUser(data);
    logger.info("Update result:", result);
    if (result.success) {
      await refetch();
      closeEditDialog();
    } else {
      // Error is already shown by the hook via toast
      logger.error("Update failed:", result.errors);
    }
  };

  // Handle delete user with confirmation
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${userName}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    const result = await deleteStaffUser(userId, userName);
    if (result.success) {
      await refetch();
    }
  };

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
        title="User Management"
        onBack={onBack}
        backAriaLabel="Back to Dashboard"
        action={{
          label: "New",
          onClick: openAddDialog,
          icon: <Plus className="h-4 w-4" />,
          ariaLabel: "Add staff member",
        }}
        center={
          <div className="w-full max-w-md">
            <UserFilters
              variant="miniBar"
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              filterRole={filterRole}
              onRoleFilterChange={setFilterRole}
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

      {/* Staff Table - fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col">
        <UserTable
          users={filteredUsers}
          isLoading={isLoadingUsers}
          searchTerm={searchTerm}
          filterRole={filterRole}
          onResetFilters={() => {
            setSearchTerm("");
            setFilterRole("all");
          }}
          onViewUser={openViewDialog}
          onEditUser={openEditDialog}
          onDeleteUser={handleDeleteUser}
          onAddUser={openAddDialog}
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

      {/* Add User Drawer */}
      <AddUserDrawer
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleCreateUser}
        isLoading={isCreating}
      />

      {/* Edit User Drawer */}
      {selectedUser && (
        <EditUserDrawer
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          user={selectedUser}
          onSubmit={handleUpdateUser}
          isLoading={isUpdating}
        />
      )}

      {/* View User Drawer */}
      {selectedUser && (
        <ViewUserDrawer
          open={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
          user={selectedUser}
          onEdit={() => {
            closeViewDialog();
            openEditDialog(selectedUser);
          }}
        />
      )}
    </div>
  );
}
