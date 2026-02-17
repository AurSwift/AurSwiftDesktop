import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { RoleTable } from "@/features/rbac/components/role-table";
import { createMockRoles } from "../../../utils/fixtures/rbac.fixture";

const defaultProps = {
  roles: [] as ReturnType<typeof createMockRoles>,
  roleUserCounts: {} as Record<string, number>,
  isLoading: false,
  searchTerm: "",
  onViewRole: vi.fn(),
  onEditRole: vi.fn(),
  onDeleteRole: vi.fn(),
  onViewUsers: vi.fn(),
  onAddRole: vi.fn(),
  canEdit: true,
};

describe("RoleTable", () => {
  it("renders all role rows when roles provided", () => {
    const roles = createMockRoles(3);
    const roleUserCounts = { [roles[0].id]: 1, [roles[1].id]: 2, [roles[2].id]: 0 };
    render(
      <RoleTable
        {...defaultProps}
        roles={roles}
        roleUserCounts={roleUserCounts}
      />
    );
    expect(screen.getByText("Role 0")).toBeInTheDocument();
    expect(screen.getByText("Role 1")).toBeInTheDocument();
    expect(screen.getByText("Role 2")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<RoleTable {...defaultProps} isLoading={true} />);
    expect(screen.getByText("Loading roles...")).toBeInTheDocument();
  });

  it("shows empty state when no roles", () => {
    const onAddRole = vi.fn();
    render(
      <RoleTable {...defaultProps} roles={[]} onAddRole={onAddRole} />
    );
    expect(screen.getByText("No custom roles yet")).toBeInTheDocument();
    const createButton = screen.getByRole("button", { name: /create role/i });
    expect(createButton).toBeInTheDocument();
  });

  it("shows empty state with search message when searchTerm is set", () => {
    render(
      <RoleTable
        {...defaultProps}
        roles={[]}
        searchTerm="foo"
        onAddRole={vi.fn()}
      />
    );
    expect(screen.getByText("No roles found")).toBeInTheDocument();
  });

  it("displays correct page of roles with internal pagination", () => {
    const roles = createMockRoles(15);
    const roleUserCounts = Object.fromEntries(roles.map((r) => [r.id, 0]));
    render(
      <RoleTable
        {...defaultProps}
        roles={roles}
        roleUserCounts={roleUserCounts}
      />
    );
    // Default page size 10
    expect(screen.getByText("Role 0")).toBeInTheDocument();
    expect(screen.getByText("Role 9")).toBeInTheDocument();
    expect(screen.queryByText("Role 10")).not.toBeInTheDocument();
  });

  it("selection count updates when rows selected", async () => {
    const user = userEvent.setup();
    const roles = createMockRoles(2);
    const roleUserCounts = { [roles[0].id]: 0, [roles[1].id]: 0 };
    render(
      <RoleTable
        {...defaultProps}
        roles={roles}
        roleUserCounts={roleUserCounts}
      />
    );
    expect(screen.getByText("0 of 2 row(s) selected")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // first data row
    expect(screen.getByText("1 of 2 row(s) selected")).toBeInTheDocument();
  });

  it("Export button is disabled when no roles on page", () => {
    render(<RoleTable {...defaultProps} roles={[]} />);
    const exportButton = screen.getByRole("button", { name: /export/i });
    expect(exportButton).toBeDisabled();
  });

  it("calls onAddRole when empty state Create Role is clicked", async () => {
    const user = userEvent.setup();
    const onAddRole = vi.fn();
    render(
      <RoleTable {...defaultProps} roles={[]} onAddRole={onAddRole} />
    );
    await user.click(screen.getByRole("button", { name: /create role/i }));
    expect(onAddRole).toHaveBeenCalled();
  });

  it("calls onResetFilters when Clear filters is clicked and filters active", async () => {
    const user = userEvent.setup();
    const onResetFilters = vi.fn();
    render(
      <RoleTable
        {...defaultProps}
        searchTerm="test"
        onResetFilters={onResetFilters}
        roles={createMockRoles(1)}
        roleUserCounts={{}}
      />
    );
    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("menuitem", { name: /clear filters/i }));
    expect(onResetFilters).toHaveBeenCalled();
  });

  it("respects controlled pagination when provided", () => {
    const roles = createMockRoles(5);
    const roleUserCounts = Object.fromEntries(roles.map((r) => [r.id, 0]));
    const onPageChange = vi.fn();
    render(
      <RoleTable
        {...defaultProps}
        roles={roles}
        roleUserCounts={roleUserCounts}
        pagination={{
          currentPage: 2,
          pageSize: 2,
          onPageChange,
          onPageSizeChange: vi.fn(),
        }}
      />
    );
    // Page 2 with size 2 = roles 2 and 3 (0-indexed)
    expect(screen.getByText("Role 2")).toBeInTheDocument();
    expect(screen.getByText("Role 3")).toBeInTheDocument();
    expect(screen.queryByText("Role 0")).not.toBeInTheDocument();
  });
});
