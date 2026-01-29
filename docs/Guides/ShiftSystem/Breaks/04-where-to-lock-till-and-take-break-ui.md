## Where to lock the till & take a break (UI flow)

This file documents where the till lock feature exists in the UI, how it starts/ends breaks, and which components/files implement it.

## Primary POS entry point (Sales / New Transaction screen)

### Where the button is

- View: `desktop/packages/renderer/src/features/sales/views/new-transaction-view.tsx`
- Component: `QuickActionButtons`
  - File: `desktop/packages/renderer/src/features/sales/components/shared/cart-operation-buttons.tsx`
  - Button label: **“Lock till”** (bottom row)

### What happens when you click “Lock till”

In `new-transaction-view.tsx`:

- Clicking “Lock till” sets `showLockDialog = true`.
- This renders `LockTillBreakDialog`.

## Lock Till & Break dialog

- File: `desktop/packages/renderer/src/features/sales/components/lock-till-break-dialog.tsx`
- Title: **“Lock Till & Take Break”**

Behavior:

- If there is an active shift, it attempts to fetch policy-based break options via:
  - `window.breakPolicyAPI.getAvailableBreaks({ businessId, shiftId, shiftStartTime })`
- When user confirms:
  - It *may* call `window.timeTrackingAPI.startBreak(...)` first (depending on whether break options were loaded).
  - Then it calls the parent `onLockConfirmed()`, which flips `isTillLocked = true`.

## Lock screen overlay (unlock ends break)

- File: `desktop/packages/renderer/src/features/sales/components/lock-screen.tsx`
- Rendered from: `new-transaction-view.tsx` when `isTillLocked === true`.

Behavior:

- Full-screen overlay that blocks the POS.
- Shows:
  - current time
  - “Locked by” user name
  - active break type + live timer (if an `activeBreak` exists)
- Unlock path:
  - verifies PIN for `lockedByUserId` using `window.authAPI.verifyPin(userId, pin)`
  - if a break is active, calls `window.timeTrackingAPI.endBreak(activeBreak.id)`
  - then calls `onUnlock()`, which clears `isTillLocked` and refreshes shift/break state

## Alternative break UI (Dashboard header controls)

Breaks can also be started without locking the till (manager/cashier dashboard area):

- `desktop/packages/renderer/src/features/dashboard/components/break-controls.tsx` (Start break)
- `desktop/packages/renderer/src/features/dashboard/components/break-status-indicator.tsx` (End break)
- Break docs overview: `desktop/packages/renderer/src/features/dashboard/BREAK_MANAGEMENT.md`

