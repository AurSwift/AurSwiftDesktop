/**
 * Update Toast Context Types
 *
 * Split out for Fast Refresh compatibility.
 */
import { createContext } from "react";
import type {
  UpdateInfo,
  DownloadProgress,
  UpdateError,
  UpdateState,
} from "@app/shared";

export interface UpdateContextValue {
  state: UpdateState;
  updateInfo: UpdateInfo | null;
  progress: DownloadProgress | null;
  error: UpdateError | null;
  currentVersion: string;
  postponeCount: number;

  // Actions
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  postponeUpdate: () => void;
  checkForUpdates: () => Promise<void>;
  dismissError: () => void;
}

export const UpdateToastContext = createContext<UpdateContextValue | null>(null);
