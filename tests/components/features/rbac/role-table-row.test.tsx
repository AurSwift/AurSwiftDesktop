import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { RoleTableRow } from "@/features/rbac/components/role-table-row";
import {
  Table,
  TableBody,
} from "@/components/ui/table";
import { createMockRole, createSystemRole } from "../../../utils/fixtures/rbac.fixture";

function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <Table>
      <TableBody>{children}</TableBody>
    </Table>
  );
}

const defaultProps = {
  role: createMockRole(),
  userCount: 0,
  selected: false,
  onToggleSelected: vi.fn(),
  showPermissions: true,
  showCreated: true,
  showStatus: true,
  onView: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onViewUsers: vi.fn(),
  canEdit: true,
};

describe("RoleTableRow", () => {
  it("renders role displayName, user count, and status badge", () => {
    const role = createMockRole({
      displayName: "Store Manager",
      isActive: true,
    });
    render(
      <TableWrapper>
        <RoleTableRow
          {...defaultProps}
          role={role}
          userCount={5}
        />
      </TableWrapper>
    );
    expect(screen.getByText("Store Manager")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("formats createdAt date correctly", () => {
    const role = createMockRole({
      createdAt: new Date("2024-06-15").getTime(),
    });
    render(
      <TableWrapper>
        <RoleTableRow {...defaultProps} role={role} showCreated={true} />
      </TableWrapper>
    );
    expect(screen.getByText("15 Jun 2024")).toBeInTheDocument();
  });

  it("hides permissions column when showPermissions is false", () => {
    const role = createMockRole({ permissions: ["p1", "p2"] });
    render(
      <TableWrapper>
        <RoleTableRow {...defaultProps} role={role} showPermissions={false} />
      </TableWrapper>
    );
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("calls onToggleSelected when checkbox clicked", async () => {
    const user = userEvent.setup();
    const onToggleSelected = vi.fn();
    const role = createMockRole({ id: "r1" });
    render(
      <TableWrapper>
        <RoleTableRow
          {...defaultProps}
          role={role}
          onToggleSelected={onToggleSelected}
        />
      </TableWrapper>
    );
    await user.click(screen.getByRole("checkbox", { name: /select/i }));
    expect(onToggleSelected).toHaveBeenCalledWith("r1");
  });

  it("calls onViewUsers when View Users menu item clicked", async () => {
    const user = userEvent.setup();
    const role = createMockRole({ id: "r1" });
    const onViewUsers = vi.fn();
    render(
      <TableWrapper>
        <RoleTableRow
          {...defaultProps}
          role={role}
          onViewUsers={onViewUsers}
        />
      </TableWrapper>
    );
    await user.click(screen.getByRole("button", { name: /open menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /view users/i }));
    expect(onViewUsers).toHaveBeenCalledWith(role);
  });

  it("disables Delete when role is system role", async () => {
    const user = userEvent.setup();
    const role = createSystemRole();
    render(
      <TableWrapper>
        <RoleTableRow {...defaultProps} role={role} canEdit={true} />
      </TableWrapper>
    );
    await user.click(screen.getByRole("button", { name: /open menu/i }));
    const deleteItem = screen.getByRole("menuitem", { name: /delete role/i });
    expect(deleteItem).toHaveAttribute("aria-disabled", "true");
  });
});
