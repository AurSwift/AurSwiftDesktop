/**
 * Quick Sell Config View
 *
 * Main configuration view for managing quick sell button layouts.
 * Uses mini bar + detail pattern: MiniBar, toolbar, grid, ButtonEditorModal.
 */

import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { MiniBar } from "@/components/mini-bar";
import { useAuth } from "@/shared/hooks/use-auth";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import { QuickSellPageTabs } from "../components/page-tabs";
import { QuickSellButtonGrid } from "../components/button-grid";
import {
  QuickSellToolbar,
  filterButtons,
  sortButtonsForExport,
} from "../components/quick-sell-toolbar";
import { useQuickSellPages } from "../hooks/use-quick-sell-pages";
import { useButtonEditor } from "../hooks/use-button-editor";
import type {
  QuickSellButtonWithDetails,
  QuickSellLinkTypeFilter,
  QuickSellSortKey,
} from "../types";

const logger = getLogger("quick-sell-config-view");

const ButtonEditorModal = lazy(() =>
  import("../components/button-editor-modal").then((m) => ({
    default: m.ButtonEditorModal,
  })),
);

interface QuickSellConfigViewProps {
  onBack: () => void;
}

export default function QuickSellConfigView({
  onBack,
}: QuickSellConfigViewProps) {
  const safeFocusRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const {
    pages,
    isLoading,
    refetch,
    resetPage,
    setPages,
  } = useQuickSellPages(user?.businessId);

  const {
    editorState,
    openEditor,
    closeEditor,
    handleUpdate,
  } = useButtonEditor(setPages);

  const [activePageIndex, setActivePageIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [linkTypeFilter, setLinkTypeFilter] =
    useState<QuickSellLinkTypeFilter>("all");
  const [sortKey, setSortKey] = useState<QuickSellSortKey>("position");

  const currentPage = pages[activePageIndex];
  const totalPages = Math.max(1, pages.length);

  const filteredButtons = useMemo(() => {
    if (!currentPage?.buttons) return [];
    return filterButtons(
      currentPage.buttons,
      linkTypeFilter,
      searchTerm,
    );
  }, [currentPage?.buttons, linkTypeFilter, searchTerm]);

  const handleSwapPositions = async (buttonId1: string, buttonId2: string) => {
    try {
      const response = await window.quickSellAPI.swapPositions({
        buttonId1,
        buttonId2,
      });

      if (response.success) {
        await refetch();
      } else {
        throw new Error(
          (response as { message?: string }).message ||
            "Failed to swap positions",
        );
      }
    } catch (error) {
      logger.error("Error swapping positions:", error);
      toast.error("Failed to swap button positions");
    }
  };

  const handleResetPage = () => {
    if (!currentPage) return;
    resetPage(currentPage.id, currentPage.name);
  };

  const handleExport = () => {
    if (!currentPage?.buttons?.length) return;
    const toExport = sortButtonsForExport(
      filterButtons(currentPage.buttons, linkTypeFilter, searchTerm),
      sortKey,
    );
    const blob = new Blob([JSON.stringify(toExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quick-sell-${currentPage.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-1 max-w-[1600px] flex flex-col flex-1 min-h-0 gap-4 sm:gap-6">
      <div
        ref={safeFocusRef}
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
      />

      <MiniBar
        className="shrink-0"
        title="Quick Sell Buttons"
        onBack={onBack}
        backAriaLabel="Back to Settings"
        center={
          <div className="w-full max-w-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search buttons by label, product or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
                aria-label="Search buttons"
              />
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              {pages.length === 0
                ? "0 / 0"
                : `${activePageIndex + 1} / ${totalPages}`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setActivePageIndex((p) => Math.max(0, p - 1))
              }
              disabled={activePageIndex <= 0 || totalPages <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setActivePageIndex((p) =>
                  Math.min(totalPages - 1, p + 1),
                )
              }
              disabled={
                activePageIndex >= totalPages - 1 || totalPages <= 1
              }
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex-1 min-h-0 flex flex-col rounded-xl border bg-background shadow-sm overflow-hidden">
        <QuickSellToolbar
          linkTypeFilter={linkTypeFilter}
          onLinkTypeFilterChange={setLinkTypeFilter}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
          onResetPage={handleResetPage}
          onExport={handleExport}
          hasCurrentPage={Boolean(currentPage)}
          currentPageName={currentPage?.name ?? null}
          buttonCount={filteredButtons.length}
        />

        <QuickSellPageTabs
          pages={pages}
          activePageIndex={activePageIndex}
          onPageChange={setActivePageIndex}
        />

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center flex-1 min-h-[200px]">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : currentPage ? (
            <QuickSellButtonGrid
              buttons={filteredButtons}
              onButtonClick={(btn: QuickSellButtonWithDetails) =>
                openEditor(btn, "edit")
              }
              onSwapPositions={handleSwapPositions}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No page selected. Please initialize quick sell pages.
            </div>
          )}
        </div>
      </div>

      <Suspense fallback={null}>
        <ButtonEditorModal
          isOpen={editorState.isOpen}
          button={editorState.button}
          onClose={closeEditor}
          onSave={handleUpdate}
        />
      </Suspense>
    </div>
  );
}
