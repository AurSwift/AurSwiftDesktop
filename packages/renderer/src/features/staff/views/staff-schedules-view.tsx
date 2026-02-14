import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  getUserRoleName,
  getUserRoleDisplayName,
} from "@/shared/utils/rbac-helpers";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Table as TableIcon,
  Calendar as CalendarIcon,
  Edit2,
  Trash2,
  StickyNote,
  Clock,
  CreditCard,
  User,
} from "lucide-react";
import { MiniBar } from "@/components/mini-bar";
import { useAuth } from "@/shared/hooks/use-auth";
import { useUserPermissions } from "@/features/dashboard/hooks/use-user-permissions";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/shared/utils/cn";
import {
  AdaptiveKeyboard,
  AdaptiveTextarea,
} from "@/features/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";
import type {
  ScheduleFormData,
  ScheduleUpdateData,
} from "../schemas/schedule-schema";
// Optimized: Import individual functions to reduce bundle size (date-fns v4 supports tree-shaking with named imports)
import {
  format,
  addWeeks,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  startOfDay,
} from "date-fns";
import { TimePicker } from "@/components/time-picker";
import { useScheduleForm } from "../hooks/use-schedule-form";
import { ScheduleFilters, ScheduleTable } from "../components";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("staff-schedules-view");

// Using database interfaces with RBAC support
interface Staff {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  businessName: string;
  businessId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // RBAC fields (from backend)
  primaryRoleId?: string;
  roleName?: string; // From backend join query (lowercase role name)
  primaryRole?: {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    permissions?: unknown[];
  };
}

