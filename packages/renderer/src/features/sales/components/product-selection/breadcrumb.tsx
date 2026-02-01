/**
 * Breadcrumb navigation component
 */

import React from "react";
import { ChevronRight, Home } from "lucide-react";
import type { BreadcrumbItem } from "@/types/ui";

interface BreadcrumbProps {
  breadcrumb: BreadcrumbItem[];
  onBreadcrumbClick: (index: number) => void;
}

export function Breadcrumb({ breadcrumb, onBreadcrumbClick }: BreadcrumbProps) {
  // Safety check for undefined breadcrumb
  if (!breadcrumb || breadcrumb.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-xs sm:text-sm overflow-x-auto">
      {breadcrumb.map((item, index) => (
        <React.Fragment key={item.id || "root"}>
          {index > 0 && (
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
          )}
          <button
            onClick={() => onBreadcrumbClick(index)}
            className={`px-1.5 sm:px-2 py-1 rounded transition-colors shrink-0 touch-manipulation text-xs sm:text-sm ${
              index === breadcrumb.length - 1
                ? "bg-sky-100 text-sky-700 font-medium"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {index === 0 ? (
              <Home className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <span className="line-clamp-1">{item.name}</span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
