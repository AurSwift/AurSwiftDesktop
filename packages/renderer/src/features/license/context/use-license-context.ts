/**
 * License Context Hook
 *
 * Custom hook to access the license context.
 * Separated from provider for Fast Refresh compatibility.
 */

import { useContext } from "react";
import { LicenseContext, type LicenseContextValue } from "./license-context-types.js";

export function useLicenseContext(): LicenseContextValue {
  const context = useContext(LicenseContext);

  if (!context) {
    throw new Error("useLicenseContext must be used within a LicenseProvider");
  }

  return context;
}
