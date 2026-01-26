import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { CreateRoleForm } from "./forms/create-role-form";
import type { RoleCreateFormData } from "@/features/rbac/schemas";

interface CreateRoleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RoleCreateFormData) => Promise<void>;
  isLoading: boolean;
}

export function CreateRoleDrawer({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateRoleDrawerProps) {
  const handleSubmit = async (data: RoleCreateFormData) => {
    await onSubmit(data);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-[95%] sm:w-[600px] md:w-[700px] lg:w-[800px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>Create New Role</DrawerTitle>
          <DrawerDescription>
            Create a custom role with specific permissions
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0">
          <CreateRoleForm
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
