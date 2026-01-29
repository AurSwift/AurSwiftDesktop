# Authentication & Shift Management System

## Overview

This document explains how the authentication system integrates with shift management, schedules, and breaks to provide role-based access control and time tracking.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Admin      │  │   Manager    │  │   Cashier    │      │
│  │ (No Shift)   │  │  (Shift Req) │  │ (Shift Req)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Shift Requirement Resolver                       │
│  Determines if user requires shift based on RBAC roles       │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
┌──────────────────┐            ┌──────────────────┐
│  Admin Mode      │            │  Cashier Mode     │
│  Direct Login    │            │  Schedule Check  │
│  No Shift Req    │            │  Clock In Req    │
└──────────────────┘            └──────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────┐
                            │  Schedule Validator  │
                            │  - Time Window Check │
                            │  - Grace Period      │
                            │  - Manager Override  │
                            └──────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────┐
                            │   Clock In/Out       │
                            │   - Create Shift     │
                            │   - Track Time       │
                            └──────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────┐
                            │   Break Management   │
                            │   - Start/End Break  │
                            │   - Compliance Check │
                            └──────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────┐
                            │   Sales Validation   │
                            │   - Active Shift Req │
                            │   - Transaction Link │
                            └──────────────────────┘
```

## Core Concepts

### 1. Role-Based Shift Requirements

The system uses **RBAC (Role-Based Access Control)** to determine if a user requires a shift:

- **Admin/Owner Roles**: `shiftRequired = false` → Can make direct sales without shifts
- **Manager/Cashier Roles**: `shiftRequired = true` → Must clock in before making sales

**Resolution Priority:**
1. Role's `shiftRequired` field (explicit configuration)
2. User's `shiftRequired` field (legacy fallback)
3. Default: `true` (conservative security approach)

### 2. Schedule Validation

Before clocking in, the system validates:
- **Schedule Exists**: User must have a schedule for today
- **Time Window**: Clock-in must be within schedule time ± grace period (15 minutes)
- **Active Shift Check**: User cannot have duplicate active shifts
- **Manager Override**: Managers can approve clock-ins outside schedule

### 3. Shift Lifecycle

```
┌─────────┐      ┌──────────┐      ┌─────────┐      ┌─────────┐
│ Pending │ ───▶ │  Active  │ ───▶ │  Ended  │ ───▶ │ Archived│
└─────────┘      └──────────┘      └─────────┘      └─────────┘
                    │
                    │ (Break)
                    ▼
                ┌──────────┐
                │ On Break │
                └──────────┘
```

### 4. Break Management

Breaks are tracked within active shifts:
- **Break Types**: Meal, Rest, Other
- **Compliance**: System validates required breaks (e.g., meal break after 6 hours)
- **Duration Tracking**: Automatically calculated from start/end times
- **Clock-Out Protection**: Cannot clock out while on break

---

## Scenarios

### Scenario 1: Admin Login (No Shift Required)

**User**: Administrator/Owner  
**Role**: `admin` (shiftRequired: false)

**Flow:**
```
1. User enters credentials
   ↓
2. System validates credentials
   ↓
3. ShiftRequirementResolver checks role
   → Result: requiresShift = false
   ↓
4. Login succeeds immediately
   → No schedule check
   → No clock-in required
   ↓
5. User can make sales directly
   → No active shift needed
   → Transactions linked to user only
```

**Example:**
```typescript
// Login Request
POST /auth/login
{
  "username": "admin",
  "password": "***"
}

// Response
{
  "success": true,
  "user": { ... },
  "shift": null,  // No shift required
  "clockEvent": null
}
```

**Key Points:**
- ✅ No schedule validation
- ✅ No clock-in required
- ✅ Can make sales immediately
- ✅ Direct access to all features

---

### Scenario 2: Cashier Login (Shift Required - On Time)

**User**: Cashier  
**Role**: `cashier` (shiftRequired: true)  
**Schedule**: 9:00 AM - 5:00 PM  
**Login Time**: 8:55 AM (within grace period)

**Flow:**
```
1. User enters credentials
   ↓
2. System validates credentials
   ↓
3. ShiftRequirementResolver checks role
   → Result: requiresShift = true
   ↓
4. Schedule Validator checks:
   → Schedule exists: ✅ Yes (9:00 AM - 5:00 PM)
   → Current time: 8:55 AM
   → Within grace period: ✅ Yes (15 min before)
   → Validation: ✅ PASSED
   ↓
