import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
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

interface ViewUserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: StaffUser;
  onEdit: () => void;
}

export function ViewUserDrawer({
  open,
  onOpenChange,
  user,
  onEdit,
}: ViewUserDrawerProps) {
  const handleEdit = () => {
    onOpenChange(false);
    onEdit();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-[95%] sm:w-[600px] md:w-[700px] lg:w-[800px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0">
        <DrawerHeader className="border-b">
          <DrawerTitle>Staff Member Details</DrawerTitle>
          <DrawerDescription>
            View detailed information about this staff member.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col h-full">
          {/* Fixed Buttons Section */}
          <div className="border-b bg-background shrink-0">
            <div className="flex space-x-2 px-6 pt-4 pb-4">
              <Button onClick={handleEdit} className="flex-1">
                Edit User
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </DrawerClose>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <UserAvatar
                user={user}
                className="w-20 h-20 md:w-24 md:h-24"
              />
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">
                  Full Name
                </Label>
                <p className="text-base md:text-lg font-semibold mt-1">
                  {getStaffDisplayName(user)}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">
                  Email
                </Label>
                <p className="text-sm md:text-base mt-1">
                  {user.email}
                </p>
              </div>

              {user.address && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Address
                  </Label>
                  <p className="text-sm md:text-base mt-1">
                    {user.address}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-gray-500">
                  Role
                </Label>
                <div className="mt-1">
                  <Badge
                    variant={
                      getUserRoleName(user) === "manager"
                        ? "default"
                        : "secondary"
                    }
                    className="text-sm"
                  >
                    {getUserRoleDisplayName(user)}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">
                  Status
                </Label>
                <div className="mt-1">
                  <Badge
                    variant={user.isActive ? "default" : "destructive"}
                    className="text-sm"
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">
                  Created Date
                </Label>
                <p className="text-sm md:text-base mt-1">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

