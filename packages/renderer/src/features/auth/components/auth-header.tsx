import { BatteryFull, Bell, Store, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { getAppVersion } from "@/shared/utils/version";
import { Button } from "@/components/ui/button";
import { getLogger } from "@/shared/utils/logger";
import { WiFiStatusIcon } from "@/features/license";

const logger = getLogger("auth-header");

// Header component for banner and time
export function AuthHeader() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Format time as HH:mm:ss
  const timeString = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const handleCloseApp = async () => {
    try {
      await window.appAPI.quit();
    } catch (error) {
      logger.error("Failed to close app:", error);
    }
  };

  return (
    <header className="w-full flex items-center justify-between px-2 sm:px-4 lg:px-6 py-2 sm:py-3 border-b border-gray-200 bg-white/90 shadow-sm select-none">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-xl flex items-center justify-center shrink-0">
          <Store className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="relative inline-block">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground truncate">
              aurswift
            </h1>
            <span className="absolute -bottom-0.6 -right-1 sm:-right-2 z-10 inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-md bg-primary/12 border border-primary/25 shadow-sm">
              <span className="text-[8px] sm:text-[9px] font-semibold text-primary leading-none tracking-tight">
                v{getAppVersion()}
              </span>
            </span>
          </div>
        </div>
      </div>
      {/* Center: Store/Terminal Name - Hidden on small screens */}
      <div className="hidden sm:flex flex-1 justify-center items-center min-w-0 px-2">
        <span className="text-xs sm:text-sm lg:text-base font-semibold text-gray-700 truncate max-w-xs text-center"></span>
      </div>

      {/* Right: Status Area */}
      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
        <span className="hidden md:inline-flex items-center gap-1.5 lg:gap-2 text-gray-400">
          <WiFiStatusIcon />
          <BatteryFull
            className="w-4 h-4 lg:w-5 lg:h-5"
            aria-label="Battery Status"
          />
          <Bell className="w-4 h-4 lg:w-5 lg:h-5" aria-label="Notifications" />
        </span>
        <span
          className="text-xs sm:text-sm font-mono text-gray-700 whitespace-nowrap"
          aria-label="Current Time"
        >
          {timeString}
        </span>
        <Button
          onClick={handleCloseApp}
          variant="ghost"
          size="sm"
          className="hover:bg-destructive/10 hover:text-destructive shrink-0"
        >
          <Power className="w-4 h-4 lg:w-5 lg:h-5" />
        </Button>
      </div>
    </header>
  );
}
