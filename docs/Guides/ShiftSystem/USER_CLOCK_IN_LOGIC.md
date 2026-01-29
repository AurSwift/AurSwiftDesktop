# User Login & Clock-In/Out Workflows

This document explains the workflows for Authentication (Login) and Time Tracking (Clock In/Out) for different user roles within the Desktop application. It clarifies the distinction between "locking a session" and "ending a shift".

## 1. Concepts: Login vs. Clock-In

It is crucial to understand that these are two separate concepts in AuraSwift:

1.  **Authentication (Login)**:
    -   **Purpose**: Identifies *who* is using the terminal.
    -   **Mechanism**: PIN code verification.
    -   **State**: Establishes a secure `sessionToken`.
    -   **UI**: Unlocks the screen to show the Dashboard/POS.

2.  **Time Tracking (Clock In)**:
    -   **Purpose**: Tracks *attendance* and payroll hours.
    -   **Mechanism**: Creating a `clock_event` (type: 'in').
    -   **State**: Creates an active `shift` record in the database.
    -   **Requirement**: Some actions (like POS Sales) are blocked if not Clocked In.

---

## 2. Role-Based Requirements

The system uses `shiftRequirementResolver` to determine if a user needs to be clock-in to operate.

| Role | Requires Shift (Clock-In)? | Can Login without Clock-In? | Notes |
| :--- | :--- | :--- | :--- |
| **Admin / Owner** | **NO** | ✅ **YES** | Can full access the system immediately after PIN entry. Does not need to track hours. |
| **Manager** | **YES** | ⚠️ **Conditional** | Typically tracks hours. Can access non-POS features without clock-in, but needs shift for sales/cash. |
| **Cashier** | **YES** | ❌ **Generally NO** | Primary function is POS. System may prompt/warn if trying to operate without an active shift. |

*Note: This is configurable via the `roles` table `shiftRequired` field.*

---

## 3. Workflows & User Scenarios

### Scenario A: Admin Login (No Clock-In)
1.  **Screen**: PIN Entry Screen.
2.  **Action**: Admin enters 4-digit PIN.
3.  **System**:
    -   Validates PIN.
    -   Checks `shiftRequirementResolver` -> **FALSE**.
    -   Logs user in immediately.
4.  **Result**: Admin is taken directly to the Dashboard.

### Scenario B: Cashier Start of Day (Auto Clock-In)
*The system is designed to streamline the process for scheduled staff.*

1.  **Screen**: PIN Entry Screen.
2.  **Action**: Cashier enters 4-digit PIN to log in.
3.  **System**:
    -   Validates PIN.
    -   Checks `shiftRequirementResolver` -> **TRUE**.
    -   Checks for **Scheduled Shift** for the current time.
    -   **Auto-Action**: If a valid schedule is found, the system **Automatically Clocks In** the user.
    -   Creates `clock_events` and `shift` records in the background.
4.  **Result**: Cashier enters Dashboard and is already marked as "Clocked In". They can start POS operations immediately.

### Scenario C: Manual Clock-In (Unscheduled / Override)
*Used when a staff member works outside their schedule or if auto-clock-in fails.*

1.  **Screen**: PIN Entry Screen.
2.  **Action**: User clicks **"CLOCK IN"** button *before* entering PIN for login.
3.  **System**:
    -   Prompts for PIN to confirm identity.
    -   Manually creates the "Clock In" event.
4.  **Action**: User then enters PIN again to Log In.
5.  **Result**: User enters Dashboard clocked in.

### Scenario D: End of Day (Clock-Out)
1.  **Context**: Cashier is logged in and working.
2.  **Action**: Cashier clicks "Logout" or "Clock Out" from the User Menu.
3.  **System**:
    -   Prompts "Do you want to clock out completely or just lock screen?".
    -   **Clock Out**: Ends the shift, records end time, logs out.
    -   **Logout only**: Keeps (paid) timer running, but locks terminal (e.g., for lunch break).

### Scenario E: Auto-Logout (Inactivity)
-   If the system auto-locks due to inactivity:
    -   **Login status**: Cleared (Session locked).
    -   **Clock-in status**: **REMAINS ACTIVE**. The employee is still "on the clock" and getting paid while the screen is locked.

---

## 4. "Auto Login" & Auto Clock-In Clarification

**Does Admin get auto logged in?**
-   **No**, they must enter their PIN.
-   **However**, they **Skip Attendance**. They do not need a shift or clock-in event to operate the system.

**Do Managers/Cashiers need to clock in *before* login?**
-   **Implementation Detail**: The system attempts to **Auto Clock-In** these users upon Login if:
    1.  They are assigned a role requiring shifts (Cashier/Manager).
    2.  They have a valid **Schedule** in the database for the current time.
-   **If Successful**: They land on the valid dashboard ready to work.
-   **If Failed (No Schedule)**: They may be logged in but show as "Not Clocked In", or login might be restricted depending on configuration. They would need to use the manual "Clock In" button or request a schedule.

---

## 5. Technical Implementation Notes
-   **`PinEntryScreen.tsx`**: Handles the UI for both Login (entering PIN) and Clock In/Out (separate buttons).
-   **`shiftRequirementResolver.ts`**: The backend logic that decides `mode: "admin"` vs `mode: "cashier"`.
-   **`auth-context.tsx`**: Manages the session state.
-   **`time-tracking.handlers.ts`**: Handles the actual database creation of clock events.
