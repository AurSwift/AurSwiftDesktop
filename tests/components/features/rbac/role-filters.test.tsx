import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { RoleFilters } from "@/features/rbac/components/role-filters";

// Mock AdaptiveKeyboard to avoid complex dependency in tests
vi.mock("@/features/adaptive-keyboard/adaptive-keyboard", () => ({
  AdaptiveKeyboard: () => null,
}));

describe("RoleFilters", () => {
  it("renders search input", () => {
    const onSearchChange = vi.fn();
    render(
      <RoleFilters
        searchTerm=""
        onSearchChange={onSearchChange}
      />
    );
    expect(
      screen.getByPlaceholderText(/search roles by name or description/i)
    ).toBeInTheDocument();
  });

  it("calls onSearchChange when user types", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      <RoleFilters searchTerm="" onSearchChange={onSearchChange} />
    );
    const input = screen.getByPlaceholderText(
      /search roles by name or description/i
    );
    await user.type(input, "admin");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("displays current search term as value", () => {
    render(
      <RoleFilters searchTerm="manager" onSearchChange={vi.fn()} />
    );
    const input = screen.getByPlaceholderText(
      /search roles by name or description/i
    );
    expect(input).toHaveValue("manager");
  });
});
