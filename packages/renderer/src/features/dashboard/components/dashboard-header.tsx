import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Clock, Power, User, Lock } from "lucide-react";
import { useAuth } from "@/shared/hooks/use-auth";
import { LicenseHeaderBadge } from "./license-header-badge";
import { WiFiStatusIcon } from "@/features/license";
import { LogoutConfirmationDialog } from "./logout-confirmation-dialog";
import { BreakReminder } from "./break-reminder";
import { useActiveShift } from "../hooks/use-active-shift";
import { getLogger } from "@/shared/utils/logger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangePinDialog } from "@/features/auth/components/change-pin-dialog";

const logger = getLogger("dashboard-header");

export interface DashboardHeaderProps {
  subtitle?: string;
}

export function DashboardHeader({ subtitle }: DashboardHeaderProps) {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;
  const { user, logout } = useAuth();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [showChangePinDialog, setShowChangePinDialog] = useState(false);

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
                  src={logoSrc}
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
                <p className="text-caption text-muted-foreground/60 -mt-1">
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

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    <span className="hidden md:inline-block">
                      {user.firstName}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowChangePinDialog(true)}>
                    <Lock className="mr-2 h-4 w-4" />
                    Change PIN
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogoutClick}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

      <ChangePinDialog
        open={showChangePinDialog}
        onOpenChange={setShowChangePinDialog}
        userId={user.id}
      />

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

