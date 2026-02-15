/**
 * useButtonEditor
 *
 * Manages button editor modal state (open/close, selected button, mode)
 * and handleUpdate which calls the API and updates local pages state.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import type {
  QuickSellButtonWithDetails,
  QuickSellPageWithButtons,
  ButtonEditorState,
} from "../types";

const logger = getLogger("use-button-editor");

export function useButtonEditor(
  setPages: React.Dispatch<React.SetStateAction<QuickSellPageWithButtons[]>>,
) {
  const [editorState, setEditorState] = useState<ButtonEditorState>({
    isOpen: false,
    button: null,
    mode: "edit",
  });

  const openEditor = useCallback(
    (button: QuickSellButtonWithDetails | null, mode: "create" | "edit" = "edit") => {
      setEditorState({ isOpen: true, button, mode });
    },
    [],
  );

  const closeEditor = useCallback(() => {
    setEditorState({ isOpen: false, button: null, mode: "edit" });
  }, []);

  const handleUpdate = useCallback(
    async (updatedButton: Partial<QuickSellButtonWithDetails>) => {
      if (!editorState.button) return;

      try {
        const response = await window.quickSellAPI.updateButton({
          id: editorState.button.id,
          ...updatedButton,
        });

        if (response.success) {
          setPages((prevPages) =>
            prevPages.map((page) => ({
              ...page,
              buttons: page.buttons.map((btn) =>
                btn.id === editorState.button!.id
                  ? { ...btn, ...updatedButton, ...response.button }
                  : btn,
              ),
            })),
          );

          toast.success("Button updated successfully");
          closeEditor();
        } else {
          throw new Error(
            (response as { message?: string }).message ||
              "Failed to update button",
          );
        }
      } catch (error) {
        logger.error("Error updating button:", error);
        toast.error("Failed to update button");
      }
    },
    [editorState.button, setPages, closeEditor],
  );

  return {
    editorState,
    openEditor,
    closeEditor,
    handleUpdate,
  };
}
