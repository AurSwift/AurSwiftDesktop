import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/shared/utils/cn";
import { Label } from "@/components/ui/label";

export type AdaptiveFormFieldVariant = "default" | "borderOnly";

interface AdaptiveFormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  onFocus?: () => void;
  rightElement?: ReactNode;
  /** Border-only style: no background, border-based (underline). Use for clean form layouts. */
  variant?: AdaptiveFormFieldVariant;
}

export const AdaptiveFormField = forwardRef<
  HTMLInputElement,
  AdaptiveFormFieldProps
>(
  (
    {
      label,
      error,
      className,
      onFocus,
      rightElement,
      variant = "default",
      ...props
    },
    ref
  ) => {
    const isBorderOnly = variant === "borderOnly";

    return (
      <div className="space-y-2">
        <Label
          htmlFor={props.id}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </Label>
        <div className="relative">
          <input
            ref={ref}
            className={cn(
              "flex w-full placeholder:text-muted-foreground",
              "focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "transition-colors duration-150",
              rightElement ? "pr-12" : "",
              isBorderOnly
                ? [
                    "h-9 sm:h-10 bg-transparent px-0 pt-1 pb-2",
                    "border-0 border-b-2 rounded-none",
                    "focus-visible:ring-0",
                    "text-sm sm:text-base",
                    error
                      ? "border-destructive focus-visible:border-destructive"
                      : "border-input focus-visible:border-primary",
                  ]
                : [
                    "h-14 rounded-lg border-2 bg-input px-4 py-3",
                    "text-lg font-medium",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    error
                      ? "border-destructive focus-visible:ring-destructive"
                      : "border-border focus-visible:border-primary",
                  ],
              className
            )}
            onFocus={onFocus}
            {...props}
          />
          {rightElement ? (
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
);

AdaptiveFormField.displayName = "AdaptiveFormField";
