import { useState, useCallback, useEffect, useMemo } from "react";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-expiry-alerts");
import type {
  ProductBatch,
  ExpiryAlert,
  ExpirySettings,
} from "@/types/features/batches";
import {
  generateExpiryAlert,
  filterBatchesByExpiryStatus,
  getBatchesExpiringInRange,
} from "../utils/expiry-calculations";

interface UseExpiryAlertsProps {
  batches: ProductBatch[];
  expirySettings: ExpirySettings | null;
  businessId?: string;
}

export const useExpiryAlerts = ({
  batches,
  expirySettings,
  businessId,
}: UseExpiryAlertsProps) => {
  const [notifications, setNotifications] = useState<ExpiryAlert[]>([]);
  const [loading, setLoading] = useState(false);

  // Generate alerts from batches
  const alerts = useMemo(() => {
    if (!expirySettings || batches.length === 0) {
      return [];
    }

    const alertsList: ExpiryAlert[] = [];

    batches.forEach((batch) => {
      if (batch.status === "ACTIVE") {
        const alert = generateExpiryAlert(batch, {
          criticalAlertDays: expirySettings.criticalAlertDays,
          warningAlertDays: expirySettings.warningAlertDays,
          infoAlertDays: expirySettings.infoAlertDays,
        });

        if (alert) {
          alertsList.push(alert);
        }
      }
    });

    // Sort by severity and days until expiry
    return alertsList.sort((a, b) => {
      const severityOrder: Record<
        "critical" | "high" | "medium" | "low",
        number
      > = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });
  }, [batches, expirySettings]);

  const loadNotifications = useCallback(async () => {
    // Check if expiryNotificationsAPI exists (it may not be implemented yet)
    const expiryAPI = (window as any).expiryNotificationsAPI;

    if (!businessId || !expiryAPI) {
      setNotifications([]);
      return;
    }

    try {
      setLoading(true);
      // Use getByBusiness to get pending and sent notifications
      // Since status filter only accepts single value, we'll get all and filter client-side
      // or use getPending for pending ones specifically
      const [pendingResponse, sentResponse] = await Promise.all([
        expiryAPI
          .getPending(businessId)
          .catch(() => ({ success: false, notifications: [] })),
        expiryAPI
          .getByBusiness(businessId, { status: "SENT" })
          .catch(() => ({ success: false, notifications: [] })),
      ]);

      const allNotifications = [
        ...(pendingResponse.success && pendingResponse.notifications
          ? pendingResponse.notifications
          : []),
        ...(sentResponse.success && sentResponse.notifications
          ? sentResponse.notifications
          : []),
      ];

      setNotifications(allNotifications);
    } catch (err) {
      logger.error("Error loading notifications:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Categorized alerts
  const criticalAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.alertType === "CRITICAL" || alert.alertType === "EXPIRED"
      ),
    [alerts]
  );

  const warningAlerts = useMemo(
    () => alerts.filter((alert) => alert.alertType === "WARNING"),
    [alerts]
  );

  const infoAlerts = useMemo(
    () => alerts.filter((alert) => alert.alertType === "INFO"),
    [alerts]
  );

  // Batch counts by status
  const expiredBatches = useMemo(
    () =>
      expirySettings
        ? filterBatchesByExpiryStatus(batches, "expired", expirySettings)
        : [],
    [batches, expirySettings]
  );

  const criticalBatches = useMemo(
    () =>
      expirySettings
        ? filterBatchesByExpiryStatus(batches, "critical", expirySettings)
        : [],
    [batches, expirySettings]
  );

  const warningBatches = useMemo(
    () =>
      expirySettings
        ? filterBatchesByExpiryStatus(batches, "warning", expirySettings)
        : [],
    [batches, expirySettings]
  );

  const expiringThisWeek = useMemo(
    () => getBatchesExpiringInRange(batches, 0, 7),
    [batches]
  );

  const expiringNext30Days = useMemo(
    () => getBatchesExpiringInRange(batches, 0, 30),
    [batches]
  );

  return {
    alerts,
    criticalAlerts,
    warningAlerts,
    infoAlerts,
    expiredBatches,
    criticalBatches,
    warningBatches,
    expiringThisWeek,
    expiringNext30Days,
    notifications,
    loading,
    loadNotifications,
  };
};
