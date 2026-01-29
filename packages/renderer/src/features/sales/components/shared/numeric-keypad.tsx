import { cn } from "@/shared/utils/cn";
import { Delete } from "lucide-react";
import React from "react";

/**
 * Numeric keypad for numeric and decimal input (cash, price, quantity, etc.).
 *
 * - Use `layout="numericField"` for a reusable numeric-only grid: 7–9, 4–6, 1–3, 0/00/.
 * - Use `includeClear` / `includeBackspace` with `layout="numericField"` to add those
 *   action keys in the grid so the keypad is self-contained.
 * - Use `keysOverride` (or default layout) for custom layouts (e.g. transaction view
 *   with Checkout/Back to Cart).
 *
 * `onInput(value)` receives: "0"–"9", "00", ".", "Clear", "Backspace", and optionally "Enter".
 */
interface NumericKeypadProps {
  /** Called with the key value: "0"–"9", "00", ".", "Clear", "Backspace", "Enter". */
  onInput: (value: string) => void;
  /** Custom key grid; ignored when layout is "numericField". */
  keysOverride?: (string | React.ReactNode)[][];
  /** Preset layout. "numericField" = digits + decimal; "default" = use keysOverride or default grid. */
  layout?: "default" | "numericField";
  /** When layout is "numericField", add a Clear key in the grid. */
  includeClear?: boolean;
  /** When layout is "numericField", add a Backspace key in the grid (with icon). */
  includeBackspace?: boolean;
}

export function NumericKeypad({
  onInput,
  keysOverride,
  layout = "default",
  includeClear = false,
  includeBackspace = false,
}: NumericKeypadProps) {
  // Color classes matching the main interface (slate/sky)
  const keyBase =
    "min-h-[44px] py-2 sm:py-3 lg:py-4 font-semibold text-sm sm:text-base lg:text-lg rounded transition-colors select-none focus:outline-none touch-manipulation";
  const keyNumber =
    "bg-slate-100 text-slate-700 hover:bg-sky-100 active:bg-sky-200";
  const keyEnter = "bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800";
  const keyClear =
    "bg-slate-200 text-slate-700 hover:bg-slate-300 active:bg-slate-400";
  const keyBackspace =
    "bg-slate-200 text-slate-700 hover:bg-slate-300 active:bg-slate-400";

  // Default layout: conditional button placeholder (overridden by keysOverride in transaction view)
  const conditionalButton = (
    <button
      className={cn("w-full h-full flex-1 ", keyBase, keyEnter)}
      onClick={() => onInput("Conditional")}
      type="button"
    >
      Checkout
    </button>
  );

  // Numeric-field preset: 7,8,9 | 4,5,6 | 1,2,3 | 0,00,. with optional Clear (row1) and Backspace (row2)
  const hasActions = includeClear || includeBackspace;
  const backspaceButton = (
    <button
      key="backspace-btn"
      type="button"
      onClick={() => onInput("Backspace")}
      className={cn(
        "w-full h-full flex items-center justify-center",
        keyBase,
        keyBackspace,
      )}
      tabIndex={0}
      aria-label="Backspace"
      title="Backspace"
    >
      <Delete className="h-5 w-5" />
    </button>
  );

  const numericFieldKeys: (string | React.ReactNode)[][] = hasActions
    ? [
        ["7", "8", "9", includeClear ? "Clear" : ""],
        ["4", "5", "6", includeBackspace ? backspaceButton : ""],
        ["1", "2", "3", ""],
        ["0", "00", ".", ""],
      ]
    : [
        ["7", "8", "9"],
        ["4", "5", "6"],
        ["1", "2", "3"],
        ["0", "00", "."],
      ];

  const keys: (string | React.ReactNode)[][] =
    layout === "numericField"
      ? numericFieldKeys
      : keysOverride
        ? keysOverride.map((row) =>
            row.map((key) => (key === "Back" ? "Backspace" : key)),
          )
        : [
            ["7", "8", "9", "Enter"],
            ["4", "5", "6", "Clear"],
            ["1", "2", "3", conditionalButton],
            ["0", "00"],
          ];

  // Determine the max number of columns in any row
  const colCount = Math.max(...keys.map((row) => row.length));

  // Tailwind needs static classnames; map dynamic column counts safely.
  const gridColsClass =
    colCount <= 2
      ? "grid-cols-2"
      : colCount === 3
        ? "grid-cols-3"
        : "grid-cols-4";

  return (
    <div className={cn("grid mt-2 gap-1.5 sm:gap-2", gridColsClass)}>
      {keys.map((row, rowIdx) =>
        row.map((key, colIdx) => {
          if (!key)
            return (
              <div key={`${rowIdx}-${colIdx}`} className="bg-transparent" />
            );

          // If key is a React element, render as-is
          if (React.isValidElement(key)) {
            return (
              <div
                key={`custom-${rowIdx}-${colIdx}`}
                className="col-span-1 h-full w-full flex items-stretch"
              >
                {key}
              </div>
            );
          }

          const isEnter = key === "Enter";
          const isClear = key === "Clear";
          const isBackspace =
            key === "Backspace" || key === "<-" || key === "←" || key === "⌫";
          let keyClass = keyNumber;
          if (isEnter) keyClass = keyEnter;
          else if (isClear) keyClass = keyClear;
          else if (isBackspace) keyClass = keyBackspace;

          return (
            <button
              key={String(key) + rowIdx + colIdx}
              onClick={() => onInput(key as string)}
              className={cn(keyBase, keyClass)}
              tabIndex={0}
              type="button"
            >
              {key}
            </button>
          );
        }),
      )}
    </div>
  );
}
