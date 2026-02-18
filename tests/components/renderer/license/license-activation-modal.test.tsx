import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  userEvent,
  waitFor,
} from "../../../utils/render-helpers";
import { LicenseActivationModal } from "@/features/license";
import { useLicense } from "@/features/license/hooks/use-license";

vi.mock("@/features/license/hooks/use-license", () => ({
  useLicense: vi.fn(),
}));

vi.mock("@/features/adaptive-keyboard/adaptive-keyboard", () => ({
  AdaptiveKeyboard: () => <div data-testid="adaptive-keyboard" />,
}));

const mockUseLicense = vi.mocked(useLicense);

describe("LicenseActivationModal", () => {
  const mockActivate = vi.fn();
  const mockGetMachineInfo = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    mockActivate.mockReset();
    mockGetMachineInfo.mockReset();
    mockClearError.mockReset();

    mockGetMachineInfo.mockResolvedValue({
      hostname: "Terminal-1",
      platform: "linux",
      arch: "x64",
      cpuModel: "Test CPU",
      totalMemoryGB: 8,
      hasNetworkInterface: true,
      fingerprintPreview: "abc123",
    });

    mockUseLicense.mockReturnValue({
      isLoading: false,
      error: null,
      clearError: mockClearError,
      activate: mockActivate,
      getMachineInfo: mockGetMachineInfo,
      getStatus: vi.fn(),
      validate: vi.fn(),
      deactivate: vi.fn(),
      hasFeature: vi.fn(),
      initialize: vi.fn(),
    } as ReturnType<typeof useLicense>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders dark overlay and activation form content", () => {
    render(<LicenseActivationModal open onActivationSuccess={vi.fn()} />);

    expect(screen.getByTestId("license-activation-modal")).toBeInTheDocument();
    expect(screen.getByText("License Activation")).toBeInTheDocument();

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).toBeTruthy();
    expect(overlay?.className).toContain("bg-black/70");
    expect(overlay?.className).toContain("backdrop-blur-[2px]");
  });

  it("blocks close attempts via escape and outside click", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <LicenseActivationModal
        open
        onActivationSuccess={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByLabelText(/license key/i));
    await user.keyboard("{Escape}");

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    if (!overlay) {
      throw new Error("Dialog overlay not rendered");
    }
    await user.click(overlay);

    expect(screen.getByTestId("license-activation-modal")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("invokes activation success callback after successful activation", async () => {
    const user = userEvent.setup();
    const onActivationSuccess = vi.fn();
    mockActivate.mockResolvedValue({ success: true, message: "ok" });

    render(
      <LicenseActivationModal
        open
        onActivationSuccess={onActivationSuccess}
      />,
    );

    await user.type(
      screen.getByLabelText(/license key/i),
      "AUR-BAS-V2-ABCDEFGH-IJKLMNOP",
    );
    await user.click(screen.getByRole("button", { name: /activate license/i }));

    await waitFor(() => {
      expect(mockActivate).toHaveBeenCalledWith(
        "AUR-BAS-V2-ABCDEFGH-IJKLMNOP",
        undefined,
      );
    });
    await waitFor(() => {
      expect(
        screen.getByText(/license activated successfully/i),
      ).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(onActivationSuccess).toHaveBeenCalledTimes(1);
      },
      { timeout: 2500 },
    );
  });

  it("keeps test mode action available", async () => {
    const user = userEvent.setup();
    const onTestMode = vi.fn();

    render(
      <LicenseActivationModal
        open
        onActivationSuccess={vi.fn()}
        onTestMode={onTestMode}
      />,
    );

    await user.click(screen.getByRole("button", { name: /test mode/i }));
    expect(onTestMode).toHaveBeenCalledTimes(1);
  });

  it("exposes a quit action that calls app quit API", async () => {
    const user = userEvent.setup();
    const quit = vi.fn().mockResolvedValue(undefined);
    (window as any).appAPI = { quit };

    render(<LicenseActivationModal open onActivationSuccess={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /quit/i }));
    expect(quit).toHaveBeenCalledTimes(1);
  });
});
