import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, userEvent, waitFor } from "../../../utils/render-helpers";
import { ViewRoleUsersDialog } from "@/features/rbac/components/view-role-users-dialog";
import { createMockRole } from "../../../utils/fixtures/rbac.fixture";
import * as useRolesModule from "@/features/rbac/hooks/useRoles";

vi.mock("@/features/rbac/hooks/useRoles", () => ({
  useUsersByRole: vi.fn(),
}));

describe("ViewRoleUsersDialog", () => {
  beforeEach(() => {
    vi.mocked(useRolesModule.useUsersByRole).mockReturnValue({
      getUsersByRole: vi.fn().mockResolvedValue([]),
      isLoading: false,
      error: null,
    });
  });

  it("renders nothing when role is null", () => {
    const { container } = render(
      <ViewRoleUsersDialog role={null} open={true} onOpenChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows role displayName in title", () => {
    const role = createMockRole({ displayName: "Store Manager" });
    render(
      <ViewRoleUsersDialog role={role} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText(/Users with Role: Store Manager/)).toBeInTheDocument();
  });

  it("shows loading state when isLoading", () => {
    vi.mocked(useRolesModule.useUsersByRole).mockReturnValue({
      getUsersByRole: vi.fn(),
      isLoading: true,
      error: null,
    });
    const role = createMockRole();
    render(
      <ViewRoleUsersDialog role={role} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText("Loading users...")).toBeInTheDocument();
  });

  it("shows empty state when no users", async () => {
    const role = createMockRole();
    render(
      <ViewRoleUsersDialog role={role} open={true} onOpenChange={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText("No users are assigned to this role.")).toBeInTheDocument();
    });
  });

  it("calls onOpenChange when Close clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const role = createMockRole();
    render(
      <ViewRoleUsersDialog role={role} open={true} onOpenChange={onOpenChange} />
    );
    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    await user.click(closeButtons[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
