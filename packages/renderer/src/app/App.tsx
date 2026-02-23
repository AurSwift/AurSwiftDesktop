import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  LoadingScreen,
  ProtectedRoute,
  PublicRoute,
  RetryableLazyRoute,
  RouteErrorBoundary,
} from "@/components";
import {
  StartupScreen,
  useStartupSequence,
  type StartupWarningCode,
} from "@/app/startup";
import type { StartupState } from "@/app/startup/startup.types";
import { AuthPage, useTestMode } from "@/features/auth";
import { LicenseActivationModal, useLicenseContext } from "@/features/license";
import { ProtectedAppShell } from "@/features/navigation/components/protected-app-shell";
import { useAuth } from "@/shared/hooks";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import { sanitizeUserFacingMessage } from "@/shared/utils/user-facing-errors";

const authLoader = () => import("@/features/auth/views/auth-page");
const dashboardLoader = () =>
  import("@/features/dashboard/views/dashboard-view");
const licenseLoader = () =>
  import("@/features/license/pages/license-info-page").then((m) => ({
    default: m.LicenseInfoPage,
  }));
const startupLogger = getLogger("startup-sequence");

function getStartupWarningMessage(code: StartupWarningCode): string {
  switch (code) {
    case "update-timeout":
      return "Startup continued without waiting for update check completion.";
    case "update-failed":
      return "Startup continued after an update check error.";
    case "update-unavailable":
      return "Update checks are currently unavailable. Startup continued.";
    default:
      return "Startup continued with a non-blocking warning.";
  }
}

/**
 * System notification listener
 * Handles system-level notifications from main process
 */
function useSystemNotifications() {
  useEffect(() => {
    // Check if API is available (preload script loaded)
    if (!window.systemNotificationsAPI?.onNotification) {
      return;
    }

    const cleanup = window.systemNotificationsAPI.onNotification(
      (data: { type: string; message: string }) => {
        const message = sanitizeUserFacingMessage(
          data.message,
          "Something went wrong",
        );
        switch (data.type) {
          case "warning":
            toast.warning(message, { duration: 5000 });
            break;
          case "error":
            toast.error(message, { duration: 5000 });
            break;
          case "info":
            toast.info(message, { duration: 5000 });
            break;
          case "success":
            toast.success(message, { duration: 5000 });
            break;
          default:
            toast(message, { duration: 5000 });
        }
      },
    );

    return cleanup;
  }, []);
}

/**
 * Default route redirects to auth.
 */
function DefaultRouteRedirect() {
  return <Navigate to="/auth" replace />;
}

/**
 * Main App content - only shown after license check
 */
function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DefaultRouteRedirect />} />

        <Route
          path="/auth"
          element={
            <PublicRoute>
              <RouteErrorBoundary>
                <RetryableLazyRoute
                  loader={authLoader}
                  fallback={<LoadingScreen />}
                  debug="none"
                />
              </RouteErrorBoundary>
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary>
                <RetryableLazyRoute
                  loader={dashboardLoader}
                  fallback={<LoadingScreen />}
                  debug="none"
                />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/license"
          element={
            <ProtectedRoute>
              <ProtectedAppShell>
                <RouteErrorBoundary>
                  <RetryableLazyRoute
                    loader={licenseLoader}
                    fallback={<LoadingScreen />}
                    debug="none"
                  />
                </RouteErrorBoundary>
              </ProtectedAppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

/**
 * App wrapper that handles license activation flow
 */
function AppWithLicenseCheck() {
  const { isLoading, isActivated, refreshStatus } = useLicenseContext();
  const { user, isInitializing } = useAuth();
  const { testMode, setTestMode } = useTestMode();
  const [showActivation, setShowActivation] = useState(
    () => !isLoading && !isActivated,
  );
  const startupWarningShownRef = useRef(false);
  const prefetchedAuthRef = useRef(false);
  const prefetchedDashboardRef = useRef(false);

  // Listen for system notifications
  useSystemNotifications();

  const runStartupUpdateCheck =
    useCallback(async (): Promise<StartupWarningCode | null> => {
      if (!window.updateAPI?.checkForUpdates) {
        return "update-unavailable";
      }

      try {
        await window.updateAPI.checkForUpdates();
        return null;
      } catch (error) {
        startupLogger.warn("Startup update check failed", error);
        return "update-failed";
      }
    }, []);

  const startupState = useStartupSequence({
    licenseLoading: isLoading,
    authInitializing: isInitializing,
    runUpdateCheck: runStartupUpdateCheck,
  });

  const licenseLoadingState = useMemo<StartupState>(
    () => ({
      phase: "starting-services",
      progress: 75,
      isBlocking: true,
      warning: null,
      startedAt: Date.now(),
      completedAt: null,
    }),
    [],
  );

  useEffect(() => {
    if (prefetchedAuthRef.current) {
      return;
    }

    prefetchedAuthRef.current = true;
    void authLoader().catch((error) => {
      startupLogger.warn("Failed to prefetch auth route", error);
    });
  }, []);

  useEffect(() => {
    if (!user || prefetchedDashboardRef.current) {
      return;
    }

    prefetchedDashboardRef.current = true;
    void dashboardLoader().catch((error) => {
      startupLogger.warn("Failed to prefetch dashboard route", error);
    });
  }, [user]);

  useEffect(() => {
    if (!startupState.warning || startupWarningShownRef.current) {
      return;
    }

    startupWarningShownRef.current = true;
    const warningMessage = getStartupWarningMessage(startupState.warning);
    startupLogger.warn(warningMessage);
    toast.warning(warningMessage, {
      id: "startup-warning",
      duration: 5000,
    });
  }, [startupState.warning]);

  useEffect(() => {
    // Once loading is complete, determine if we need activation
    if (!isLoading) {
      setShowActivation(!isActivated);
    }
  }, [isLoading, isActivated]);

  // Show EPOS-style splash for entire cold start (startup + license loading)
  if (startupState.isBlocking || isLoading) {
    const splashState = startupState.isBlocking
      ? startupState
      : licenseLoadingState;
    return <StartupScreen state={splashState} />;
  }

  // Bypass license check in test mode
  if (testMode) {
    return <AppContent />;
  }

  // Show auth background + activation modal if not licensed
  if (showActivation) {
    return (
      <>
        <AuthPage />
        <LicenseActivationModal
          open
          onActivationSuccess={() => {
            void refreshStatus();
            setShowActivation(false);
          }}
          onTestMode={() => setTestMode(true)}
        />
      </>
    );
  }

  // Show main app if licensed
  return <AppContent />;
}

export default function App() {
  return <AppWithLicenseCheck />;
}
