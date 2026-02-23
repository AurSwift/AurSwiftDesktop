import { describe, expect, it, vi } from "vitest";
import { Settings, Users } from "lucide-react";
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { BackOfficeSidebar } from "@/features/dashboard/shell/back-office-sidebar";
import type { SidebarGroupConfig } from "@/features/dashboard/shell/sidebar-menu.types";

function createGroups(): SidebarGroupConfig[] {
  return [
    {
      featureId: "user-management",
      category: "management",
      label: "Users",
      icon: Users,
      isActive: false,
      requiresUpgrade: false,
      items: [
        {
          key: "user-management:manage-users",
          featureId: "user-management",
          actionId: "manage-users",
          label: "Manage Users",
          icon: Users,
          state: "enabled",
          isActive: false,
        },
      ],
    },
    {
      featureId: "system-settings",
      category: "settings",
      label: "Settings",
      icon: Settings,
      isActive: false,
      requiresUpgrade: false,
      items: [
        {
          key: "system-settings:general-settings",
          featureId: "system-settings",
          actionId: "general-settings",
          label: "General Settings",
          icon: Settings,
          state: "enabled",
          isActive: false,
        },
      ],
    },
  ];
}

describe("BackOfficeSidebar", () => {
  it("renders category sections and actions in expanded mode", () => {
    const onActionClick = vi.fn();

    render(
      <BackOfficeSidebar
        groups={createGroups()}
        layoutMode="expanded"
        isMobileDrawerOpen={false}
        onMobileDrawerOpenChange={vi.fn()}
        onActionClick={onActionClick}
        onToggleSidebarCollapsed={vi.fn()}
      />,
    );

    expect(screen.getByText("System Settings")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manage Users" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "General Settings" }),
    ).toBeInTheDocument();
  });

  it("renders a dedicated scroll region and separate collapse control", () => {
    render(
      <BackOfficeSidebar
        groups={createGroups()}
        layoutMode="expanded"
        isMobileDrawerOpen={false}
        onMobileDrawerOpenChange={vi.fn()}
        onActionClick={vi.fn()}
        onToggleSidebarCollapsed={vi.fn()}
      />,
    );

    const scrollRegion = screen.getByTestId("sidebar-scroll-region");
    expect(scrollRegion).toBeInTheDocument();
    expect(scrollRegion).toHaveClass("overflow-y-auto");

    const collapseControl = screen.getByTestId("sidebar-collapse-control");
    expect(collapseControl).toBeInTheDocument();
    expect(collapseControl).toContainElement(
      screen.getByRole("button", { name: "Collapse" }),
    );
  });

  it("does not invoke action handler for disabled items", async () => {
    const user = userEvent.setup();
    const onActionClick = vi.fn();
    const groups = createGroups();
    groups[0].items = [
      {
        key: "user-management:disabled-item",
        featureId: "user-management",
        actionId: "disabled-item",
        label: "Disabled Action",
        icon: Users,
        state: "disabled",
        disabledReason: "Not available yet",
        isActive: false,
      },
    ];

    render(
      <BackOfficeSidebar
        groups={groups}
        layoutMode="expanded"
        isMobileDrawerOpen={false}
        onMobileDrawerOpenChange={vi.fn()}
        onActionClick={onActionClick}
        onToggleSidebarCollapsed={vi.fn()}
      />,
    );

    const disabledButton = screen.getByRole("button", {
      name: "Disabled Action",
    });
    expect(disabledButton).toBeDisabled();
    await user.click(disabledButton);
    expect(onActionClick).not.toHaveBeenCalled();
  });

  it("toggles sidebar when icon rail group is clicked", async () => {
    const user = userEvent.setup();
    const onToggleSidebarCollapsed = vi.fn();

    render(
      <BackOfficeSidebar
        groups={createGroups()}
        layoutMode="collapsed"
        isMobileDrawerOpen={false}
        onMobileDrawerOpenChange={vi.fn()}
        onActionClick={vi.fn()}
        onToggleSidebarCollapsed={onToggleSidebarCollapsed}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(onToggleSidebarCollapsed).toHaveBeenCalledOnce();
  });
});
