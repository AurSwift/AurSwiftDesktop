/**
 * Quick Sell Page Tabs
 *
 * Tab navigation for switching between quick sell pages.
 * Main Screen + Sub Pages (up to 6).
 */

import { cn } from "@/shared/utils/cn";
import type { QuickSellPageWithButtons } from "../types";

interface QuickSellPageTabsProps {
  pages: QuickSellPageWithButtons[];
  activePageIndex: number;
  onPageChange: (index: number) => void;
}

export function QuickSellPageTabs({
  pages,
  activePageIndex,
  onPageChange,
}: QuickSellPageTabsProps) {
  if (pages.length === 0) {
    return null;
  }

  // Separate main screen from sub pages
  const mainScreen = pages.find((p) => p.isMainScreen);
  const subPages = pages
    .filter((p) => !p.isMainScreen)
    .sort((a, b) => a.pageIndex - b.pageIndex);

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
      {/* Main Screen Tab */}
      {mainScreen && (
        <button
          onClick={() => onPageChange(pages.indexOf(mainScreen))}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
            "border-2",
            pages.indexOf(mainScreen) === activePageIndex
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-accent border-transparent hover:border-border",
          )}
        >
          {mainScreen.name}
        </button>
      )}

      {/* Divider */}
      {mainScreen && subPages.length > 0 && (
        <div className="w-px h-6 bg-border mx-2" />
      )}

      {/* Sub Page Tabs */}
      {subPages.map((page) => {
        const index = pages.indexOf(page);
        return (
          <button
            key={page.id}
            onClick={() => onPageChange(index)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
              "border-2",
              index === activePageIndex
                ? "bg-slate-700 text-white border-slate-700"
                : "bg-slate-100 text-slate-800 hover:bg-slate-200 border-transparent hover:border-slate-300",
            )}
          >
            {page.name}
          </button>
        );
      })}
    </div>
  );
}
