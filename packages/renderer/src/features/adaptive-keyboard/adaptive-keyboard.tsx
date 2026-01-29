import { useState, useCallback, useEffect } from "react";
import { cn } from "@/shared/utils/cn";
import { KeyboardKey } from "./keyboard-key";
import { LAYOUTS, type KeyboardMode, type KeyType } from "./keyboard-layouts";
import { Keyboard, Hash, Calculator, X } from "lucide-react";

interface AdaptiveKeyboardProps {
  onInput: (value: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onEnter: () => void;
  onTab?: () => void;
  initialMode?: KeyboardMode;
  inputType?: "text" | "number" | "email" | "tel";
  className?: string;
  visible?: boolean;
  onClose?: () => void;
}

export function AdaptiveKeyboard({
  onInput,
  onBackspace,
  onClear,
  onEnter,
  onTab,
  initialMode = "qwerty",
  inputType = "text",
  className,
  visible = true,
  onClose,
}: AdaptiveKeyboardProps) {
  const [mode, setMode] = useState<KeyboardMode>(initialMode);
  const [isShifted, setIsShifted] = useState(false);
  const [isCapsLock, setIsCapsLock] = useState(false);

  useEffect(() => {
    if (inputType === "number" || inputType === "tel") {
      setMode("numeric");
    } else if (inputType === "email") {
      setMode("qwerty");
    } else {
      setMode(initialMode);
    }
  }, [inputType, initialMode]);

  const handleKeyPress = useCallback(
    (key: KeyType) => {
      if (key.action) {
        switch (key.action) {
          case "backspace":
            onBackspace();
            break;
          case "clear":
            onClear();
            break;
          case "enter":
            onEnter();
            break;
          case "tab":
            onTab?.();
            break;
          case "space":
            onInput(" ");
            break;
          case "shift":
            setIsShifted((prev) => !prev);
            break;
          case "caps":
            setIsCapsLock((prev) => !prev);
            setIsShifted(false);
            break;
          case "mode":
            if (key.key === "123") setMode("numeric");
            else if (key.key === "#+=") setMode("symbols");
            else if (key.key === "ABC") setMode("qwerty");
            break;
        }
      } else {
        let char = key.key;
        if (isShifted || isCapsLock) {
          char = char.toUpperCase();
        }
        onInput(char);
        if (isShifted && !isCapsLock) {
          setIsShifted(false);
        }
      }
    },
    [onInput, onBackspace, onClear, onEnter, onTab, isShifted, isCapsLock],
  );

  const currentLayout = LAYOUTS[mode];

  const getModeIcon = (currentMode: KeyboardMode) => {
    switch (currentMode) {
      case "qwerty":
        return <Keyboard className="h-4 w-4" />;
      case "numeric":
        return <Calculator className="h-4 w-4" />;
      case "symbols":
        return <Hash className="h-4 w-4" />;
    }
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "w-full bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 rounded-t-xl shadow-2xl",
        // Container query support
        "@container",
        // Small screens (default)
        "p-1.5",
        // Medium screens
        "md:p-2",
        // Large screens
        "lg:p-2.5",
        "transition-all duration-300 ease-out",
        className,
      )}
      role="application"
      aria-label="Adaptive Virtual Keyboard"
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-0.5",
          // Small screens
          "mb-1.5 gap-1",
          // Medium screens
          "md:mb-2 md:gap-1.5",
          // Large screens
          "lg:mb-2 lg:gap-1.5",
        )}
      >
        <div className="flex items-center gap-1 md:gap-1.5">
          <div
            className={cn(
              "flex items-center gap-0.5 bg-teal-100 dark:bg-teal-600/20 rounded-full",
              // Small screens
              "px-1.5 py-0.5",
              // Medium screens
              "md:px-2 md:py-1",
              // Large screens
              "lg:px-2.5 lg:py-1",
            )}
          >
            <span className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4">
              {getModeIcon(mode)}
            </span>
            <span
              className={cn(
                "font-medium text-teal-700 dark:text-teal-400 capitalize",
                "text-xs",
              )}
            >
              {mode}
            </span>
          </div>
          {(isShifted || isCapsLock) && (
            <div
              className={cn(
                "flex items-center gap-0.5 bg-amber-100 dark:bg-amber-500/20 rounded-full",
                // Small screens
                "px-1.5 py-0.5",
                // Medium screens
                "md:px-2 md:py-1",
                // Large screens
                "lg:px-2.5 lg:py-1",
              )}
            >
              <span
                className={cn(
                  "font-medium text-amber-700 dark:text-amber-400",
                "text-xs",
                )}
              >
                {isCapsLock ? "CAPS" : "SHIFT"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 md:gap-1">
          {/* Mode Quick Switch */}
          <div
            className={cn(
              "flex items-center bg-slate-200 dark:bg-slate-700 rounded-lg",
              // Small screens
              "gap-0.5 p-0.5",
              // Medium screens
              "md:gap-1 md:p-1",
              // Large screens
              "lg:gap-1 lg:p-1",
            )}
          >
            <button
              onClick={() => setMode("qwerty")}
              className={cn(
                "rounded-md transition-colors text-slate-700 dark:text-white",
                // Small screens
                "p-1",
                // Medium screens
                "md:p-1",
                // Large screens
                "lg:p-1.5",
                mode === "qwerty"
                  ? "bg-teal-500 dark:bg-teal-600 text-white"
                  : "hover:bg-slate-300 dark:hover:bg-slate-600",
              )}
              aria-label="QWERTY mode"
            >
              <Keyboard className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
            </button>
            <button
              onClick={() => setMode("numeric")}
              className={cn(
                "rounded-md transition-colors text-slate-700 dark:text-white",
                // Small screens
                "p-1",
                // Medium screens
                "md:p-1",
                // Large screens
                "lg:p-1.5",
                mode === "numeric"
                  ? "bg-teal-500 dark:bg-teal-600 text-white"
                  : "hover:bg-slate-300 dark:hover:bg-slate-600",
              )}
              aria-label="Numeric mode"
            >
              <Calculator className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
            </button>
            <button
              onClick={() => setMode("symbols")}
              className={cn(
                "rounded-md transition-colors text-slate-700 dark:text-white",
                // Small screens
                "p-1",
                // Medium screens
                "md:p-1",
                // Large screens
                "lg:p-1.5",
                mode === "symbols"
                  ? "bg-teal-500 dark:bg-teal-600 text-white"
                  : "hover:bg-slate-300 dark:hover:bg-slate-600",
              )}
              aria-label="Symbols mode"
            >
              <Hash className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                "rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-white",
                // Small screens
                "p-1",
                // Medium screens
                "md:p-1",
                // Large screens
                "lg:p-1.5",
              )}
              aria-label="Close keyboard"
            >
              <X className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Keyboard Grid */}
      <div
        className={cn(
          // Small screens
          "space-y-0.5",
          // Medium screens
          "md:space-y-1",
          // Large screens
          "lg:space-y-1.5",
        )}
      >
        {currentLayout.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={cn(
              "flex justify-center",
              // Small screens
              "gap-0.5",
              // Medium screens
              "md:gap-1",
              // Large screens
              "lg:gap-1",
              mode === "numeric" && "max-w-xs mx-auto",
            )}
          >
            {row.map((key, keyIndex) => {
              const displayKey =
                key.display ||
                (isShifted || isCapsLock ? key.key.toUpperCase() : key.key);

              return (
                <KeyboardKey
                  key={`${rowIndex}-${keyIndex}`}
                  onClick={() => handleKeyPress(key)}
                  variant={key.variant}
                  className={cn(
                    // Width 2 (wide keys)
                    key.width === 2 &&
                      cn(
                        "min-w-[70px] md:min-w-20 lg:min-w-[90px]",
                        "in-[.license-keyboard]:min-w-[58px] in-[.license-keyboard]:md:min-w-[65px] in-[.license-keyboard]:lg:min-w-[75px]",
                      ),
                    // Width 4
                    key.width === 4 &&
                      cn(
                        "min-w-[120px] md:min-w-[140px] lg:min-w-40",
                        "in-[.license-keyboard]:min-w-[95px] in-[.license-keyboard]:md:min-w-[110px] in-[.license-keyboard]:lg:min-w-[130px]",
                      ),
                    // Width 5 (extra wide - spacebar)
                    key.width === 5 &&
                      cn(
                        "min-w-[150px] flex-1 max-w-[220px] md:min-w-[180px] md:max-w-[250px] lg:min-w-[200px] lg:max-w-[280px]",
                        "in-[.license-keyboard]:min-w-[120px] in-[.license-keyboard]:max-w-[180px] in-[.license-keyboard]:md:min-w-[140px] in-[.license-keyboard]:md:max-w-[200px] in-[.license-keyboard]:lg:min-w-40 in-[.license-keyboard]:lg:max-w-[230px]",
                      ),
                    // Numeric mode specific sizing
                    mode === "numeric" &&
                      cn(
                        "min-h-[50px] min-w-[60px] text-base",
                        "md:min-h-[55px] md:min-w-[65px] md:text-lg",
                        "lg:min-h-[60px] lg:min-w-[70px] lg:text-lg",
                      ),
                  )}
                  ariaLabel={key.action || key.key}
                >
                  {displayKey}
                </KeyboardKey>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
