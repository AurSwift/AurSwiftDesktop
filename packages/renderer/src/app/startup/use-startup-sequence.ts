import { useEffect, useState } from "react";
import {
  STARTUP_HARD_TIMEOUT_MS,
  STARTUP_MIN_VISIBLE_MS,
  STARTUP_PHASE_PROGRESS,
  UPDATE_SOFT_TIMEOUT_MS,
} from "./startup.constants";
import type {
  StartupState,
  StartupWarningCode,
  UseStartupSequenceOptions,
} from "./startup.types";

const STARTUP_UPDATE_CHECK_PROMISE_KEY =
  "__AURSWIFT_STARTUP_UPDATE_CHECK_PROMISE__" as const;

type StartupGlobal = typeof globalThis & {
  [STARTUP_UPDATE_CHECK_PROMISE_KEY]?: Promise<StartupWarningCode | null>;
};

function getOrCreateUpdateCheckPromise(
  runUpdateCheck: () => Promise<StartupWarningCode | null>,
): Promise<StartupWarningCode | null> {
  const startupGlobal = globalThis as StartupGlobal;

  if (!startupGlobal[STARTUP_UPDATE_CHECK_PROMISE_KEY]) {
    startupGlobal[STARTUP_UPDATE_CHECK_PROMISE_KEY] = Promise.resolve().then(
      runUpdateCheck,
    );
  }

  return startupGlobal[STARTUP_UPDATE_CHECK_PROMISE_KEY];
}

export function __resetStartupSequenceForTests() {
  const startupGlobal = globalThis as StartupGlobal;
  delete startupGlobal[STARTUP_UPDATE_CHECK_PROMISE_KEY];
}

export function useStartupSequence({
  licenseLoading,
  authInitializing,
  runUpdateCheck,
}: UseStartupSequenceOptions): StartupState {
  const [state, setState] = useState<StartupState>(() => {
    const startedAt = Date.now();
    return {
      phase: "checking-updates",
      progress: STARTUP_PHASE_PROGRESS["checking-updates"],
      isBlocking: true,
      warning: null,
      startedAt,
      completedAt: null,
    };
  });
  const [updateGateResolved, setUpdateGateResolved] = useState(false);
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const [hardTimeoutReached, setHardTimeoutReached] = useState(false);
  const [startupWarning, setStartupWarning] = useState<StartupWarningCode | null>(
    null,
  );

  useEffect(() => {
    const elapsed = Date.now() - state.startedAt;
    const remaining = Math.max(0, STARTUP_MIN_VISIBLE_MS - elapsed);
    const minDurationTimer = setTimeout(() => setMinDurationElapsed(true), remaining);

    return () => {
      clearTimeout(minDurationTimer);
    };
  }, [state.startedAt]);

  useEffect(() => {
    const hardTimeoutTimer = setTimeout(
      () => setHardTimeoutReached(true),
      STARTUP_HARD_TIMEOUT_MS,
    );

    return () => {
      clearTimeout(hardTimeoutTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolveUpdateStage() {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<StartupWarningCode>((resolve) => {
        timeoutId = setTimeout(() => resolve("update-timeout"), UPDATE_SOFT_TIMEOUT_MS);
      });

      const updatePromise = getOrCreateUpdateCheckPromise(runUpdateCheck)
        .then((warning) => warning)
        .catch(() => "update-failed" as StartupWarningCode);

      try {
        const warning = await Promise.race([updatePromise, timeoutPromise]);
        if (cancelled) {
          return;
        }

        if (warning) {
          setStartupWarning((existing) => existing ?? warning);
        }

        setUpdateGateResolved(true);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    resolveUpdateStage();

    return () => {
      cancelled = true;
    };
  }, [runUpdateCheck]);

  useEffect(() => {
    setState((prevState) => {
      const warning = startupWarning ?? prevState.warning;
      let phase = prevState.phase;
      let isBlocking = true;
      let completedAt = prevState.completedAt;

      if (hardTimeoutReached) {
        phase = "complete";
        isBlocking = false;
        if (!completedAt) {
          completedAt = Date.now();
        }
      } else if (!updateGateResolved) {
        phase = "checking-updates";
      } else if (licenseLoading) {
        phase = "starting-services";
      } else if (authInitializing) {
        phase = "restoring-session";
      } else if (!minDurationElapsed) {
        phase = "finalizing";
      } else {
        phase = "complete";
        isBlocking = false;
        if (!completedAt) {
          completedAt = Date.now();
        }
      }

      const progress = STARTUP_PHASE_PROGRESS[phase];

      if (
        prevState.phase === phase &&
        prevState.progress === progress &&
        prevState.isBlocking === isBlocking &&
        prevState.warning === warning &&
        prevState.completedAt === completedAt
      ) {
        return prevState;
      }

      return {
        ...prevState,
        phase,
        progress,
        isBlocking,
        warning,
        completedAt,
      };
    });
  }, [
    authInitializing,
    hardTimeoutReached,
    licenseLoading,
    minDurationElapsed,
    startupWarning,
    updateGateResolved,
  ]);

  return state;
}
