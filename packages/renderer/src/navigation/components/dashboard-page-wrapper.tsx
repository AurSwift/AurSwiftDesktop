/**
 * Dashboard Page Wrapper
 *
 * Wrapper component that renders the appropriate dashboard page
 * based on user role. Uses the new navigation system.
 */

import { useAuth } from "@/shared/hooks";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import {
  AdminDashboardView,
  CashierDashboardView,
  ManagerDashboardView,
} from "@/features/dashboard";
import { USERS_ROUTES } from "@/features/users/config/navigation";
import { SALES_ROUTES } from "@/features/sales/config/navigation";

import { useNavigation } from "../hooks/use-navigation";
import { useDashboardNavigation } from "../hooks/use-dashboard-navigation";
import { LoadingScreen } from "@/components/loading-screen";

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

  // Navigation helper
  const handleNavigate = (viewId: string) => {
    navigateTo(viewId);
  };

  switch (role) {
    case "admin":
      return (
        <AdminDashboardView
          onFront={() => navigateTo(USERS_ROUTES.MANAGEMENT)}
          onActionClick={handleActionClick}
        />
      );

    case "manager":
      return <ManagerDashboardView onActionClick={handleActionClick} />;

    case "cashier":
      return (
        <CashierDashboardView
          onNewTransaction={() => handleNavigate(SALES_ROUTES.NEW_TRANSACTION)}
        />
      );

    default:
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Unauthorized</h2>
            <p className="text-muted-foreground">
              You don't have access to the dashboard.
            </p>
          </div>
        </div>
      );
  }
}
