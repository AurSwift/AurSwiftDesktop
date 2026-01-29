import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { AddPolicyRuleForm } from "../forms/add-policy-rule-form";
import type {
  PolicyRuleFormData,
  PolicyRuleUpdateData,
} from "../../schemas/policy-rule-schema";
import type { BreakPolicyRule, BreakTypeDefinition } from "@/shared/types/api/break-policy";

interface AddPolicyRuleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PolicyRuleFormData | PolicyRuleUpdateData) => Promise<void>;
  isLoading: boolean;
  editingRule?: BreakPolicyRule | null;
  breakTypes: BreakTypeDefinition[];
  policyId: number;
}

export function AddPolicyRuleDrawer({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  editingRule,
  breakTypes,
  policyId,
}: AddPolicyRuleDrawerProps) {
  const handleSubmit = async (data: PolicyRuleFormData | PolicyRuleUpdateData) => {
    await onSubmit(data);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-[95%] sm:w-[600px] md:w-[700px] lg:w-[800px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>
            {editingRule ? "Edit Policy Rule" : "Add Policy Rule"}
          </DrawerTitle>
          <DrawerDescription>
            Define when this break type is available based on shift length
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0">
          <AddPolicyRuleForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={isLoading}
            isOpen={open}
            showButtons={false}
            editingRule={editingRule}
            breakTypes={breakTypes}
            policyId={policyId}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
