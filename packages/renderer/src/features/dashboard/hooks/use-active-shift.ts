/**
 * Hook to manage active shift state
 *
 * Provides current shift information, breaks, and real-time updates
 */

import { useState, useEffect } from "react";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("use-active-shift");

interface ActiveBreak {
  id: string;
  type: "meal" | "rest" | "other";
  start_time: string;
  status: "active";
  is_paid: boolean;
}

interface ActiveShift {
  id: string;
  user_id: string;
  business_id: string;
  schedule_id?: string;
  clock_in_id: string;
  status: "active";
  createdAt: string;
  clockInEvent?: {
    timestamp: string;
  };
}

interface UseActiveShiftReturn {
  shift: ActiveShift | null;
  activeBreak: ActiveBreak | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  workDuration: number; // in seconds
  breakDuration: number; // in seconds
}

export function useActiveShift(
  userId: string | undefined
): UseActiveShiftReturn {
  const [shift, setShift] = useState<ActiveShift | null>(null);
  const [activeBreak, setActiveBreak] = useState<ActiveBreak | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workDuration, setWorkDuration] = useState(0);
  const [breakDuration, setBreakDuration] = useState(0);

  const fetchShiftData = async () => {
    if (!userId) {
      setShift(null);
      setActiveBreak(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await window.timeTrackingAPI.getActiveShift(userId);

      if (response.success && response.shift) {
        setShift(response.shift);

        // Find active break
        const active = response.breaks?.find(
          (b: { status: string }) => b.status === "active"
        );
        setActiveBreak(active || null);
      } else {
        setShift(null);
        setActiveBreak(null);
      }
    } catch (error) {
      logger.error("Failed to fetch active shift:", error);
      setShift(null);
      setActiveBreak(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Update durations every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (shift?.clockInEvent?.timestamp) {
        const clockInTime = new Date(shift.clockInEvent.timestamp).getTime();
        const now = Date.now();
        const totalSeconds = Math.floor((now - clockInTime) / 1000);
        setWorkDuration(totalSeconds);
      }

      if (activeBreak?.start_time) {
        const breakStart = new Date(activeBreak.start_time).getTime();
        const now = Date.now();
        const breakSeconds = Math.floor((now - breakStart) / 1000);
        setBreakDuration(breakSeconds);
      } else {
        setBreakDuration(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [shift, activeBreak]);

  // Fetch on mount and set up polling
  useEffect(() => {
    fetchShiftData();

    // Poll every 30 seconds for shift changes
    const pollInterval = setInterval(fetchShiftData, 30000);

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    shift,
    activeBreak,
    isLoading,
    refresh: fetchShiftData,
    workDuration,
    breakDuration,
  };
}
