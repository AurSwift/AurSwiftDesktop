import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  ShieldAlert,
  Pencil,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAuth } from "@/shared/hooks/use-auth";

interface StaffTimeReportsViewProps {
  onBack: () => void;
  tab?: "reports" | "compliance" | "payroll" | "live" | string;
}

type ShiftsReportRow = {
  shift: any;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role?: string;
    roleName?: string;
    primaryRole?: { name: string; displayName?: string };
  } | null;
  breaksSummary: {
    totalBreakSeconds: number;
    paidBreakSeconds: number;
    unpaidBreakSeconds: number;
    breakCount: number;
    hasAnyMealBreak: boolean;
    hasShortRequiredBreak: boolean;
    complianceIssue: boolean;
  };
};

type ShiftDetails = {
  shift: any;
  user: any;
  clockInEvent: any;
  clockOutEvent: any;
  breaks: any[];
};

function secondsToHm(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDateTime(value?: string | number | Date | null): string {
  if (!value) return "—";
  const d =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function toDateTimeLocalValue(value?: string | number | Date | null): string {
  if (!value) return "";
  const d =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function StaffTimeReportsView({
  onBack,
  tab,
}: StaffTimeReportsViewProps) {
  const { user } = useAuth();

  const defaultRange = useMemo(() => {
    const now = new Date();
    const from = startOfWeek(now, { weekStartsOn: 1 });
    const to = endOfWeek(now, { weekStartsOn: 1 });
    return { from, to } satisfies DateRange;
  }, []);

  const [activeTab, setActiveTab] = useState<string>(tab || "reports");
  const [range, setRange] = useState<DateRange>(defaultRange);

  // Filters (reports tab)
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ended">(
    "all"
  );
  const [complianceOnly, setComplianceOnly] = useState(false);
  const [staffQuery, setStaffQuery] = useState("");
  const [staffOptions, setStaffOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");

  // Data
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<ShiftsReportRow[]>([]);

  const [complianceRows, setComplianceRows] = useState<any[]>([]);
  const [payrollRows, setPayrollRows] = useState<any[]>([]);
  const [liveData, setLiveData] = useState<any | null>(null);

  // Details sheet
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [details, setDetails] = useState<ShiftDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Dialogs
  const [forceDialogOpen, setForceDialogOpen] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [forcePin, setForcePin] = useState("");
  const [isForcing, setIsForcing] = useState(false);

  const [editBreakOpen, setEditBreakOpen] = useState(false);
  const [editingBreak, setEditingBreak] = useState<any | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editPin, setEditPin] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editType, setEditType] = useState<"meal" | "rest" | "other">("rest");
  const [editIsPaid, setEditIsPaid] = useState(false);
  const [editNotes, setEditNotes] = useState<string>("");
  const [isSavingBreak, setIsSavingBreak] = useState(false);

  const businessId = user?.businessId || "";
  const managerId = user?.id || "";

  // Keep tab in sync with navigation param
  useEffect(() => {
    if (tab && tab !== activeTab) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Load staff options (for selector)
  useEffect(() => {
    const loadStaff = async () => {
      if (!businessId) return;
      try {
        const token = await window.authStore.get("token");
        if (!token) return;
        const resp = await window.authAPI.getUsersByBusiness(token, businessId);
        if (resp?.success && Array.isArray(resp.data)) {
          const opts = (resp.data as any[])
            .filter((u) => u && u.id)
            .map((u) => ({
              id: u.id as string,
              label: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.id,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
          setStaffOptions(opts);
        }
      } catch {
        // non-blocking
      }
    };
    loadStaff();
  }, [businessId]);

  const startDateISO = useMemo(() => {
    if (!range.from) return null;
    const start = new Date(range.from);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }, [range.from]);

  const endDateISO = useMemo(() => {
    if (!range.to) return null;
    const end = new Date(range.to);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  }, [range.to]);

  const summary = useMemo(() => {
    const totalShifts = rows.length;
    const totalBreakSeconds = rows.reduce(
      (sum, r) => sum + (r.breaksSummary?.totalBreakSeconds || 0),
      0
    );
    const violations = rows.filter((r) => r.breaksSummary?.complianceIssue).length;
    const totalHours = rows.reduce(
      (sum, r) => sum + (typeof r.shift?.total_hours === "number" ? r.shift.total_hours : 0),
      0
    );
    const overtimeHours = rows.reduce(
      (sum, r) => sum + (typeof r.shift?.overtime_hours === "number" ? r.shift.overtime_hours : 0),
      0
    );
    return { totalShifts, totalBreakSeconds, violations, totalHours, overtimeHours };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (selectedStaffId !== "all" && r.user?.id !== selectedStaffId) return false;
      if (q) {
        const name = `${r.user?.firstName || ""} ${r.user?.lastName || ""}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [rows, staffQuery, selectedStaffId]);

  const loadReports = async () => {
    if (!businessId || !startDateISO || !endDateISO) return;
    setIsLoading(true);
    try {
      const resp = await window.timeTrackingAPI.getShiftsReport({
        businessId,
        startDate: startDateISO,
        endDate: endDateISO,
        filters: {
          status: statusFilter === "all" ? undefined : statusFilter,
          complianceOnly,
          userIds: selectedStaffId === "all" ? undefined : [selectedStaffId],
        },
      });
      if (resp.success) {
        setRows((resp.data || []) as ShiftsReportRow[]);
      } else {
        toast.error("Failed to load shifts", {
          description: resp.message || "Please try again",
        });
      }
    } catch (error) {
      toast.error("Failed to load shifts", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCompliance = async () => {
    if (!businessId || !startDateISO || !endDateISO) return;
    setIsLoading(true);
    try {
      const resp = await window.timeTrackingAPI.getBreakComplianceReport({
        businessId,
        startDate: startDateISO,
        endDate: endDateISO,
      });
      if (resp.success) {
        setComplianceRows(resp.data || []);
      } else {
        toast.error("Failed to load compliance report", {
          description: resp.message || "Please try again",
        });
      }
    } catch (error) {
      toast.error("Failed to load compliance report", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPayroll = async () => {
    if (!businessId || !startDateISO || !endDateISO) return;
    setIsLoading(true);
    try {
      const resp = await window.timeTrackingAPI.getPayrollSummary({
        businessId,
        startDate: startDateISO,
        endDate: endDateISO,
      });
      if (resp.success) {
        setPayrollRows(resp.data || []);
      } else {
        toast.error("Failed to load payroll summary", {
          description: resp.message || "Please try again",
        });
      }
    } catch (error) {
      toast.error("Failed to load payroll summary", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLive = async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const resp = await window.timeTrackingAPI.getRealTimeDashboard(businessId);
      if (resp.success) {
        setLiveData(resp.data);
      } else {
        toast.error("Failed to load live dashboard", {
          description: resp.message || "Please try again",
        });
      }
    } catch (error) {
      toast.error("Failed to load live dashboard", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!businessId) return;
    if (activeTab === "reports") void loadReports();
    if (activeTab === "compliance") void loadCompliance();
    if (activeTab === "payroll") void loadPayroll();
    if (activeTab === "live") void loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, businessId, startDateISO, endDateISO, statusFilter, complianceOnly, selectedStaffId]);

  const openShiftDetails = async (shiftId: string) => {
    setIsDetailsOpen(true);
    setActiveShiftId(shiftId);
    setIsDetailsLoading(true);
    setDetails(null);
    try {
      const resp = await window.timeTrackingAPI.getShiftDetails(shiftId);
      if (resp.success && resp.data) {
        setDetails(resp.data as ShiftDetails);
      } else {
        toast.error("Failed to load shift details", {
          description: resp.message || "Please try again",
        });
      }
    } catch (error) {
      toast.error("Failed to load shift details", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const verifyOptionalPin = async (pin: string): Promise<boolean> => {
    const trimmed = pin.trim();
    if (!trimmed) return true; // optional
    try {
      const resp = await window.authAPI.verifyPin(managerId, trimmed);
      if (resp?.success) return true;
      toast.error("PIN verification failed", {
        description: resp?.message || "Invalid PIN",
      });
      return false;
    } catch (error) {
      toast.error("PIN verification failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  };

  const doForceClockOut = async () => {
    if (!details?.shift || !details.user) return;
    if (!forceReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    const ok = await verifyOptionalPin(forcePin);
    if (!ok) return;

    setIsForcing(true);
    try {
      const resp = await window.timeTrackingAPI.forceClockOut({
        userId: details.shift.user_id,
        managerId,
        reason: forceReason.trim(),
      });
      if (resp.success) {
        toast.success("Forced clock-out completed");
        setForceDialogOpen(false);
        setForceReason("");
        setForcePin("");
        if (activeShiftId) await openShiftDetails(activeShiftId);
        await loadReports();
      } else {
        toast.error("Failed to force clock-out", {
          description: resp.message || "Please try again",
        });
      }
    } catch (error) {
      toast.error("Failed to force clock-out", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsForcing(false);
    }
  };

  const openEditBreak = (b: any) => {
    setEditingBreak(b);
    setEditType((b.type || "rest") as any);
    setEditIsPaid(Boolean(b.is_paid));
    setEditNotes(String(b.notes || ""));
    setEditStartTime(toDateTimeLocalValue(b.start_time));
    setEditEndTime(toDateTimeLocalValue(b.end_time));
    setEditReason("");
    setEditPin("");
    setEditBreakOpen(true);
  };

  const saveBreak = async () => {
    if (!editingBreak) return;
    if (!editReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    const ok = await verifyOptionalPin(editPin);
    if (!ok) return;

    setIsSavingBreak(true);
    try {
      const patch: any = {
        type: editType,
        isPaid: editIsPaid,
        notes: editNotes,
      };
      if (editStartTime) patch.startTime = new Date(editStartTime).toISOString();
      if (editEndTime) patch.endTime = new Date(editEndTime).toISOString();

      const resp = await window.timeTrackingAPI.updateBreak({
        breakId: editingBreak.id,
        managerId,
        reason: editReason.trim(),
        patch,
      });

      if (resp.success) {
        toast.success("Break updated");
        setEditBreakOpen(false);
        setEditingBreak(null);
        if (activeShiftId) await openShiftDetails(activeShiftId);
        await loadReports();
      } else {
        toast.error("Failed to update break", {
          description: resp.message || "Please try again",
        });
      }
    } catch (error) {
      toast.error("Failed to update break", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSavingBreak(false);
    }
  };

  const endActiveBreakNow = async (b: any) => {
    setEditingBreak(b);
    setEditType((b.type || "rest") as any);
    setEditIsPaid(Boolean(b.is_paid));
    setEditNotes(String(b.notes || ""));
    setEditStartTime(toDateTimeLocalValue(b.start_time));
    setEditEndTime(toDateTimeLocalValue(new Date()));
    setEditReason("");
    setEditPin("");
    setEditBreakOpen(true);
  };

  return (
    <div className="w-full min-h-screen p-2 sm:p-3 md:p-4 lg:p-6 pb-6">
      <div className="max-w-7xl mx-auto animate-slide-down">
        <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6 lg:mb-8">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="p-1.5 sm:p-2 shrink-0"
            aria-label="Go back to previous page"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-slate-900 mb-0.5 sm:mb-1 lg:mb-2 break-word">
              Time & Break Reports
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 line-clamp-2">
              Review staff shifts and breaks, spot compliance issues, and apply
              manager overrides with audit trail.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="reports">Shifts</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="payroll">Payroll</TabsTrigger>
              <TabsTrigger value="live">Live</TabsTrigger>
            </TabsList>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {range.from && range.to ? (
                    <span>
                      {format(range.from, "MMM d, yyyy")} – {format(range.to, "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span>Select date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={(next) => next && setRange(next)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <TabsContent value="reports" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Total shifts
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {summary.totalShifts}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Total hours
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {summary.totalHours.toFixed(1)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Overtime hours
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {summary.overtimeHours.toFixed(1)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Compliance flags
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {summary.violations}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label>Staff</Label>
                  <Select
                    value={selectedStaffId}
                    onValueChange={(v) => setSelectedStaffId(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All staff</SelectItem>
                      {staffOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Search</Label>
                  <Input
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    placeholder="Search staff name…"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) =>
                      setStatusFilter(v as typeof statusFilter)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="block">Compliance only</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={complianceOnly}
                      onCheckedChange={setComplianceOnly}
                      aria-label="Show only compliance issues"
                    />
                    <span className="text-sm text-muted-foreground">
                      Show flagged shifts
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base sm:text-lg">
                  Shifts
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadReports()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No shifts found for this range.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Clock in</TableHead>
                        <TableHead>Clock out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Breaks</TableHead>
                        <TableHead>Compliance</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => (
                        <TableRow key={r.shift.id}>
                          <TableCell className="min-w-[220px]">
                            <div className="font-medium">
                              {r.user
                                ? `${r.user.firstName} ${r.user.lastName}`
                                : "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.user?.primaryRole?.displayName ||
                                r.user?.roleName ||
                                r.user?.role ||
                                "—"}
                            </div>
                          </TableCell>
                          <TableCell>{fmtDateTime(r.shift?.clockInEvent?.timestamp)}</TableCell>
                          <TableCell>
                            {r.shift?.clockOutEvent?.timestamp ? (
                              <span>{fmtDateTime(r.shift.clockOutEvent.timestamp)}</span>
                            ) : (
                              <Badge variant="secondary">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {typeof r.shift?.total_hours === "number"
                              ? r.shift.total_hours.toFixed(2)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {secondsToHm(r.breaksSummary.totalBreakSeconds)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.breaksSummary.breakCount} break(s)
                            </div>
                          </TableCell>
                          <TableCell>
                            {r.breaksSummary.complianceIssue ? (
                              <Badge variant="destructive" className="gap-1">
                                <ShieldAlert className="h-3 w-3" />
                                Flagged
                              </Badge>
                            ) : (
                              <Badge variant="outline">OK</Badge>
                            )}
                            {r.breaksSummary.complianceIssue && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {!r.breaksSummary.hasAnyMealBreak
                                  ? "Possible missing meal break"
                                  : r.breaksSummary.hasShortRequiredBreak
                                    ? "Short required break"
                                    : "Review"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void openShiftDetails(r.shift.id)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base sm:text-lg">
                  Break compliance report
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadCompliance()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : complianceRows.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No compliance issues found for this range.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Total shifts</TableHead>
                        <TableHead>Shifts w/ breaks</TableHead>
                        <TableHead>Total breaks</TableHead>
                        <TableHead>Avg break</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {complianceRows.map((r: any) => (
                        <TableRow key={r.userId}>
                          <TableCell className="font-medium">
                            {r.firstName} {r.lastName}
                          </TableCell>
                          <TableCell>{r.totalShifts}</TableCell>
                          <TableCell>{r.shiftsWithBreaks}</TableCell>
                          <TableCell>{r.totalBreaks}</TableCell>
                          <TableCell>{r.averageBreakDuration}m</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payroll" className="space-y-4">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base sm:text-lg">
                  Payroll summary (hours)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadPayroll()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : payrollRows.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No payroll data found for this range.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Shifts</TableHead>
                        <TableHead>Regular hours</TableHead>
                        <TableHead>Overtime hours</TableHead>
                        <TableHead>Total hours</TableHead>
                        <TableHead>Break minutes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRows.map((r: any) => (
                        <TableRow key={r.userId}>
                          <TableCell className="font-medium">
                            {r.firstName} {r.lastName}
                          </TableCell>
                          <TableCell>{r.role}</TableCell>
                          <TableCell>{r.totalShifts}</TableCell>
                          <TableCell>{Number(r.regularHours || 0).toFixed(2)}</TableCell>
                          <TableCell>{Number(r.overtimeHours || 0).toFixed(2)}</TableCell>
                          <TableCell>{Number(r.totalHours || 0).toFixed(2)}</TableCell>
                          <TableCell>{Math.round(Number(r.totalBreakMinutes || 0))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live" className="space-y-4">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base sm:text-lg">
                  Live operations
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadLive()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : !liveData ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No live data available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          Currently working
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-bold">
                        {liveData.currentlyWorking}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          Active breaks
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-bold">
                        {liveData.activeBreaks}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          Completed shifts (today)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-bold">
                        {liveData.completedShifts}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          Hours (today)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-bold">
                        {Number(liveData.todayHours || 0).toFixed(1)}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Shift Details Sheet */}
      <Sheet
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) {
            setActiveShiftId(null);
            setDetails(null);
          }
        }}
      >
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Shift details</SheetTitle>
            <SheetDescription>
              Review breaks within this shift and apply manager overrides.
            </SheetDescription>
          </SheetHeader>

          {isDetailsLoading ? (
            <div className="p-4 text-muted-foreground flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading…
            </div>
          ) : !details ? (
            <div className="p-4 text-muted-foreground">No shift selected.</div>
          ) : (
            <div className="p-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Staff
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="font-semibold">
                    {details.user
                      ? `${details.user.firstName} ${details.user.lastName}`
                      : "Unknown"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {details.user?.primaryRole?.displayName ||
                      details.user?.roleName ||
                      details.user?.role ||
                      "—"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Shift
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clock in</span>
                    <span>{fmtDateTime(details.clockInEvent?.timestamp)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clock out</span>
                    <span>
                      {details.clockOutEvent?.timestamp
                        ? fmtDateTime(details.clockOutEvent.timestamp)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span>
                      {details.shift?.status === "active" ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Ended</Badge>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {details.shift?.status === "active" && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Manager actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="destructive"
                      className="w-full justify-start gap-2"
                      onClick={() => setForceDialogOpen(true)}
                    >
                      <LogOut className="h-4 w-4" />
                      Force clock-out
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground">
                    Breaks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {details.breaks?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead>Dur.</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {details.breaks.map((b: any) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-medium">
                              {b.type}
                              {b.is_paid ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (paid)
                                </span>
                              ) : (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (unpaid)
                                </span>
                              )}
                              {b.is_required && (
                                <span className="ml-2">
                                  <Badge variant="outline" className="text-[10px]">
                                    Required
                                  </Badge>
                                </span>
                              )}
                              {b.is_short && (
                                <span className="ml-2">
                                  <Badge variant="destructive" className="text-[10px]">
                                    Short
                                  </Badge>
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{fmtDateTime(b.start_time)}</TableCell>
                            <TableCell>{fmtDateTime(b.end_time)}</TableCell>
                            <TableCell>
                              {typeof b.duration_seconds === "number"
                                ? secondsToHm(b.duration_seconds)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {b.status === "active" ? (
                                <Badge variant="secondary">Active</Badge>
                              ) : (
                                <Badge variant="outline">Completed</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {b.status === "active" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void endActiveBreakNow(b)}
                                  >
                                    End now
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditBreak(b)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-sm text-muted-foreground py-6 text-center">
                      No breaks recorded for this shift.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Force clock-out dialog */}
      <Dialog open={forceDialogOpen} onOpenChange={setForceDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Force clock-out</DialogTitle>
            <DialogDescription>
              This will immediately clock the staff member out. A reason is
              required and will be stored in the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea
                value={forceReason}
                onChange={(e) => setForceReason(e.target.value)}
                placeholder="e.g. Staff left without clocking out…"
              />
            </div>
            <div className="space-y-2">
              <Label>Manager PIN (optional)</Label>
              <Input
                value={forcePin}
                onChange={(e) => setForcePin(e.target.value)}
                placeholder="Enter PIN to confirm"
                type="password"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setForceDialogOpen(false)}
              disabled={isForcing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void doForceClockOut()}
              disabled={isForcing}
            >
              {isForcing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Working…
                </>
              ) : (
                "Force clock-out"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Break edit dialog */}
      <Dialog open={editBreakOpen} onOpenChange={setEditBreakOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit break</DialogTitle>
            <DialogDescription>
              Adjust break details. A reason is required and will be stored in
              the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rest">Rest</SelectItem>
                  <SelectItem value="meal">Meal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paid</Label>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={editIsPaid} onCheckedChange={setEditIsPaid} />
                <span className="text-sm text-muted-foreground">
                  {editIsPaid ? "Paid" : "Unpaid"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Start time</Label>
              <Input
                type="datetime-local"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End time</Label>
              <Input
                type="datetime-local"
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Reason (required)</Label>
              <Textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this edit is needed…"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Manager PIN (optional)</Label>
              <Input
                value={editPin}
                onChange={(e) => setEditPin(e.target.value)}
                placeholder="Enter PIN to confirm"
                type="password"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditBreakOpen(false)}
              disabled={isSavingBreak}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveBreak()} disabled={isSavingBreak}>
              {isSavingBreak ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

