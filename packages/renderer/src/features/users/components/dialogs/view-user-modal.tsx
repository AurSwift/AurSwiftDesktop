import { ModalContainer, type ModalVariant } from "../modal-container";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import {
  getUserRoleName,
  getUserRoleDisplayName,
} from "@/shared/utils/rbac-helpers";
import { getStaffDisplayName } from "@/features/users/utils/user-helpers";
import type { StaffUser } from "@/features/users/schemas/types";

interface ViewUserModalProps {
  /**
   * Modal variant - dialog or drawer
   */
  variant: ModalVariant;
  /**
   * Open state
   */
  open: boolean;
  /**
   * Open state change handler
   */
  onOpenChange: (open: boolean) => void;
  /**
   * User to display
   */
  user: StaffUser;
  /**
   * Edit button handler
   */
  onEdit: () => void;
}

/**
 * View User Modal (replaces view-user-dialog and view-user-drawer)
 * Uses ModalContainer for polymorphic behavior
 */
export function ViewUserModal({
  variant,
  open,
  onOpenChange,
  user,
  onEdit,
}: ViewUserModalProps) {
  return (
    <ModalContainer
      variant={variant}
      open={open}
      onOpenChange={onOpenChange}
      title="Staff Member Details"
      description="View detailed information about this staff member."
    >
      <div className="space-y-3 sm:space-y-4 md:space-y-5 py-2 sm:py-3 md:py-4 px-0 sm:px-0 md:px-2">
        {/* Avatar */}
        <div className="flex justify-center">
          <UserAvatar
            user={user}
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
          />
        </div>

        {/* Basic Info */}
        <div className="space-y-2 sm:space-y-3 md:space-y-4">
          <div>
            <Label className="text-xs sm:text-sm md:text-base lg:text-base font-medium text-gray-500">
              Full Name
            </Label>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold">
              {getStaffDisplayName(user)}
            </p>
          </div>

          <div>
            <Label className="text-xs sm:text-sm md:text-base lg:text-base font-medium text-gray-500">
              Email
            </Label>
            <p className="text-xs sm:text-sm md:text-base lg:text-base">
              {user.email}
            </p>
          </div>

          {user.address && (
            <div>
              <Label className="text-xs sm:text-sm md:text-base lg:text-base font-medium text-gray-500">
                Address
              </Label>
              <p className="text-xs sm:text-sm md:text-base lg:text-base">
                {user.address}
              </p>
            </div>
          )}

          <div>
            <Label className="text-xs sm:text-sm md:text-base lg:text-base font-medium text-gray-500">
              Role
            </Label>
            <div className="mt-1">
              <Badge
                variant={
                  getUserRoleName(user) === "manager" ? "default" : "secondary"
                }
                className="text-xs sm:text-sm md:text-base lg:text-base"
              >
                {getUserRoleDisplayName(user)}
              </Badge>
            </div>
          </div>

          <div>
            <Label className="text-xs sm:text-sm md:text-base lg:text-base font-medium text-gray-500">
              Status
            </Label>
            <div className="mt-1">
              <Badge
                variant={user.isActive ? "default" : "destructive"}
                className="text-xs sm:text-sm md:text-base lg:text-base"
              >
                {user.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          <div>
            <Label className="text-xs sm:text-sm md:text-base lg:text-base font-medium text-gray-500">
              Created Date
            </Label>
            <p className="text-xs sm:text-sm md:text-base lg:text-base">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 pt-3 sm:pt-4 md:pt-5">
          <Button
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
            className="flex-1 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
          >
            Edit User
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
          >
            Close
          </Button>
        </div>
      </div>
    </ModalContainer>
  );
}
