import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { mapActionToView } from "@/features/navigation/utils/navigation-mapper";
import { useNavigation } from "@/features/navigation/hooks/use-navigation";
import { getLogger } from "@/shared/utils/logger";
import { useAuth } from "@/shared/hooks/use-auth";
import { useActiveShift } from "../hooks/use-active-shift";
import { useDatabaseActions } from "../hooks/use-database-actions";
import { LicenseInfoModal } from "@/features/license";
import { ChangePinDialog } from "@/features/auth/components";
import { LogoutConfirmationDialog } from "../components/logout-confirmation-dialog";
import {
  SYSTEM_SETTINGS_ACTION_IDS,
  type SystemSettingsExtraActionId,
} from "../config/system-settings-actions";

const logger = getLogger("dashboard-actions");

interface DashboardActionsContextValue {
  handleActionClick: (featureId: string, actionId: string) => void;
}

const DashboardActionsContext =
  createContext<DashboardActionsContextValue | null>(null);

export function DashboardActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { navigateTo } = useNavigation();
  const databaseActions = useDatabaseActions();
  const { user, logout } = useAuth();
  const { shift: activeShift, refresh: refreshShift, workDuration } =
    useActiveShift(user?.id);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showChangePinDialog, setShowChangePinDialog] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const handleConfirmLogout = useCallback(async () => {
    if (!user) return;
    await logout();
  }, [logout, user]);

  const handleBreakStarted = useCallback(async () => {
    await refreshShift();
  }, [refreshShift]);

  const handleLogoutRequest = useCallback(() => {
    if (activeShift) {
      setIsLogoutDialogOpen(true);
      return;
    }
    void handleConfirmLogout();
  }, [activeShift, handleConfirmLogout]);

  const handleActionClick = useCallback(
    (featureId: string, actionId: string) => {
      logger.info(`[handleActionClick] Feature: ${featureId}, Action: ${actionId}`);

      const mapped = mapActionToView(featureId, actionId);
      if (typeof mapped === "string") {
        logger.info(`Navigating to view: ${mapped}`);
        navigateTo(mapped);
        return;
      }

      if (mapped?.viewId) {
        logger.info(`Navigating to view: ${mapped.viewId}`);
        navigateTo(mapped.viewId, mapped.params);
        return;
      }

      if (
        featureId === "system-settings" &&
        SYSTEM_SETTINGS_ACTION_IDS.has(actionId as SystemSettingsExtraActionId)
      ) {
        switch (actionId as SystemSettingsExtraActionId) {
          case "show-license-info":
            setShowLicenseModal(true);
            return;
          case "change-pin":
            setShowChangePinDialog(true);
            return;
          case "logout":
            handleLogoutRequest();
            return;
          case "quit-app":
            void window.appAPI.quit();
            return;
        }
      }

      if (featureId === "database-management") {
        if (databaseActions.warnIfBusy()) return;
        if (actionId === "import-database") {
          databaseActions.openImportDialog();
          return;
        }
        if (actionId === "backup-database") {
          databaseActions.openBackupDialog();
          return;
        }
        if (actionId === "empty-database") {
          databaseActions.openEmptyDialog();
          return;
        }
      }

      logger.warn(
        `[handleActionClick] Unhandled feature: ${featureId}, action: ${actionId}`,
      );
    },
    [databaseActions, handleLogoutRequest, navigateTo],
  );

  return (
    <DashboardActionsContext.Provider value={{ handleActionClick }}>
      {children}
      {databaseActions.dialogs}
      <LicenseInfoModal
        open={showLicenseModal}
        onOpenChange={setShowLicenseModal}
      />
      {user && (
        <ChangePinDialog
          open={showChangePinDialog}
          onOpenChange={setShowChangePinDialog}
          userId={user.id}
        />
      )}
      {activeShift && user && (
        <LogoutConfirmationDialog
          isOpen={isLogoutDialogOpen}
          onClose={() => setIsLogoutDialogOpen(false)}
          onConfirmLogout={handleConfirmLogout}
          hasActiveShift={!!activeShift}
          workDuration={workDuration}
          shiftId={activeShift.id}
          userId={user.id}
          onBreakStarted={handleBreakStarted}
        />
      )}
    </DashboardActionsContext.Provider>
  );
}

export function useDashboardActions() {
  const context = useContext(DashboardActionsContext);
  if (!context) {
    throw new Error(
      "useDashboardActions must be used within DashboardActionsProvider",
    );
  }
  return context;
}

export function useOptionalDashboardActions() {
  return useContext(DashboardActionsContext);
}
