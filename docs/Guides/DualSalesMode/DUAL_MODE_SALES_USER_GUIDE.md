# Dual-Mode Sales System - User Guide

## Overview

AuraSwift supports two distinct sales modes to accommodate different business needs:

- **Admin/Owner Mode**: Direct sales access without shift management
- **Cashier/Manager Mode**: Shift-based sales with time tracking and schedule validation

This guide explains how to use each mode effectively.

---

## Admin/Owner Mode

### What is Admin Mode?

Admin Mode allows business owners and administrators to make sales directly without requiring shift management, clock-in, or schedule validation. This is ideal for:

- Small businesses where the owner operates the POS
- Quick sales when cashiers are unavailable
- Administrative overrides and corrections

### Getting Started

1. **Login**: Log in with an admin or owner account
2. **Automatic Mode Detection**: The system automatically detects your role and enables Admin Mode
3. **Direct Sales Access**: You can immediately start processing transactions

### Features

✅ **No Shift Required**: Create transactions without starting a shift  
✅ **No Clock-In**: Login directly to sales interface  
✅ **Simplified UI**: No shift banners or warnings  
✅ **Full Access**: All sales features available immediately

### Creating Transactions

1. Navigate to the **New Transaction** view
2. Add products to cart
3. Process payment
4. Complete transaction

**Note**: Transactions created in Admin Mode will have `shiftId = null` in the database.

### Visual Indicators

- **Blue Banner**: "Admin Mode: Direct sales access (no shift required)"
- **No Shift Warnings**: Shift-related UI elements are hidden
- **Simplified Interface**: Clean, focused sales interface

---

## Cashier/Manager Mode

### What is Cashier Mode?

Cashier Mode requires shift management, schedule validation, and time tracking. This ensures:

- Accurate time tracking for payroll
- Schedule compliance
- Shift-based transaction reporting
- Cash drawer reconciliation

### Getting Started

1. **Login**: Log in with a cashier or manager account
2. **Schedule Validation**: System checks if you have a schedule for today
3. **Clock-In**: Automatically clock in (if within schedule) or manually clock in
4. **Start Shift**: Start your POS shift with starting cash amount
5. **Sales Access**: Begin processing transactions

### Workflow

```
Login → Schedule Check → Clock In → Start Shift → Sales Access
```

### Step-by-Step Process

#### 1. Login

When you log in as a cashier/manager:

- System checks for today's schedule
- Validates schedule time window (with 15-minute grace period)
- Automatically clocks you in if within schedule

#### 2. Schedule Validation

**Within Schedule**: Clock-in proceeds automatically  
**Before Schedule** (outside grace period): Requires manager approval  
**After Schedule** (outside grace period): Requires manager approval  
**No Schedule**: Cannot clock in (contact manager)

**Grace Period**: 15 minutes before/after scheduled time

#### 3. Clock-In

- **Automatic**: If within schedule window
- **Manual**: If outside schedule (with approval)
- **Blocked**: If no schedule exists

#### 4. Start Shift

1. Click **"Start Shift"** button (if not auto-started)
2. Enter **Starting Cash** amount
3. Confirm shift start
4. Shift is now active

#### 5. Process Transactions

Once shift is active:

- Add products to cart
- Process payments
- Complete transactions
- All transactions are linked to your shift

### Features

✅ **Schedule Validation**: Ensures you're working during scheduled hours  
✅ **Time Tracking**: Automatic clock-in/out tracking  
✅ **Shift Management**: Track sales per shift  
✅ **Cash Drawer**: Reconcile cash at shift end  
✅ **Reporting**: Shift-based sales reports

### Visual Indicators

- **Shift Banner**: Shows shift status and schedule information
- **Overtime Warning**: Alerts when working beyond scheduled hours
- **Active Shift Indicator**: Shows current shift details

### Ending Your Shift

1. Click **"End Shift"** button
2. Enter **Final Cash Drawer** amount
3. System calculates variance
4. Shift is closed
5. **Auto Clock-Out**: If all POS shifts are closed, time shift auto-clocks out

---

## Mode Comparison

