import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { AssignRoleDialog } from "@/features/rbac/components/assign-role-dialog";
import { createMockRole } from "../../../utils/fixtures/rbac.fixture";

const mockUsers = [
  { id: "user-1", firstName: "John", lastName: "Doe", username: "johnd" },
  { id: "user-2", firstName: "Jane", lastName: "Smith" },
];

const mockRoles = [
  createMockRole({ id: "role-1", displayName: "Manager" }),
  createMockRole({ id: "role-2", displayName: "Cashier" }),
];

describe("AssignRoleDialog", () => {
  it("renders dialog with user and role selects", () => {
    render(
      <AssignRoleDialog
        users={mockUsers}
        roles={mockRoles}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText("Assign Role to User")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /user/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /role/i })).toBeInTheDocument();
  });

  it("disables Assign button until user and role selected", () => {
    render(
      <AssignRoleDialog
        users={mockUsers}
        roles={mockRoles}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /assign role/i })).toBeDisabled();
  });

  it("preselectedUserId disables user select", () => {
    render(
      <AssignRoleDialog
        users={mockUsers}
        roles={mockRoles}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        preselectedUserId="user-1"
      />
    );
    const userCombobox = screen.getByRole("combobox", { name: /user/i });
    expect(userCombobox).toBeDisabled();
  });

  it("calls onOpenChange when Cancel clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <AssignRoleDialog
        users={mockUsers}
        roles={mockRoles}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
