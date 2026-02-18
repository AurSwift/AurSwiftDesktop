import type { StartupPhase } from "./startup.types";

export const STARTUP_MIN_VISIBLE_MS = 350;
export const UPDATE_SOFT_TIMEOUT_MS = 4000;
export const STARTUP_HARD_TIMEOUT_MS = 15000;

export const STARTUP_PHASE_PROGRESS: Record<StartupPhase, number> = {
  "checking-updates": 20,
  "starting-services": 45,
  "restoring-session": 75,
  finalizing: 92,
  complete: 100,
};

export const STARTUP_PHASE_LABELS: Record<StartupPhase, string> = {
  "checking-updates": "Checking for updates...",
  "starting-services": "Starting AuraSwift...",
  "restoring-session": "Loading secure session...",
  finalizing: "Loading...",
  complete: "Loading...",
};