| Feature              | Admin Mode   | Cashier Mode         |
| -------------------- | ------------ | -------------------- |
| Shift Required       | ❌ No        | ✅ Yes               |
| Clock-In Required    | ❌ No        | ✅ Yes               |
| Schedule Validation  | ❌ No        | ✅ Yes               |
| Time Tracking        | ❌ No        | ✅ Yes               |
| Shift Start          | ❌ No        | ✅ Yes               |
| Transaction Creation | ✅ Immediate | ✅ After shift start |
| UI Complexity        | ✅ Simple    | ⚠️ Enhanced          |

---

## Common Scenarios

### Scenario 1: Owner Making Quick Sale

**Situation**: Owner needs to make a sale when cashier is on break

**Solution**:

1. Log in with owner account
2. System automatically enables Admin Mode
3. Process sale immediately
4. No shift or clock-in needed

### Scenario 2: Cashier Starting Shift

**Situation**: Cashier arrives for scheduled shift

**Solution**:

1. Log in with cashier account
2. System validates schedule
3. Auto clock-in (if within schedule)
4. Start POS shift with starting cash
5. Begin processing transactions

### Scenario 3: Cashier Arriving Early

**Situation**: Cashier arrives 20 minutes before scheduled time

**Solution**:

1. Log in with cashier account
2. System detects early arrival
3. Shows warning: "Clock-in is 20 minutes before scheduled time"
4. Requires manager approval to proceed
5. Manager approves → Clock-in allowed
6. Start shift as normal

### Scenario 4: Cashier Arriving Late

**Situation**: Cashier arrives 30 minutes after scheduled start

**Solution**:

1. Log in with cashier account
2. System detects late arrival
3. Shows warning: "Clock-in is 30 minutes after scheduled time"
4. Requires manager approval to proceed
5. Manager approves → Clock-in allowed
6. Start shift as normal

### Scenario 5: No Schedule Today

**Situation**: Cashier tries to log in but has no schedule

**Solution**:

1. Log in with cashier account
2. System detects no schedule
3. Shows error: "No schedule found for today"
4. Cannot clock in
5. Contact manager to create schedule

---

## Troubleshooting

### "Shift is required for your role to create transactions"

**Cause**: You're in Cashier Mode but haven't started a shift

**Solution**:

1. Check if you're clocked in
2. Start your POS shift
3. Try transaction again

### "Cannot clock in: Schedule validation failed"

**Cause**: No schedule exists or outside schedule window

**Solution**:

1. Check with manager about schedule
2. If outside schedule, request manager approval
3. Manager can approve out-of-schedule clock-in

### "You already have an active shift running"

**Cause**: Shift already started (possibly on another device)

**Solution**:

1. Check if shift is active on current device
2. If on another device, end that shift first
3. Or continue using existing shift

### "Cannot create transaction on inactive shift"

**Cause**: Shift was ended or closed

**Solution**:

1. Check shift status
2. Start a new shift if needed
3. Try transaction again

---

## Best Practices

### For Admins/Owners

1. **Use Admin Mode Sparingly**: Reserve for quick sales or emergencies
2. **Document Transactions**: Note why Admin Mode was used
3. **Review Reports**: Check Admin Mode transactions in reports
4. **Train Staff**: Ensure cashiers use Cashier Mode for proper tracking

### For Cashiers/Managers

1. **Check Schedule**: Verify schedule before arriving
2. **Clock In On Time**: Arrive within grace period when possible
3. **Start Shift Promptly**: Don't delay shift start after clock-in
4. **End Shift Properly**: Always end shift and reconcile cash
5. **Report Issues**: Contact manager if schedule validation fails

---

## Security Notes

- **Mode Detection**: Based on RBAC roles, not user preferences
- **Shift Ownership**: Cashiers can only use their own shifts
- **Schedule Validation**: Prevents unauthorized clock-ins
- **Audit Trail**: All mode switches and transactions are logged

---

## Support

For issues or questions:

1. Check this guide first
2. Contact your system administrator
3. Review error messages carefully
4. Check system logs if available

---

**Last Updated**: 2025-01-XX  
**Version**: 1.8.0  
**Status**: Production Ready
