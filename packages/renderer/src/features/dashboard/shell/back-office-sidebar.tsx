import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";
import type {
  SidebarActionItem,
  SidebarGroupConfig,
  SidebarLayoutMode,
} from "./sidebar-menu.types";

interface BackOfficeSidebarProps {
  groups: SidebarGroupConfig[];
  layoutMode: SidebarLayoutMode;
  isMobileDrawerOpen: boolean;
  onMobileDrawerOpenChange: (open: boolean) => void;
  onActionClick: (item: SidebarActionItem) => void;
  onToggleSidebarCollapsed: () => void;
}

const CATEGORY_ORDER: SidebarGroupConfig["category"][] = [
  "management",
  "actions",
  "reports",
  "settings",
  "stats",
];

const CATEGORY_LABELS: Record<SidebarGroupConfig["category"], string> = {
  management: "Store Management",
  actions: "Operations",
  reports: "Analytics",
  settings: "System Settings",
  stats: "Insights",
};

interface SidebarSection {
  category: SidebarGroupConfig["category"];
  label: string;
  items: SidebarActionItem[];
}

function buildSidebarSections(groups: SidebarGroupConfig[]): SidebarSection[] {
  const groupedItems = new Map<
    SidebarGroupConfig["category"],
    SidebarActionItem[]
  >();

  for (const group of groups) {
    const existingItems = groupedItems.get(group.category) ?? [];
    groupedItems.set(group.category, [...existingItems, ...group.items]);
  }

  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: groupedItems.get(category) ?? [],
  })).filter((section) => section.items.length > 0);
}

function SidebarActionButton({
  item,
  onSelect,
  compact = false,
}: {
  item: SidebarActionItem;
  onSelect: (item: SidebarActionItem) => void;
  compact?: boolean;
}) {
  const isDisabled = item.state === "disabled";
  const Icon = item.icon;

  const button = (
    <button
      type="button"
      onClick={() => onSelect(item)}
      disabled={isDisabled}
      title={isDisabled ? item.disabledReason : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm border-l-2 border-l-transparent px-3 py-2 text-left text-sm transition-colors",
        compact && "px-2.5 py-1.5 text-xs",
        item.isActive
          ? "border-l-primary bg-accent text-foreground"
          : "text-foreground/85 hover:bg-accent/70 hover:text-foreground",
        isDisabled &&
          "cursor-not-allowed border-l-transparent bg-transparent text-muted-foreground/70 hover:bg-transparent hover:text-muted-foreground/70",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );

  if (isDisabled && item.disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{item.disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

function SidebarEmptyState() {
  return (
    <div className="rounded-md border border-dashed border-sidebar-border bg-muted/20 p-3 text-sm text-muted-foreground">
      No menu items available for your account.
    </div>
  );
}

function SidebarSectionList({
  groups,
  onActionClick,
  compactActions = false,
}: {
  groups: SidebarGroupConfig[];
  onActionClick: (item: SidebarActionItem) => void;
  compactActions?: boolean;
}) {
  const sections = buildSidebarSections(groups);
  if (sections.length === 0) {
    return <SidebarEmptyState />;
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        return (
          <section
            key={section.category}
            className="space-y-1 border-t border-sidebar-border pt-3 first:border-t-0 first:pt-0"
            aria-label={section.label}
          >
            <p className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {section.label}
            </p>

            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarActionButton
                  key={item.key}
                  item={item}
                  onSelect={onActionClick}
                  compact={compactActions}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function BackOfficeSidebar({
  groups,
  layoutMode,
  isMobileDrawerOpen,
  onMobileDrawerOpenChange,
  onActionClick,
  onToggleSidebarCollapsed,
}: BackOfficeSidebarProps) {
  if (layoutMode === "mobile-drawer") {
    return (
      <Sheet open={isMobileDrawerOpen} onOpenChange={onMobileDrawerOpenChange}>
        <SheetContent
          side="left"
          className="flex w-[20rem] flex-col p-0 sm:max-w-[20rem]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Back Office Navigation</SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            <SidebarSectionList
              groups={groups}
              onActionClick={onActionClick}
              compactActions
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (layoutMode === "collapsed") {
    return (
      <aside className="hidden h-full w-16 shrink-0 flex-col border-r border-sidebar-border bg-background md:flex">
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-1 py-2">
          {groups.map((group) => {
            const GroupIcon = group.icon;
            const iconButton = (
              <button
                key={group.featureId}
                type="button"
                onClick={onToggleSidebarCollapsed}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-sidebar-border hover:bg-accent hover:text-foreground"
                aria-label={group.label}
                title={group.label}
              >
                <GroupIcon className="h-5 w-5" />
              </button>
            );

            return (
              <Tooltip key={group.featureId}>
                <TooltipTrigger asChild>{iconButton}</TooltipTrigger>
                <TooltipContent side="right">{group.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="border-t border-sidebar-border p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleSidebarCollapsed}
                className="flex h-10 w-full items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-background md:flex">
      <div
        className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
        data-testid="sidebar-scroll-region"
      >
        <SidebarSectionList groups={groups} onActionClick={onActionClick} />
      </div>

      <div
        className="border-t border-sidebar-border p-2"
        data-testid="sidebar-collapse-control"
      >
        <button
          type="button"
          onClick={onToggleSidebarCollapsed}
          className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PanelLeftClose className="h-4 w-4" />
          <span>Collapse</span>
        </button>
      </div>
    </aside>
  );
}
