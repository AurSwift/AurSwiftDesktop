import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface ViewUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: StaffUser;
  onEdit: () => void;
}

export function ViewUserDialog({
  open,
  onOpenChange,
  user,
  onEdit,
}: ViewUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-2 sm:mx-4 md:mx-6 lg:mx-8 p-3 sm:p-4 md:p-6 max-h-[90vh] sm:max-h-[85vh] md:max-h-[80vh] overflow-y-auto">
        <DialogHeader className="px-0 sm:px-0 md:px-2">
          <DialogTitle className="text-base sm:text-lg md:text-xl lg:text-2xl">
            Staff Member Details
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm md:text-base lg:text-base mt-1 sm:mt-2">
            View detailed information about this staff member.
          </DialogDescription>
        </DialogHeader>

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
                    getUserRoleName(user) === "manager"
                      ? "default"
                      : "secondary"
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
      </DialogContent>
    </Dialog>
  );
}
