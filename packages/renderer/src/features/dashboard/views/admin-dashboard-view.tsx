import { OperationsOverview } from "@/features/dashboard/components/operations-overview";

interface AdminDashboardViewProps {
  onFront: () => void;
  onActionClick?: (featureId: string, actionId: string) => void;
  onNewTransaction?: () => void;
  onNavigateToRoles?: () => void;
  onNavigateToUserRoles?: () => void;
  onManageUsers?: () => void;
  onManageCashiers?: () => void;
  onManageProducts?: () => void;
  onStaffSchedules?: () => void;
  onGeneralSettings?: () => void;
}

const AdminDashboardView = ({
  onFront: _onFront,
  onNewTransaction: _onNewTransaction,
  onNavigateToRoles: _onNavigateToRoles,
  onNavigateToUserRoles: _onNavigateToUserRoles,
  onManageUsers: _onManageUsers,
  onManageProducts: _onManageProducts,
  onStaffSchedules: _onStaffSchedules,
  onGeneralSettings: _onGeneralSettings,
}: AdminDashboardViewProps) => {
  return (
    <div className="container mx-auto max-w-[1600px]">
      <OperationsOverview />
    </div>
  );
};

export default AdminDashboardView;
