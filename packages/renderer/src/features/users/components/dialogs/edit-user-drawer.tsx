import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EditUserForm } from "../forms/edit-user-form";
import type { UserUpdateFormData } from "@/features/users/schemas/user-schema";
import type { StaffUser } from "@/features/users/schemas/types";

interface EditUserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: StaffUser;
  onSubmit: (data: UserUpdateFormData) => Promise<void>;
  isLoading: boolean;
}

export function EditUserDrawer({
  open,
  onOpenChange,
  user,
  onSubmit,
  isLoading,
}: EditUserDrawerProps) {
  const handleSubmit = async (data: UserUpdateFormData) => {
    await onSubmit(data);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-[95%] sm:w-[600px] md:w-[700px] lg:w-[800px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>Edit Staff Member</DrawerTitle>
          <DrawerDescription>
            Update staff member information and permissions.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0">
          <EditUserForm
            user={user}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={isLoading}
            isOpen={open}
            showButtons={false}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

