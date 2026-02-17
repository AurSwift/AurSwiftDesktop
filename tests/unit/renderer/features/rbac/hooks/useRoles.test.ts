import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { AuthContext } from "@/features/auth/context/auth-context";
import type { AuthContextType } from "@/types/domain/user";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useUsersByRole,
} from "@/features/rbac/hooks/useRoles";
import { createMockRole } from "../../../../../utils/fixtures/rbac.fixture";

const mockUser = {
  id: "user-1",
  businessId: "business-1",
  primaryRole: { name: "admin" },
};

function createMockAuthValue(user: typeof mockUser | null): AuthContextType {
  const noop = async () => ({ success: false, message: "Not implemented" });
  return {
    user: user as AuthContextType["user"],
    sessionToken: user ? "test-token" : null,
    requiresPinChange: false,
    completeForceChangePIN: noop,
    login: noop,
    register: noop,
    registerBusiness: noop,
    createUser: noop,
    logout: async () => {},
    clockIn: noop,
    clockOut: noop,
    getActiveShift: async () => null,
    isLoading: false,
    error: null,
    isInitializing: false,
  };
}

function createWrapper(authUser: typeof mockUser | null) {
  const value = createMockAuthValue(authUser);
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(AuthContext.Provider, { value }, children);
  };
}

describe("useRoles", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    vi.mocked((window as any).rbacAPI.roles.list).mockResolvedValue({
      success: true,
      data: [createMockRole({ id: "r1", name: "admin" })],
    });
  });

  it("fetches roles for authenticated user businessId", async () => {
    const { result } = renderHook(() => useRoles(), {
      wrapper: createWrapper(mockUser),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect((window as any).rbacAPI.roles.list).toHaveBeenCalledWith(
      "token",
      "business-1"
    );
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].name).toBe("admin");
  });

  it("sets error on API failure", async () => {
    vi.mocked((window as any).rbacAPI.roles.list).mockResolvedValue({
      success: false,
      message: "Forbidden",
    });

    const { result } = renderHook(() => useRoles(), {
      wrapper: createWrapper(mockUser),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Forbidden");
  });

  it("does not fetch when businessId is undefined", async () => {
    const { result } = renderHook(() => useRoles(), {
      wrapper: createWrapper(null),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect((window as any).rbacAPI.roles.list).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });

  it("refetch re-triggers fetch", async () => {
    const { result } = renderHook(() => useRoles(), {
      wrapper: createWrapper(mockUser),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.mocked((window as any).rbacAPI.roles.list).mockResolvedValue({
      success: true,
      data: [createMockRole({ id: "r2" })],
    });

    result.current.refetch();

    await waitFor(() => {
      expect((window as any).rbacAPI.roles.list).toHaveBeenCalledTimes(2);
    });
  });
});

describe("useCreateRole", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    vi.mocked((window as any).rbacAPI.roles.create).mockResolvedValue({
      success: true,
      data: createMockRole({ id: "new-1" }),
    });
  });

  it("calls API with session token and merged data", async () => {
    const { result } = renderHook(() => useCreateRole(), {
      wrapper: createWrapper(mockUser),
    });

    await result.current.mutate({
      name: "custom_role",
      displayName: "Custom Role",
      permissions: ["manage:users"],
    });

    expect((window as any).rbacAPI.roles.create).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        name: "custom_role",
        displayName: "Custom Role",
        permissions: ["manage:users"],
        businessId: "business-1",
        isSystemRole: false,
        isActive: true,
      })
    );
  });

  it("calls onSuccess callback on success", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCreateRole(), {
      wrapper: createWrapper(mockUser),
    });

    await result.current.mutate(
      {
        name: "r",
        displayName: "R",
        permissions: ["p"],
      },
      { onSuccess }
    );

    expect(onSuccess).toHaveBeenCalled();
  });

  it("calls onError and throws when API fails", async () => {
    vi.mocked((window as any).rbacAPI.roles.create).mockResolvedValue({
      success: false,
      message: "Duplicate role",
    });

    const onError = vi.fn();
    const { result } = renderHook(() => useCreateRole(), {
      wrapper: createWrapper(mockUser),
    });

    await expect(
      result.current.mutate(
        {
          name: "r",
          displayName: "R",
          permissions: ["p"],
        },
        { onError }
      )
    ).rejects.toThrow();

    expect(onError).toHaveBeenCalled();
  });

  it("throws when not authenticated", async () => {
    vi.mocked((window as any).authStore.get).mockResolvedValue(null);
    const { result } = renderHook(() => useCreateRole(), {
      wrapper: createWrapper(mockUser),
    });

    await expect(
      result.current.mutate({
        name: "r",
        displayName: "R",
        permissions: ["p"],
      })
    ).rejects.toThrow("Not authenticated");
  });
});

describe("useUpdateRole", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    vi.mocked((window as any).rbacAPI.roles.update).mockResolvedValue({
      success: true,
      data: {},
    });
  });

  it("calls API with roleId and data", async () => {
    const { result } = renderHook(() => useUpdateRole(), {
      wrapper: createWrapper(mockUser),
    });

    await result.current.mutate({
      roleId: "role-1",
      data: { displayName: "Updated Name" },
    });

    expect((window as any).rbacAPI.roles.update).toHaveBeenCalledWith(
      "token",
      "role-1",
      { displayName: "Updated Name" }
    );
  });

  it("calls onSuccess on success", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateRole(), {
      wrapper: createWrapper(mockUser),
    });

    await result.current.mutate(
      { roleId: "r1", data: {} },
      { onSuccess }
    );
    expect(onSuccess).toHaveBeenCalled();
  });
});

describe("useDeleteRole", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    vi.mocked((window as any).rbacAPI.roles.delete).mockResolvedValue({
      success: true,
      data: {},
    });
  });

  it("calls API with roleId", async () => {
    const { result } = renderHook(() => useDeleteRole(), {
      wrapper: createWrapper(mockUser),
    });

    await result.current.mutate("role-1");

    expect((window as any).rbacAPI.roles.delete).toHaveBeenCalledWith(
      "token",
      "role-1"
    );
  });

  it("calls onSuccess on success", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDeleteRole(), {
      wrapper: createWrapper(mockUser),
    });

    await result.current.mutate("role-1", { onSuccess });
    expect(onSuccess).toHaveBeenCalled();
  });
});

describe("useUsersByRole", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    vi.mocked((window as any).rbacAPI.roles.getUsersByRole).mockResolvedValue({
      success: true,
      data: [{ user: { id: "u1" }, userRole: {} }],
    });
  });

  it("returns users when API succeeds", async () => {
    const { result } = renderHook(() => useUsersByRole(), {
      wrapper: createWrapper(mockUser),
    });

    const users = await result.current.getUsersByRole("role-1");

    expect(users).toHaveLength(1);
    expect((window as any).rbacAPI.roles.getUsersByRole).toHaveBeenCalledWith(
      "token",
      "role-1"
    );
  });

  it("returns null and sets error on failure", async () => {
    vi.mocked(
      (window as any).rbacAPI.roles.getUsersByRole
    ).mockResolvedValue({ success: false, message: "Not found" });

    const { result } = renderHook(() => useUsersByRole(), {
      wrapper: createWrapper(mockUser),
    });

    const users = await result.current.getUsersByRole("role-1");

    expect(users).toBeNull();
    await waitFor(() => {
      expect(result.current.error).toBe("Not found");
    });
  });
});
