import { useMemo } from "react";
import { DashboardActionsProvider } from "@/features/dashboard/context";
import { useShiftExpiryLogout } from "@/features/dashboard/hooks/use-shift-expiry-logout";
import { BackOfficeShell } from "@/features/dashboard/shell";
import { useNavigation } from "../hooks/use-navigation";
import { getView } from "../registry/view-registry";
import { NavigationContainer } from "./navigation-container";

/**
 * Authenticated App Shell
 *
 * Provides shared chrome (dashboard header) for authenticated views rendered
 * via the navigation system. Header visibility is controlled by ViewConfig.chrome.
 */
export function AuthenticatedAppShell() {
  const { currentViewId } = useNavigation();

  // Auto-logout when scheduled shift end is exceeded (runs even when header hidden, e.g. New Transaction)
  useShiftExpiryLogout();

  const view = useMemo(() => getView(currentViewId), [currentViewId]);
  const appShellMode = view?.chrome?.appShellMode ?? "back-office";

  return (
    <DashboardActionsProvider>
      {appShellMode === "back-office" ? (
        <BackOfficeShell
          currentViewId={currentViewId}
          currentViewTitle={view?.metadata?.title}
        >
          <NavigationContainer />
        </BackOfficeShell>
      ) : (
        <div className="min-h-screen bg-background flex flex-col">
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col">
              <NavigationContainer />
            </div>
          </main>
        </div>
      )}
    </DashboardActionsProvider>
  );
}
