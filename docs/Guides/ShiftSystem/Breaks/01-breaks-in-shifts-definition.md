## Breaks in Shifts — what is a “break” in this app?

This file documents how “breaks” are represented in the **desktop** app: data model (DB schema), core invariants, and how breaks relate to shifts.

## Where breaks are defined (data model)

### Core tables

- **`shifts`**: A shift is the top-level “time tracking session” for a user.
  - Defined in `desktop/packages/main/src/database/schema.ts` (`shifts` table).
  - Source of truth for timing is `clock_in_id` / `clock_out_id` (clock events).
  - Has computed fields like `break_duration_seconds` (sum of completed breaks).

- **`breaks`**: A break is a time interval *within* a shift.
  - Defined in `desktop/packages/main/src/database/schema.ts` (`breaks` table).
  - Required fields: `shift_id`, `user_id`, `business_id`, `type`, `start_time`.
  - Key fields:
    - **`type`**: enum in schema is **`"meal" | "rest" | "other"`** (important for UI + policy alignment).
    - **`status`**: enum: `scheduled | active | completed | cancelled | missed`.
    - **`is_paid`**: whether break counts toward paid time (UI labels as Paid/Unpaid).
    - **Compliance flags**:
      - `is_required`, `required_reason`, `minimum_duration_seconds`
      - `is_missed`, `is_short`

### Relationships

- A **break belongs to a shift**: `breaks.shift_id → shifts.id` (cascade delete).
- A shift can have many breaks: `shiftsRelations.breaks: many(breaks)`.

## Important invariants / rules (as implemented)

### Only one active break per shift (enforced)

`TimeTrackingManager.startBreak(...)` checks for an existing active break:

- File: `desktop/packages/main/src/database/managers/timeTrackingManager.ts`
- Rule: if `getActiveBreak(shiftId)` exists, it throws: “There is already an active break for this shift”.

### You cannot complete a shift while a break is active (enforced)

- File: `desktop/packages/main/src/database/managers/timeTrackingManager.ts`
- `completeShift(...)` throws if there is an active break.
- Note: the IPC `clockOut` handler ends any active break automatically before completing the shift (see `03-...` doc).

## Where the “break type” is constrained

### DB schema constraint

The DB schema’s `breaks.type` only allows:

- `meal`
- `rest`
- `other`

This matters because break-policy definitions can include additional codes (e.g. `tea`), but **those cannot be stored in `breaks.type` without a schema change**.

## Files to read first

- **Schema**: `desktop/packages/main/src/database/schema.ts` (`breaks`, `shifts`, `clock_events`)
- **Core logic**: `desktop/packages/main/src/database/managers/timeTrackingManager.ts`
- **IPC adapter**: `desktop/packages/main/src/ipc/time-tracking.handlers.ts`

