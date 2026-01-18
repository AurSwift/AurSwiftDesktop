import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Clock, Power } from "lucide-react";
import { useAuth } from "@/shared/hooks/use-auth";
import { LicenseHeaderBadge } from "./license-header-badge";
import { WiFiStatusIcon } from "@/features/license";
import { LogoutConfirmationDialog } from "./logout-confirmation-dialog";
import { BreakReminder } from "./break-reminder";
import { useActiveShift } from "../hooks/use-active-shift";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("dashboard-header");

export interface DashboardHeaderProps {
  subtitle?: string;
}

export function DashboardHeader({ subtitle }: DashboardHeaderProps) {
  const { user, logout, isLoading } = useAuth();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  // Use the active shift hook for real-time updates
  const {
    shift: activeShift,
    activeBreak,
    refresh: refreshShift,
    workDuration,
  } = useActiveShift(user?.id);

  // Check if user has had a meal break today
  const hasMealBreakToday = false; // TODO: Implement check for meal breaks in shift history

  const handleLogoutClick = () => {
    if (activeShift) {
      // Show confirmation dialog if user has active shift
      setIsLogoutDialogOpen(true);
    } else {
      // No active shift, logout immediately
      void handleConfirmLogout();
    }
  };

  const handleConfirmLogout = async () => {
    if (!user) return;
    // Backend automatically handles clock-out during logout
    await logout();
  };

  const handleTakeBreak = () => {
    // No need for separate state, break controls manages its own dialog
  };

  const handleBreakStarted = async () => {
    await refreshShift();
  };

  const handleCloseApp = async () => {
    try {
      await window.appAPI.quit();
    } catch (error) {
      logger.error("Failed to close app:", error);
    }
  };

  if (!user) return null;

  return (
    <>
      <header className="border-b bg-linear-to-r from-background via-primary/5 to-background backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden ring-2 ring-primary/20 shadow-md bg-black flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="AurSwift Logo"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    // Fallback to icon if logo fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  AurSwift
                </h1>
                <p className="text-[10px] text-muted-foreground/60 -mt-1">
                  EPOS System
                </p>
              </div>
            </div>
            <div className="hidden md:block h-6 w-px bg-border" />
            <div className="hidden md:block">
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <WiFiStatusIcon size={18} />
            <LicenseHeaderBadge />
            <div className="flex items-center gap-3 pl-3 border-l">
              <div className="flex items-center gap-2">
                {/* Show clocked in status if shift active but not on break */}
                {activeShift && !activeBreak && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <Clock className="w-3 h-3 text-green-700 dark:text-green-400" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">
                      Clocked In
                    </span>
                  </div>
                )}
              </div>
              <Button
                onClick={handleLogoutClick}
                variant="ghost"
                size="sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </Button>
            </div>
            <Button
              onClick={handleCloseApp}
              variant="ghost"
              size="sm"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Power className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Dialog */}
      {activeShift && (
        <LogoutConfirmationDialog
          isOpen={isLogoutDialogOpen}
          onClose={() => setIsLogoutDialogOpen(false)}
          onConfirmLogout={handleConfirmLogout}
          hasActiveShift={!!activeShift}
          workDuration={workDuration}
          shiftId={activeShift.id}
          userId={user?.id}
          onBreakStarted={handleBreakStarted}
        />
      )}

      {/* Break Reminder (shows after 6 hours without meal break) */}
      {activeShift &&
        !activeBreak &&
        (
          <BreakReminder
            workDuration={workDuration}
            hasMealBreakToday={hasMealBreakToday}
            onTakeBreak={handleTakeBreak}
          />
        )}
    </>
  );
}