5. Auto Clock-In:
   → Create clock event (type: "in", method: "login")
   → Create shift (status: "active")
   → Link to schedule
   ↓
6. Login succeeds
   → User authenticated
   → Active shift created
   ↓
7. User can make sales
   → Transactions linked to active shift
```

**Example:**
```typescript
// Login Request
POST /auth/login
{
  "username": "cashier1",
  "password": "***"
}

// Response
{
  "success": true,
  "user": { ... },
  "shift": {
    "id": "shift-123",
    "status": "active",
    "clockInId": "clock-456",
    "scheduleId": "schedule-789"
  },
  "clockEvent": {
    "id": "clock-456",
    "type": "in",
    "timestamp": "2024-01-15T08:55:00Z",
    "method": "login"
  }
}
```

**Key Points:**
- ✅ Schedule validated
- ✅ Auto clock-in on login
- ✅ Shift created and linked to schedule
- ✅ Can make sales immediately

---

### Scenario 3: Cashier Login (Shift Required - Early, Needs Approval)

**User**: Cashier  
**Role**: `cashier` (shiftRequired: true)  
**Schedule**: 9:00 AM - 5:00 PM  
**Login Time**: 8:30 AM (outside grace period)

**Flow:**
```
1. User enters credentials
   ↓
2. System validates credentials
   ↓
3. ShiftRequirementResolver checks role
   → Result: requiresShift = true
   ↓
4. Schedule Validator checks:
   → Schedule exists: ✅ Yes
   → Current time: 8:30 AM
   → Within grace period: ❌ No (25 min before, > 15 min)
   → Validation: ⚠️ REQUIRES APPROVAL
   ↓
5. System logs warning
   → Audit log: "schedule_validation_failed"
   → Details: "Clock-in 25 minutes before schedule"
   ↓
6. Auto Clock-In proceeds with approval flag
   → Create clock event (with warning)
   → Create shift
   ↓
7. Login succeeds with warning
   → User authenticated
   → Active shift created
   → Warning displayed to user
```

**Example:**
```typescript
// Response
{
  "success": true,
  "user": { ... },
  "shift": { ... },
  "clockEvent": { ... },
  "warning": "Clock-in 25 minutes before scheduled time"
}
```

**Key Points:**
- ⚠️ Schedule validation warning
- ✅ Clock-in allowed with approval
- ✅ Shift created
- ⚠️ Manager notification recommended

---

### Scenario 4: Cashier Login (No Schedule - Blocked)

**User**: Cashier  
**Role**: `cashier` (shiftRequired: true)  
**Schedule**: None for today  
**Login Time**: 9:00 AM

**Flow:**
```
1. User enters credentials
   ↓
2. System validates credentials
   ↓
3. ShiftRequirementResolver checks role
   → Result: requiresShift = true
   ↓
4. Schedule Validator checks:
   → Schedule exists: ❌ No schedule for today
   → Validation: ❌ FAILED
   ↓
5. Login blocked
   → Return error: "NO_SCHEDULED_SHIFT"
   → Message: "No scheduled shift found. Please contact your manager."
   ↓
6. Audit log created
   → Action: "schedule_validation_failed"
   → Reason: "No schedule exists for today"
```

**Example:**
```typescript
// Response
{
  "success": false,
  "message": "No scheduled shift found. Please contact your manager to create a schedule.",
  "code": "NO_SCHEDULED_SHIFT",
  "requiresShift": true
}
```

**Key Points:**
- ❌ Login blocked
- ❌ No shift created
- ⚠️ User must contact manager
- 📝 Audit log created

---

### Scenario 5: Manager Login (Shift Required - Can Override)

**User**: Manager  
**Role**: `manager` (shiftRequired: true)  
**Schedule**: 8:00 AM - 4:00 PM  
**Login Time**: 7:30 AM (outside grace period)

**Flow:**
```
1. User enters credentials
   ↓
2. System validates credentials
   ↓
3. ShiftRequirementResolver checks role
   → Result: requiresShift = true
   ↓
4. Schedule Validator checks:
   → Schedule exists: ✅ Yes
   → Current time: 7:30 AM
   → Within grace period: ❌ No
   → User role: Manager (can override)
   → Validation: ⚠️ REQUIRES APPROVAL (manager can proceed)
   ↓
