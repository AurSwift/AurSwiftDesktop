import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, userEvent, waitFor } from "../../../../utils/render-helpers";
import RoleManagementView from "../../../../../packages/renderer/src/features/rbac/views/role-management-view";
import { createMockRoles } from "../../../../utils/fixtures/rbac.fixture";

const adminUser = {
  id: "user-1",
  businessId: "business-1",
  primaryRole: { name: "admin" },
};

vi.mock("@/shared/hooks/use-auth", () => ({
  useAuth: () => ({ user: adminUser }),
}));

describe("RoleManagementView", () => {
  beforeEach(() => {
    vi.mocked((window as any).authStore.get).mockResolvedValue("token");
    const roles = createMockRoles(3);
    vi.mocked((window as any).rbacAPI.roles.list).mockResolvedValue({
      success: true,
      data: roles,
    });
    vi.mocked((window as any).rbacAPI.roles.getUsersByRole).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it("renders and loads roles on mount", async () => {
    render(<RoleManagementView onBack={vi.fn()} />);
    await waitFor(() => {
      expect((window as any).rbacAPI.roles.list).toHaveBeenCalledWith(
        "token",
        "business-1"
      );
    });
    expect(screen.getByText("Role Management")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Role 0")).toBeInTheDocument();
    });
  });

  it("search filters roles", async () => {
    const user = userEvent.setup();
    render(<RoleManagementView onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Role 0")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(
      /search roles by name or description/i
    );
    await user.type(searchInput, "Role 0");
    await waitFor(() => {
      expect(screen.getByText("Role 0")).toBeInTheDocument();
      expect(screen.queryByText("Role 1")).not.toBeInTheDocument();
    });
  });

  it("New button opens create drawer", async () => {
    const user = userEvent.setup();
    render(<RoleManagementView onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Role 0")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /new/i }));
    expect(screen.getByPlaceholderText(/inventory_specialist/i)).toBeInTheDocument();
  });

  it("Back button calls onBack", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<RoleManagementView onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByText("Role 0")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /back to dashboard/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows pagination when many roles", async () => {
    vi.mocked((window as any).rbacAPI.roles.list).mockResolvedValue({
      success: true,
      data: createMockRoles(15),
    });
    render(<RoleManagementView onBack={vi.fn()} />);
    await waitFor(() => {
      expect((window as any).rbacAPI.roles.list).toHaveBeenCalled();
    });
    expect(screen.getByText(/1-/)).toBeInTheDocument();
  });
});
