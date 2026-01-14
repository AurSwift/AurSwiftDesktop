import { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { ProtectedRoute, PublicRoute } from "@/components";
import { AuthPage } from "@/features/auth";
import { DashboardView } from "@/features/dashboard";
import {
  LicenseActivationScreen,
  LicenseInfoPage,
  useLicenseContext,
} from "@/features/license";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
        switch (data.type) {
          case "warning":
            toast.warning(data.message, { duration: 5000 });
            break;
          case "error":
            toast.error(data.message, { duration: 5000 });
            break;
          case "info":
            toast.info(data.message, { duration: 5000 });
            break;
          case "success":
            toast.success(data.message, { duration: 5000 });
            break;
          default:
            toast(data.message, { duration: 5000 });
        }
      }
    );

    return cleanup;
  }, []);
}

/**
 * Loading screen shown while checking license status
 */
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Loading aurswift...</p>
      </div>
    </div>
  );
}

/**
 * Main App content - only shown after license check
 */
function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />

        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/license"
          element={
            <ProtectedRoute>
              <LicenseInfoPage />
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
  const [showActivation, setShowActivation] = useState(false);

  // Listen for system notifications
  useSystemNotifications();

  useEffect(() => {
    // Once loading is complete, determine if we need activation
    if (!isLoading) {
      setShowActivation(!isActivated);
    }
  }, [isLoading, isActivated]);

  // Show loading screen while checking license
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show activation screen if not licensed
  if (showActivation) {
    return (
      <LicenseActivationScreen
        onActivationSuccess={() => {
          refreshStatus();
          setShowActivation(false);
        }}
      />
    );
  }

  // Show main app if licensed
  return <AppContent />;
}

export default function App() {
  return <AppWithLicenseCheck />;
}
