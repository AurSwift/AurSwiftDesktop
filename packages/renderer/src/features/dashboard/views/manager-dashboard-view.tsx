import { DashboardGrid, FEATURE_REGISTRY } from "@/features/dashboard";
import { ManagerStatsCards } from "@/features/dashboard/components/stats-cards";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("manager-dashboard");

const ManagerDashboardView = ({
  onActionClick,
}: {
  onActionClick?: (featureId: string, actionId: string) => void;
}) => {
  // Handle feature action clicks
  const handleActionClick = (featureId: string, actionId: string) => {
    logger.debug(`handleActionClick: ${featureId} -> ${actionId}`);

    // Use navigation handler if provided (for actions that map to views)
    if (onActionClick) {
      onActionClick(featureId, actionId);
    }

    // Actions that map to views are handled by onActionClick (navigation handler)
    // Only handle actions that don't map to views if needed
  };

  // Filter features for manager dashboard (exclude admin-only features)
  const managerFeatures = FEATURE_REGISTRY.filter(
    (feature) =>
      feature.id !== "database-management" &&
      feature.id !== "advanced-reports" &&
      feature.id !== "system-settings" &&
      feature.id !== "quick-actions"
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="grid gap-4 sm:gap-6">
        {/* Manager Stats */}
        <ManagerStatsCards onActionClick={handleActionClick} />

        {/* Manager Features - Permission-based rendering */}
        <DashboardGrid
          features={managerFeatures}
          onActionClick={handleActionClick}
        />
      </div>
    </div>
  );
};

export default ManagerDashboardView;
