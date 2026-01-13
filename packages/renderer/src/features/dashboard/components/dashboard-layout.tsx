import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

import {
  Store,
  LogOut,
  User,
  Bell,
  Settings,
  Clock,
  Power,
} from "lucide-react";
import { useAuth } from "@/shared/hooks/use-auth";
import { ClockOutWarningDialog } from "@/features/auth/components/clock-out-warning-dialog";
import { userHasAnyRole } from "@/shared/utils/rbac-helpers";
import { LicenseHeaderBadge } from "./license-header-badge";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("dashboard-layout");

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, subtitle }: DashboardLayoutProps) {
  const { user, logout, isLoading } = useAuth();
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);
  const [activeShift, setActiveShift] = useState<{
    id: string;
    clockInEvent?: { timestamp: string };
    createdAt?: string;
  } | null>(null);
  const [clockInTime, setClockInTime] = useState<string | undefined>();
  const [isCheckingShift, setIsCheckingShift] = useState(false);

  // Check for active shift on mount and periodically
  useEffect(() => {
    if (!user) return;

    const checkActiveShift = async () => {
      try {
        const response = await window.timeTrackingAPI.getActiveShift(user.id);
        if (response.success && response.shift) {
          setActiveShift(response.shift);
          // Get clock-in timestamp from the clock event
          if (response.shift.clockInEvent?.timestamp) {
            setClockInTime(response.shift.clockInEvent.timestamp);
          } else if (response.shift.createdAt) {
            // Fallback to createdAt if clock event not available
            setClockInTime(response.shift.createdAt);
          }
        } else {
          setActiveShift(null);
          setClockInTime(undefined);
        }
      } catch (error) {
        logger.error("Failed to check active shift:", error);
      }
    };

    checkActiveShift();
    const interval = setInterval(checkActiveShift, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    if (!user) return;

    // Check if user is clocked in
    setIsCheckingShift(true);
    try {
      const response = await window.timeTrackingAPI.getActiveShift(user.id);
      if (
        response.success &&
        response.shift &&
        userHasAnyRole(user, ["cashier", "manager"])
      ) {
        setActiveShift(response.shift);
        // Get clock-in timestamp
        if (response.shift.clockInEvent?.timestamp) {
          setClockInTime(response.shift.clockInEvent.timestamp);
        } else if (response.shift.createdAt) {
          setClockInTime(response.shift.createdAt);
        }
        setShowClockOutDialog(true);
        setIsCheckingShift(false);
        return;
      }
    } catch (error) {
      logger.error("Failed to check shift:", error);
    }
    setIsCheckingShift(false);

    // No active shift, proceed with logout
    await logout();
  };

  const handleClockOutAndLogout = async () => {
    setShowClockOutDialog(false);
    // Logout will auto-handle clock-out
    await logout();
  };

  const handleLogoutOnly = async () => {
    setShowClockOutDialog(false);
    await logout();
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-background via-primary/5 to-background backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden ring-2 ring-primary/20 shadow-md bg-black flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="AuraSwift Logo"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    // Fallback to icon if logo fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="hidden w-full h-full items-center justify-center">
                  <Store className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  AuraSwift
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
            <Button variant="ghost" size="sm">
              <Bell className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
            <LicenseHeaderBadge />
            <div className="flex items-center gap-3 pl-3 border-l">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                {activeShift &&
                  userHasAnyRole(user, ["cashier", "manager"]) && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
                      <Clock className="w-3 h-3 text-green-700" />
                      <span className="text-xs font-medium text-green-700">
                        Clocked In
                      </span>
                    </div>
                  )}
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                disabled={isLoading || isCheckingShift}
              >
                {isLoading || isCheckingShift ? (
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

      {/* Main Content */}
      <main className="p-3">{children}</main>

      {/* Clock Out Warning Dialog */}
      <ClockOutWarningDialog
        open={showClockOutDialog}
        onClose={() => setShowClockOutDialog(false)}
        onClockOutAndLogout={handleClockOutAndLogout}
        onLogoutOnly={handleLogoutOnly}
        clockInTime={clockInTime}
      />
    </div>
  );
}
