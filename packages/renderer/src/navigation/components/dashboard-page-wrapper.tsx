/**
 * Dashboard Page Wrapper
 *
 * Wrapper component that renders the appropriate dashboard page
 * based on user role. Uses the new navigation system.
 * Role-specific views are lazy-loaded so they can be code-split.
 * Cashiers are automatically redirected to the new transaction view.
 */

import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "@/shared/hooks";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { USERS_ROUTES } from "@/features/users/config/navigation";
import { SALES_ROUTES } from "@/features/sales/config/navigation";

import { useNavigation } from "../hooks/use-navigation";
import { useDashboardNavigation } from "../hooks/use-dashboard-navigation";
import { LoadingScreen, ViewLoadingFallback } from "@/components";

const AdminDashboardView = lazy(
  () => import("@/features/dashboard/views/admin-dashboard-view"),
);
const ManagerDashboardView = lazy(
  () => import("@/features/dashboard/views/manager-dashboard-view"),
);

/**
 * Dashboard Page Wrapper
 *
 * Renders role-specific dashboard pages using the navigation system.
 * All dashboard pages receive navigation functions via the navigation hook.
 */
export function DashboardPageWrapper() {
  const { user, isLoading } = useAuth();
  const { navigateTo } = useNavigation();

  // Dashboard navigation handler for feature actions
  // Must be called before any early returns (React Hooks rule)
  const handleActionClick = useDashboardNavigation();

  if (isLoading || !user) {
    return <LoadingScreen />;
  }

  const role = getUserRoleName(user);

  // Auto-navigate cashiers to new transaction view
  useEffect(() => {
    if (role === "cashier") {
      navigateTo(SALES_ROUTES.NEW_TRANSACTION);
    }
  }, [role, navigateTo]);

  switch (role) {
    case "admin":
      return (
        <Suspense fallback={<ViewLoadingFallback />}>
          <AdminDashboardView
            onFront={() => navigateTo(USERS_ROUTES.MANAGEMENT)}
            onActionClick={handleActionClick}
          />
        </Suspense>
      );

    case "manager":
      return (
        <Suspense fallback={<ViewLoadingFallback />}>
          <ManagerDashboardView onActionClick={handleActionClick} />
        </Suspense>
      );

    case "cashier":
      // Cashiers are auto-redirected via useEffect above
      return <ViewLoadingFallback />;

    default:
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-heading-medium mb-2">Unauthorized</h2>
            <p className="text-body text-muted-foreground">
              You don't have access to the dashboard.
            </p>
          </div>
        </div>
      );
  }
}
