## Findings & issues (breaks + till lock)

This file captures current behavior I observed in code and potential issues / mismatches to be aware of.

## Till lock break type can include policy codes that the DB does not support

- **Where**: `desktop/packages/renderer/src/features/sales/components/lock-till-break-dialog.tsx`
- **What**: the dialog explicitly allows `tea` as a possible break code when starting a break (via `apiBreakType` logic).
- **Why it’s a problem**:
  - DB schema for `breaks.type` only supports **`meal | rest | other`**.
  - `TimeTrackingManager.startBreak(...)` persists `breakRecord.type = data.type || "rest"`.
  - If `data.type` is `"tea"`, it will attempt to store `"tea"` in `breaks.type`, which is outside the schema enum.
- **Impact**: starting a “Tea Break” from the till-lock dialog can fail at runtime (or create inconsistent data if constraints aren’t enforced as expected).
- **Suggested fix**: map any policy code that isn’t `meal/rest/other` to `other` (or expand `breaks.type` to include more codes, and propagate that through types + UI labels).

## Till lock only starts a break if policy options were fetched

- **Where**: `desktop/packages/renderer/src/features/sales/components/lock-till-break-dialog.tsx`
- **What**: it starts a break only when `availableBreaks.length > 0 && selectedBreak`.
  - If the policy API isn’t available, fetch fails, or returns empty, it will still lock the till but **won’t record a break**.
- **Impact**: “Locking the till = taking a break” isn’t guaranteed unless break policies are reachable and return options.
- **Suggested fix**: on lock, fall back to starting a default break (e.g. `rest`) even when policy options are unavailable, or show a blocking prompt instead of proceeding without recording a break.

## Dashboard break UI is static; policy system is dynamic

- **Where**: `desktop/packages/renderer/src/features/dashboard/components/break-controls.tsx`
- **What**: break controls offer only `meal/rest/other` and hard-code paid/unpaid defaults.
- **Impact**: businesses can configure richer policies (including `tea`, different durations, paid rules, etc.), but the dashboard UI doesn’t reflect those options.
- **Suggested fix**: drive dashboard break options from `window.breakPolicyAPI.getAvailableBreaks(...)` similar to the till-lock dialog (and ensure the DB supports the chosen codes).

## Minimum duration warnings in UI are hard-coded (may disagree with policy)

- **Where**: `desktop/packages/renderer/src/features/dashboard/components/break-status-indicator.tsx`
- **What**: minimums are hard-coded (meal = 30 min, rest = 10 min).
- **Why it matters**: the backend can compute `minimum_duration_seconds` and policy-specific durations; UI may show the wrong minimum guidance.
- **Suggested fix**: return backend-computed minimum duration in `getActiveShift` / active break payload and use that in the UI.

## Admin break policy system and runtime break storage are partially misaligned

- **Observation**: policy break types are open-ended (`break_type_definitions.code` can be anything), but actual `breaks.type` is a fixed enum of 3 values.
- **Impact**: you can configure break types in the admin UI that can’t be recorded as breaks unless mapped.
- **Suggested options**:
  - expand `breaks.type` enum to match policy codes, or
  - store policy code separately (e.g. `breaks.policy_break_code`) while keeping the legacy enum, or
  - constrain admin UI to only allow `meal/rest/other`.
