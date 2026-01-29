/**
 * useShiftExpiryLogout
 *
 * Monitors the current user's scheduled shift end time and automatically
 * logs them out when the shift has exceeded (real-time). Ensures cashiers
 * who stay past their scheduled end (e.g. 9am–10pm) without manually
 * logging out are logged out when the shift time is exceeded.
 *
 * Only runs for users who require a shift (cashier, manager, supervisor).
 * Uses the same schedule end time as assigned by admin (e.g. from staff
 * schedules in admin dashboard).
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import {
  getUserRoleName,
  userRequiresShift,
} from "@/shared/utils/rbac-helpers";
import type { User } from "@/types/domain";
import type { Schedule } from "@/types/domain/shift";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("use-shift-expiry-logout");

/** Poll interval in ms. Check every minute for shift expiry. */
const CHECK_INTERVAL_MS = 60_000;

/**
 * Returns true if the current user requires shift-based access and should
 * be subject to shift-expiry auto-logout (cashier, manager, supervisor).
 */
function shouldCheckShiftExpiry(user: User | null): boolean {
  if (!user) return false;
  if (userRequiresShift(user)) return true;
  const role = getUserRoleName(user);
  return role === "manager";
}

/**
 * Parse schedule end time to milliseconds (handles number or string).
 */
function getScheduleEndMs(schedule: Schedule): number {
  const raw = schedule.endTime;
  if (typeof raw === "number") return raw;
  return new Date(raw as string).getTime();
}

/**
 * Hook that checks periodically whether the logged-in user's scheduled
 * shift has ended. If so, shows a toast and logs them out automatically.
 * Call this from a component that is always mounted when a cashier is
 * logged in (e.g. DashboardHeader).
 */
export function useShiftExpiryLogout(): void {
  const { user, logout } = useAuth();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!user?.id || !shouldCheckShiftExpiry(user)) return;

    const check = async () => {
      if (hasTriggeredRef.current) return;

      try {
        const [shiftRes, scheduleRes] = await Promise.all([
          window.shiftAPI.getActive(user.id),
          window.shiftAPI.getTodaySchedule(user.id),
        ]);

        if (!shiftRes.success || !shiftRes.data) return;
        if (!scheduleRes.success || !scheduleRes.data) return;

        const schedule = scheduleRes.data as Schedule;
        const endMs = getScheduleEndMs(schedule);
        const now = Date.now();

        if (now > endMs) {
          hasTriggeredRef.current = true;
          logger.info(
            "[useShiftExpiryLogout] Scheduled shift ended, auto-logging out user",
            { userId: user.id, scheduleEnd: new Date(endMs).toISOString() }
          );
          toast.info(
            "Your scheduled shift has ended. You have been logged out.",
            { duration: 5000 }
          );
          await logout();
        }
      } catch (e) {
        logger.error("[useShiftExpiryLogout] Error during shift expiry check", e);
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.id, logout]);
}
