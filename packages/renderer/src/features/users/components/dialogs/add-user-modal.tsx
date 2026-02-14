import { ModalContainer, type ModalVariant } from "../modal-container";
import { UserForm } from "../forms/user-form";
import type { UserCreateFormData } from "@/features/users/schemas/user-schema";

interface AddUserModalProps {
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
   * Form submission handler
   */
  onSubmit: (data: UserCreateFormData) => Promise<void>;
  /**
   * Loading state
   */
  isLoading: boolean;
  /**
   * Optional trigger element (dialog only)
   */
  trigger?: React.ReactNode;
}

/**
 * Add User Modal (replaces add-user-dialog and add-user-drawer)
 * Uses ModalContainer for polymorphic behavior
 */
export function AddUserModal({
  variant,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  trigger,
}: AddUserModalProps) {
  const handleSubmit = async (data: UserCreateFormData) => {
    await onSubmit(data);
  };

  return (
    <ModalContainer
      variant={variant}
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Staff Member"
      description="Create a new staff account with role-based permissions."
      trigger={trigger}
    >
      <UserForm
        mode="create"
        onSubmit={handleSubmit as (data: UserCreateFormData | import("@/features/users/schemas/user-schema").UserUpdateFormData) => Promise<void>}
        onCancel={() => onOpenChange(false)}
        isLoading={isLoading}
        isOpen={open}
        showButtons={variant === "dialog"} // Dialog shows buttons, drawer doesn't
      />
    </ModalContainer>
  );
}
