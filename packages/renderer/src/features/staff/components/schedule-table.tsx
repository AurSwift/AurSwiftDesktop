import { useEffect, useMemo, useState } from "react";
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
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/shared/utils/cn";
import {
  Download,
  Filter,
  SlidersHorizontal,
  View,
  Calendar as CalendarIcon,
} from "lucide-react";
import { ScheduleEmptyState } from "./schedule-empty-state";
import { ScheduleTableRow } from "./schedule-table-row";
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

interface ScheduleTableProps {
  schedules: Schedule[];
  allStaff: Staff[];
  isLoading: boolean;
  searchTerm: string;
  statusFilter: string;
  onResetFilters?: () => void;
  onViewSchedule: (schedule: Schedule) => void;
  onEditSchedule: (schedule: Schedule) => void;
  onDeleteSchedule: (schedule: Schedule) => void;
  onAddSchedule: () => void;
  onToggleCalendarView?: () => void;
  /** When set, pagination is controlled by parent (e.g. shown in mini bar). */
  pagination?: {
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

type SortKey = "staff" | "date" | "time" | "duration" | "status";
type SortDirection = "asc" | "desc";

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toCsvValue(value: unknown) {
  const str = String(value ?? "");
  const escaped = str.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function ScheduleTable({
  schedules,
  allStaff,
  isLoading,
  searchTerm,
  statusFilter,
  onResetFilters,
  onViewSchedule,
  onEditSchedule,
  onDeleteSchedule,
  onAddSchedule,
  onToggleCalendarView,
  pagination: controlledPagination,
}: ScheduleTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const [showRegister, setShowRegister] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [showDate, setShowDate] = useState(true);

  const [internalPageSize, setInternalPageSize] = useState(10);
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);

  const pageSize = controlledPagination?.pageSize ?? internalPageSize;
  const currentPage = controlledPagination?.currentPage ?? internalCurrentPage;
  const setPageSize =
    controlledPagination?.onPageSizeChange ?? setInternalPageSize;
  const setCurrentPage =
    controlledPagination?.onPageChange ?? setInternalCurrentPage;
  const paginationInMiniBar = controlledPagination != null;

  const hasActiveFilters = Boolean(searchTerm) || statusFilter !== "all";
  const activeFilterCount =
    (searchTerm ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  const sortedSchedules = useMemo(() => {
    const copy = [...schedules];

    const dir = sortDir === "asc" ? 1 : -1;
    const getValue = (s: Schedule) => {
      switch (sortKey) {
        case "staff": {
          const staff = allStaff.find((st) => st.id === s.staffId);
          return staff
            ? `${staff.firstName} ${staff.lastName}`.toLowerCase()
            : "";
        }
        case "date":
          return new Date(s.startTime).getTime();
        case "time": {
          const time = new Date(s.startTime);
          return time.getHours() * 60 + time.getMinutes();
        }
        case "duration": {
          const start = new Date(s.startTime).getTime();
          const end = new Date(s.endTime).getTime();
          return end - start;
        }
        case "status":
          return s.status;
        default:
          return new Date(s.startTime).getTime();
      }
    };

    copy.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

    return copy;
  }, [schedules, sortKey, sortDir, allStaff]);

  const totalItems = sortedSchedules.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages, setCurrentPage]);

  const pageSchedules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedSchedules.slice(start, end);
  }, [sortedSchedules, currentPage, pageSize]);

  // Keep selection only for existing schedules
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const existing = new Set(schedules.map((s) => s.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (existing.has(id)) next.add(id);
      });
      return next;
    });
  }, [schedules]);

  const visibleIds = pageSchedules.map((s) => s.id);
  const selectedVisibleCount = visibleIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const allVisibleSelected =
    pageSchedules.length > 0 && selectedVisibleCount === pageSchedules.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleExportCsv = () => {
    const rows = pageSchedules.map((s) => {
      const staff = allStaff.find((st) => st.id === s.staffId);
      const staffName = staff
        ? `${staff.firstName} ${staff.lastName}`
        : "Unknown";
      const duration = (() => {
        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        const diffMs = end.getTime() - start.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
      })();

      return {
        staff: staffName,
        date: format(new Date(s.startTime), "yyyy-MM-dd"),
        startTime: format(new Date(s.startTime), "HH:mm"),
        endTime: format(new Date(s.endTime), "HH:mm"),
        duration,
        register: s.assignedRegister ?? "",
        status: s.status,
        notes: s.notes ?? "",
      };
    });

    const headers = [
      "Staff",
      "Date",
      "Start Time",
      "End Time",
      "Duration",
      "Register",
      "Status",
      "Notes",
    ];
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) =>
          [
            toCsvValue(r.staff),
            toCsvValue(r.date),
            toCsvValue(r.startTime),
            toCsvValue(r.endTime),
            toCsvValue(r.duration),
            toCsvValue(r.register),
            toCsvValue(r.status),
            toCsvValue(r.notes),
          ].join(","),
        )
        .join("\n");

    downloadCsv(`schedules-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const setSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "date" ? "desc" : "asc");
  };

  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-xs">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Active filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                Search: {searchTerm ? `"${searchTerm}"` : "—"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Status: {statusFilter === "all" ? "All" : statusFilter}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!hasActiveFilters || !onResetFilters}
                onSelect={() => onResetFilters?.()}
              >
                Clear filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSort("staff")}>
                Staff {sortKey === "staff" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("date")}>
                Date {sortKey === "date" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("time")}>
                Time {sortKey === "time" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("duration")}>
                Duration {sortKey === "duration" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("status")}>
                Status {sortKey === "status" ? `(${sortDir})` : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedIds.size > 0 && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              {selectedIds.size} selected
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {onToggleCalendarView && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onToggleCalendarView}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleExportCsv}
            disabled={pageSchedules.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <View className="h-4 w-4 mr-2" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShowDate((v) => !v)}>
                {showDate ? "Hide" : "Show"} date
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowRegister((v) => !v)}>
                {showRegister ? "Hide" : "Show"} register
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowNotes((v) => !v)}>
                {showNotes ? "Hide" : "Show"} notes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="w-full flex-1 min-h-0 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center flex-1 min-h-[200px]">
            <div className="text-xs sm:text-sm text-muted-foreground">
              Loading schedules...
            </div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-4 sm:p-6 flex-1">
            <ScheduleEmptyState
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              onAddSchedule={onAddSchedule}
            />
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-background">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          allVisibleSelected
                            ? true
                            : someVisibleSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label="Select all visible rows"
                      />
                    </TableHead>
                    <TableHead
                      className={cn(
                        "text-xs uppercase tracking-wide text-muted-foreground",
                        "cursor-pointer select-none",
                      )}
                      onClick={() => setSort("staff")}
                    >
                      Staff Member
                    </TableHead>
                    {showDate && (
                      <TableHead
                        className={cn(
                          "hidden md:table-cell text-xs uppercase tracking-wide text-muted-foreground",
                          "cursor-pointer select-none",
                        )}
                        onClick={() => setSort("date")}
                      >
                        Date
                      </TableHead>
                    )}
                    <TableHead
                      className={cn(
                        "text-xs uppercase tracking-wide text-muted-foreground",
                        "cursor-pointer select-none",
                      )}
                      onClick={() => setSort("time")}
                    >
                      Time
                    </TableHead>
                    <TableHead
                      className={cn(
                        "hidden sm:table-cell text-xs uppercase tracking-wide text-muted-foreground",
                        "cursor-pointer select-none",
                      )}
                      onClick={() => setSort("duration")}
                    >
                      Duration
                    </TableHead>
                    {showRegister && (
                      <TableHead className="hidden lg:table-cell text-xs uppercase tracking-wide text-muted-foreground">
                        Register
                      </TableHead>
                    )}
                    {showNotes && (
                      <TableHead className="hidden xl:table-cell text-xs uppercase tracking-wide text-muted-foreground">
                        Notes
                      </TableHead>
                    )}
                    <TableHead
                      className={cn(
                        "text-xs uppercase tracking-wide text-muted-foreground",
                        "cursor-pointer select-none",
                      )}
                      onClick={() => setSort("status")}
                    >
                      Status
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageSchedules.map((schedule) => (
                    <ScheduleTableRow
                      key={schedule.id}
                      schedule={schedule}
                      staff={allStaff.find((s) => s.id === schedule.staffId)}
                      selected={selectedIds.has(schedule.id)}
                      onToggleSelected={toggleSelected}
                      showRegister={showRegister}
                      showNotes={showNotes}
                      showDate={showDate}
                      onView={onViewSchedule}
                      onEdit={onEditSchedule}
                      onDelete={onDeleteSchedule}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Footer: selection count only when pagination is in mini bar */}
            <div className="border-t bg-background shrink-0">
              <div className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground flex items-center justify-between gap-3">
                <span>
                  {selectedIds.size} of {totalItems} row(s) selected
                </span>
                {!paginationInMiniBar && (
                  <span className="hidden sm:inline">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>
              {!paginationInMiniBar && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  showPageSizeSelector={true}
                  showPageInfo={false}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
