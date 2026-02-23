import { Check } from "lucide-react";
import type { UserForLogin } from "@/types/domain";
import { getInitials } from "./utils";

interface UserSelectionGridProps {
  users: UserForLogin[];
  selectedUser: UserForLogin | null;
  onUserSelect: (user: UserForLogin) => void;
}

/**
 * Left-panel vertical list of user cards for the light-themed auth shell.
 * Each card shows avatar initials, name, role, and a check icon when active.
 */
export function UserSelectionGrid({
  users,
  selectedUser,
  onUserSelect,
}: UserSelectionGridProps) {
  if (users.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p
          className="text-sm text-center"
          style={{ color: "#64748b" }}
        >
          No users found.
          <br />
          Please contact administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto">
      {users.map((user, index) => {
        const isActive = selectedUser?.id === user.id;
        const initials = getInitials(user.firstName, user.lastName);
        const color = user.color;

        return (
          <button
            key={user.id}
            onClick={() => onUserSelect(user)}
            className="flex items-center gap-3.5 px-4 py-3 rounded-[14px] cursor-pointer relative overflow-hidden transition-all duration-200 text-left"
            style={{
              border: isActive
                ? "1px solid #5BA4D9"
                : "1px solid rgba(0,0,0,0.08)",
              background: isActive
                ? "rgba(91,164,217,0.1)"
                : "#FFFFFF",
              boxShadow: isActive
                ? "0 0 0 1px rgba(91,164,217,0.25), 0 2px 8px rgba(91,164,217,0.08)"
                : "0 1px 2px rgba(0,0,0,0.04)",
              animationDelay: `${0.4 + index * 0.1}s`,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.transform = "translateX(4px)";
                e.currentTarget.style.borderColor = "rgba(91,164,217,0.4)";
                e.currentTarget.style.background = "rgba(91,164,217,0.06)";
                e.currentTarget.style.boxShadow =
                  "0 2px 8px rgba(0,0,0,0.06)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.transform = "translateX(0)";
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.boxShadow =
                  "0 1px 2px rgba(0,0,0,0.04)";
              }
            }}
          >
            {/* Sky blue gradient overlay on active */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-250"
              style={{
                background:
                  "linear-gradient(90deg, rgba(91,164,217,0.12), transparent)",
                opacity: isActive ? 1 : 0,
              }}
            />

            {/* Avatar */}
            <div
              className="w-[38px] h-[38px] rounded-full flex items-center justify-center shrink-0 relative"
              style={{
                background: `${color}22`,
                border: `1.5px solid ${color}55`,
              }}
            >
              {/* Ring for active state */}
              <div
                className="absolute -inset-0.5 rounded-full transition-all duration-250"
                style={{
                  border: `2px solid ${isActive ? "#5BA4D9" : "transparent"}`,
                }}
              />
              <span
                className="text-xs font-bold relative z-10"
                style={{ color }}
              >
                {initials}
              </span>
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0 relative z-10">
              <div
                className="text-sm font-semibold truncate"
                style={{ color: "#1e293b" }}
              >
                {user.firstName} {user.lastName}
              </div>
              <div
                className="text-[11px] mt-px capitalize"
                style={{ color: "#64748b" }}
              >
                {user.roleName}
              </div>
            </div>

            {/* Check icon */}
            {isActive && (
              <div
                className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 relative z-10"
                style={{ background: "#5BA4D9" }}
              >
                <Check
                  className="w-2.5 h-2.5"
                  style={{ color: "#FFFFFF" }}
                  strokeWidth={3}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