5. Auto Clock-In proceeds
   → Create clock event
   → Create shift
   → Manager override logged
   ↓
6. Login succeeds
   → Active shift created
   → Manager can make sales
```

**Key Points:**
- ⚠️ Schedule validation warning
- ✅ Manager can override
- ✅ Shift created
- 📝 Override logged in audit

---

### Scenario 6: Making a Sale (Cashier with Active Shift)

**User**: Cashier  
**Status**: Logged in, Active shift  
**Action**: Create transaction

**Flow:**
```
1. User initiates sale
   ↓
2. Transaction Validator checks:
   → User requires shift: ✅ Yes
   → Active shift exists: ✅ Yes (shift-123)
   → Shift status: ✅ "active"
   ↓
3. Transaction created
   → Linked to active shift (shift-123)
   → Linked to user
   → Amount recorded
   ↓
4. Sale completed
   → Transaction saved
   → Audit log created
```

**Example:**
```typescript
// Transaction Request
POST /transactions/create
{
  "userId": "user-123",
  "items": [...],
  "shiftId": "shift-123"  // Auto-assigned if null
}

// Response
{
  "success": true,
  "transaction": {
    "id": "txn-456",
    "shiftId": "shift-123",
    "userId": "user-123",
    ...
  }
}
```

**Key Points:**
- ✅ Active shift validated
- ✅ Transaction linked to shift
- ✅ Sales tracked per shift

---

### Scenario 7: Making a Sale (Cashier without Active Shift - Blocked)

**User**: Cashier  
**Status**: Logged in, No active shift  
**Action**: Create transaction

**Flow:**
```
1. User initiates sale
   ↓
2. Transaction Validator checks:
   → User requires shift: ✅ Yes
   → Active shift exists: ❌ No
   → Validation: ❌ FAILED
   ↓
3. Transaction blocked
   → Return error: "NO_ACTIVE_SHIFT_FOR_SALES"
   → Message: "You must have an active shift to make sales. Please clock in first."
   ↓
4. Audit log created
   → Action: "denied_transaction"
   → Reason: "No active shift"
```

**Example:**
```typescript
// Response
{
  "success": false,
  "message": "You must have an active shift to make sales. Please clock in first.",
  "code": "NO_ACTIVE_SHIFT_FOR_SALES"
}
```

**Key Points:**
- ❌ Sale blocked
- ⚠️ User must clock in first
- 📝 Denial logged

---

### Scenario 8: Making a Sale (Admin - No Shift Required)

**User**: Admin  
**Status**: Logged in, No shift  
**Action**: Create transaction

**Flow:**
```
1. User initiates sale
   ↓
2. Transaction Validator checks:
   → User requires shift: ❌ No (admin role)
   → Validation: ✅ PASSED (shift not required)
   ↓
3. Transaction created
   → Linked to user only
   → shiftId: null
   → Amount recorded
   ↓
4. Sale completed
   → Transaction saved
   → Audit log created
```

**Example:**
```typescript
// Transaction Request
POST /transactions/create
{
  "userId": "admin-123",
  "items": [...]
  // No shiftId needed
}

// Response
{
  "success": true,
  "transaction": {
    "id": "txn-789",
    "shiftId": null,  // No shift required
    "userId": "admin-123",
    ...
  }
}
```

**Key Points:**
- ✅ No shift validation
- ✅ Direct sale allowed
- ✅ Transaction linked to user only

---

### Scenario 9: Starting a Break

**User**: Cashier  
**Status**: Active shift (4 hours worked)  
**Action**: Start break

**Flow:**
```
1. User requests break
   ↓
2. Break Validator checks:
   → Active shift exists: ✅ Yes
   → Shift status: ✅ "active"
   → No active break: ✅ Yes
   ↓
3. Break Compliance Check:
   → Hours worked: 4 hours
   → Required break: ❌ Not yet (after 6 hours)
   → Validation: ✅ PASSED
   ↓
4. Break created
   → Status: "active"
   → Start time: now
   → Type: "rest" (user selected)
   ↓
5. Break started
   → User on break
   → Shift still active
```

**Example:**
```typescript
// Break Request
POST /timeTracking/startBreak
{
  "shiftId": "shift-123",
  "userId": "user-123",
  "type": "rest"
}

