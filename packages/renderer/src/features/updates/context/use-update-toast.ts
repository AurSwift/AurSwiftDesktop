/**
 * Update Toast Context Hook
 *
 * Separated from provider for Fast Refresh compatibility.
 */
import { useContext } from "react";
import { UpdateToastContext } from "./update-toast-context-types";

export function useUpdateToast() {
  const context = useContext(UpdateToastContext);
  if (!context) {
    throw new Error("useUpdateToast must be used within UpdateToastProvider");
  }
  return context;
}

