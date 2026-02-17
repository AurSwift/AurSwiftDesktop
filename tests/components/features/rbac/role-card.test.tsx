import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { RoleCard } from "@/features/rbac/components/role-card";
import { createMockRole, createSystemRole } from "../../../utils/fixtures/rbac.fixture";

describe("RoleCard", () => {
  it("renders displayName, name, description, permission count, user count", () => {
    const role = createMockRole({
      displayName: "Store Manager",
      name: "store_manager",
      description: "Manages store operations",
      permissions: ["read:products", "write:products"],
    });

    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onViewUsers = vi.fn();

    render(
      <RoleCard
        role={role}
        userCount={3}
        onEdit={onEdit}
        onDelete={onDelete}
        onViewUsers={onViewUsers}
      />
    );

    expect(screen.getByText("Store Manager")).toBeInTheDocument();
    expect(screen.getByText("store_manager")).toBeInTheDocument();
    expect(screen.getByText("Manages store operations")).toBeInTheDocument();
    expect(screen.getByText("Permissions:")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // permission count badge
    expect(screen.getByText("Users with role:")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // user count - there are two "3" if we have 3 users and 2 perms, so we need something more specific. Actually userCount is shown in a Badge next to "Users with role:" - so we have multiple elements with "3". Let me just check "Users with role" is there.
  });

  it("shows System badge for system roles", () => {
    const role = createSystemRole();
    render(
      <RoleCard
        role={role}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onViewUsers={vi.fn()}
      />
    );
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("shows Active badge for active roles", () => {
    const role = createMockRole({ isActive: true });
    render(
      <RoleCard
        role={role}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onViewUsers={vi.fn()}
      />
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Inactive badge for inactive roles", () => {
    const role = createMockRole({ isActive: false });
    render(
      <RoleCard
        role={role}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onViewUsers={vi.fn()}
      />
    );
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("disables Edit button when canEdit is false", () => {
    const role = createMockRole();
    render(
      <RoleCard
        role={role}
        canEdit={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onViewUsers={vi.fn()}
      />
    );
    const editButton = screen.getByTitle("Only administrators can edit roles");
    expect(editButton).toBeDisabled();
  });

  it("disables Delete button for system roles", () => {
    const role = createSystemRole();
    render(
      <RoleCard
        role={role}
        canEdit={true}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onViewUsers={vi.fn()}
      />
    );
    const deleteButton = screen.getByTitle("Cannot delete system roles");
    expect(deleteButton).toBeDisabled();
  });

  it("calls onViewUsers with role when Users button is clicked", async () => {
    const user = userEvent.setup();
    const role = createMockRole({ id: "r1" });
    const onViewUsers = vi.fn();
    render(
      <RoleCard
        role={role}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onViewUsers={onViewUsers}
      />
    );
    await user.click(screen.getByRole("button", { name: /users/i }));
    expect(onViewUsers).toHaveBeenCalledWith(role);
  });

  it("calls onEdit with role when Edit button is clicked and canEdit is true", async () => {
    const user = userEvent.setup();
    const role = createMockRole({ id: "r1" });
    const onEdit = vi.fn();
    render(
      <RoleCard
        role={role}
        canEdit={true}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onViewUsers={vi.fn()}
      />
    );
    await user.click(screen.getByTitle("Edit role"));
    expect(onEdit).toHaveBeenCalledWith(role);
  });

  it("calls onDelete with role when Delete button is clicked for non-system role", async () => {
    const user = userEvent.setup();
    const role = createMockRole({ id: "r1", isSystemRole: false });
    const onDelete = vi.fn();
    render(
      <RoleCard
        role={role}
        canEdit={true}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onViewUsers={vi.fn()}
      />
    );
    await user.click(screen.getByTitle("Delete role"));
    expect(onDelete).toHaveBeenCalledWith(role);
  });
});
