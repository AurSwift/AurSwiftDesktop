import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useUserRoles,
  useAssignRole,
  useRevokeRole,
  useSetPrimaryRole,
} from "@/features/rbac/hooks/useUserRoles";
import { createMockUserRole } from "../../../../../utils/fixtures/rbac.fixture";

describe("useUserRoles", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    vi.mocked((window as any).rbacAPI.userRoles.getUserRoles).mockResolvedValue(
      {
        success: true,
        data: [createMockUserRole({ userId: "user-1", roleId: "role-1" })],
      }
    );
  });

  it("returns empty data when userId is undefined", async () => {
    const { result } = renderHook(() => useUserRoles(undefined));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect((window as any).rbacAPI.userRoles.getUserRoles).not.toHaveBeenCalled();
  });

  it("fetches user roles for given userId", async () => {
    const { result } = renderHook(() => useUserRoles("user-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect((window as any).rbacAPI.userRoles.getUserRoles).toHaveBeenCalledWith(
      "token",
      "user-1"
    );
    expect(result.current.data).toHaveLength(1);
  });

  it("sets error on failure", async () => {
    vi.mocked(
      (window as any).rbacAPI.userRoles.getUserRoles
    ).mockResolvedValue({ success: false, message: "Forbidden" });

    const { result } = renderHook(() => useUserRoles("user-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Forbidden");
  });
});

describe("useAssignRole", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    vi.mocked((window as any).rbacAPI.userRoles.assign).mockResolvedValue({
      success: true,
      data: {},
    });
  });

  it("calls API with userId and roleId", async () => {
    const { result } = renderHook(() => useAssignRole());

    await result.current.mutate({ userId: "user-1", roleId: "role-1" });

    expect((window as any).rbacAPI.userRoles.assign).toHaveBeenCalledWith(
      "token",
      "user-1",
      "role-1"
    );
  });

  it("calls onSuccess on success", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useAssignRole());

    await result.current.mutate(
      { userId: "user-1", roleId: "role-1" },
      { onSuccess }
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it("throws when API fails", async () => {
    vi.mocked((window as any).rbacAPI.userRoles.assign).mockResolvedValue({
      success: false,
      message: "Already assigned",
    });

    const { result } = renderHook(() => useAssignRole());

    await expect(
      result.current.mutate({ userId: "user-1", roleId: "role-1" })
    ).rejects.toThrow();
  });

  it("throws when not authenticated", async () => {
    vi.mocked((window as any).authStore.get).mockResolvedValue(null);
    const { result } = renderHook(() => useAssignRole());

    await expect(
      result.current.mutate({ userId: "user-1", roleId: "role-1" })
    ).rejects.toThrow("Not authenticated");
  });
});

describe("useRevokeRole", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    vi.mocked((window as any).rbacAPI.userRoles.revoke).mockResolvedValue({
      success: true,
      data: {},
    });
  });

  it("calls API with userId and roleId", async () => {
    const { result } = renderHook(() => useRevokeRole());

    await result.current.mutate({ userId: "user-1", roleId: "role-1" });

    expect((window as any).rbacAPI.userRoles.revoke).toHaveBeenCalledWith(
      "token",
      "user-1",
      "role-1"
    );
  });

  it("calls onSuccess on success", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRevokeRole());

    await result.current.mutate(
      { userId: "user-1", roleId: "role-1" },
      { onSuccess }
    );
    expect(onSuccess).toHaveBeenCalled();
  });
});

describe("useSetPrimaryRole", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    vi.mocked(
      (window as any).rbacAPI.userRoles.setPrimaryRole
    ).mockResolvedValue({ success: true, data: {} });
  });

  it("calls API with userId and roleId", async () => {
    const { result } = renderHook(() => useSetPrimaryRole());

    await result.current.mutate({ userId: "user-1", roleId: "role-1" });

    expect(
      (window as any).rbacAPI.userRoles.setPrimaryRole
    ).toHaveBeenCalledWith("token", "user-1", "role-1");
  });

  it("calls onSuccess on success", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSetPrimaryRole());

    await result.current.mutate(
      { userId: "user-1", roleId: "role-1" },
      { onSuccess }
    );
    expect(onSuccess).toHaveBeenCalled();
  });
});
