import { Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScheduleEmptyStateProps {
  searchTerm: string;
  statusFilter: string;
  onAddSchedule: () => void;
}

export function ScheduleEmptyState({
  searchTerm,
  statusFilter,
  onAddSchedule,
}: ScheduleEmptyStateProps) {
  const hasFilters = searchTerm || statusFilter !== "all";

  return (
    <div className="text-center py-12">
      <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">
        {hasFilters ? "No schedules found" : "No schedules yet"}
      </h3>
      <p className="text-muted-foreground mb-4">
        {hasFilters
          ? "Try adjusting your search or filters"
          : "Get started by creating your first staff schedule"}
      </p>
      {!hasFilters && (
        <Button onClick={onAddSchedule}>
          <Plus className="h-4 w-4 mr-2" />
          Create Schedule
        </Button>
      )}
    </div>
  );
}
