import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/shared/utils/cn";
import { KeyboardKey } from "./keyboard-key";
import { LAYOUTS, type KeyboardMode, type KeyType } from "./keyboard-layouts";

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
  const keyboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputType === "number" || inputType === "tel") {
      setMode("numeric");
    } else if (inputType === "email") {
      setMode("qwerty");
    } else {
      setMode(initialMode);
    }
  }, [inputType, initialMode]);

  useEffect(() => {
    if (!visible || !onClose) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (keyboardRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [visible, onClose]);

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

  if (!visible) return null;

  return (
    <div
      ref={keyboardRef}
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
              "grid w-full",
              // Small screens
              "gap-0.5",
              // Medium screens
              "md:gap-1",
              // Large screens
              "lg:gap-1",
            )}
            style={{
              gridTemplateColumns: `repeat(${row.reduce(
                (sum, key) => sum + (key.width ?? 1),
                0,
              )}, minmax(0, 1fr))`,
            }}
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
                  style={{
                    gridColumn: `span ${key.width ?? 1} / span ${
                      key.width ?? 1
                    }`,
                  }}
                  className={cn(
                    // Numeric mode specific sizing
                    mode === "numeric" &&
                      cn(
                        "min-h-[42px] text-base",
                        "md:min-h-[46px] md:text-lg",
                        "lg:min-h-[50px] lg:text-lg",
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
