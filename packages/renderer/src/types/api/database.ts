/**
 * Database API Types
 *
 * Types for database management operations.
 *
 * @module types/api/database
 */

import type { APIResponse } from "./common";

// Database import progress types
export interface DatabaseImportProgress {
  stage:
    | "validating"
    | "backing-up"
    | "copying"
    | "reinitializing"
    | "restoring-license"
    | "complete"
    | "error";
  percent: number;
  message: string;
}

export interface DatabaseAPI {
  getInfo: () => Promise<APIResponse>;
  backup: () => Promise<APIResponse>;
  empty: () => Promise<APIResponse>;
  import: () => Promise<APIResponse>;

  // Progress subscription for database import
  onImportProgress: (
    callback: (progress: DatabaseImportProgress) => void,
  ) => () => void;

  // Ready signal subscription for when database import is fully complete
  onImportReady: (callback: () => void) => () => void;
}
