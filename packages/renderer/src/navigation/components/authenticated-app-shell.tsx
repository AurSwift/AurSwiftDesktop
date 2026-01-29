import { useMemo } from "react";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { useShiftExpiryLogout } from "@/features/dashboard/hooks/use-shift-expiry-logout";
import { useAuth } from "@/shared/hooks";
import { getUserDisplayName } from "@/shared/utils/auth";
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
  const { user } = useAuth();
  const { currentViewId } = useNavigation();

  // Auto-logout when scheduled shift end is exceeded (runs even when header hidden, e.g. New Transaction)
  useShiftExpiryLogout();

  const view = useMemo(() => getView(currentViewId), [currentViewId]);

  const showDashboardHeader = view?.chrome?.showDashboardHeader !== false;

  const subtitle = useMemo(() => {
    if (!user) return view?.metadata?.title;

    if (currentViewId === "dashboard") {
      const userDisplayName = getUserDisplayName(user);
      return `Welcome, ${userDisplayName}`;
    }

    return view?.metadata?.title;
  }, [currentViewId, user, view?.metadata?.title]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showDashboardHeader && <DashboardHeader subtitle={subtitle} />}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col">
          <NavigationContainer />
        </div>
      </main>
    </div>
  );
}

