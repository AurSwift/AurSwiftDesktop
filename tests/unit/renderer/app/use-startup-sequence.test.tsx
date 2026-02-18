import { StrictMode, type ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  STARTUP_HARD_TIMEOUT_MS,
  STARTUP_MIN_VISIBLE_MS,
  UPDATE_SOFT_TIMEOUT_MS,
} from "@/app/startup/startup.constants";
import {
  __resetStartupSequenceForTests,
  useStartupSequence,
} from "@/app/startup/use-startup-sequence";
import type { StartupWarningCode } from "@/app/startup/startup.types";

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useStartupSequence", () => {
  beforeEach(() => {
    __resetStartupSequenceForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    __resetStartupSequenceForTests();
  });

  it("completes when auth/license are ready and update check succeeds", async () => {
    const runUpdateCheck = vi
      .fn<() => Promise<StartupWarningCode | null>>()
      .mockResolvedValue(null);

    const { result, rerender } = renderHook(
      ({ licenseLoading, authInitializing }) =>
        useStartupSequence({
          licenseLoading,
          authInitializing,
          runUpdateCheck,
        }),
      {
        initialProps: {
          licenseLoading: true,
          authInitializing: true,
        },
      },
    );

    await flushMicrotasks();
    expect(runUpdateCheck).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("starting-services");

    rerender({ licenseLoading: false, authInitializing: true });
    await flushMicrotasks();
    expect(result.current.phase).toBe("restoring-session");

    rerender({ licenseLoading: false, authInitializing: false });
    await flushMicrotasks();
    expect(result.current.phase).toBe("finalizing");

    act(() => {
      vi.advanceTimersByTime(STARTUP_MIN_VISIBLE_MS);
    });
    await flushMicrotasks();

    expect(result.current.phase).toBe("complete");
    expect(result.current.isBlocking).toBe(false);
    expect(result.current.warning).toBeNull();
  });

  it("continues after update timeout with warning", async () => {
    const runUpdateCheck = vi
      .fn<() => Promise<StartupWarningCode | null>>()
      .mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useStartupSequence({
        licenseLoading: false,
        authInitializing: false,
        runUpdateCheck,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(UPDATE_SOFT_TIMEOUT_MS + 1);
    });
    await flushMicrotasks();

    expect(result.current.warning).toBe("update-timeout");
    expect(result.current.phase).toBe("complete");
    expect(result.current.isBlocking).toBe(false);
  });

  it("continues after update failure with warning", async () => {
    const runUpdateCheck = vi
      .fn<() => Promise<StartupWarningCode | null>>()
      .mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() =>
      useStartupSequence({
        licenseLoading: false,
        authInitializing: false,
        runUpdateCheck,
      }),
    );

    await flushMicrotasks();
    expect(result.current.warning).toBe("update-failed");
    expect(result.current.phase).toBe("finalizing");

    act(() => {
      vi.advanceTimersByTime(STARTUP_MIN_VISIBLE_MS);
    });
    await flushMicrotasks();

    expect(result.current.phase).toBe("complete");
    expect(result.current.isBlocking).toBe(false);
  });

  it("respects minimum visible startup duration", async () => {
    const runUpdateCheck = vi
      .fn<() => Promise<StartupWarningCode | null>>()
      .mockResolvedValue(null);

    const { result } = renderHook(() =>
      useStartupSequence({
        licenseLoading: false,
        authInitializing: false,
        runUpdateCheck,
      }),
    );

    await flushMicrotasks();
    expect(result.current.phase).toBe("finalizing");

    act(() => {
      vi.advanceTimersByTime(STARTUP_MIN_VISIBLE_MS - 1);
    });
    await flushMicrotasks();
    expect(result.current.phase).toBe("finalizing");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    await flushMicrotasks();
    expect(result.current.phase).toBe("complete");
  });

  it("exits on hard-timeout if dependencies remain stuck", async () => {
    const runUpdateCheck = vi
      .fn<() => Promise<StartupWarningCode | null>>()
      .mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useStartupSequence({
        licenseLoading: true,
        authInitializing: true,
        runUpdateCheck,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(STARTUP_HARD_TIMEOUT_MS + 1);
    });
    await flushMicrotasks();

    expect(result.current.phase).toBe("complete");
    expect(result.current.isBlocking).toBe(false);
  });

  it("runs update check once in strict-mode-like double effects", async () => {
    const runUpdateCheck = vi
      .fn<() => Promise<StartupWarningCode | null>>()
      .mockResolvedValue(null);

    const StrictModeWrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    renderHook(
      () =>
        useStartupSequence({
          licenseLoading: true,
          authInitializing: true,
          runUpdateCheck,
        }),
      { wrapper: StrictModeWrapper },
    );

    await flushMicrotasks();
    expect(runUpdateCheck).toHaveBeenCalledTimes(1);
  });
});