// Response
{
  "success": true,
  "break": {
    "id": "break-456",
    "status": "active",
    "start_time": "2024-01-15T13:00:00Z",
    "type": "rest"
  }
}
```

**Key Points:**
- ✅ Active shift required
- ✅ Break compliance checked
- ✅ Break tracked within shift
- ✅ Shift remains active

---

### Scenario 10: Ending a Break

**User**: Cashier  
**Status**: On break (15 minutes)  
**Action**: End break

**Flow:**
```
1. User ends break
   ↓
2. Break Validator checks:
   → Break exists: ✅ Yes
   → Break status: ✅ "active"
   ↓
3. Calculate duration
   → Start: 13:00:00
   → End: 13:15:00
   → Duration: 900 seconds (15 minutes)
   ↓
4. Break Compliance Check:
   → Duration: 15 minutes
   → Minimum required: 30 minutes (if required)
   → Validation: ⚠️ WARNING (if too short)
   ↓
5. Break updated
   → Status: "completed"
   → End time: now
   → Duration: 900 seconds
   → is_short: true (if below minimum)
   ↓
6. Break ended
   → User back to work
   → Shift still active
   → Duration added to shift totals
```

**Example:**
```typescript
// Break End Request
POST /timeTracking/endBreak
{
  "breakId": "break-456"
}

// Response
{
  "success": true,
  "break": {
    "id": "break-456",
    "status": "completed",
    "duration_seconds": 900,
    "is_short": false
  }
}
```

**Key Points:**
- ✅ Duration automatically calculated
- ⚠️ Compliance warnings if too short
- ✅ Break duration added to shift
- ✅ User can continue work

---

### Scenario 11: Clocking Out (Normal)

**User**: Cashier  
**Status**: Active shift, No active break  
**Action**: Clock out

**Flow:**
```
1. User requests clock-out
   ↓
2. Clock-Out Validator checks:
   → Active shift exists: ✅ Yes
   → Active break: ❌ No (required)
   → Shift status: ✅ "active"
   ↓
3. Create clock-out event
   → Type: "out"
   → Method: "manual"
   → Timestamp: now
   ↓
4. Calculate shift totals:
   → Clock-in: 9:00 AM
   → Clock-out: 5:00 PM
   → Total time: 8 hours
   → Breaks: 30 minutes (1 break)
   → Working time: 7.5 hours
   → Regular hours: 7.5
   → Overtime: 0
   ↓
5. Complete shift
   → Status: "ended"
   → Total hours: 7.5
   → Break duration: 1800 seconds
   → Clock-out event linked
   ↓
6. Shift completed
   → User clocked out
   → Shift ready for review
```

**Example:**
```typescript
// Clock-Out Request
POST /timeTracking/clockOut
{
  "userId": "user-123"
}

// Response
{
  "success": true,
  "shift": {
    "id": "shift-123",
    "status": "ended",
    "total_hours": 7.5,
    "regular_hours": 7.5,
    "overtime_hours": 0,
    "break_duration_seconds": 1800
  },
  "clockEvent": {
    "id": "clock-789",
    "type": "out",
    "timestamp": "2024-01-15T17:00:00Z"
  }
}
```

**Key Points:**
- ✅ No active break required
- ✅ Shift totals calculated
- ✅ Break duration included
- ✅ Shift marked as ended

---

### Scenario 12: Clocking Out (With Active Break - Blocked)

**User**: Cashier  
**Status**: Active shift, On break  
**Action**: Clock out

**Flow:**
```
1. User requests clock-out
   ↓
2. Clock-Out Validator checks:
   → Active shift exists: ✅ Yes
   → Active break: ✅ Yes (break-456)
   → Validation: ❌ FAILED
   ↓
3. Clock-out blocked
   → Return error: "ACTIVE_BREAK_IN_PROGRESS"
   → Message: "Cannot clock out: active break in progress. Please end break first."
   ↓
4. User must end break first
```

**Example:**
```typescript
// Response
{
  "success": false,
  "message": "Cannot clock out: active break in progress. Please end break first.",
  "code": "ACTIVE_BREAK_IN_PROGRESS"
}
```

**Key Points:**
- ❌ Clock-out blocked
- ⚠️ Must end break first
- ✅ Prevents data inconsistency

---

### Scenario 13: Logout (Auto Clock-Out)

**User**: Cashier  
**Status**: Active shift  
**Action**: Logout

**Flow:**
```
1. User logs out
   ↓
