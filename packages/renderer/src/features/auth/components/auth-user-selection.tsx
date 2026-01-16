import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/shared/hooks";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { UserSelectionGrid } from "@/features/auth/components/user-selection-grid";
import { PinEntryScreen } from "@/features/auth/components/pin-entry-screen";
import { getUserColor } from "@/features/auth/components/utils";
import type { UserForLogin } from "@/types/domain";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("auth-user-selection");

export function AuthUserSelection() {
  const [users, setUsers] = useState<UserForLogin[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserForLogin | null>(null);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const { login, isLoading } = useAuth();

  // Load users (server-side pattern like categories in product management)
  const loadUsers = useCallback(async () => {
    try {
      const response = await window.authAPI.getAllActiveUsers();
      if (response.success && response.users) {
        // Map users and assign colors
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

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handleDeletePin = () => {
    setPin(pin.slice(0, -1));
  };

  const handleBack = () => {
    setSelectedUser(null);
    setPin("");
    setLoginError("");
  };

  // Auto-submit when PIN is complete
  useEffect(() => {
    const handleLogin = async () => {
      if (!selectedUser || pin.length !== 4) return;

      setLoginError("");
      const result = await login(selectedUser.username, pin, false);
      if (!result.success) {
        setLoginError(result.message);
        setPin("");
      }
    };

    if (pin.length === 4 && selectedUser) {
      handleLogin();
    }
  }, [pin, selectedUser, login]);

  return (
    <div className="w-full flex items-center justify-center lg:w-auto">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto">
        {!selectedUser ? (
          <UserSelectionGrid users={users} onUserSelect={setSelectedUser} />
        ) : (
          <PinEntryScreen
            user={selectedUser}
            pin={pin}
            loginError={loginError}
            isLoading={isLoading}
            onPinInput={handlePinInput}
            onDeletePin={handleDeletePin}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
