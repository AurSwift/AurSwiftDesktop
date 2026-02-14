import { OperationsOverview } from "@/features/dashboard/components/operations-overview";

interface ManagerDashboardViewProps {
  onActionClick?: (featureId: string, actionId: string) => void;
}

const ManagerDashboardView = (_props: ManagerDashboardViewProps) => {
  return (
    <div className="max-w-7xl mx-auto">
      <OperationsOverview />
    </div>
  );
};

export default ManagerDashboardView;
