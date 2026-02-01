/**
 * Quick Sell Config View
 *
 * Main configuration view for managing quick sell button layouts.
 * Allows creating, editing, and organizing buttons across multiple pages.
 */

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import { useAuth } from "@/shared/hooks/use-auth";
import { QuickSellPageTabs } from "../components/page-tabs";
import { QuickSellButtonGrid } from "../components/button-grid";
import { ButtonEditorModal } from "../components/button-editor-modal";
import {
  QUICK_SELL_GRID,
  QUICK_SELL_MAX_PAGES,
  type QuickSellPageWithButtons,
  type QuickSellButtonWithDetails,
  type ButtonEditorState,
} from "../types";

const logger = getLogger("quick-sell-config-view");

interface QuickSellConfigViewProps {
  onBack: () => void;
}

export default function QuickSellConfigView({
  onBack,
}: QuickSellConfigViewProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [pages, setPages] = useState<QuickSellPageWithButtons[]>([]);

  // Button editor modal state
  const [editorState, setEditorState] = useState<ButtonEditorState>({
    isOpen: false,
    button: null,
    mode: "edit",
  });

  // Initialize default pages with unassigned buttons
  const initializeDefaultPages = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      logger.debug("Creating default pages...");
      const response = await window.quickSellAPI.initializeDefaults(
        user.businessId,
      );

      if (response.success && response.pages) {
        setPages(response.pages);
        toast.success("Quick sell pages initialized");
      } else {
        throw new Error(response.message || "Failed to initialize pages");
      }
    } catch (error) {
      logger.error("Error initializing default pages:", error);
      toast.error("Failed to initialize quick sell pages");
    }
  }, [user?.businessId]);

  // Load pages and buttons
  const loadData = useCallback(async () => {
    if (!user?.businessId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      logger.debug("Loading quick sell pages for business:", user.businessId);

      const response = await window.quickSellAPI.getPages(user.businessId);

      if (response.success && response.pages && response.pages.length > 0) {
        setPages(response.pages);
        logger.debug("Loaded pages:", response.pages.length);
      } else {
        // Initialize default pages if none exist
        logger.debug("No pages found, initializing defaults");
        await initializeDefaultPages();
      }
    } catch (error) {
      logger.error("Error loading quick sell data:", error);
      toast.error("Failed to load quick sell configuration");
    } finally {
      setIsLoading(false);
    }
  }, [user?.businessId, initializeDefaultPages]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get current page
  const currentPage = pages[activePageIndex];

  // Handle button click to open editor
  const handleButtonClick = (button: QuickSellButtonWithDetails) => {
    setEditorState({
      isOpen: true,
      button,
      mode: "edit",
    });
  };

  // Handle button update from editor
  const handleButtonUpdate = async (
    updatedButton: Partial<QuickSellButtonWithDetails>,
  ) => {
    if (!editorState.button) return;

    try {
      const response = await window.quickSellAPI.updateButton({
        id: editorState.button.id,
        ...updatedButton,
      });

      if (response.success) {
        // Update local state
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
        setEditorState({ isOpen: false, button: null, mode: "edit" });
      } else {
        throw new Error(response.message || "Failed to update button");
      }
    } catch (error) {
      logger.error("Error updating button:", error);
      toast.error("Failed to update button");
    }
  };

  // Handle button position swap (drag and drop)
  const handleSwapPositions = async (buttonId1: string, buttonId2: string) => {
    try {
      const response = await window.quickSellAPI.swapPositions({
        buttonId1,
        buttonId2,
      });

      if (response.success) {
        // Reload data to get updated positions
        await loadData();
      } else {
        throw new Error(response.message || "Failed to swap positions");
      }
    } catch (error) {
      logger.error("Error swapping positions:", error);
      toast.error("Failed to swap button positions");
    }
  };

  // Reset page to unassigned buttons
  const handleResetPage = async () => {
    if (!currentPage) return;

    const confirmed = window.confirm(
      `Are you sure you want to reset "${currentPage.name}" to unassigned buttons? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      const response = await window.quickSellAPI.resetPage(currentPage.id);

      if (response.success) {
        await loadData();
        toast.success(`${currentPage.name} has been reset`);
      } else {
        throw new Error(response.message || "Failed to reset page");
      }
    } catch (error) {
      logger.error("Error resetting page:", error);
      toast.error("Failed to reset page");
    }
  };

  // Close editor modal
  const handleCloseEditor = () => {
    setEditorState({ isOpen: false, button: null, mode: "edit" });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center gap-4 p-4 border-b">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Quick Sell Buttons</h1>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Quick Sell Buttons</h1>
            <p className="text-sm text-muted-foreground">
              Configure button layouts for quick product selection (
              {QUICK_SELL_GRID.COLUMNS}×{QUICK_SELL_GRID.ROWS} grid,{" "}
              {QUICK_SELL_MAX_PAGES} pages)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetPage}
            disabled={!currentPage}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Page
          </Button>
        </div>
      </div>

      {/* Page Tabs */}
      <QuickSellPageTabs
        pages={pages}
        activePageIndex={activePageIndex}
        onPageChange={setActivePageIndex}
      />

      {/* Button Grid */}
      <div className="flex-1 overflow-auto p-4">
        {currentPage ? (
          <QuickSellButtonGrid
            buttons={currentPage.buttons}
            onButtonClick={handleButtonClick}
            onSwapPositions={handleSwapPositions}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No page selected. Please initialize quick sell pages.
          </div>
        )}
      </div>

      {/* Button Editor Modal */}
      <ButtonEditorModal
        isOpen={editorState.isOpen}
        button={editorState.button}
        onClose={handleCloseEditor}
        onSave={handleButtonUpdate}
      />
    </div>
  );
}
