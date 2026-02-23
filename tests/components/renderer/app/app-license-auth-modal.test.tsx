import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/app/App";

const mockUseAuth = vi.fn();
const mockUseLicenseContext = vi.fn();
const mockUseStartupSequence = vi.fn();

vi.mock("@/shared/hooks", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/app/startup", () => ({
  StartupScreen: () => <div data-testid="startup-screen" />,
  useStartupSequence: () => mockUseStartupSequence(),
}));

vi.mock("@/features/auth", () => ({
  AuthPage: () => <div data-testid="auth-page" />,
  useTestMode: () => ({ testMode: false, setTestMode: vi.fn() }),
}));

vi.mock("@/features/license", () => ({
  useLicenseContext: () => mockUseLicenseContext(),
  LicenseActivationModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="license-activation-modal" /> : null,
}));

vi.mock("@/components", () => ({
  LoadingScreen: () => <div data-testid="loading-screen" />,
  ProtectedRoute: ({ children }: { children: any }) => children,
  PublicRoute: ({ children }: { children: any }) => children,
  RetryableLazyRoute: () => <div data-testid="lazy-route" />,
  RouteErrorBoundary: ({ children }: { children: any }) => children,
}));

vi.mock("@/features/navigation/components/protected-app-shell", () => ({
  ProtectedAppShell: ({ children }: { children: any }) => children,
}));

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

describe("App license activation modal routing", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      isInitializing: false,
    });

    mockUseLicenseContext.mockReturnValue({
      isLoading: false,
      isActivated: false,
      refreshStatus: vi.fn(),
    });

    mockUseStartupSequence.mockReturnValue({
      phase: "complete",
      progress: 100,
      isBlocking: false,
      warning: null,
      startedAt: Date.now(),
      completedAt: Date.now(),
    });
  });

  it("shows auth background with license activation modal when license is inactive", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("auth-page")).toBeInTheDocument();
      expect(screen.getByTestId("license-activation-modal")).toBeInTheDocument();
    });
  });

  it("keeps normal auth routing when license is active", async () => {
    mockUseLicenseContext.mockReturnValue({
      isLoading: false,
      isActivated: true,
      refreshStatus: vi.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("lazy-route")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("license-activation-modal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("auth-page")).not.toBeInTheDocument();
  });
});
