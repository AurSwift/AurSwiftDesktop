# Auth & Shift System Analysis

This document provides an in-depth analysis of the Authentication, Time Tracking, and POS Shift Management systems in the Desktop application. It evaluates the architecture, implementation details, and identifies critical issues found during code analysis.

## 1. System Overview

The system uses a unified architecture where Authentication, Time Tracking, and POS Operations are tightly integrated.

-   **Authentication**: PIN-based user login with secure token storage.
-   **Time Tracking**: Records attendance (Clock In / Clock Out) via `clock_events`.
-   **Shifts**: A unified `shifts` table serves as the source of truth for both Time Tracking (attendance hours) and POS Operations (cash drawer, sales).

## 2. Authentication (PIN System)

**Implementation**:
-   **Frontend**: `PinEntryScreen` handles user interaction.
-   **Backend**: `auth:login` IPC handler interacts with `db.users.login`.
-   **Security**: validation of PINs, rate limiting (locking after failed attempts per terminal/user), and token encryption using Electron's `safeStorage`.

**Status**: ✅ **Working Well**
-   The logic handles session creation, token storage, and RBAC permission cache clearing correctly.
-   Rate limiting provides protection against brute-force (or lucky guess) attacks.
-   Public/Private access patterns for user fetching are handled securely.

## 3. Time Tracking (Clock In / Clock Out)

**Implementation**:
-   **Clock In**:
    1.  User verifies identity.
    2.  `timeTracking:clockIn` is called.
    3.  A `clock_events` record (type: 'in') is created.
    4.  **Crucial Step**: A `shifts` record is created (Status: 'active') linked to the `clock_in_id`.
-   **Clock Out**:
    1.  `timeTracking:clockOut` is called.
    2.  Validates the user owns the active shift.
    3.  Creates `clock_events` record (type: 'out').
    4.  Updates the `shifts` record with `clock_out_id`, `total_hours`, etc., and sets Status to 'ended'.

**Status**: ✅ **Working Generally** (See Critical Issue below regarding integration)

## 4. POS Shift Management (Shift Start/End)

**Implementation**:
-   **Shift Start (POS)**:
    -   Intended to "Open" the register for sales.
    -   Requires the user to be Clocked In (active `timeTracking` shift exists).
    -   Takes `starting_cash` and `terminal_id` inputs.
-   **Shift End (POS)**:
    -   "Closes" the register.
    -   Updates sales totals (`total_sales`, etc.) on the shift.
    -   Auto-clocks out the user (Time Tracking) if this is their last/only shift.

## 5. 🚨 CRITICAL BUG: Shift Creation Conflict

**Issue**: The current implementation of "Start Shift" (POS) will fail due to a database constraint violation.

**The Code Path**:
1.  **Clock In**:
    -   Calls `db.timeTracking.createShift(...)`.
    -   Inserts a new row into `shifts` table: `{ id: "SHIFT_A", clock_in_id: "CLOCK_1", status: "active" }`.
2.  **Start POS Shift**:
    -   User clicks "Start Shift".
    -   Logic checks for active time shift -> Finds "SHIFT_A".
    -   Calls `db.shifts.createShift(...)` with `clock_in_id: "CLOCK_1"`.
    -   `createShift` attempts to **INSERT** a new row: `{ id: "SHIFT_B", clock_in_id: "CLOCK_1", starting_cash: 100 }`.

**The Failure**:
-   The `shifts` table schema defines a unique constraint:
    ```typescript
    unique("shifts_clock_in_unique").on(table.clock_in_id)
    ```
-   Since "CLOCK_1" is already used by "SHIFT_A", the attempt to create "SHIFT_B" will trigger a **UNIQUE constraint failed** error.

**Consequence**: Users can Clock In, but they **cannot** Start a POS Shift. The app will throw an error.

## 6. Recommendations & Fixes

### Fix for Shift Creation Conflict
The "Start Shift" logic in the POS context should be interpreted as **"Upgrading"** the existing Time Tracking shift to a POS Shift, rather than creating a new one.

**Steps to Fix**:
1.  **Modify `shift.handlers.ts` (`shift:start`)**:
    -   Instead of calling `db.shifts.createShift`, call a new method `db.shifts.updateShiftToPosMode` (or manual update).
    -   Logic:
        ```typescript
        // Get existing active shift
        const activeTimeShift = db.timeTracking.getActiveShift(shiftData.cashierId);
        if (!activeTimeShift) throw new Error("Must clock in first");

        // Update the existing shift
        db.shifts.update(activeTimeShift.id, {
            starting_cash: shiftData.startingCash,
            terminal_id: shiftData.deviceId,
            notes: shiftData.notes
            // Do NOT create a new record
        });
        ```

### Minor Improvements

1.  **Unified Shift Manager**: The naming confusion between `shiftManager` (POS focus) and `timeTrackingManager` (Time focus) but accessing the *same* `shifts` table is risky. Consider merging logic or clearly documenting that `shifts` table IS the time tracking table.
2.  **Clock Out Logic in Shift End**: `shift:end` logic attempts to find a time shift using `db.timeTracking.getShiftById(shiftId)`. If we implement the fix above (1 shift record), this logic is correct and will work perfectly. If we tried to maintain 2 separate records, this logic would fail. The fix confirms the single-record architecture is the intended design.

## 7. Conclusion

The Auth and Time Tracking systems are solidly built with good security practices. However, the integration point between "Clocking In" and "Starting a POS Shift" is currently broken due to a logic error that violates the database schema. **Implementing the fix to update the existing shift instead of creating a duplicate is critical for system functionality.**
