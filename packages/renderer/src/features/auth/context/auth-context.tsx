import { createContext, useState, useEffect, type ReactNode } from "react";
import type { User, AuthContextType } from "@/types/domain";

import { getLogger } from "@/shared/utils/logger";
import { ForcePinChangeScreen } from "../components/force-pin-change-screen";

const logger = getLogger("auth-context");

/* eslint-disable react-refresh/only-export-components */
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [requiresPinChange, setRequiresPinChange] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Login: Authenticate user and create session
   */
  const login = async (
    username: string,
    pin: string,
    rememberMe: boolean = false
  ): Promise<{ success: boolean; message: string; errors?: string[] }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get terminal ID (use a default or generate one)
      const terminalId = `TERMINAL-${navigator.userAgent.slice(0, 10)}`;
      const ipAddress = "127.0.0.1"; // Could be enhanced to get actual IP

      const response = await window.authAPI.login({
        username,
        pin,
        rememberMe,
        terminalId,
        ipAddress,
      });

      if (response.success && response.user && response.token) {
        // Store token and user in SafeStorage (encrypted)
        await window.authStore.set("token", response.token);
        await window.authStore.set("user", JSON.stringify(response.user));

        // Store shift and clock event data if present
        if (response.shift) {
          await window.authStore.set(
            "activeShift",
            JSON.stringify(response.shift)
          );
        }
        if (response.clockEvent) {
          await window.authStore.set(
            "clockEvent",
            JSON.stringify(response.clockEvent)
          );
        }

        // Update React context state
        setUser(response.user);
        setSessionToken(response.token);
        if (response.user.requiresPinChange) {
            setRequiresPinChange(true);
        } else {
            setRequiresPinChange(false);
        }

        // Clear permission cache
        if (typeof window !== "undefined") {
          const cache = (
            window as typeof window & { permissionCache?: Map<string, unknown> }
          ).permissionCache;
          if (cache && typeof cache.clear === "function") {
            cache.clear();
            logger.info("[Login] Cleared permission cache");
          }
        }

        logger.info(`[Login] User ${response.user.id} logged in successfully`);
        return { success: true, message: response.message };
      } else {
        // Handle specific error codes
        if (response.code === "NO_SCHEDULED_SHIFT") {
          setError(
            "You don't have a scheduled shift at this time. Please contact your manager."
          );
        } else {
          setError(response.message);
        }
        return {
          success: false,
          message: response.message,
          errors: response.errors,
        };
      }
    } catch (error) {
      logger.error("Login error:", error);
      const errorMessage = "Login failed due to network error";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register: Create new user account
   */
  const register = async (userData: {
    email?: string;
    username: string;
    pin: string;
    firstName: string;
    lastName: string;
    businessName: string;
    role: "cashier" | "manager" | "admin";
  }): Promise<{ success: boolean; message: string; errors?: string[] }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.authAPI.register(userData);

      if (response.success && response.user && response.token) {
        // Store token and user in SafeStorage
        await window.authStore.set("token", response.token);
        await window.authStore.set("user", JSON.stringify(response.user));

        // Update React context state
        setUser(response.user);

        logger.info(
          `[Register] User ${response.user.id} registered successfully`
        );
        return { success: true, message: response.message };
      } else {
        setError(response.message);
        return {
          success: false,
          message: response.message,
          errors: response.errors,
        };
      }
    } catch (error) {
      logger.error("Registration error:", error);
      const errorMessage = "Registration failed due to network error";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register Business: Create business owner account
   */
  const registerBusiness = async (userData: {
    email?: string;
    username: string;
    pin: string;
    firstName: string;
    lastName: string;
    businessName: string;
    avatar?: string;
    businessAvatar?: string;
  }): Promise<{ success: boolean; message: string; errors?: string[] }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.authAPI.registerBusiness(userData);

      if (response.success && response.user && response.token) {
        // Store token and user in SafeStorage
        await window.authStore.set("token", response.token);
        await window.authStore.set("user", JSON.stringify(response.user));

        // Store business info if provided
        if (response.business) {
          await window.authStore.set(
            "business",
            JSON.stringify(response.business)
          );
        }

        // Update React context state
        setUser(response.user);

        logger.info(
          `[RegisterBusiness] Business owner ${response.user.id} registered successfully`
        );
        return { success: true, message: response.message };
      } else {
        setError(response.message);
        return {
          success: false,
          message: response.message,
          errors: response.errors,
        };
      }
    } catch (error) {
      logger.error("Business registration error:", error);
      const errorMessage = "Business registration failed due to network error";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create User: Admin creates new staff user
   */
  const createUser = async (userData: {
    businessId: string;
    username: string;
    pin: string;
    email?: string;
    firstName: string;
    lastName: string;
    role: "cashier" | "manager";
    avatar?: string;
    address?: string;
  }): Promise<{ success: boolean; message: string; errors?: string[] }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get session token for authentication
      const sessionToken = await window.authStore.get("token");
      if (!sessionToken) {
        throw new Error("Not authenticated");
      }

      const response = await window.authAPI.createUser(sessionToken, userData);

      if (response.success) {
        return { success: true, message: response.message };
      } else {
        setError(response.message);
        return {
          success: false,
          message: response.message,
          errors: response.errors,
        };
      }
    } catch (error) {
      logger.error("User creation error:", error);
      const errorMessage = "User creation failed due to network error";
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout: End user session
   * Note: Backend automatically handles clock-out if user has active shift
   */
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await window.authStore.get("token");
      if (token) {
        // Get terminal ID for clock-out tracking
        const terminalId = `TERMINAL-${navigator.userAgent.slice(0, 10)}`;
        const ipAddress = "127.0.0.1";

        await window.authAPI.logout(token, {
          terminalId,
          ipAddress,
        });
      }
    } catch (error) {
      logger.error("Logout error:", error);
    } finally {
      // Clear all auth data from SafeStorage
      try {
        await Promise.all([
          window.authStore.delete("user"),
          window.authStore.delete("token"),
          window.authStore.delete("salesMode"),
          window.authStore.delete("requiresShift"),
          window.authStore.delete("clockEvent"),
          window.authStore.delete("activeShift"),
        ]);
      } catch (clearError) {
        logger.error("Failed to clear SafeStorage:", clearError);
      }

      // Clear permission cache
      if (typeof window !== "undefined") {
        const cache = (
          window as typeof window & { permissionCache?: Map<string, unknown> }
        ).permissionCache;
        if (cache && typeof cache.clear === "function") {
          cache.clear();
        }
      }

      // Clear React context state
      setUser(null);
      setIsLoading(false);

      logger.info("[Logout] User logged out successfully");
    }
  };

  /**
   * Validate session on app start
   */
  useEffect(() => {
    const validateSession = async () => {
      setIsInitializing(true);

      try {
        const token = await window.authStore.get("token");
        const storedUser = await window.authStore.get("user");

        if (token && storedUser) {
          // Basic token format validation
          if (typeof token !== "string" || token.length < 10) {
            logger.warn("Invalid token format, clearing session");
            await Promise.all([
              window.authStore.delete("user"),
              window.authStore.delete("token"),
            ]);
            setIsInitializing(false);
            return;
          }

          // Validate session with backend
          const response = await window.authAPI.validateSession(token);

          if (response.success && response.user) {
            // Session is valid - update React context
            setUser(response.user);
            setSessionToken(token); // Restore session token
            if (response.user.requiresPinChange) {
                setRequiresPinChange(true);
            } else {
                setRequiresPinChange(false);
            }
            logger.info(
              `[ValidateSession] Session validated for user ${response.user.id}`
            );
          } else {
            // Session is invalid - clear stored data
            logger.warn("Session validation failed:", response.message);
            await Promise.all([
              window.authStore.delete("user"),
              window.authStore.delete("token"),
            ]);
            setSessionToken(null); 
            setRequiresPinChange(false);
          }
        } else {
          logger.debug("[ValidateSession] No stored session found");
        }
      } catch (error) {
        logger.error("Session validation error:", error);
        // Clear stored data on error
        await Promise.all([
          window.authStore.delete("user"),
          window.authStore.delete("token"),
        ]);
        setSessionToken(null);
        setRequiresPinChange(false);
      } finally {
        setIsInitializing(false);
      }
    };

    validateSession();
  }, []); // Run only on mount

  /**
   * Clock In: Start time tracking shift
   */
  const clockIn = async (
    userId: string,
    businessId: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const terminalId = `TERMINAL-${navigator.userAgent.slice(0, 10)}`;
      const ipAddress = "127.0.0.1";

      const response = await window.timeTrackingAPI.clockIn({
        userId,
        terminalId,
        businessId,
        ipAddress,
      });

      if (response.success) {
        if (response.shift) {
          await window.authStore.set(
            "activeShift",
            JSON.stringify(response.shift)
          );
        }
        return { success: true, message: "Clocked in successfully" };
      }

      return {
        success: false,
        message: response.message || "Failed to clock in",
      };
    } catch (error) {
      logger.error("Clock-in error:", error);
      return { success: false, message: "Failed to clock in" };
    }
  };

  /**
   * Clock Out: End time tracking shift
   */
  const clockOut = async (
    userId: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const terminalId = `TERMINAL-${navigator.userAgent.slice(0, 10)}`;
      const ipAddress = "127.0.0.1";

      const response = await window.timeTrackingAPI.clockOut({
        userId,
        terminalId,
        ipAddress,
      });

      if (response.success) {
        await window.authStore.delete("activeShift");
        await window.authStore.delete("clockEvent");
        return { success: true, message: "Clocked out successfully" };
      }

      return {
        success: false,
        message: response.message || "Failed to clock out",
      };
    } catch (error) {
      logger.error("Clock-out error:", error);
      return { success: false, message: "Failed to clock out" };
    }
  };

  /**
   * Get Active Shift: Check if user has active time tracking shift
   */
  const getActiveShift = async (userId: string): Promise<unknown> => {
    try {
      const response = await window.timeTrackingAPI.getActiveShift(userId);
      return response.shift || null;
    } catch (error) {
      logger.error("Get active shift error:", error);
      return null;
    }
  };

  /**
   * Complete forced PIN change
   */
  const completeForceChangePIN = async (
    newPin: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
        if (!sessionToken) throw new Error("No session");
        
        const result = await window.authAPI.setNewPin(sessionToken, newPin);
        
        if (result.success) {
            setRequiresPinChange(false);
            
            // Also update the stored user object locally as requiresPinChange is now false
            if (user) {
                const updatedUser = { ...user, requiresPinChange: false };
                setUser(updatedUser);
                await window.authStore.set("user", JSON.stringify(updatedUser));
            }
        }
        return result;
    } catch (error) {
        logger.error("Failed to complete forced PIN change", error);
        return { success: false, message: "Failed to update PIN" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        requiresPinChange,
        completeForceChangePIN,
        login,
        register,
        registerBusiness,
        createUser,
        logout,
        clockIn,
        clockOut,
        getActiveShift,
        isLoading,
        error,
        isInitializing,
      }}
    >
      {requiresPinChange && user ? (
        <ForcePinChangeScreen onComplete={() => setRequiresPinChange(false)} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
