import type { ReactNode } from "react";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";

interface ProtectedAppShellProps {
  children: ReactNode;
  subtitle?: string;
}

/**
 * Protected App Shell
 *
 * Shared chrome wrapper for protected routes that live outside the navigation
 * system (e.g. `/license`).
 */
export function ProtectedAppShell({ children, subtitle }: ProtectedAppShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardHeader subtitle={subtitle} />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0">{children}</div>
      </main>
    </div>
  );
}

