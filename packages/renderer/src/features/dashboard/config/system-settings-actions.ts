import { BadgeInfo, KeyRound, LogOut, Power, type LucideIcon } from "lucide-react";

export type SystemSettingsExtraActionId =
  | "show-license-info"
  | "change-pin"
  | "logout"
  | "quit-app";

export interface SystemSettingsExtraAction {
  id: SystemSettingsExtraActionId;
  label: string;
  icon: LucideIcon;
}

export const SYSTEM_SETTINGS_EXTRA_ACTIONS: readonly SystemSettingsExtraAction[] = [
  { id: "show-license-info", label: "Show license info", icon: BadgeInfo },
];

export const SYSTEM_SETTINGS_ACTION_IDS = new Set<SystemSettingsExtraActionId>([
  "show-license-info",
  "change-pin",
  "logout",
  "quit-app",
]);

export const TOPBAR_USER_ACTIONS: readonly SystemSettingsExtraAction[] = [
  { id: "change-pin", label: "Change PIN", icon: KeyRound },
  { id: "logout", label: "Log out", icon: LogOut },
  { id: "quit-app", label: "Quit App", icon: Power },
];
