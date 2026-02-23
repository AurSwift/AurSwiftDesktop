import type { LucideIcon } from "lucide-react";
import type { FeatureCategory } from "@/features/dashboard/types/feature-config";

export type SidebarActionState = "enabled" | "disabled";

export interface SidebarSelection {
  featureId: string;
  actionId: string;
}

export interface SidebarActionItem {
  key: string;
  featureId: string;
  actionId: string;
  label: string;
  icon: LucideIcon;
  state: SidebarActionState;
  disabledReason?: string;
  isActive: boolean;
}

export interface SidebarGroupConfig {
  featureId: string;
  category: FeatureCategory;
  label: string;
  icon: LucideIcon;
  items: SidebarActionItem[];
  isActive: boolean;
  requiresUpgrade: boolean;
  upgradeMessage?: string;
}

export interface SidebarFeatureVisibility {
  isVisible: boolean;
  canAccess: boolean;
  requiresUpgrade: boolean;
  upgradeMessage?: string;
}

export interface SidebarMenuViewModel {
  groups: SidebarGroupConfig[];
  activeSelection: SidebarSelection | null;
  activeGroupId: string | null;
}

export type SidebarLayoutMode = "expanded" | "collapsed" | "mobile-drawer";
