import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus, Shield } from "lucide-react";
import { useAuth } from "@/shared/hooks/use-auth";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { useUserPermissions } from "@/features/dashboard/hooks/use-user-permissions";
import { PERMISSIONS } from "@app/shared/constants/permissions";

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

  const userRole = getUserRoleName(user);
  const canManageUsers = hasPermission(PERMISSIONS.USERS_MANAGE);

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
        await refetch();
        closeAddDialog();
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
        `Are you sure you want to delete ${userName}? This action cannot be undone.`
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
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-[1600px] space-y-6 sm:space-y-8">
      {/* Back button */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex items-center space-x-2 h-9 sm:h-10"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-base">Back to Dashboard</span>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 break-words tracking-tight">
            User Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 break-words">
            Manage staff members and their permissions
          </p>
        </div>

        <Button
          className="w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base shadow-sm"
          onClick={openAddDialog}
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {/* Stats Cards */}
      <UserStatsCards staffUsers={staffUsers} />

      {/* Filters */}
      <UserFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterRole={filterRole}
        onRoleFilterChange={setFilterRole}
      />

      {/* Staff Table */}
      <UserTable
        users={filteredUsers}
        isLoading={isLoadingUsers}
        searchTerm={searchTerm}
        filterRole={filterRole}
        onViewUser={openViewDialog}
        onEditUser={openEditDialog}
        onDeleteUser={handleDeleteUser}
        onAddUser={openAddDialog}
      />

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
