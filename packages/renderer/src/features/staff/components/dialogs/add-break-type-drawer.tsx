import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { AddBreakTypeForm } from "../forms/add-break-type-form";
import type {
  BreakTypeFormData,
  BreakTypeUpdateData,
} from "../../schemas/break-type-schema";
import type { BreakTypeDefinition } from "@/shared/types/api/break-policy";

interface AddBreakTypeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BreakTypeFormData | BreakTypeUpdateData) => Promise<void>;
  isLoading: boolean;
  editingBreakType?: BreakTypeDefinition | null;
}

export function AddBreakTypeDrawer({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  editingBreakType,
}: AddBreakTypeDrawerProps) {
  const handleSubmit = async (data: BreakTypeFormData | BreakTypeUpdateData) => {
    await onSubmit(data);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-[95%] sm:w-[600px] md:w-[700px] lg:w-[800px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>
            {editingBreakType ? "Edit Break Type" : "Add Break Type"}
          </DrawerTitle>
          <DrawerDescription>
            Define a type of break available to staff
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0">
          <AddBreakTypeForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={isLoading}
            isOpen={open}
            showButtons={false}
            editingBreakType={editingBreakType}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
