import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export type ModalVariant = "dialog" | "drawer";

interface ModalContainerProps {
  /**
   * Modal variant - dialog for desktop, drawer for mobile/tablet
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
   * Modal title
   */
  title: string;
  /**
   * Modal description
   */
  description: string;
  /**
   * Modal content
   */
  children: React.ReactNode;
  /**
   * Optional trigger element (dialog only)
   */
  trigger?: React.ReactNode;
  /**
   * Optional drawer direction (drawer only)
   * @default "right"
   */
  drawerDirection?: "top" | "bottom" | "left" | "right";
}

/**
 * Polymorphic modal container component
 * Renders either a Dialog or Drawer based on variant prop
 * Eliminates duplication between dialog/drawer pairs
 *
 * @example
 * ```tsx
 * <ModalContainer
 *   variant="dialog"
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Add User"
 *   description="Create a new user account"
 * >
 *   <UserForm />
 * </ModalContainer>
 * ```
 */
export function ModalContainer({
  variant,
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
  drawerDirection = "right",
}: ModalContainerProps) {
  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-2 sm:mx-4 md:mx-6 lg:mx-8 p-3 sm:p-4 md:p-6 max-h-[90vh] sm:max-h-[85vh] md:max-h-[80vh] flex flex-col">
          <DialogHeader className="px-0 sm:px-0 md:px-2 shrink-0">
            <DialogTitle className="text-base sm:text-lg md:text-xl lg:text-2xl">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm md:text-base lg:text-base mt-1 sm:mt-2">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="px-0 sm:px-0 md:px-2 flex-1 overflow-y-auto min-h-0">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Drawer variant
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={drawerDirection}>
      <DrawerContent className="h-full w-[95%] sm:w-[600px] md:w-[700px] lg:w-[800px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
        <DrawerHeader className="border-b shrink-0">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
