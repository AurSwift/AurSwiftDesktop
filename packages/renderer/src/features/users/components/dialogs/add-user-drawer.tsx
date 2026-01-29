import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { AddUserForm } from "../forms/add-user-form";
import type { UserCreateFormData } from "@/features/users/schemas/user-schema";

interface AddUserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UserCreateFormData) => Promise<void>;
  isLoading: boolean;
}

export function AddUserDrawer({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: AddUserDrawerProps) {
  const handleSubmit = async (data: UserCreateFormData) => {
    await onSubmit(data);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-[95%] sm:w-[600px] md:w-[700px] lg:w-[800px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>Add New Staff Member</DrawerTitle>
          <DrawerDescription>
            Create a new staff account with role-based permissions.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0">
          <AddUserForm
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

