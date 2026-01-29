## Break Policies — how break “rules” are defined

This file documents the **admin-configurable break policy system**: what entities exist, how they’re stored, and how “available breaks” are computed.

## Where break policies are defined (data model)

All of these live in `desktop/packages/main/src/database/schema.ts`:

- **`break_type_definitions`** (`breakTypeDefinitions`)
  - Defines break types available to a business (examples in defaults: `tea`, `meal`, `rest`, `other`).
  - Controls UI display defaults: name, icon, color, durations, paid/unpaid, optional time windows.

- **`break_policies`** (`breakPolicies`)
  - Defines overall policy settings for a business.
  - Key fields: `max_consecutive_hours`, `warn_before_required_minutes`, `auto_enforce_breaks`, etc.

- **`break_policy_rules`** (`breakPolicyRules`)
  - Links policy → break type and adds “entitlement rules” based on shift length:
    - `min_shift_hours`, `max_shift_hours`
    - `allowed_count`
    - `is_mandatory`
    - optional `earliest_after_hours`, `latest_before_end_hours`

## Where break policies are computed / applied

### Main business logic: `BreakPolicyManager`

- File: `desktop/packages/main/src/database/managers/breakPolicyManager.ts`
- Key method: **`getAvailableBreaksForShift(businessId, shiftId, shiftStartTime, shiftEndTime?)`**
  - Loads the active policy (default or any active).
  - **Auto-seeds defaults** if no policy exists for the business (`seedDefaultsForBusiness`).
  - Counts already taken breaks for the shift (by type code).
  - Produces `AvailableBreakOption[]` with:
    - `remainingCount`
    - `isAllowed` + `reason` (time window / earliest-after checks)

### IPC endpoints exposed to renderer

- IPC handlers: `desktop/packages/main/src/ipc/break-policy.handlers.ts`
  - Example channel: `breakPolicy:getAvailableBreaks`

- Preload API wrapper: `desktop/packages/preload/src/api/breakPolicy.ts`
  - Exposes `window.breakPolicyAPI.getAvailableBreaks({ businessId, shiftId, shiftStartTime, shiftEndTime? })`

- Admin UI: `desktop/packages/renderer/src/features/staff/views/break-policy-settings-view.tsx`
  - Lets owners seed defaults, manage break types, manage policy rules/settings.

## Important cross-system constraint (policy codes vs DB break type)

Break policy **type codes** can be any string (defaults include **`tea`**), but the **actual `breaks` table** currently only accepts:

- `meal`
- `rest`
- `other`

If the UI starts a break with a policy code that isn’t one of those three, it can’t be persisted safely unless it is mapped (or the schema is expanded). See `05-findings-and-issues.md`.

