/**
 * License Activation Feature
 *
 * Components and hooks for license activation flow in the desktop EPOS app.
 */

// Components
export { LicenseActivationScreen } from "./components/license-activation-screen.js";
export { LicenseStatusBadge } from "./components/license-status-badge.js";
export { LicenseInfoModal } from "./components/license-info-modal.js";
export { OfflineWarningBanner } from "./components/offline-warning-banner.js";
export { WiFiStatusIcon } from "./components/wifi-status-icon.js";

// Pages
export { LicenseInfoPage } from "./pages/license-info-page.js";

// Hooks
export { useLicense } from "./hooks/use-license.js";

// Context
export { LicenseProvider } from "./context/license-context.js";
export { useLicenseContext } from "./context/use-license-context.js";
