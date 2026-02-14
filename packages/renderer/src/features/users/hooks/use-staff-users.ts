import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { StaffUser } from "../schemas/types";
import type { GetUsersAPIResponse, RawUserData } from "../schemas/api-types";
import { useAuth } from "@/shared/hooks/use-auth";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";

export function useStaffUsers() {
  const { user } = useAuth();
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStaffUsers = async () => {
    if (!user?.businessId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get session token for authentication
      const sessionToken = await window.authStore.get("token");
      if (!sessionToken) {
        throw new Error("Not authenticated");
      }

      const response = (await window.authAPI.getUsersByBusiness(
        sessionToken,
        user.businessId,
      )) as GetUsersAPIResponse;

      if (response.success && response.users) {
        // Filter out admin users and convert to StaffUser format
        const staffUsers: StaffUser[] = response.users
          .filter((u: RawUserData) => getUserRoleName(u) !== "admin")
          .map((u: RawUserData) => ({
            id: u.id,
            username: u.username || "",
            email: u.email || "",
            firstName: u.firstName,
            lastName: u.lastName,
            businessName: u.businessName,
            businessId: u.businessId,
            avatar: u.avatar,
            address: u.address || "",
            createdAt: u.createdAt || new Date().toISOString(),
            isActive: u.isActive !== undefined ? u.isActive : true,
            // RBAC fields
            primaryRoleId: u.primaryRoleId,
            roleName: u.roleName,
            primaryRole: u.primaryRole,
          }));

        setStaffUsers(staffUsers);
      } else {
        const errorMessage = response.message || "Failed to load staff users";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load staff users";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaffUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.businessId]);

  return {
    staffUsers,
    isLoading,
    error,
    refetch: loadStaffUsers,
  };
}
