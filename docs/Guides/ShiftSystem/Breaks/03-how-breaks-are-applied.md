## How breaks are applied (start/end, compliance, and shift totals)

This file documents the runtime flow: renderer calls → IPC → DB manager, and what “start break” / “end break” actually do.

## Start break flow

### Renderer entry points

Common callers:

- Dashboard “Take Break” UI: `desktop/packages/renderer/src/features/dashboard/components/break-controls.tsx`
- POS “Lock Till & Take Break” dialog: `desktop/packages/renderer/src/features/sales/components/lock-till-break-dialog.tsx`

Both call:

- `window.timeTrackingAPI.startBreak({ shiftId, userId, type, isPaid })`

### IPC adapter

- File: `desktop/packages/main/src/ipc/time-tracking.handlers.ts`
- Handler: `timeTracking:startBreak`
  - Looks up the shift by `shiftId` to derive `businessId`.
  - Calls `db.timeTracking.startBreak({ ...data, businessId: shift.business_id })`.

### DB implementation details

- File: `desktop/packages/main/src/database/managers/timeTrackingManager.ts`
- Method: `startBreak(...)`

Key logic:

- Validates shift exists, belongs to the user, and is `status === "active"`.
- Enforces **only one active break per shift**.
- Loads break-policy options via:
  - `db.breakPolicy.getAvailableBreaksForShift(businessId, shiftId, shiftStartTime)`
  - If the chosen break type matches a policy option:
    - Enforces remaining count (`remainingCount > 0`) and applies the policy’s `is_paid`.
    - Logs warnings if break is outside allowed timing windows (but does not hard-block for “timing”).
- Computes compliance metadata via `BreakComplianceValidator`:
  - Sets `is_required`, `required_reason`, `minimum_duration_seconds`.
- Writes a row to `breaks` with `status: "active"`, `start_time: now`, `end_time: null`, `duration_seconds: null`.

## End break flow

### Renderer entry points

Common callers:

- Dashboard “End Break”: `desktop/packages/renderer/src/features/dashboard/components/break-status-indicator.tsx`
- Till unlock flow: `desktop/packages/renderer/src/features/sales/components/lock-screen.tsx`

Both call:

- `window.timeTrackingAPI.endBreak(breakId)`

### IPC adapter

- File: `desktop/packages/main/src/ipc/time-tracking.handlers.ts`
- Handler: `timeTracking:endBreak`
  - Calls `db.timeTracking.endBreak(breakId)`.

### DB implementation details

- File: `desktop/packages/main/src/database/managers/timeTrackingManager.ts`
- Method: `endBreak(breakId)`

Key logic:

- Validates break exists and is currently `status === "active"`.
- Computes `duration_seconds` from `start_time` to `now`.
- Validates compliance:
  - Uses `BreakComplianceValidator.validateBreakEnd(...)`.
  - Sets `is_short` if break was required and ended before minimum duration.
- Marks break `status: "completed"`, sets `end_time`, `duration_seconds`, and flags (`is_short`).

## Clock-out interaction

- File: `desktop/packages/main/src/ipc/time-tracking.handlers.ts`
- Handler: `timeTracking:clockOut`
  - If there is an active break, it **ends it automatically** before completing the shift.

Important nuance:

- `TimeTrackingManager.completeShift(...)` would otherwise reject shift completion if an active break exists, so the IPC layer proactively ends the break first.

## Compliance logic overview

### Validator

- File: `desktop/packages/main/src/utils/breakComplianceValidator.ts`
- Uses cached policy settings per business (5-minute TTL).
- Checks:
  - Required break conditions (e.g. “meal break required after X hours”).
  - Recommended minimum durations per break type.

### What compliance affects

- Does **not** block starting a break.
- Can mark breaks as required and/or short.
- Logs warnings/violations and writes audit logs (see `timeTrackingManager.ts`).

