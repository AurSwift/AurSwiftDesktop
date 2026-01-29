import { cn } from "@/shared/utils/cn";
import { memo, type ReactNode } from "react";

export type KeyVariant =
  | "default"
  | "action"
  | "special"
  | "danger"
  | "success"
  | "wide"
  | "extra-wide";

interface KeyboardKeyProps {
  children: ReactNode;
  onClick: () => void;
  variant?: KeyVariant;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

const variantStyles: Record<KeyVariant, string> = {
  default:
    "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 active:bg-slate-400 dark:active:bg-slate-500 text-slate-900 dark:text-white",
  action:
    "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 active:bg-slate-500 dark:active:bg-slate-400 text-slate-900 dark:text-white",
  special:
    "bg-teal-500 dark:bg-teal-600 hover:bg-teal-400 dark:hover:bg-teal-500 active:bg-teal-300 dark:active:bg-teal-400 text-white font-semibold",
  danger:
    "bg-red-500 dark:bg-red-600 hover:bg-red-400 dark:hover:bg-red-500 active:bg-red-300 dark:active:bg-red-400 text-white font-semibold",
  success:
    "bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-300 dark:active:bg-emerald-400 text-white font-semibold",
  wide: "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 active:bg-slate-400 dark:active:bg-slate-500 text-slate-900 dark:text-white col-span-2",
  "extra-wide":
    "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 active:bg-slate-400 dark:active:bg-slate-500 text-slate-900 dark:text-white col-span-4",
};

export const KeyboardKey = memo(function KeyboardKey({
  children,
  onClick,
  variant = "default",
  className,
  disabled = false,
  ariaLabel,
}: KeyboardKeyProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        ariaLabel || (typeof children === "string" ? children : undefined)
      }
      className={cn(
        "flex items-center justify-center rounded-lg border border-slate-300/50 dark:border-slate-500/50",
        // Base responsive sizing
        "min-h-11 min-w-8 px-1.5 py-2 text-xs",
        // License keyboard specific sizing (narrower container - smaller keys)
        "in-[.license-keyboard]:min-h-[38px] in-[.license-keyboard]:min-w-7 in-[.license-keyboard]:px-1 in-[.license-keyboard]:py-1.5 in-[.license-keyboard]:text-xs",
        // Medium screens (md: 768px+)
        "md:min-h-12 md:min-w-9 md:px-2 md:py-2.5 md:text-sm",
        "in-[.license-keyboard]:md:min-h-[42px] in-[.license-keyboard]:md:min-w-[30px] in-[.license-keyboard]:md:text-xs",
        // Large screens (lg: 1024px+)
        "lg:min-h-[52px] lg:min-w-10 lg:px-2 lg:py-3 lg:text-sm",
        "in-[.license-keyboard]:lg:min-h-[46px] in-[.license-keyboard]:lg:min-w-[34px] in-[.license-keyboard]:lg:text-sm",
        "font-medium",
        "select-none touch-manipulation",
        "shadow-sm active:shadow-none",
        "focus:outline-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
});
