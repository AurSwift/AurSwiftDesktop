import { useState, useEffect } from "react";
import { Delete } from "lucide-react";
import type { UserForLogin } from "@/types/domain";

interface PinEntryScreenProps {
  user: UserForLogin | null;
  pin: string;
  loginError: string;
  isLoading: boolean;
  onPinInput: (digit: string) => void;
  onDeletePin: () => void;
  onUnlock: () => void;
}

/**
 * Right-panel PIN entry for the light-themed auth shell.
 * Shows terminal badge, passcode dots, numpad, and Unlock button.
 */
export function PinEntryScreen({
  user,
  pin,
  loginError,
  isLoading,
  onPinInput,
  onDeletePin,
}: PinEntryScreenProps) {
  const [shaking, setShaking] = useState(false);

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const yy = now.getFullYear();

  const numpadDisabled = !user || isLoading;

  useEffect(() => {
    if (loginError) {
      setShaking(true);
      const timer = setTimeout(() => setShaking(false), 400);
      return () => clearTimeout(timer);
    }
  }, [loginError]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-0">
      {/* Terminal badge */}
      <div
        className="font-mono text-[10px] tracking-[0.18em] font-normal rounded-full px-4 py-1.5 mb-8"
        style={{
          color: "#64748b",
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.1)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        TERMINAL <span style={{ color: "#5BA4D9" }}>1</span>
        &nbsp;&middot;&nbsp;
        <span>
          {dd}/{mo}/{yy}
        </span>
      </div>

      {/* Passcode area */}
      <div
        className="w-full mb-7"
        style={{
          animation: shaking ? "shake 0.4s ease" : undefined,
        }}
      >
        <div
          className="text-[10px] font-semibold tracking-[0.2em] uppercase text-center mb-4"
          style={{ color: "#64748b" }}
        >
          Enter Passcode
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-3.5">
          {[0, 1, 2, 3].map((i) => {
            const filled = i < pin.length;
            return (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-full transition-all duration-200"
                style={{
                  border: filled
                    ? "2px solid #5BA4D9"
                    : "2px solid rgba(0,0,0,0.2)",
                  background: filled ? "#5BA4D9" : "transparent",
                  boxShadow: filled ? "0 0 12px rgba(91,164,217,0.4)" : "none",
                  transform: filled ? "scale(1.15)" : "scale(1)",
                }}
              />
            );
          })}
        </div>

        {/* Warning message */}
        <div
          className="text-[11px] text-center mt-2 tracking-wide min-h-[16px]"
          style={{ color: "#dc2626" }}
        >
          {loginError || (!user ? "Please select an operator first." : "")}
        </div>
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2.5 w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <NumpadKey
            key={num}
            value={num.toString()}
            disabled={numpadDisabled || pin.length >= 4}
            onClick={() => onPinInput(num.toString())}
          />
        ))}
        {/* Bottom row: empty, 0, delete */}
        <div className="aspect-square" />
        <NumpadKey
          value="0"
          disabled={numpadDisabled || pin.length >= 4}
          onClick={() => onPinInput("0")}
        />
        <button
          onClick={onDeletePin}
          disabled={numpadDisabled || pin.length === 0}
          className="aspect-square flex items-center justify-center rounded-2xl text-sm cursor-pointer select-none relative overflow-hidden transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            border: "1px solid rgba(220,38,38,0.2)",
            background: "rgba(254,226,226,0.8)",
            color: "#dc2626",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = "rgba(254,202,202,0.9)";
              e.currentTarget.style.borderColor = "rgba(220,38,38,0.35)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(254,226,226,0.8)";
            e.currentTarget.style.borderColor = "rgba(220,38,38,0.2)";
          }}
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/* ── Individual numpad key (light theme) ── */

function NumpadKey({
  value,
  disabled,
  onClick,
}: {
  value: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="aspect-square flex items-center justify-center rounded-2xl text-xl font-medium cursor-pointer select-none relative overflow-hidden transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        border: "1px solid rgba(0,0,0,0.1)",
        background: "#FFFFFF",
        color: "#1e293b",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
      onMouseEnter={(e) => {
        if (!e.currentTarget.disabled) {
          e.currentTarget.style.background = "rgba(91,164,217,0.08)";
          e.currentTarget.style.borderColor = "rgba(91,164,217,0.35)";
          e.currentTarget.style.transform = "scale(1.04)";
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(91,164,217,0.15)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#FFFFFF";
        e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)";
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.95)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1.04)";
      }}
    >
      {/* Sky blue glow overlay on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(91,164,217,0.12), transparent 70%)",
        }}
      />
      <span className="relative z-10">{value}</span>
    </button>
  );
}
