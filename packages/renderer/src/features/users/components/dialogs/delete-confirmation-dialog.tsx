import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmationDialogProps {
  /**
   * Open state
   */
  open: boolean;
  /**
   * Open state change handler
   */
  onOpenChange: (open: boolean) => void;
  /**
   * User name to display in confirmation message
   */
  userName: string;
  /**
   * Confirmation handler (called when user confirms deletion)
   */
  onConfirm: () => void;
  /**
   * Loading state (shows spinner in confirm button)
   */
  isLoading?: boolean;
}

/**
 * Delete Confirmation Dialog
 * Replaces native browser confirm() for better UX and accessibility
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <DeleteConfirmationDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   userName="John Doe"
 *   onConfirm={handleDelete}
 *   isLoading={isDeleting}
 * />
 * ```
 */
export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  userName,
  onConfirm,
  isLoading = false,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Staff Member?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{userName}</strong>?
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
