import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { DeleteRoleDialog } from "@/features/rbac/components/delete-role-dialog";
import { createMockRole } from "../../../utils/fixtures/rbac.fixture";

describe("DeleteRoleDialog", () => {
  it("renders nothing when role is null", () => {
    const { container } = render(
      <DeleteRoleDialog
        role={null}
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows role displayName in confirmation message", () => {
    const role = createMockRole({ displayName: "Store Manager" });
    render(
      <DeleteRoleDialog
        role={role}
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/Store Manager/)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete the role/)).toBeInTheDocument();
  });

  it("calls onOpenChange when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const role = createMockRole();
    render(
      <DeleteRoleDialog
        role={role}
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onConfirm with roleId when Delete is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const role = createMockRole({ id: "role-123" });
    render(
      <DeleteRoleDialog
        role={role}
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledWith("role-123");
  });

  it("disables buttons when isLoading", () => {
    const role = createMockRole();
    render(
      <DeleteRoleDialog
        role={role}
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isLoading={true}
      />
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    const deleteButton = screen.getByRole("button", { name: /deleting/i });
    expect(deleteButton).toBeDisabled();
  });
});