2. System checks for active shift
   → Active shift: ✅ Yes
   ↓
3. Check for active break
   → Active break: ❌ No (or auto-end if exists)
   ↓
4. Auto clock-out
   → Create clock-out event (method: "logout")
   → Complete shift
   → Calculate totals
   ↓
5. Session terminated
   → User logged out
   → Shift ended
```

**Example:**
```typescript
// Logout Request
POST /auth/logout
{
  "token": "session-token-123"
}

// Response
{
  "success": true,
  "shift": {
    "id": "shift-123",
    "status": "ended",
    ...
  }
}
```

**Key Points:**
- ✅ Auto clock-out on logout
- ✅ Active breaks auto-ended
- ✅ Shift totals calculated
- ✅ Clean session termination

---

## Data Flow Diagrams

### Login Flow (Cashier/Manager)

```
┌─────────────┐
│   Login     │
│  Request    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Authenticate    │
│ Credentials     │
└──────┬──────────┘
       │
       ▼
┌─────────────────────┐
│ Check Shift         │
│ Requirement         │
│ (RBAC)              │
└──────┬──────────────┘
       │
       ▼ (requiresShift = true)
┌─────────────────────┐
│ Validate Schedule    │
│ - Exists?            │
│ - Time window?       │
│ - Grace period?      │
└──────┬───────────────┘
       │
       ├─► ❌ No Schedule → Block Login
       │
       ├─► ⚠️ Outside Window → Warn & Continue
       │
       └─► ✅ Valid → Continue
              │
              ▼
       ┌──────────────┐
       │ Auto Clock-In│
       │ - Create Event│
       │ - Create Shift│
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ Login Success │
       │ + Active Shift│
       └──────────────┘
```

### Sales Flow (Cashier)

```
┌─────────────┐
│ Create      │
│ Transaction │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Check Shift     │
│ Requirement     │
└──────┬──────────┘
       │
       ▼ (requiresShift = true)
┌─────────────────┐
│ Check Active    │
│ Shift           │
└──────┬──────────┘
       │
       ├─► ❌ No Shift → Block Sale
       │
       └─► ✅ Active Shift → Continue
              │
              ▼
       ┌──────────────┐
       │ Create       │
       │ Transaction  │
       │ (linked to   │
       │  shift)      │
       └──────────────┘
```

### Break Flow

```
┌─────────────┐
│ Start Break │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Check Active    │
│ Shift           │
└──────┬──────────┘
       │
       ├─► ❌ No Shift → Error
       │
       └─► ✅ Active Shift → Continue
              │
              ▼
       ┌─────────────────┐
       │ Check Break      │
       │ Compliance       │
       └──────┬───────────┘
              │
              ▼
       ┌─────────────────┐
       │ Create Break    │
       │ (status: active) │
       └─────────────────┘
              │
              ▼
       ┌─────────────────┐
       │ End Break       │
       │ - Calculate     │
       │   Duration      │
       │ - Update Status │
       └─────────────────┘
