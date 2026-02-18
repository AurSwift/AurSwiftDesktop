import { describe, it, expect } from "vitest";
import { render, screen } from "../../../utils/render-helpers";
import { StartupScreen } from "@/app/startup/startup-screen";
import type { StartupState } from "@/app/startup/startup.types";

function createState(overrides: Partial<StartupState> = {}): StartupState {
  return {
    phase: "starting-services",
    progress: 45,
    isBlocking: true,
    warning: null,
    startedAt: Date.now(),
    completedAt: null,
    ...overrides,
  };
}

describe("StartupScreen", () => {
  it("renders phase label and progress bar values", () => {
    render(<StartupScreen state={createState()} />);

    expect(screen.getByTestId("startup-screen")).toBeInTheDocument();
    expect(screen.getByTestId("startup-phase-label")).toHaveTextContent(
      "Starting AuraSwift...",
    );
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByTestId("startup-progress-fill")).toHaveStyle(
      "transform: scaleX(0.45)",
    );
  });

  it("includes reduced-motion fallback styles", () => {
    render(<StartupScreen state={createState()} />);

    expect(screen.getByTestId("startup-motion-styles")).toHaveTextContent(
      "prefers-reduced-motion: reduce",
    );
  });

  it("provides accessible startup status semantics", () => {
    render(<StartupScreen state={createState({ phase: "restoring-session" })} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-label", "AuraSwift startup in progress");
    expect(screen.getByAltText("AuraSwift logo")).toBeInTheDocument();
  });
});
