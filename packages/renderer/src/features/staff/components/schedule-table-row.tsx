import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  roleName?: string;
  primaryRole?: {
    displayName: string;
  };
}

interface Schedule {
  id: string;
  staffId: string;
  businessId: string;
  startTime: string;
  endTime: string;
  status: "upcoming" | "active" | "completed" | "missed";
  assignedRegister?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleTableRowProps {
  schedule: Schedule;
  staff: Staff | undefined;
  selected: boolean;
  onToggleSelected: (id: string) => void;
  showRegister: boolean;
  showNotes: boolean;
  showDate: boolean;
  onView: (schedule: Schedule) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
  hasConflict?: boolean;
}

export function ScheduleTableRow({
  schedule,
  staff,
  selected,
  onToggleSelected,
  showRegister,
  showNotes,
  showDate,
  onView,
  onEdit,
  onDelete,
  hasConflict = false,
}: ScheduleTableRowProps) {
  const getStatusColor = (status: Schedule["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "upcoming":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "completed":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "missed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours === 0) return `${diffMinutes}m`;
    if (diffMinutes === 0) return `${diffHours}h`;
    return `${diffHours}h ${diffMinutes}m`;
  };

  const isOvernightShift = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return endDate.getDate() !== startDate.getDate();
  };

  const staffName = staff
    ? `${staff.firstName} ${staff.lastName}`
    : "Unknown Staff";

  const duration = calculateDuration(schedule.startTime, schedule.endTime);
  const isOvernight = isOvernightShift(schedule.startTime, schedule.endTime);

  return (
    <TableRow className="group hover:bg-muted/50">
      <TableCell className="w-10">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelected(schedule.id)}
          aria-label={`Select schedule for ${staffName}`}
        />
      </TableCell>

      {/* Staff name & role */}
      <TableCell>
        <div className="flex flex-col">
          <div className="font-medium text-sm sm:text-base flex items-center gap-2">
            {staffName}
            {hasConflict && (
              <span title="Overlapping shift">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              </span>
            )}
          </div>
          {staff?.primaryRole && (
            <p className="text-xs text-muted-foreground">
              {staff.primaryRole.displayName}
            </p>
          )}
        </div>
      </TableCell>

      {/* Date */}
      {showDate && (
        <TableCell className="hidden md:table-cell text-xs sm:text-sm">
          {format(new Date(schedule.startTime), "MMM dd, yyyy")}
        </TableCell>
      )}

      {/* Time */}
      <TableCell className="text-xs sm:text-sm">
        <div className="flex flex-col">
          <span>
            {format(new Date(schedule.startTime), "h:mm a")} -{" "}
            {format(new Date(schedule.endTime), "h:mm a")}
          </span>
          {isOvernight && (
            <span className="text-xs text-amber-600">+1 day</span>
          )}
        </div>
      </TableCell>

      {/* Duration */}
      <TableCell className="hidden sm:table-cell">
        <div className="flex items-center gap-1 text-xs sm:text-sm">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span>{duration}</span>
        </div>
      </TableCell>

      {/* Register */}
      {showRegister && (
        <TableCell className="hidden lg:table-cell text-xs sm:text-sm text-muted-foreground">
          {schedule.assignedRegister || "—"}
        </TableCell>
      )}

      {/* Notes preview */}
      {showNotes && (
        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground max-w-[200px]">
          {schedule.notes ? (
            <span className="truncate block">{schedule.notes}</span>
          ) : (
            "—"
          )}
        </TableCell>
      )}

      {/* Status */}
      <TableCell>
        <Badge
          variant="outline"
          className={`text-xs ${getStatusColor(schedule.status)}`}
        >
          {schedule.status}
        </Badge>
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onView(schedule)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(schedule)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Schedule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDelete(schedule)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Schedule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
