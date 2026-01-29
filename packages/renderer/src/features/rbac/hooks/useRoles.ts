import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import type { RoleCreateFormData, RoleUpdateFormData } from "../schemas";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("useRoles");

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  permissions: string[];
  businessId: string;
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export function useRoles() {
  const { user } = useAuth();
  const businessId = user?.businessId;
  const [data, setData] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!businessId) return;

    setIsLoading(true);
    setError(null);

    try {
      const sessionToken = await window.authStore.get("token");
      if (!sessionToken) throw new Error("Not authenticated");

      logger.info("[useRoles] Fetching roles for businessId:", businessId);
      const response = await window.rbacAPI.roles.list(
        sessionToken,
        businessId
      );

      logger.info("[useRoles] Response:", response);

      if (!response.success) {
        // If user doesn't exist or session is invalid, force logout
        if (
          (response as any).code === "USER_NOT_FOUND" ||
          (response as any).code === "INVALID_SESSION"
        ) {
          logger.error(
            "[useRoles] User session is invalid - forcing logout..."
          );
          toast.error(
            "Session expired or user not found. Please log in again."
          );
          // Clear stale auth data
          await window.authStore.delete("token");
          await window.authStore.delete("user");
          // Reload to login page
          window.location.reload();
          return;
        }

        throw new Error(response.message || "Failed to fetch roles");
      }

      setData(response.data as Role[]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error(`[useRoles] Error: ${errorMessage}`, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { data, isLoading, error, refetch: fetchRoles };
}

export function useCreateRole() {
  const { user } = useAuth();
  const [isPending, setIsPending] = useState(false);

  const createRole = useCallback(
    async (
      roleData: RoleCreateFormData,
      callbacks?: { onSuccess?: () => void; onError?: (error: unknown) => void }
    ) => {
      setIsPending(true);

      try {
        const sessionToken = await window.authStore.get("token");
        if (!sessionToken) throw new Error("Not authenticated");
        if (!user?.businessId) throw new Error("No business ID");

        const response = await window.rbacAPI.roles.create(sessionToken, {
          ...roleData,
          businessId: user.businessId,
          isSystemRole: false,
          isActive: true,
        });

        if (!response.success) {
          throw new Error(response.message || "Failed to create role");
        }

        toast.success("Role created successfully");
        callbacks?.onSuccess?.();
        return response.data;
      } catch (error: unknown) {
        callbacks?.onError?.(error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast.error("Failed to create role", {
          description: errorMessage,
        });
        throw error;
      } finally {
        setIsPending(false);
      }
    },
    [user?.businessId]
  );

  return { mutate: createRole, isPending };
}

export function useUpdateRole() {
  const [isPending, setIsPending] = useState(false);

  const updateRole = useCallback(
    async (
      { roleId, data }: { roleId: string; data: RoleUpdateFormData },
      callbacks?: { onSuccess?: () => void }
    ) => {
      setIsPending(true);

      try {
        const sessionToken = await window.authStore.get("token");
        if (!sessionToken) throw new Error("Not authenticated");

        const response = await window.rbacAPI.roles.update(
          sessionToken,
          roleId,
          data
        );

        if (!response.success) {
          throw new Error(response.message || "Failed to update role");
        }

        toast.success("Role updated successfully");
        callbacks?.onSuccess?.();
        return response.data;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast.error("Failed to update role", {
          description: errorMessage,
        });
        throw error;
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { mutate: updateRole, isPending };
}

export function useDeleteRole() {
  const [isPending, setIsPending] = useState(false);

  const deleteRole = useCallback(
    async (roleId: string, callbacks?: { onSuccess?: () => void }) => {
      setIsPending(true);

      try {
        const sessionToken = await window.authStore.get("token");
        if (!sessionToken) throw new Error("Not authenticated");

        const response = await window.rbacAPI.roles.delete(
          sessionToken,
          roleId
        );

        if (!response.success) {
          throw new Error(response.message || "Failed to delete role");
        }

        toast.success("Role deleted successfully");
        callbacks?.onSuccess?.();
        return response.data;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast.error("Failed to delete role", {
          description: errorMessage,
        });
        throw error;
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { mutate: deleteRole, isPending };
}

export function useUsersByRole() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUsersByRole = useCallback(
    async (
      roleId: string
    ): Promise<Array<{ user: any; userRole: any }> | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const sessionToken = await window.authStore.get("token");
        if (!sessionToken) throw new Error("Not authenticated");

        const response = await window.rbacAPI.roles.getUsersByRole(
          sessionToken,
          roleId
        );

        if (!response.success) {
          throw new Error(response.message || "Failed to get users with role");
        }

        return response.data as Array<{ user: any; userRole: any }>;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        logger.error(`[useUsersByRole] Error: ${errorMessage}`, err);
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { getUsersByRole, isLoading, error };
}
