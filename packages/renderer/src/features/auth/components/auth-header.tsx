import { Power } from "lucide-react";
import { useEffect, useState } from "react";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("auth-header");

/**
 * Compact top bar for the auth shell (light theme).
 * Shows clock-in/out button, live clock, and power button.
 */
export function AuthHeader() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hh = String(time.getHours()).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");
  const dd = String(time.getDate()).padStart(2, "0");
  const mo = String(time.getMonth() + 1).padStart(2, "0");
  const yy = time.getFullYear();

  const handleCloseApp = async () => {
    try {
      await window.appAPI.quit();
    } catch (error) {
      logger.error("Failed to close app:", error);
    }
  };

  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-between px-7 z-20"
      style={{
        height: 52,
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
      }}
    >
      <div />

      {/* Center: Live clock */}
      <div
        className="font-mono text-[13px] tracking-wider"
        style={{ color: "#64748b" }}
      >
        <span className="font-medium" style={{ color: "#1e293b" }}>
          {hh}:{mm}
        </span>
        &nbsp;&middot;&nbsp;
        <span>
          {dd}/{mo}/{yy}
        </span>
      </div>

      {/* Right: Power button */}
      <button
        onClick={handleCloseApp}
        className="flex items-center gap-2 px-4 py-1.5 rounded-[10px] text-[11px] font-semibold uppercase tracking-wider cursor-pointer transition-all duration-200"
        style={{
          border: "1px solid rgba(0,0,0,0.1)",
          background: "#FFFFFF",
          color: "#64748b",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(91,164,217,0.5)";
          e.currentTarget.style.color = "#2B6CB0";
          e.currentTarget.style.background = "rgba(91,164,217,0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)";
          e.currentTarget.style.color = "#64748b";
          e.currentTarget.style.background = "#FFFFFF";
        }}
      >
        <Power className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
