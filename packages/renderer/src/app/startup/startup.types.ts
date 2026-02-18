export type StartupPhase =
  | "checking-updates"
  | "starting-services"
  | "restoring-session"
  | "finalizing"
  | "complete";

export type StartupWarningCode =
  | "update-timeout"
  | "update-failed"
  | "update-unavailable";

export interface StartupState {
  phase: StartupPhase;
  progress: number;
  isBlocking: boolean;
  warning: StartupWarningCode | null;
  startedAt: number;
  completedAt: number | null;
}

export interface UseStartupSequenceOptions {
  licenseLoading: boolean;
  authInitializing: boolean;
  runUpdateCheck: () => Promise<StartupWarningCode | null>;
}
