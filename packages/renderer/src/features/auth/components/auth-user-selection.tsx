import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/shared/hooks";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { getAppVersion } from "@/shared/utils/version";
import type { UserForLogin } from "@/types/domain";
import { AuthHeader } from "./auth-header";
import { PinEntryScreen } from "./pin-entry-screen";
import { UserSelectionGrid } from "./user-selection-grid";
import { getUserColor } from "./utils";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("auth-user-selection");

/**
 * Full-screen auth component: split-panel layout with user list (left) and PIN entry (right).
 * Both panels are always visible -- selecting a user highlights them and enables the numpad.
 */
export function AuthUserSelection() {
  const [users, setUsers] = useState<UserForLogin[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserForLogin | null>(null);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const { login, isLoading } = useAuth();
  const loginInFlightRef = useRef(false);

  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  const loadUsers = useCallback(async () => {
    try {
      const response = await window.authAPI.getAllActiveUsers();
      if (response.success && response.users) {
        const cashierCount = { count: 0 };
        const mappedUsers = response.users.map((user: UserForLogin) => {
          const roleName = getUserRoleName(user);
          const color = getUserColor(roleName, cashierCount.count);
          if (roleName === "cashier") {
            cashierCount.count++;
          }
          return {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            roleName: roleName,
            color,
          };
        });
        setUsers(mappedUsers);
      }
    } catch (error) {
      logger.error("Failed to fetch users:", error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleUserSelect = (user: UserForLogin) => {
    setSelectedUser(user);
    setPin("");
    setLoginError("");
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDeletePin = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const attemptLogin = useCallback(async () => {
    if (!selectedUser || pin.length !== 4) return;
    if (isLoading || loginInFlightRef.current) return;

    loginInFlightRef.current = true;
    try {
      setLoginError("");
      const result = await login(selectedUser.username, pin, false);
      if (!result.success) {
        setLoginError(result.message);
        setPin("");
      }
    } finally {
      loginInFlightRef.current = false;
    }
  }, [isLoading, login, pin, selectedUser]);

  useEffect(() => {
    if (pin.length === 4 && selectedUser) {
      void attemptLogin();
    }
  }, [attemptLogin, pin.length, selectedUser]);

  return (
    <div className="relative w-full h-full flex overflow-hidden">
      {/* Top bar */}
      <AuthHeader />

      {/* ── Left Panel: User Selection ── */}
      <div
        className="w-[340px] shrink-0 flex flex-col relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, rgba(91,164,217,0.06) 0%, #FFFFFF 50%)",
          borderRight: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "2px 0 24px rgba(0,0,0,0.04)",
          padding: "40px 32px",
          marginTop: 52,
          height: "calc(100% - 52px)",
        }}
      >
        {/* Sky blue top line accent */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background:
              "linear-gradient(90deg, transparent, #5BA4D9, transparent)",
            opacity: 0.8,
          }}
        />

        {/* Brand */}
        <div className="flex items-center gap-3 mb-10">
          <div
            className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-lg font-bold overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #5BA4D9, #2B6CB0)",
              color: "#FFFFFF",
              boxShadow: "0 4px 16px rgba(91,164,217,0.35)",
            }}
          >
            <img
              src={logoSrc}
              alt="Logo"
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          </div>
          <div className="flex flex-col">
            <span
              className="text-base font-bold tracking-[0.08em]"
              style={{ color: "#2B6CB0" }}
            >
              AURSWIFT
            </span>
            <span
              className="text-[10px] font-normal tracking-[0.2em] uppercase"
              style={{ color: "#64748b" }}
            >
              Point of Sale &middot; v{getAppVersion()}
            </span>
          </div>
        </div>

        {/* Panel label */}
        <div
          className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4"
          style={{ color: "#64748b" }}
        >
          Select Operator
        </div>

        {/* User cards */}
        <UserSelectionGrid
          users={users}
          selectedUser={selectedUser}
          onUserSelect={handleUserSelect}
        />
      </div>

      {/* ── Right Panel: PIN Entry ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{
          background: "#FAFBFD",
          padding: "40px 44px",
          marginTop: 52,
          height: "calc(100% - 52px)",
        }}
      >
        <PinEntryScreen
          user={selectedUser}
          pin={pin}
          loginError={loginError}
          isLoading={isLoading}
          onPinInput={handlePinInput}
          onDeletePin={handleDeletePin}
          onUnlock={attemptLogin}
        />
      </div>
    </div>
  );
}
