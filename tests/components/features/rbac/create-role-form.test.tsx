import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, userEvent, waitFor } from "../../../utils/render-helpers";
import { CreateRoleForm } from "@/features/rbac/components/forms/create-role-form";

vi.mock("@app/shared/constants/permissions", () => ({
  getAllAvailablePermissions: () => ["manage:users", "read:products", "write:products"],
}));

vi.mock("@/shared/hooks", () => ({
  useKeyboardWithRHF: (opts: { watch: () => any }) => ({
    formValues: opts.watch(),
    activeField: null,
    showKeyboard: false,
    handleFieldFocus: () => {},
    handleCloseKeyboard: () => {},
    handleInput: () => {},
    handleBackspace: () => {},
    handleClear: () => {},
    activeFieldConfig: {},
  }),
}));

vi.mock("@/features/adaptive-keyboard/adaptive-form-field", () => ({
  AdaptiveFormField: (props: any) => {
    const { readOnly, ...rest } = props;
    return <input {...rest} data-testid={props["data-testid"] || "adaptive-field"} />;
  },
}));

vi.mock("@/features/adaptive-keyboard/adaptive-keyboard", () => ({
  AdaptiveKeyboard: () => null,
}));

describe("CreateRoleForm", () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    onSubmit.mockReset();
    onCancel.mockReset();
  });

  it("renders all form fields", () => {
    render(
      <CreateRoleForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={false}
      />
    );
    expect(screen.getByPlaceholderText(/inventory_specialist/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Inventory Specialist/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/describe the purpose/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search permissions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create role/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("submit button is disabled when no permissions selected", () => {
    render(
      <CreateRoleForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={false}
      />
    );
    expect(screen.getByRole("button", { name: /create role/i })).toBeDisabled();
  });

  it("permission search filters the list", async () => {
    const user = userEvent.setup();
    render(
      <CreateRoleForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={false}
      />
    );
    const searchInput = screen.getByPlaceholderText(/search permissions/i);
    await user.type(searchInput, "manage");
    expect(screen.getByText("manage:users")).toBeInTheDocument();
    expect(screen.queryByText("read:products")).not.toBeInTheDocument();
  });

  it("toggling permission adds and removes from selection", async () => {
    const user = userEvent.setup();
    render(
      <CreateRoleForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={false}
      />
    );
    const permissionLabels = screen.getAllByText("manage:users");
    await user.click(permissionLabels[0]);
    expect(screen.getAllByText("manage:users").length).toBeGreaterThanOrEqual(2);
    await user.click(permissionLabels[0]);
    expect(screen.getAllByText("manage:users")).toHaveLength(1);
  });

  it("selected permissions shown as badges", async () => {
    const user = userEvent.setup();
    render(
      <CreateRoleForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={false}
      />
    );
    await user.click(screen.getByText("manage:users"));
    const badges = screen.getAllByText("manage:users");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows validation error for invalid name format", async () => {
    const user = userEvent.setup();
    render(
      <CreateRoleForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={false}
      />
    );
    const nameInput = screen.getByPlaceholderText(/e.g., inventory_specialist/i);
    await user.type(nameInput, "Invalid Name");
    await user.tab();
    expect(screen.getAllByText(/lowercase with underscores only/i).length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSubmit with correct data on valid submission", async () => {
    const user = userEvent.setup();
    onSubmit.mockResolvedValue(undefined);
    render(
      <CreateRoleForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={false}
      />
    );
    await user.type(
      screen.getByPlaceholderText(/e.g., inventory_specialist/i),
      "test_role"
    );
    await user.type(
      screen.getByPlaceholderText(/e.g., Inventory Specialist/i),
      "Test Role"
    );
    await user.click(screen.getAllByText("manage:users")[0]);
    await user.click(screen.getByRole("button", { name: /create role/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test_role",
          displayName: "Test Role",
          permissions: ["manage:users"],
        })
      );
    });
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    render(
      <CreateRoleForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={false}
      />
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
