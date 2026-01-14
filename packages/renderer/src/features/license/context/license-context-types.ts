/**
 * License Context Types
 *
 * Type definitions and context creation for license management.
 */

import { createContext } from "react";
import type { LicenseStatus } from "../hooks/use-license.js";

export interface LicenseContextValue {
  // License status
  isActivated: boolean;
  isLoading: boolean;
  licenseStatus: LicenseStatus | null;

  // Error state for initialization/validation failures
  error: string | null;
  clearError: () => void;

  // Actions
  refreshStatus: () => Promise<void>;
  activate: (licenseKey: string, terminalName?: string) => Promise<boolean>;
  deactivate: () => Promise<boolean>;
  hasFeature: (featureName: string) => Promise<boolean>;

  // Plan info helpers
  planId: string | null;
  planName: string | null;
  businessName: string | null;
}

export const LicenseContext = createContext<LicenseContextValue | null>(null);