interface Schedule {
  id: string;
  staffId: string;
  businessId: string;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  status: "upcoming" | "active" | "completed" | "missed";
  assignedRegister?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface StaffSchedulesViewProps {
  onBack: () => void;
}

const StaffSchedulesView: React.FC<StaffSchedulesViewProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } =
    useUserPermissions();

  // RBAC: Determine which roles the current user can schedule
  // Admin: can schedule both cashiers and managers (has SCHEDULES_MANAGE_ALL)
  // Manager: can only schedule cashiers (has SCHEDULES_MANAGE_CASHIERS)
  const canScheduleAll = hasPermission(PERMISSIONS.SCHEDULES_MANAGE_ALL);
  const canScheduleCashiers = hasPermission(
    PERMISSIONS.SCHEDULES_MANAGE_CASHIERS,
  );

  // State for cashiers - will be loaded from database (filtered by permissions for form dropdown)
  const [cashiers, setCashiers] = useState<Staff[]>([]);

  // State for all staff members - for displaying schedule cards (not filtered by permissions)
  const [allStaff, setAllStaff] = useState<Staff[]>([]);

  // State for schedules - will be loaded from database
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Loading states
  const [isLoadingCashiers, setIsLoadingCashiers] = useState(true);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(
    null,
  );

  // Get business ID from current authenticated user
  const businessId = user?.businessId || "";

  // Load cashiers/staff users
  useEffect(() => {
    const loadCashiers = async () => {
      if (!businessId || isLoadingPermissions) {
        setIsLoadingCashiers(false);
        return;
      }

      try {
        setIsLoadingCashiers(true);
        const response = await window.scheduleAPI.getCashierUsers(businessId);
        if (response.success && response.data) {
          const allUsers = response.data as Staff[];
          logger.info(
            `[loadCashiers] Received ${allUsers.length} users from API`,
          );

          // Log all users for debugging
          allUsers.forEach((user) => {
            const roleName = getUserRoleName(user);
            logger.info(
              `[loadCashiers] User: ${user.firstName} ${user.lastName} (${user.id}), roleName: ${user.roleName}, primaryRoleId: ${user.primaryRoleId}, resolved role: ${roleName}`,
            );
          });

          // RBAC-based filtering: Filter staff members based on user's permissions
          // - Admin (SCHEDULES_MANAGE_ALL): can schedule cashiers and managers
          // - Manager (SCHEDULES_MANAGE_CASHIERS): can only schedule cashiers
          const filteredUsers = allUsers.filter((staffUser) => {
            const staffRoleName = getUserRoleName(staffUser);

            // Skip admin users (they shouldn't have schedules)
            if (staffRoleName === "admin") {
              return false;
            }

            // If user can schedule all, include both cashiers and managers
            if (canScheduleAll) {
              return staffRoleName === "cashier" || staffRoleName === "manager";
            }

            // If user can only schedule cashiers, filter to cashiers only
            if (canScheduleCashiers) {
              return staffRoleName === "cashier";
            }

            // No permission - don't show any users
            logger.warn(
              `[loadCashiers] User ${user?.id} has no schedule management permissions`,
            );
            return false;
          });

          logger.info(
            `[loadCashiers] Filtered to ${filteredUsers.length} staff members out of ${allUsers.length} total users (canScheduleAll: ${canScheduleAll}, canScheduleCashiers: ${canScheduleCashiers})`,
          );

          if (filteredUsers.length === 0 && allUsers.length > 0) {
            logger.warn(
              `[loadCashiers] No staff members available for scheduling. Check permissions or ensure users have roles assigned.`,
            );
          }

          setCashiers(filteredUsers);

          // Store ALL non-admin staff for display purposes (to show names in schedule cards)
          // This is separate from the filtered list - managers need to see schedule names
          // even if they can't edit those schedules (e.g., other managers' schedules)
          const allNonAdminStaff = allUsers.filter((staffUser) => {
            const staffRoleName = getUserRoleName(staffUser);
            logger.info(
              `[loadCashiers] allStaff filter: ${staffUser.firstName} ${staffUser.lastName} (${staffUser.id}), roleName: ${staffRoleName}`,
            );
            return staffRoleName !== "admin";
          });
          logger.info(
            `[loadCashiers] Set allStaff to ${allNonAdminStaff.length} users (all non-admin staff for display)`,
          );
          setAllStaff(allNonAdminStaff);
        } else {
          logger.error("Failed to load staff members:", response.message);
          toast.error("Failed to load staff members", {
            description: response.message || "Please try again",
          });
        }
      } catch (error) {
        logger.error("Error loading cashiers:", error);
        toast.error("Error loading staff members", {
          description: "Please refresh the page and try again",
        });
      } finally {
        setIsLoadingCashiers(false);
      }
    };

    loadCashiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, isLoadingPermissions, canScheduleAll, canScheduleCashiers]);

  // Load schedules
  useEffect(() => {
    const loadSchedules = async () => {
      if (!businessId) {
        setIsLoadingSchedules(false);
        return;
      }

      try {
        setIsLoadingSchedules(true);
        const response = await window.scheduleAPI.getByBusiness(businessId);
        if (response.success && response.data) {
          setSchedules(response.data as Schedule[]);
        } else {
          toast.error("Failed to load schedules", {
            description: response.message || "Please try again",
          });
        }
      } catch (error) {
        logger.error("Error loading schedules:", error);
        toast.error("Error loading schedules", {
          description: "Please refresh the page and try again",
        });
      } finally {
        setIsLoadingSchedules(false);
      }
    };

    loadSchedules();
  }, [businessId]);
  const safeFocusRef = useRef<HTMLDivElement>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calendarViewMode, setCalendarViewMode] = useState<"week" | "day">(
    "week",
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "upcoming" | "active" | "completed" | "missed"
  >("all");

  // Calendar view functions - memoized for performance
  const weekStart = useMemo(
    () => startOfWeek(currentWeek, { weekStartsOn: 1 }),
    [currentWeek],
  );
  const weekEnd = useMemo(
    () => endOfWeek(currentWeek, { weekStartsOn: 1 }),
    [currentWeek],
  );
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd],
  );

  // Memoized event handlers
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeek(addWeeks(currentWeek, -1));
  }, [currentWeek]);

  const goToNextWeek = useCallback(() => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  }, [currentWeek]);

  const goToToday = useCallback(() => {
    setCurrentWeek(new Date());
    setSelectedDate(new Date());
  }, []);

  const resetForm = useCallback(() => {
    setSelectedDate(new Date());
    setEditingSchedule(null);
  }, []);

  const setupDrawerForm = useCallback(
    (schedule?: Schedule, date?: Date) => {
      if (schedule) {
        setEditingSchedule(schedule);
        // Parse the date from the schedule's startTime (ISO format)
        const scheduleDate = new Date(schedule.startTime);
        setSelectedDate(scheduleDate);
      } else {
        resetForm();
        if (date) {
          setSelectedDate(date);
        }
      }
    },
    [resetForm],
  );

  const openDrawer = useCallback(
    (schedule?: Schedule, date?: Date) => {
      setupDrawerForm(schedule, date);
      setIsDrawerOpen(true);
    },
    [setupDrawerForm],
  );

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    resetForm();
  }, [resetForm]);

  // Configuration constants for shift validation
  const SHIFT_CONFIG = {
    MIN_DURATION_MINUTES: 60, // 1 hour minimum as recommended in shiftallCases.md
    MAX_DURATION_MINUTES: 16 * 60, // 16 hours maximum (configurable between 12-16)
    ALLOW_BACKDATED_SHIFTS: false, // Only managers should be able to create past shifts
  };

  // Helper function to calculate shift duration handling overnight shifts
  const calculateShiftDuration = (startTime: string, endTime: string) => {
    // Validate time format first
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return -1; // Invalid time format
    }

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    // Check for invalid hour/minute values
    if (
      startHour < 0 ||
      startHour > 23 ||
      startMinute < 0 ||
      startMinute > 59 ||
      endHour < 0 ||
      endHour > 23 ||
      endMinute < 0 ||
      endMinute > 59
    ) {
      return -1; // Invalid time values
    }

    const startTotalMinutes = startHour * 60 + startMinute;
    let endTotalMinutes = endHour * 60 + endMinute;

    // Case 1: Start time = End time (Invalid)
    if (startTotalMinutes === endTotalMinutes) {
      return 0; // No duration
    }

    // If end time is earlier in the day than start time, assume it's next day (overnight shift)
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60; // Add 24 hours
    }

    return endTotalMinutes - startTotalMinutes;
  };

  // Helper function to check if shift is overnight
  const isOvernightShift = (startTime: string, endTime: string) => {
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    return endTotalMinutes < startTotalMinutes;
  };

  /**
   * Helper function to check for shift overlaps
   *
   * Overlap detection rules:
   * - Two shifts overlap if they have any time in common
   * - Exact boundaries are NOT considered overlaps (e.g., shift ending at 5pm and another starting at 5pm are allowed)
   * - Uses strict comparison (< and >) so shifts can be back-to-back
   * - Handles overnight shifts correctly by extending end time to next day
   *
   * @param newStartTime - Start time in HH:mm format
   * @param newEndTime - End time in HH:mm format
   * @param selectedDate - Date for the new shift
   * @param staffId - Staff member ID to check overlaps for
   * @param excludeScheduleId - Optional schedule ID to exclude from overlap check (for editing)
   * @returns true if there's an overlap, false otherwise
   */
  const checkShiftOverlap = (
    newStartTime: string,
    newEndTime: string,
    selectedDate: Date,
    staffId: string,
    excludeScheduleId?: string,
  ) => {
    // Create proper Date objects for comparison using startOfDay for consistency
    const baseDate = startOfDay(selectedDate);
    const newStart = new Date(baseDate);
    const [startHour, startMinute] = newStartTime.split(":").map(Number);
    newStart.setHours(startHour, startMinute, 0, 0);

    const newEnd = new Date(baseDate);
    const [endHour, endMinute] = newEndTime.split(":").map(Number);
    newEnd.setHours(endHour, endMinute, 0, 0);

    // Handle overnight shifts (end time is next day)
    if (isOvernightShift(newStartTime, newEndTime)) {
      newEnd.setDate(newEnd.getDate() + 1);
    }

    // Check against existing schedules for this staff member
    return schedules.some((schedule) => {
      // Skip the schedule being edited
      if (excludeScheduleId && schedule.id === excludeScheduleId) {
        return false;
      }

      // Only check schedules for the same staff member
      if (schedule.staffId !== staffId) {
        return false;
      }

      // Parse existing schedule times (already in ISO format from database)
      const existingStart = new Date(schedule.startTime);
      const existingEnd = new Date(schedule.endTime);

      // Overlap detection: shifts overlap if they have any time in common
      // Using strict comparison (< and >) means exact boundaries are NOT overlaps
      // Example: Shift 1 ends at 5:00 PM, Shift 2 starts at 5:00 PM → No overlap (allowed)
      // Example: Shift 1 ends at 5:00 PM, Shift 2 starts at 4:59 PM → Overlap (not allowed)
      const hasOverlap = newStart < existingEnd && newEnd > existingStart;

      return hasOverlap;
    });
  };

  // Schedule form component - using React Hook Form
  const ScheduleFormContent: React.FC<{
    editingSchedule: Schedule | null;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    isDatePickerOpen: boolean;
    setIsDatePickerOpen: (open: boolean) => void;
    cashiers: Staff[];
    isLoadingCashiers: boolean;
    businessId: string;
    checkShiftOverlap: (
      newStartTime: string,
      newEndTime: string,
      selectedDate: Date,
      staffId: string,
      excludeScheduleId?: string,
    ) => boolean;
    canScheduleAll: boolean;
    canScheduleCashiers: boolean;
    onClose: () => void;
    isOpen?: boolean;
    showButtons?: boolean;
    onSuccess: (schedule: Schedule) => void;
  }> = ({
    editingSchedule,
    selectedDate,
    setSelectedDate,
    isDatePickerOpen,
    setIsDatePickerOpen,
    cashiers,
    isLoadingCashiers,
    businessId,
    checkShiftOverlap,
    canScheduleAll,
    canScheduleCashiers,
    onClose,
    isOpen = true,
    showButtons = true,
    onSuccess,
  }) => {
    const {
      form,
      handleSubmit: formHandleSubmit,
      isSubmitting,
      isEditMode,
    } = useScheduleForm({
      schedule: editingSchedule,
      selectedDate,
      businessId,
      onSubmit: async (data) => {
        // RBAC: Validate permission to schedule the selected staff member
        const selectedStaffMember = cashiers.find((c) => c.id === data.staffId);
        if (!selectedStaffMember) {
          throw new Error("Selected staff member not found");
        }

        const staffRoleName = getUserRoleName(selectedStaffMember);

        // Check if user has permission to schedule this staff member
        if (staffRoleName === "manager" && !canScheduleAll) {
          throw new Error(
            "You do not have permission to schedule managers. Only cashiers can be scheduled.",
          );
        }

        if (
          staffRoleName === "cashier" &&
          !canScheduleCashiers &&
          !canScheduleAll
        ) {
          throw new Error("You do not have permission to create schedules.");
        }

        // Check for overlapping shifts (business logic)
        if (
          checkShiftOverlap(
            data.startTime,
            data.endTime,
            new Date(data.date),
            data.staffId,
            editingSchedule?.id,
          )
        ) {
          const staffMember = cashiers.find((c) => c.id === data.staffId);
          const staffName = staffMember
            ? `${staffMember.firstName} ${staffMember.lastName}`
            : "This staff member";
          throw new Error(
            `${staffName} already has an overlapping shift scheduled.`,
          );
        }

        // Create proper Date objects in local timezone, then convert to ISO strings for UTC storage
        const [startHour, startMinute] = data.startTime.split(":").map(Number);
        const startDateTime = new Date(data.date);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        const [endHour, endMinute] = data.endTime.split(":").map(Number);
        const endDateTime = new Date(data.date);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        // Handle overnight shifts (crossing midnight)
        if (isOvernightShift(data.startTime, data.endTime)) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        // Convert to ISO strings for UTC storage in database
        const startDateTimeISO = startDateTime.toISOString();
        const endDateTimeISO = endDateTime.toISOString();

        if (isEditMode && editingSchedule) {
          const response = await window.scheduleAPI.update(editingSchedule.id, {
            staffId: data.staffId,
            startTime: startDateTimeISO,
            endTime: endDateTimeISO,
            assignedRegister: data.assignedRegister || undefined,
            notes: data.notes || undefined,
          });

          if (response.success && response.data) {
            keyboard.handleCloseKeyboard();
            onSuccess(response.data as Schedule);
          } else {
            throw new Error(response.message || "Failed to update schedule");
          }
        } else {
          const response = await window.scheduleAPI.create({
            staffId: data.staffId,
            businessId: businessId,
            startTime: startDateTimeISO,
            endTime: endDateTimeISO,
            assignedRegister: data.assignedRegister || undefined,
            notes: data.notes || undefined,
          });

          if (response.success && response.data) {
            keyboard.handleCloseKeyboard();
            onSuccess(response.data as Schedule);
          } else {
            throw new Error(response.message || "Failed to create schedule");
          }
        }
      },
      onSuccess: onClose,
    });

    const handleSubmit = formHandleSubmit;

    // Keyboard integration
    const keyboard = useKeyboardWithRHF<ScheduleFormData | ScheduleUpdateData>({
      setValue: form.setValue,
      watch: form.watch,
      fieldConfigs: {
        notes: { keyboardMode: "qwerty" },
      },
    });

    // Close keyboard when drawer closes
    useEffect(() => {
      if (!isOpen) {
        keyboard.handleCloseKeyboard();
      }
    }, [isOpen, keyboard]);

    const startTime = form.watch("startTime");
    const endTime = form.watch("endTime");

    return (
      <Form {...form}>
        <form
          onSubmit={handleSubmit}
          className={showButtons ? "space-y-4" : "flex flex-col h-full"}
        >
          {/* Fixed Buttons Section - Only in drawer mode */}
          {!showButtons && (
            <div className="border-b bg-background shrink-0">
              <div className="flex space-x-2 px-6 pt-4 pb-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : isEditMode
                      ? "Update Schedule"
                      : "Create Schedule"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    keyboard.handleCloseKeyboard();
                    onClose();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Scrollable Form Content */}
          <div
            className={
              showButtons ? "" : "p-6 overflow-y-auto flex-1 min-h-0 space-y-4"
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="staffId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Member</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                      disabled={isSubmitting || isLoadingCashiers}
                      onOpenChange={() => keyboard.handleCloseKeyboard()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingCashiers
                                ? "Loading staff..."
                                : "Select staff member"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingCashiers ? (
                          <SelectItem value="loading" disabled>
                            Loading staff members...
                          </SelectItem>
                        ) : cashiers.length === 0 ? (
                          <SelectItem value="no-staff" disabled>
                            No staff members found. Create staff users first.
                          </SelectItem>
                        ) : (
                          cashiers.map((cashier) => (
                            <SelectItem key={cashier.id} value={cashier.id}>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <div>
                                  <div className="font-medium">
                                    {cashier.firstName} {cashier.lastName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {cashier.email} •{" "}
                                    {getUserRoleDisplayName(cashier)}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Date</FormLabel>
                    <Popover
                      open={isDatePickerOpen}
                      onOpenChange={(open) => {
                        keyboard.handleCloseKeyboard();
                        setIsDatePickerOpen(open);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                            type="button"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value
                              ? format(new Date(field.value), "PPP")
                              : "Pick a date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            if (date) {
                              setSelectedDate(date);
                              field.onChange(format(date, "yyyy-MM-dd"));
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* <FormField
                  control={form.control}
                  name="assignedRegister"
                  render={() => (
                    <FormItem>
                      <FormLabel>Assigned Register</FormLabel>
                      <FormControl>
                        <AdaptiveFormField
                          id="assignedRegister"
                          label=""
                          value={keyboard.formValues.assignedRegister || ""}
                          placeholder="e.g. Register 1, Main POS"
                          readOnly
                          onClick={() =>
                            keyboard.handleFieldFocus("assignedRegister")
                          }
                          onFocus={() =>
                            keyboard.handleFieldFocus("assignedRegister")
                          }
                          error={
                            form.formState.errors.assignedRegister?.message
                          }
                          className={cn(
                            keyboard.activeField === "assignedRegister" &&
                              "ring-2 ring-primary border-primary",
                            isSubmitting && "opacity-50 cursor-not-allowed"
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                /> */}

              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <TimePicker
                        id="startTime"
                        label="Start Time"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <TimePicker
                        id="endTime"
                        label="End Time"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {startTime && endTime && (
                <div className="md:col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="font-medium text-slate-800 text-sm sm:text-base">
                      Shift Duration:
                    </span>
                    <span className="text-slate-700 text-sm sm:text-base">
                      {(() => {
                        const formatTime = (time: string) => {
                          const [hour, minute] = time.split(":").map(Number);
                          const period = hour >= 12 ? "PM" : "AM";
                          const displayHour =
                            hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                          return `${displayHour}:${minute
                            .toString()
                            .padStart(2, "0")} ${period}`;
                        };

                        const durationMinutes = calculateShiftDuration(
                          startTime,
                          endTime,
                        );

                        if (durationMinutes === -1) {
                          return "Invalid time format";
                        }

                        if (durationMinutes === 0) {
                          return "Start and end time cannot be the same";
                        }

                        const hours = Math.floor(durationMinutes / 60);
                        const minutes = durationMinutes % 60;

                        const isOvernight = isOvernightShift(
                          startTime,
                          endTime,
                        );

                        let warningText = "";
                        if (
                          durationMinutes < SHIFT_CONFIG.MIN_DURATION_MINUTES
                        ) {
                          warningText = " ⚠️ Too short";
                        } else if (
                          durationMinutes > SHIFT_CONFIG.MAX_DURATION_MINUTES
                        ) {
                          warningText = " ⚠️ Too long";
                        }

                        return `${formatTime(startTime)} - ${formatTime(
                          endTime,
                        )}${
                          isOvernight ? " (+1 day)" : ""
                        } (${hours}h ${minutes}m)${warningText}`;
                      })()}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <FormLabel>Quick Time Presets</FormLabel>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("startTime", "09:00");
                      form.setValue("endTime", "17:00");
                    }}
                    disabled={isSubmitting}
                  >
                    9 AM - 5 PM
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("startTime", "08:00");
                      form.setValue("endTime", "16:00");
                    }}
                    disabled={isSubmitting}
                  >
                    8 AM - 4 PM
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("startTime", "10:00");
                      form.setValue("endTime", "18:00");
                    }}
                    disabled={isSubmitting}
                  >
                    10 AM - 6 PM
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("startTime", "14:00");
                      form.setValue("endTime", "22:00");
                    }}
                    disabled={isSubmitting}
                  >
                    2 PM - 10 PM
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("startTime", "22:00");
                      form.setValue("endTime", "06:00");
                    }}
                    disabled={isSubmitting}
                  >
                    10 PM - 6 AM (Night)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("startTime", "23:00");
                      form.setValue("endTime", "07:00");
                    }}
                    disabled={isSubmitting}
                  >
                    11 PM - 7 AM (Night)
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={() => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <AdaptiveTextarea
                        id="notes"
                        label=""
                        value={keyboard.formValues.notes || ""}
                        placeholder="Add any special instructions or notes for this schedule..."
                        readOnly
                        onClick={() => keyboard.handleFieldFocus("notes")}
                        onFocus={() => keyboard.handleFieldFocus("notes")}
                        error={form.formState.errors.notes?.message}
                        className={cn(
                          keyboard.activeField === "notes" &&
                            "ring-2 ring-primary border-primary",
                          isSubmitting && "opacity-50 cursor-not-allowed",
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Actions - Only show if showButtons is true */}
          {showButtons && (
            <div
              className={cn(
                "flex flex-col sm:flex-row gap-2 sm:gap-2 pt-4",
                keyboard.showKeyboard && "pb-[340px]",
              )}
            >
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
              >
                {isSubmitting
                  ? "Saving..."
                  : isEditMode
                    ? "Update Schedule"
                    : "Create Schedule"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  keyboard.handleCloseKeyboard();
                  onClose();
                }}
                disabled={isSubmitting}
                className="flex-1 text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Adaptive Keyboard */}
          {keyboard.showKeyboard && (
            <div
              className={cn(
                showButtons
                  ? "sticky bottom-0 left-0 right-0 z-50 mt-4 bg-background"
                  : "border-t bg-background px-2 py-2 shrink-0",
              )}
            >
              <div className={showButtons ? "" : "max-w-full overflow-hidden"}>
                <AdaptiveKeyboard
                  onInput={keyboard.handleInput}
                  onBackspace={keyboard.handleBackspace}
                  onClear={keyboard.handleClear}
                  onEnter={() => {
                    // Move to next field or submit if last field
                    if (keyboard.activeField === "notes") {
                      handleSubmit();
                    } else {
                      keyboard.handleCloseKeyboard();
                    }
                  }}
                  initialMode={
                    (
                      keyboard.activeFieldConfig as {
                        keyboardMode?: "qwerty" | "numeric" | "symbols";
                      }
                    )?.keyboardMode || "qwerty"
                  }
                  visible={keyboard.showKeyboard}
                  onClose={keyboard.handleCloseKeyboard}
                />
              </div>
            </div>
          )}
        </form>
      </Form>
    );
  };

  const handleDeleteClick = useCallback((schedule: Schedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!scheduleToDelete) {
      setDeleteDialogOpen(false);
      return;
    }

    setIsDeleting(true);
    const toastId = toast.loading("Deleting schedule...");

    try {
      const response = await window.scheduleAPI.delete(scheduleToDelete.id);
      if (response.success) {
        setSchedules(
          schedules.filter((schedule) => schedule.id !== scheduleToDelete.id),
        );
        toast.success("Schedule deleted successfully", { id: toastId });
      } else {
        toast.error("Failed to delete schedule", {
          description: response.message || "Please try again",
          id: toastId,
        });
      }
    } catch (error) {
      logger.error("Error deleting schedule:", error);
      toast.error("An error occurred", {
        description: "Failed to delete the schedule. Please try again.",
        id: toastId,
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    }
  }, [scheduleToDelete, schedules]);

  const handleViewSchedule = useCallback(
    (schedule: Schedule) => {
      openDrawer(schedule);
    },
    [openDrawer],
  );

  const getShiftDuration = (startTime: string, endTime: string) => {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);

      // Check if dates are valid
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return "Invalid date";
      }

      const diffMs = end.getTime() - start.getTime();
      const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
      return `${diffHours}h`;
    } catch (error) {
      logger.error("Error calculating shift duration:", error);
      return "N/A";
    }
  };

  const getScheduleStatus = (startTime: string, endTime: string) => {
    try {
      const now = new Date();
      const start = new Date(startTime);
      const end = new Date(endTime);

      // Check if dates are valid
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          status: "upcoming",
          color: "bg-gray-100 text-gray-800 border-gray-200",
        };
      }

      if (now < start)
        return {
          status: "upcoming",
          color: "bg-blue-100 text-blue-800 border-blue-200",
        };
      if (now >= start && now <= end)
        return {
          status: "active",
          color: "bg-green-100 text-green-800 border-green-200",
        };
      return {
        status: "completed",
        color: "bg-gray-100 text-gray-800 border-gray-200",
      };
    } catch (error) {
      logger.error("Error getting schedule status:", error);
      return {
        status: "upcoming",
        color: "bg-gray-100 text-gray-800 border-gray-200",
      };
    }
  };

  // Filter schedules based on user permissions
  // Managers should only see cashier schedules, not their own or other managers' schedules
  const filteredSchedules = useMemo(() => {
    let filtered = schedules;

    // RBAC filtering
    if (canScheduleAll) {
      filtered = schedules;
    } else if (canScheduleCashiers) {
      filtered = schedules.filter((schedule) => {
        const staffMember = allStaff.find((s) => s.id === schedule.staffId);
        if (!staffMember) {
          logger.warn(
            `[filteredSchedules] Staff member not found for schedule ${schedule.id}, staffId: ${schedule.staffId}`,
          );
          return false;
        }
        const staffRoleName = getUserRoleName(staffMember);
        return staffRoleName === "cashier";
      });
    } else {
      filtered = [];
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((schedule) => {
        const staffMember = allStaff.find((s) => s.id === schedule.staffId);
        if (!staffMember) return false;
        const staffName =
          `${staffMember.firstName} ${staffMember.lastName}`.toLowerCase();
        return staffName.includes(searchTerm.toLowerCase());
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (schedule) => schedule.status === statusFilter,
      );
    }

    return filtered;
  }, [
    schedules,
    allStaff,
    canScheduleAll,
    canScheduleCashiers,
    searchTerm,
    statusFilter,
  ]);

  const totalItems = filteredSchedules.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [totalItems]);

  // Memoized function to get schedules for a date
  const getSchedulesForDate = useCallback(
    (date: Date) => {
      const dateString = format(date, "yyyy-MM-dd");
      return filteredSchedules.filter((schedule) => {
        const scheduleDate = schedule.startTime.split("T")[0];
        return scheduleDate === dateString;
      });
    },
    [filteredSchedules],
  );

  // Memoized schedules for selected date
  const schedulesForSelectedDate = useMemo(
    () => getSchedulesForDate(selectedDate),
    [getSchedulesForDate, selectedDate],
  );

  return (
    <div className="container mx-auto p-1 max-w-[1600px] flex flex-col flex-1 min-h-0 gap-4 sm:gap-6">
      <div ref={safeFocusRef} tabIndex={-1} className="sr-only" />

      {/* Drawer for creating/editing schedules */}
      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (open) {
            setupDrawerForm();
            setIsDrawerOpen(true);
          } else {
            closeDrawer();
          }
        }}
        direction="right"
      >
        <DrawerContent className="h-full w-[95%] sm:w-[600px] md:w-[700px] lg:w-[800px] sm:max-w-none mt-0 rounded-none fixed right-0 top-0 overflow-hidden">
          <DrawerHeader className="border-b shrink-0">
            <DrawerTitle>
              {editingSchedule ? "Edit Staff Schedule" : "Create New Schedule"}
            </DrawerTitle>
            <DrawerDescription>
              {editingSchedule
                ? "Edit the staff schedule details below"
                : "Fill in the form below to create a new staff schedule"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 min-h-0">
            <ScheduleFormContent
              editingSchedule={editingSchedule}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              isDatePickerOpen={isDatePickerOpen}
              setIsDatePickerOpen={setIsDatePickerOpen}
              cashiers={cashiers}
              isLoadingCashiers={isLoadingCashiers}
              businessId={businessId}
              checkShiftOverlap={checkShiftOverlap}
              canScheduleAll={canScheduleAll}
              canScheduleCashiers={canScheduleCashiers}
              onClose={closeDrawer}
              isOpen={isDrawerOpen}
              showButtons={false}
              onSuccess={(schedule) => {
                if (editingSchedule) {
                  setSchedules(
                    schedules.map((s) =>
                      s.id === editingSchedule.id ? schedule : s,
                    ),
                  );
                } else {
                  setSchedules([...schedules, schedule]);
                }
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* MiniBar with filters and pagination */}
      <MiniBar
        title="Staff Schedules"
        onBack={onBack}
        action={{
          label: "New Schedule",
          onClick: () => openDrawer(),
          icon: <Plus className="h-4 w-4" />,
        }}
        center={
          <ScheduleFilters
            variant="miniBar"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        }
        right={
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-7 px-2"
              >
                <TableIcon className="h-4 w-4 mr-1" />
                Table
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="h-7 px-2"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Calendar
              </Button>
            </div>

            {viewMode === "table" && (
              <>
                {/* Pagination info */}
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {(currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
                </span>

                {/* Pagination controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage >= totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        }
      />

      {/* Main content - Table or Calendar view */}
      {viewMode === "table" ? (
        <ScheduleTable
          schedules={filteredSchedules}
          allStaff={allStaff}
          isLoading={isLoadingSchedules || isLoadingCashiers}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          onResetFilters={() => {
            setSearchTerm("");
            setStatusFilter("all");
          }}
          onViewSchedule={handleViewSchedule}
          onEditSchedule={openDrawer}
          onDeleteSchedule={handleDeleteClick}
          onAddSchedule={() => openDrawer()}
          onToggleCalendarView={() => setViewMode("calendar")}
          pagination={{
            currentPage,
            pageSize,
            onPageChange: setCurrentPage,
            onPageSizeChange: setPageSize,
          }}
        />
      ) : (
        /* Calendar View - Keep existing calendar functionality */
        <div className="bg-white rounded-lg shadow-lg p-2 sm:p-3 md:p-4 lg:p-6">
          <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:justify-between lg:items-center mb-3 sm:mb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:gap-x-4">
              <Button
                variant="outline"
                onClick={goToToday}
                className="w-full sm:w-auto text-xs sm:text-sm"
                aria-label="Go to today's date"
              >
                Today
              </Button>
              <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPreviousWeek}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  aria-label="Go to previous week"
                >
                  <ChevronLeft
                    className="h-3 w-3 sm:h-4 sm:w-4"
                    aria-hidden="true"
                  />
                </Button>
                <h2 className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-semibold text-slate-800 px-1 sm:px-2 text-center sm:text-left min-w-0 flex-1">
                  <span className="inline sm:hidden">
                    {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
                  </span>
                  <span className="hidden sm:inline">
                    {format(weekStart, "MMM d")} -{" "}
                    {format(weekEnd, "MMM d, yyyy")}
                  </span>
                </h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextWeek}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  aria-label="Go to next week"
                >
                  <ChevronRight
                    className="h-3 w-3 sm:h-4 sm:w-4"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={calendarViewMode === "week" ? "default" : "outline"}
                onClick={() => setCalendarViewMode("week")}
                className="flex-1 sm:flex-none text-xs sm:text-sm md:text-base"
              >
                Week View
              </Button>
              <Button
                variant={calendarViewMode === "day" ? "default" : "outline"}
                onClick={() => setCalendarViewMode("day")}
                className="flex-1 sm:flex-none text-xs sm:text-sm md:text-base"
              >
                Day View
              </Button>
            </div>
          </div>

          {/* Week Calendar */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2 mb-3 sm:mb-4 overflow-x-auto">
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "text-center p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg border transition-colors cursor-pointer min-w-0",
                  isToday(day)
                    ? "bg-slate-100 border-slate-300 text-slate-800 font-semibold"
                    : "bg-slate-50 border-slate-200",
                  isSameDay(day, selectedDate)
                    ? "ring-2 ring-primary ring-opacity-50"
                    : "",
                )}
                onClick={() => setSelectedDate(day)}
                role="button"
                tabIndex={0}
                aria-label={`Select ${format(day, "EEEE, MMMM d, yyyy")}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedDate(day);
                  }
                }}
              >
                <div className="text-caption md:text-sm font-medium truncate">
                  {format(day, "EEE")}
                </div>
                <div className="text-sm sm:text-base md:text-lg font-semibold">
                  {format(day, "d")}
                </div>
                <div className="text-caption md:text-xs text-slate-500 mt-0.5 truncate">
                  {getSchedulesForDate(day).length}{" "}
                  {getSchedulesForDate(day).length === 1 ? "shift" : "shifts"}
                </div>
              </div>
            ))}
          </div>

          {/* Date Picker for Mobile/Quick Selection */}
          <div className="flex justify-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:max-w-xs justify-center text-xs sm:text-sm"
                  size="sm"
                >
                  <CalendarIcon className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">Select Specific Date</span>
                  <span className="xs:hidden">Select Date</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Schedules Content */}
          {isLoadingSchedules ? (
            <div className="text-center py-8 sm:py-12 md:py-16">
              <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-slate-600 mx-auto mb-3 sm:mb-4"></div>
              <p className="text-sm sm:text-base text-slate-500">
                Loading schedules...
              </p>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="text-center py-8 sm:py-12 md:py-16 animate-fade-in bg-white rounded-lg shadow">
              <div className="text-slate-400 mb-3 sm:mb-4">
                <CreditCard className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-600 mb-2 px-2">
                No shifts scheduled
              </h3>
              <p className="text-sm sm:text-base text-slate-500 px-2">
                Click "Schedule Shift" to create your first cashier shift.
              </p>
            </div>
          ) : (
            /* Shifts for Selected Date */
            <div className="w-full mb-3 sm:mb-4 md:mb-6">
              <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-slate-800 mb-2 sm:mb-3 md:mb-4 break-word">
                Shifts for {format(selectedDate, "MMMM d, yyyy")}
              </h3>

              <Button
                onClick={() => openDrawer(undefined, selectedDate)}
                variant="outline"
                className="mb-3 sm:mb-4 w-full sm:w-auto text-xs sm:text-sm md:text-base"
                size="sm"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">
                  Add Shift for This Date
                </span>
                <span className="xs:hidden">Add Shift</span>
              </Button>

              {schedulesForSelectedDate.length === 0 ? (
                <div className="text-center py-6 sm:py-8 bg-white rounded-lg shadow">
                  <CalendarIcon className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-slate-500 px-2">
                    No shifts scheduled for this date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-4 lg:gap-6">
                  {schedulesForSelectedDate.map((schedule, index) => {
                    const scheduleStatus = getScheduleStatus(
                      schedule.startTime,
                      schedule.endTime,
                    );
                    const duration = getShiftDuration(
                      schedule.startTime,
                      schedule.endTime,
                    );

                    // Find staff member details - use allStaff for display (not filtered by permissions)
                    const staffMember = allStaff.find(
                      (c) => c.id === schedule.staffId,
                    );

                    // Defensive fallback: log missing staff member for debugging
                    if (!staffMember) {
                      logger.warn(
                        `[StaffSchedules] Staff member not found for schedule ${schedule.id}, staffId: ${schedule.staffId}. Available allStaff: ${allStaff.length} users`,
                      );
                    }

                    const staffName = staffMember
                      ? `${staffMember.firstName} ${staffMember.lastName}`
                      : `Unknown Staff (ID: ${schedule.staffId?.slice(0, 8)}...)`;

                    return (
                      <div
                        key={schedule.id}
                        style={{ animationDelay: `${index * 0.05}s` }}
                        className="transform transition-all duration-200 animate-slide-up hover:-translate-y-1"
                      >
                        <Card className="h-full bg-white shadow-lg hover:shadow-xl border-0 overflow-hidden">
                          <CardHeader className="pb-3 sm:pb-4">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                              <div className="space-y-1 min-w-0 flex-1">
                                <CardTitle className="text-base sm:text-xl text-slate-900 flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 shrink-0" />
                                  <span className="truncate">{staffName}</span>
                                </CardTitle>
                                <p className="text-xs sm:text-sm text-slate-600 truncate">
                                  {staffMember
                                    ? getUserRoleDisplayName(staffMember)
                                    : "Staff"}{" "}
                                  •{" "}
                                  {schedule.assignedRegister ||
                                    "No register assigned"}
                                </p>
                              </div>
                              <Badge
                                className={`${scheduleStatus.color} text-xs whitespace-nowrap`}
                              >
                                {scheduleStatus.status}
                              </Badge>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-3 sm:space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                                <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
                                <span className="truncate">
                                  {format(
                                    new Date(schedule.startTime),
                                    "MMM dd, yyyy",
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
                                <span>{duration}</span>
                              </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-2 sm:p-3 text-xs sm:text-sm">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">
                                  Schedule Time:
                                </span>
                              </div>
                              <div className="text-slate-700 mt-1">
                                {format(new Date(schedule.startTime), "h:mm a")}{" "}
                                - {format(new Date(schedule.endTime), "h:mm a")}
                              </div>
                            </div>

                            {schedule.notes && (
                              <div className="flex items-start gap-2 p-2 sm:p-3 bg-amber-50 rounded-lg">
                                <StickyNote className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs sm:text-sm font-medium text-amber-800 mb-1">
                                    Notes:
                                  </p>
                                  <p className="text-xs sm:text-sm text-amber-700 overflow-wrap-break-word">
                                    {schedule.notes}
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="pt-2 border-t border-slate-100">
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => openDrawer(schedule)}
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-xs sm:text-sm"
                                  aria-label={`Edit schedule for ${staffName}`}
                                >
                                  <Edit2
                                    className="w-3 h-3 sm:w-4 sm:h-4 mr-1"
                                    aria-hidden="true"
                                  />
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleDeleteClick(schedule)}
                                  size="sm"
                                  variant="outline"
                                  disabled={isDeleting}
                                  className="flex-1 hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-xs sm:text-sm"
                                  aria-label={`Delete schedule for ${staffName}`}
                                >
                                  <Trash2
                                    className="w-3 h-3 sm:w-4 sm:h-4 mr-1"
                                    aria-hidden="true"
                                  />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              {scheduleToDelete &&
                (() => {
                  const staffMember = allStaff.find(
                    (c) => c.id === scheduleToDelete.staffId,
                  );
                  const staffName = staffMember
                    ? `${staffMember.firstName} ${staffMember.lastName}`
                    : "This staff member";
                  return `Are you sure you want to delete the schedule for ${staffName} on ${format(
                    new Date(scheduleToDelete.startTime),
                    "PPP",
                  )}? This action cannot be undone.`;
                })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StaffSchedulesView;