```

---

## Key Components

### 1. ShiftRequirementResolver
**Location**: `packages/main/src/utils/shiftRequirementResolver.ts`

Determines if a user requires a shift based on RBAC roles.

**Methods:**
- `resolve(user, db)`: Returns shift requirement with mode and reason
- `requiresShift(user, db)`: Quick boolean check

### 2. ScheduleValidator
**Location**: `packages/main/src/utils/scheduleValidator.ts`

Validates clock-in timing against user schedules.

**Features:**
- Schedule existence check
- Time window validation
- 15-minute grace period
- Manager override support

### 3. TransactionValidator
**Location**: `packages/main/src/utils/transactionValidator.ts`

Validates transaction creation requirements.

**Checks:**
- Shift requirement based on role
- Active shift existence
- Shift status validation

### 4. BreakComplianceValidator
**Location**: `packages/main/src/utils/breakComplianceValidator.ts`

Validates break compliance with labor laws.

**Validations:**
- Required breaks (e.g., meal break after 6 hours)
- Minimum break duration
- Maximum consecutive work hours

### 5. ShiftDataValidator
**Location**: `packages/main/src/utils/shiftDataValidator.ts`

Validates data consistency for shifts and breaks.

**Validations:**
- Break timing consistency
- Shift status transitions
- Break duration calculations

---

## Audit Logging

All critical operations are logged for compliance and debugging:

### Logged Events:
- **Clock In/Out**: All clock events with timestamps, methods, and schedule links
- **Break Start/End**: Break events with compliance warnings
- **Schedule Validation**: Success/failure of schedule checks
- **Transaction Creation**: Sales linked to shifts
- **Login/Logout**: Session management events

### Audit Log Structure:
```typescript
{
  "action": "clock_in" | "break_started" | "schedule_validation_failed",
  "entityType": "clock_event" | "break" | "user",
  "entityId": "entity-id",
  "userId": "user-id",
  "details": {
    // Context-specific details
  },
  "timestamp": "2024-01-15T09:00:00Z"
}
```

---

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `NO_SCHEDULED_SHIFT` | No schedule found for today | Contact manager to create schedule |
| `SCHEDULE_VALIDATION_FAILED` | Clock-in outside schedule window | Wait for scheduled time or request approval |
| `NO_ACTIVE_SHIFT_FOR_SALES` | Attempted sale without active shift | Clock in first |
| `DUPLICATE_CLOCK_IN` | User already has active shift | Clock out first |
| `ACTIVE_BREAK_IN_PROGRESS` | Attempted clock-out during break | End break first |
| `SHIFT_NOT_FOUND` | Shift does not exist | Verify shift ID |
| `BREAK_NOT_FOUND` | Break does not exist | Verify break ID |

---

## Best Practices

### For Administrators:
1. **Create Schedules Early**: Set up schedules at least one day in advance
2. **Monitor Audit Logs**: Review schedule validation failures regularly
3. **Configure Roles Properly**: Set `shiftRequired` correctly for each role
4. **Review Break Compliance**: Check for break violations in reports

### For Managers:
1. **Approve Early/Late Clock-Ins**: Review and approve schedule exceptions
2. **Monitor Active Shifts**: Ensure employees clock out properly
3. **Review Break Compliance**: Address break duration violations
4. **Handle Schedule Changes**: Update schedules when needed

### For Cashiers:
1. **Clock In On Time**: Arrive within grace period when possible
2. **Take Required Breaks**: Follow break compliance rules
3. **End Breaks Properly**: Always end breaks before clocking out
4. **Report Issues**: Contact manager for schedule problems

---

## Troubleshooting

### Issue: "No scheduled shift found"
**Cause**: No schedule created for today  
**Solution**: Manager must create schedule in advance

### Issue: "Cannot clock in at this time"
**Cause**: Clock-in outside schedule window (beyond grace period)  
**Solution**: Wait for scheduled time or request manager approval

### Issue: "You must have an active shift to make sales"
**Cause**: User clocked out or never clocked in  
**Solution**: Clock in first before making sales

### Issue: "Cannot clock out: active break in progress"
**Cause**: Break not ended before clock-out attempt  
**Solution**: End break first, then clock out

### Issue: "You already have an active shift"
**Cause**: Previous shift not completed  
**Solution**: Clock out from previous shift first

---

## API Examples

### Login (Cashier)
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    username: 'cashier1',
    password: 'password123'
  })
});

// Response includes shift if required
const { user, shift, clockEvent } = await response.json();
```

### Clock In (Manual)
```typescript
const response = await fetch('/api/timeTracking/clockIn', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user-123',
    businessId: 'business-456',
    terminalId: 'terminal-789'
  })
});
```

### Start Break
```typescript
const response = await fetch('/api/timeTracking/startBreak', {
  method: 'POST',
  body: JSON.stringify({
    shiftId: 'shift-123',
    userId: 'user-123',
    businessId: 'business-456',
    type: 'meal'
  })
});
```

### Create Transaction
```typescript
const response = await fetch('/api/transactions/create', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user-123',
    items: [...],
    // shiftId auto-assigned if user requires shift
  })
});
```

---

## Summary

This system provides:
- ✅ **Role-based access control** for shift requirements
- ✅ **Schedule validation** with grace periods
- ✅ **Automatic clock-in** on login for cashiers/managers
- ✅ **Break management** with compliance checking
- ✅ **Sales validation** ensuring active shifts
- ✅ **Comprehensive audit logging** for all operations
- ✅ **Data validation** ensuring consistency

The system ensures that cashiers and managers follow proper time tracking procedures while allowing administrators to operate without shift constraints.

