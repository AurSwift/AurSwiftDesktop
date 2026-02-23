import { useAuth } from "@/shared/hooks/use-auth";
import { FeatureMenuBar } from "./feature-menu-bar";

import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { getDashboardFeaturesForRole } from "../utils/dashboard-features";
import { useOptionalDashboardActions } from "../context/dashboard-actions-context";

export function DashboardHeader() {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;
  const { user } = useAuth();
  const dashboardActions = useOptionalDashboardActions();

  if (!user) return null;

  const role = getUserRoleName(user);
  const menuFeatures = getDashboardFeaturesForRole(role);
  const canRenderMenu = Boolean(dashboardActions);

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-background shadow-sm overflow-visible">
        <div className="flex items-center gap-4 px-4 h-12 overflow-visible">
          <div className="flex items-center gap-2 shrink-0 rounded-md px-1.5 py-1">
            <div className="relative w-7 h-7 rounded-md overflow-hidden ring-1 ring-primary/20 bg-black flex items-center justify-center">
              <img
                src={logoSrc}
                alt="AurSwift Logo"
                className="w-full h-full object-contain p-0.5"
                onError={(e) => {
                  // Fallback to icon if logo fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            </div>
            <span className="text-sm font-semibold text-foreground">
              AurSwift
            </span>
          </div>

          {canRenderMenu && (
            <div className="flex-1 min-w-0 overflow-visible">
              <FeatureMenuBar
                features={menuFeatures}
                onActionClick={dashboardActions!.handleActionClick}
              />
            </div>
          )}

        </div>
      </header>
    </>
  );
}
