import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { EditRoleDialog } from "@/features/rbac/components/edit-role-dialog";
import { createMockRole } from "../../../utils/fixtures/rbac.fixture";

vi.mock("@app/shared/constants/permissions", () => ({
  getAllAvailablePermissions: () => ["manage:users", "read:products"],
}));

describe("EditRoleDialog", () => {
  it("renders nothing when role is null", () => {
    const { container } = render(
      <EditRoleDialog
        role={null}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("pre-fills form with role data", () => {
    const role = createMockRole({
      name: "store_manager",
      displayName: "Store Manager",
      description: "Manages the store",
    });
    render(
      <EditRoleDialog
        role={role}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("store_manager")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Store Manager")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Manages the store")).toBeInTheDocument();
  });

  it("calls onSubmit with roleId and updated data when form submitted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const role = createMockRole({ id: "role-1", displayName: "Old Name" });
    render(
      <EditRoleDialog
        role={role}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const displayNameInput = screen.getByDisplayValue("Old Name");
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "New Name");
    await user.click(screen.getByRole("button", { name: /update role/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      "role-1",
      expect.objectContaining({
        displayName: "New Name",
      })
    );
  });

  it("shows loading state on submit button", () => {
    const role = createMockRole();
    render(
      <EditRoleDialog
        role={role}
        open={true}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        isLoading={true}
      />
    );
    expect(screen.getByRole("button", { name: /updating/i })).toBeInTheDocument();
  });

  it("calls onOpenChange when Cancel clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const role = createMockRole();
    render(
      <EditRoleDialog
        role={role}
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
