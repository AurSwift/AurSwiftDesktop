import type { ReactNode } from "react";
import { DashboardHeader } from "./dashboard-header";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, subtitle }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardHeader subtitle={subtitle} />

      {/* Main Content */}
      <main className="p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
