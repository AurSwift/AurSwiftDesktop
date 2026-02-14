import { useState } from "react";
import { toast } from "sonner";
import type { UserUpdateFormData } from "../schemas/user-schema";
import type { GetRolesAPIResponse, RawRoleData } from "../schemas/api-types";
import { useAuth } from "@/shared/hooks";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-update-user");

export function useUpdateUser() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const updateStaffUser = async (data: UserUpdateFormData) => {
    setIsLoading(true);

    try {
      // Get session token for authentication
      const sessionToken = await window.authStore.get("token");
      if (!sessionToken) {
        throw new Error("Not authenticated");
      }

      if (!user?.businessId) {
        throw new Error("Business ID not found");
      }

      // Convert role name to roleId and update primary role
      let roleId: string | null = null;
      if (data.role) {
        // Get all roles for the business
        const rolesResponse = (await window.rbacAPI.roles.list(
          sessionToken,
          user.businessId,
        )) as GetRolesAPIResponse;

        if (rolesResponse.success && Array.isArray(rolesResponse.data)) {
          const role = rolesResponse.data.find(
            (r: RawRoleData) => r.name === data.role,
          );
          if (role) {
            roleId = role.id;
            logger.info(`Found roleId ${roleId} for role name ${data.role}`);
          } else {
            logger.warn(
              `Role ${data.role} not found for business ${user.businessId}`,
            );
          }
        }

        // Update primary role if roleId was found
        if (roleId) {
          const primaryRoleResponse =
            await window.rbacAPI.userRoles.setPrimaryRole(
              sessionToken,
              data.id,
              roleId,
            );

          if (!primaryRoleResponse.success) {
            logger.error(
              "Failed to update primary role:",
              primaryRoleResponse.message,
            );
            // Continue with other updates even if role update fails
          } else {
            logger.info("Primary role updated successfully");
          }

          // Ensure the role is assigned to the user
          const assignResponse = await window.rbacAPI.userRoles.assign(
            sessionToken,
            data.id,
            roleId,
          );

          if (!assignResponse.success) {
            logger.warn("Role assignment response:", assignResponse.message);
            // This might fail if role is already assigned, which is fine
          }
        }
      }

      // Update other user fields (excluding role since it's handled above)
      const updates: Record<string, string | number | boolean> = {
        firstName: data.firstName,
        lastName: data.lastName,
        isActive: data.isActive,
        address: data.address || "",
      };

      // Include avatar if it has a value
      if (data.avatar && data.avatar.trim() !== "") {
        updates.avatar = data.avatar;
      }

      const response = await window.authAPI.updateUser(
        sessionToken,
        data.id,
        updates,
      );

      if (response.success) {
        toast.success("Staff member updated successfully");
        return { success: true };
      } else {
        toast.error(response.message || "Failed to update staff member");
        return {
          success: false,
          errors: [response.message || "Update failed"],
        };
      }
    } catch (error) {
      logger.error("Error updating user:", error);
      toast.error("Failed to update staff member");
      return {
        success: false,
        errors: ["An unexpected error occurred"],
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateStaffUser,
    isLoading,
  };
}
