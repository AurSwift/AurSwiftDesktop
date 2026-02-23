import { ChevronRight, CircleUserRound, Home, Menu } from "lucide-react";
import { useState } from "react";
import { useNavigation } from "@/features/navigation/hooks/use-navigation";
import { useAuth } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";
import { getUserDisplayName } from "@/shared/utils/auth";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TOPBAR_USER_ACTIONS,
  type SystemSettingsExtraActionId,
} from "@/features/dashboard/config/system-settings-actions";
import { useOptionalDashboardActions } from "@/features/dashboard/context";

interface BackOfficeTopbarProps {
  currentViewTitle?: string;
  breadcrumbItems: string[];
  onSidebarToggle: () => void;
  isMobile: boolean;
}

export function BackOfficeTopbar({
  currentViewTitle,
  breadcrumbItems,
  onSidebarToggle,
  isMobile,
}: BackOfficeTopbarProps) {
  const { navigateTo } = useNavigation();
  const { user } = useAuth();
  const dashboardActions = useOptionalDashboardActions();
  const [isLogoBroken, setIsLogoBroken] = useState(false);

  const displayName = user ? getUserDisplayName(user) : "User";
  const roleName = user ? getUserRoleName(user) : "";
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;
  const toggleLabel = "Open menu";

  const handleUserAction = (actionId: SystemSettingsExtraActionId) => {
    dashboardActions?.handleActionClick("system-settings", actionId);
  };

  return (
    <header className="border-b border-primary/30 bg-primary text-primary-foreground shadow-sm">
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {isMobile ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/10 transition-colors hover:bg-white/20"
              onClick={onSidebarToggle}
              aria-label={toggleLabel}
              title={toggleLabel}
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : null}

          <button
            type="button"
            className="inline-flex min-w-0 items-center gap-2 rounded-md bg-white/10 px-2 py-1 text-sm font-semibold transition-colors hover:bg-white/20"
            onClick={() => navigateTo("dashboard")}
            aria-label="Go to dashboard"
          >
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-white/30 bg-primary/20">
              {!isLogoBroken ? (
                <img
                  src={logoSrc}
                  alt="AurSwift logo"
                  className="h-full w-full object-contain"
                  onError={() => setIsLogoBroken(true)}
                />
              ) : (
                <span className="text-xs font-bold text-white">AS</span>
              )}
            </div>
            <span className="truncate">AurSwift</span>
            <Home className="h-4 w-4 shrink-0" />
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5 text-left transition-colors hover:bg-white/20"
              aria-label="User menu"
            >
              <CircleUserRound className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold leading-tight sm:text-sm">
                  {displayName}
                </p>
                <p className="truncate text-[11px] leading-tight text-primary-foreground/80 sm:text-xs">
                  {roleName || "staff"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {TOPBAR_USER_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.id}
                  onSelect={() => handleUserAction(action.id)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{action.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="border-t border-white/15 px-3 py-2 sm:px-4 lg:px-5">
        <div className="flex min-h-7 items-center justify-between gap-3">
          <nav
            className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-primary-foreground/85"
            aria-label="Breadcrumb"
          >
            {breadcrumbItems.map((item, index) => (
              <span key={`${item}-${index}`} className="inline-flex min-w-0 items-center">
                {index > 0 ? <ChevronRight className="mx-1 h-3.5 w-3.5 shrink-0" /> : null}
                <span
                  className={cn(
                    "truncate",
                    index === breadcrumbItems.length - 1
                      ? "text-primary-foreground"
                      : "text-primary-foreground/85",
                  )}
                >
                  {item}
                </span>
              </span>
            ))}
          </nav>

          <p className="truncate text-sm font-medium text-primary-foreground">
            {currentViewTitle || "Back Office"}
          </p>
        </div>
      </div>
    </header>
  );
}
