import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/shared/utils/cn";
import { Label } from "@/components/ui/label";

interface AdaptiveFormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  onFocus?: () => void;
  rightElement?: ReactNode;
}

export const AdaptiveFormField = forwardRef<
  HTMLInputElement,
  AdaptiveFormFieldProps
>(({ label, error, className, onFocus, rightElement, ...props }, ref) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        <input
          ref={ref}
          className={cn(
            "flex h-14 w-full rounded-lg border-2 bg-input px-4 py-3",
            "text-lg font-medium placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-150",
            rightElement ? "pr-12" : "",
            error
              ? "border-destructive focus-visible:ring-destructive"
              : "border-border focus-visible:border-primary",
            className
          )}
          onFocus={onFocus}
          {...props}
        />
        {rightElement ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        ) : null}
      </div>
    </div>
  );
});

AdaptiveFormField.displayName = "AdaptiveFormField";
