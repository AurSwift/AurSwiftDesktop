import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Plus, Search, Shield } from "lucide-react";
import { useAuth } from "@/shared/hooks/use-auth";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { cn } from "@/shared/utils/cn";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("role-management-view");
import {
  RoleCard,
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
    {}
  );
  const { getUsersByRole } = useUsersByRole();

  // Adaptive keyboard state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const keyboardContainerRef = useRef<HTMLDivElement>(null);

  const filteredRoles = roles?.filter((role) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      role.name.toLowerCase().includes(searchLower) ||
      role.displayName.toLowerCase().includes(searchLower) ||
      role.description?.toLowerCase().includes(searchLower)
    );
  });

  const handleCreateRole = async (data: RoleCreateFormData) => {
    return new Promise<void>((resolve, reject) => {
      createRole(data, {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
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
      }
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

  // Add padding to body when keyboard is visible to allow content scrolling
  useEffect(() => {
    if (!keyboardVisible || !keyboardContainerRef.current) {
      document.body.style.paddingBottom = "";
      return;
    }

    const updatePadding = () => {
      const keyboard = keyboardContainerRef.current;
      if (keyboard) {
        const height = keyboard.offsetHeight;
        document.body.style.paddingBottom = `${height}px`;
      }
    };

    // Small delay to ensure keyboard is rendered and measured
    const timeoutId = setTimeout(updatePadding, 100);
    updatePadding();

    // Update on resize in case keyboard height changes
    window.addEventListener("resize", updatePadding);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updatePadding);
      document.body.style.paddingBottom = "";
    };
  }, [keyboardVisible]);

  // Hide keyboard when user clicks/taps outside input + keyboard
  useEffect(() => {
    if (!keyboardVisible) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      const clickedSearchInput = searchInputRef.current?.contains(target);
      const clickedKeyboard = keyboardContainerRef.current?.contains(target);

      if (clickedSearchInput || clickedKeyboard) return;
      setKeyboardVisible(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [keyboardVisible]);

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

  // Adaptive keyboard handlers
  const handleKeyboardInput = (value: string) => {
    setSearchTerm(searchTerm + value);
  };

  const handleKeyboardBackspace = () => {
    setSearchTerm(searchTerm.slice(0, -1));
  };

  const handleKeyboardClear = () => {
    setSearchTerm("");
  };

  const handleKeyboardEnter = () => {
    setKeyboardVisible(false);
    searchInputRef.current?.blur();
  };

  const handleSearchFocus = () => {
    setKeyboardVisible(true);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Shield className="h-7 w-7" />
              Role Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage user roles and permissions
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={handleSearchFocus}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Roles</div>
          <div className="text-2xl font-bold mt-1">{roles?.length || 0}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Custom Roles</div>
          <div className="text-2xl font-bold mt-1">
            {roles?.filter((r) => !r.isSystemRole).length || 0}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">System Roles</div>
          <div className="text-2xl font-bold mt-1">
            {roles?.filter((r) => r.isSystemRole).length || 0}
          </div>
        </div>
      </div>

      {/* Roles Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading roles...
        </div>
      ) : filteredRoles && filteredRoles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              userCount={roleUserCounts[role.id] ?? 0}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              onViewUsers={openViewUsersDialog}
              canEdit={isAdmin}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No roles found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm
              ? "No roles match your search"
              : "Get started by creating your first custom role"}
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          )}
        </div>
      )}

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

      {/* Adaptive Keyboard - Bottom attached, full width, no gap */}
      {keyboardVisible && (
        <div
          ref={keyboardContainerRef}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50",
            "overflow-hidden shadow-2xl",
            "transform transition-all duration-300 ease-out",
            keyboardVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-full pointer-events-none",
          )}
          style={{
            margin: 0,
            padding: 0,
          }}
        >
          <AdaptiveKeyboard
            onInput={handleKeyboardInput}
            onBackspace={handleKeyboardBackspace}
            onClear={handleKeyboardClear}
            onEnter={handleKeyboardEnter}
            initialMode="qwerty"
            inputType="text"
            visible={keyboardVisible}
            onClose={() => setKeyboardVisible(false)}
            className="!rounded-none"
          />
        </div>
      )}
    </div>
  );
}
