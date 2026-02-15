import { ModalContainer, type ModalVariant } from "../modal-container";
import { UserForm } from "../forms/user-form";
import type { UserUpdateFormData } from "@/features/users/schemas/user-schema";
import type { StaffUser } from "@/features/users/schemas/types";

interface EditUserModalProps {
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
   * User to edit
   */
  user: StaffUser;
  /**
   * Form submission handler
   */
  onSubmit: (data: UserUpdateFormData) => Promise<void>;
  /**
   * Loading state
   */
  isLoading: boolean;
}

/**
 * Edit User Modal (replaces edit-user-dialog and edit-user-drawer)
 * Uses ModalContainer for polymorphic behavior
 */
export function EditUserModal({
  variant,
  open,
  onOpenChange,
  user,
  onSubmit,
  isLoading,
}: EditUserModalProps) {
  const handleSubmit = async (data: UserUpdateFormData) => {
    await onSubmit(data);
  };

  return (
    <ModalContainer
      variant={variant}
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Staff Member"
      description="Update staff member information and permissions."
    >
      <UserForm
        mode="edit"
        user={user}
        onSubmit={
          handleSubmit as (
            data:
              | import("@/features/users/schemas/user-schema").UserCreateFormData
              | UserUpdateFormData,
          ) => Promise<void>
        }
        onCancel={() => onOpenChange(false)}
        isLoading={isLoading}
        isOpen={open}
        showButtons={variant === "dialog"} // Dialog shows buttons, drawer doesn't
      />
    </ModalContainer>
  );
}
