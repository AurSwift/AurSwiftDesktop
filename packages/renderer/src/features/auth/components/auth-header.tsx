import { Power } from "lucide-react";
import { useEffect, useState } from "react";
import { getAppVersion } from "@/shared/utils/version";
import { Button } from "@/components/ui/button";
import { getLogger } from "@/shared/utils/logger";
import { WiFiStatusIcon } from "@/features/license";

const logger = getLogger("auth-header");

// Header component for banner and time
export function AuthHeader() {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;
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
        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-sm flex items-center justify-center shrink-0">
          <div className="relative w-8 h-8 rounded-sm overflow-hidden ring-2 ring-primary/20 shadow-md bg-black flex items-center justify-center">
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
        </div>
        <div className="min-w-0">
          <div className="relative inline-block">
            <h1 className="text-lg lg:text-xl font-bold text-foreground truncate">
              Aurswift
            </h1>
            <span className="absolute -bottom-0.6 -right-1 sm:-right-2 z-10 inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-md bg-primary/12 border border-primary/25 shadow-sm">
              <span className="text-xs font-semibold text-primary leading-none tracking-tight">
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
