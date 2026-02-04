import { cn } from "@/shared/utils/cn";
import { memo, type ReactNode, type CSSProperties } from "react";

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
  style?: CSSProperties;
}

const variantStyles: Record<KeyVariant, string> = {
  default:
    "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 active:bg-slate-400 dark:active:bg-slate-500 text-slate-900 dark:text-white",
  action:
    "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 active:bg-slate-500 dark:active:bg-slate-400 text-slate-900 dark:text-white",
  special:
    "bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-slate-300 active:bg-slate-600 dark:active:bg-slate-400 text-white dark:text-slate-900 font-semibold",
  danger:
    "bg-red-500 dark:bg-red-600 hover:bg-red-400 dark:hover:bg-red-500 active:bg-red-300 dark:active:bg-red-400 text-white font-semibold",
  success:
    "bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-slate-300 active:bg-slate-600 dark:active:bg-slate-400 text-white dark:text-slate-900 font-semibold",
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
  style,
}: KeyboardKeyProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        ariaLabel || (typeof children === "string" ? children : undefined)
      }
      style={style}
      className={cn(
        "flex items-center justify-center rounded-lg border border-slate-300/50 dark:border-slate-500/50",
        // Base responsive sizing
        "min-h-9 min-w-0 w-full px-1.5 py-1.5 text-xs",
        // License keyboard specific sizing (narrower container - smaller keys)
        "in-[.license-keyboard]:min-h-[34px] in-[.license-keyboard]:min-w-0 in-[.license-keyboard]:px-1 in-[.license-keyboard]:py-1 in-[.license-keyboard]:text-xs",
        // Medium screens (md: 768px+)
        "md:min-h-10 md:min-w-0 md:px-2 md:py-2 md:text-sm",
        "in-[.license-keyboard]:md:min-h-[38px] in-[.license-keyboard]:md:min-w-0 in-[.license-keyboard]:md:text-xs",
        // Large screens (lg: 1024px+)
        "lg:min-h-[46px] lg:min-w-0 lg:px-2 lg:py-2.5 lg:text-sm",
        "in-[.license-keyboard]:lg:min-h-[42px] in-[.license-keyboard]:lg:min-w-0 in-[.license-keyboard]:lg:text-sm",
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
