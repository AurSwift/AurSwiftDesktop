import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

interface AnimatePresenceProps {
  children: ReactNode;
  mode?: "wait" | "sync";
  exitAnimation?:
    | "fade"
    | "slide-up"
    | "slide-down"
    | "slide-left"
    | "slide-right"
    | "slide-left-exit"
    | "slide-right-exit"
    | "slide-up-exit"
    | "slide-down-exit"
    | "modal-exit"
    | "modal-exit-95";
  exitDuration?: number;
  as?: "div" | "fragment";
  className?: string;
}

/**
 * Replacement for framer-motion's AnimatePresence component
 * Handles exit animations using CSS classes and React state
 */
export function AnimatePresence({
  children,
  mode = "sync",
  exitAnimation = "fade",
  exitDuration = 300,
  as = "div",
  className,
}: AnimatePresenceProps) {
  const [displayChildren, setDisplayChildren] = useState<ReactNode>(children);
  const [exiting, setExiting] = useState(false);
  const [pendingChildren, setPendingChildren] = useState<ReactNode>(null);

  useEffect(() => {
    if (children !== displayChildren) {
      if (mode === "wait" && displayChildren && !exiting) {
        // Wait mode: start exit animation first
        setExiting(true);
        setPendingChildren(children);
        const timer = setTimeout(() => {
          setDisplayChildren(children);
          setExiting(false);
          setPendingChildren(null);
        }, exitDuration);
        return () => clearTimeout(timer);
      } else {
        // Sync mode or no previous children: show immediately
        setDisplayChildren(children);
        setExiting(false);
        setPendingChildren(null);
      }
    } else if (!children && displayChildren && !exiting) {
      // Children removed - start exit animation
      setExiting(true);
      const timer = setTimeout(() => {
        setDisplayChildren(null);
        setExiting(false);
      }, exitDuration);
      return () => clearTimeout(timer);
    }
  }, [children, exitDuration, exiting, displayChildren, mode]);

  if (!displayChildren && !pendingChildren) return null;

  const exitClassMap: Record<string, string> = {
    fade: "animate-fade-out",
    "slide-up": "animate-slide-up-exit",
    "slide-down": "animate-slide-down-exit",
    "slide-left": "animate-slide-left-exit",
    "slide-right": "animate-slide-right-exit",
    "slide-left-exit": "animate-slide-left-exit",
    "slide-right-exit": "animate-slide-right-exit",
    "slide-up-exit": "animate-slide-up-exit",
    "slide-down-exit": "animate-slide-down-exit",
    "modal-exit": "animate-modal-exit",
    "modal-exit-95": "animate-modal-exit-95",
  };

  const exitClass = exiting ? exitClassMap[exitAnimation] || "animate-fade-out" : "";

  if (as === "fragment") {
    return <>{displayChildren || pendingChildren}</>;
  }

  return (
    <div className={cn(exitClass, className)}>
      {displayChildren || pendingChildren}
    </div>
  );
}
