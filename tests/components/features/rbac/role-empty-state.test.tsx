import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { RoleEmptyState } from "@/features/rbac/components/role-empty-state";

describe("RoleEmptyState", () => {
  it("renders no roles message when search term is empty", () => {
    render(<RoleEmptyState searchTerm="" onAddRole={vi.fn()} />);
    expect(screen.getByText("No custom roles yet")).toBeInTheDocument();
    expect(
      screen.getByText("Get started by creating your first custom role")
    ).toBeInTheDocument();
  });

  it("renders no results message when search term is present", () => {
    render(<RoleEmptyState searchTerm="foo" onAddRole={vi.fn()} />);
    expect(screen.getByText("No roles found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your search terms")).toBeInTheDocument();
  });

  it("calls onAddRole when Create Role button is clicked", async () => {
    const user = userEvent.setup();
    const onAddRole = vi.fn();
    render(<RoleEmptyState searchTerm="" onAddRole={onAddRole} />);
    await user.click(screen.getByRole("button", { name: /create role/i }));
    expect(onAddRole).toHaveBeenCalled();
  });
});
