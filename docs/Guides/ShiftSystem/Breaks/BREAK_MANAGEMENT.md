# Break Management System

## Overview

Industry-standard break management system implemented following labor law compliance best practices. The system allows employees to take breaks during their shift without logging out.

## Components

### 1. **BreakControls** ([break-controls.tsx](./components/break-controls.tsx))

- Modal dialog for starting a break
- Break type selection (Meal, Rest, Other)
- Paid/Unpaid toggle
- Compliance warnings and guidance

### 2. **BreakStatusIndicator** ([break-status-indicator.tsx](./components/break-status-indicator.tsx))

- Real-time break timer
- Shows break type and duration
- "End Break" button
- Minimum duration validation warnings

### 3. **LogoutConfirmationDialog** ([logout-confirmation-dialog.tsx](./components/logout-confirmation-dialog.tsx))

- Prevents accidental shift termination
- Offers two options:
  - "Take a Break" (keeps shift active)
  - "End Shift & Logout" (clocks out)
- Shows current work duration

### 4. **BreakReminder** ([break-reminder.tsx](./components/break-reminder.tsx))

- Automatic popup after 6 hours of work without meal break
- Labor law compliance reminder
- Educational content about meal breaks
- One-click break start

### 5. **useActiveShift Hook** ([hooks/use-active-shift.ts](./hooks/use-active-shift.ts))

- Real-time shift and break status
- Auto-updating timers (work duration, break duration)
- Polling every 30 seconds for changes

## User Flow

### Starting a Break

```
1. User clicks "Take Break" button in header
2. Break type selection modal appears
3. User selects: Rest (10-15min, paid) or Meal (30+min, unpaid)
4. User confirms
5. Break timer starts, "On Break" badge shown
6. Shift remains active
```

### Ending a Break

```
1. User clicks "End Break" in break status indicator
2. Confirmation dialog shows duration and compliance warnings
3. User confirms
4. Break ends, returns to "Clocked In" status
5. Work resumes
```

### Logout with Active Shift

```
1. User clicks logout button
2. Confirmation dialog appears with 2 options:
   - "Take a Break" → Opens break controls
   - "End Shift & Logout" → Clocks out and logs out
3. User chooses appropriate action
```

### 6-Hour Break Reminder

```
1. System monitors work duration
2. After 6 hours without meal break:
   - Modal automatically appears
   - Explains labor law requirement
   - Offers immediate break start
3. User can dismiss or take break
```

## Break Types

| Type      | Duration  | Paid         | Use Case                      |
| --------- | --------- | ------------ | ----------------------------- |
| **Rest**  | 10-15 min | ✅ Yes       | Short break, bathroom, coffee |
| **Meal**  | 30+ min   | ❌ No        | Lunch, dinner                 |
| **Other** | Variable  | Configurable | Custom breaks                 |

## Labor Law Compliance

### Requirements

- **6-hour rule**: Meal break required after 6 hours of continuous work
- **Minimum durations**:
  - Meal breaks: 30 minutes
  - Rest breaks: 10 minutes

### Validation

- ⚠️ Warning if break is shorter than minimum
- 🔴 Violation flag in database if required break missed
- 📊 Manager reports show compliance issues

## Database Schema

### `breaks` Table

```sql
- id (PK)
- shift_id (FK to shifts) - CASCADE delete
- user_id (FK to users)
- business_id (FK to businesses)
- type ('meal' | 'rest' | 'other')
- start_time (timestamp)
- end_time (timestamp, nullable)
- duration_seconds (calculated on end)
- is_paid (boolean)
- status ('scheduled' | 'active' | 'completed' | 'cancelled' | 'missed')
- is_required (boolean) - Labor law requirement
- required_reason (text) - Why break was required
- minimum_duration_seconds (integer)
- scheduled_start_time (timestamp, nullable)
- scheduled_end_time (timestamp, nullable)
- required_break_missed (boolean)
- compliance_violation (boolean)
```

## API Methods

### Start Break

```typescript
window.timeTrackingAPI.startBreak({
  shiftId: string,
  userId: string,
  type: "meal" | "rest" | "other",
  isPaid: boolean,
});
```

### End Break

```typescript
window.timeTrackingAPI.endBreak(breakId: string)
```

### Get Active Shift (includes breaks)

```typescript
window.timeTrackingAPI.getActiveShift(userId: string)
// Returns: { shift, breaks[] }
```

## Integration Points

### DashboardLayout

The break system is integrated into the main dashboard header:

- Shows "Clocked In" badge when shift active
- Shows "On Break" badge with timer when break active
- "Take Break" button always visible when clocked in
- Logout button triggers confirmation dialog

### Auto Clock-Out Behavior

When user logs out:

1. Active breaks are automatically ended
2. Break duration is calculated and saved
3. Shift is completed with clock-out event
4. Schedule remains active (allows re-login same day)

## Future Enhancements

1. **Break Scheduling** - Pre-schedule breaks for the day
2. **Break History** - View all breaks taken during shift
3. **Custom Break Types** - Business-configurable break types
4. **Break Policies** - Role-based break requirements
5. **Auto-Start Breaks** - Automatic break on terminal lock
6. **Break Reminders** - Configurable reminder intervals
7. **Manager Override** - Adjust break times with PIN

## Testing

### Manual Test Scenarios

1. ✅ Start rest break → End break → Verify duration
2. ✅ Start meal break → Logout → Verify auto-end
3. ✅ Work 6 hours → Verify reminder popup
4. ✅ Click logout with active shift → Verify confirmation
5. ✅ Take break via logout dialog → Verify break starts
6. ✅ End break before minimum duration → Verify warning

### Compliance Tests

1. ✅ Work 6+ hours without meal break → Flag violation
2. ✅ End meal break at 25 minutes → Show warning
3. ✅ Break compliance in manager reports

## Notes

- Break timers update every second for real-time accuracy
- Shift polling happens every 30 seconds
- Break reminders are dismissible but re-appear on next login
- Only one active break allowed per shift
- Breaks are tied to shifts (cascade delete)
