# PIN-Based Authentication System Implementation

This document details the implementation of the PIN-based authentication system for the Desktop application. It covers architecture, persistence, security, and specific user flows including app restart scenarios.

## 1. Architecture Overview

The system uses a **Client-Server model** running locally within Electron:
-   **Renderer (Frontend)**: React components (`PinEntryScreen`, `AuthContext`) handle UI and state.
-   **Main Process (Backend)**: Electron IPC handlers (`auth.handlers.ts`) manage database operations and secure storage.
-   **Database**: SQLite (`drizzle-orm`) stores users, sessions, and encrypted settings.
-   **Secure Storage**: Electron `safeStorage` API encrypts sensitive tokens before saving to the database.

### Key Components
-   **`AuthContext (React)`**: Manages global user state (`user`, `token`, `activeShift`). Auto-validates session on mount.
-   **`authAPI (IPC)`**: Exposes login, register, and user management functions.
-   **`authStore (IPC)`**: A persistence bridge mapping to `auth:set`/`auth:get` for storing session tokens.
-   **`auth.handlers.ts`**: The "Backend" logic handling PIN hash verification, rate limiting, and session generation.

---

## 2. Persistence & Storage

Persistence ensures that users remain logged in (or their state is remembered) across app restarts.

### How it works
1.  **Token Storage**: When a user logs in, the session token is stored via:
    ```typescript
    await window.authStore.set("token", response.token);
    ```
    -   **Backend**: `ipcMain.handle("auth:set")` receives this.
    -   **Encryption**: Uses `safeStorage.encryptString(value)` to encrypt the token.
    -   **Database**: Stores the *encrypted* string in the `app_settings` table (Key: `token`).

2.  **App Restart / Re-open**:
    -   **`AuthContext` initialization**: On app launch (`useEffect`), it calls `validateSession()`.
    -   **Retrieval**: Calls `window.authStore.get("token")`.
    -   **Decryption**: Backend decrypts the token using `safeStorage`.
    -   **Validation**: Verifies the token against the `sessions` table in SQLite.
    -   **Result**: If valid, the user is automatically logged in without re-entering the PIN.

### storage Location
-   **Database File**: `app.db` (SQLite)
-   **Table**: `app_settings`
-   **Keys**: `token`, `user` (cached profile), `activeShift`.

---

## 3. Detailed Scenarios & Flows

### Scenario A: Initial Login
1.  **User Input**: User enters 4-digit PIN on `PinEntryScreen`.
2.  **Request**: `authAPI.login({ username, pin, terminalId })` sent to Main process.
3.  **Backend Verification**:
    -   Checks Rate Limits (prevent brute force).
    -   Hashes input PIN and compares with `users.pinHash`.
    -   Checks `isActive` status.
4.  **Success**:
    -   Generates `sessionToken`.
    -   Saves `sessionToken` to `sessions` table.
    -   Returns `user` object and `token`.
5.  **Persistence**: Frontend calls `authStore.set("token", ...)` to persist session.

### Scenario B: App Quit & Restart (Persistence)
1.  **Quit**: User closes the application. Electron process terminates.
2.  **Restart**: User opens the application.
3.  **Bootstrap**: `AuthContext` mounts and sets `isInitializing = true`.
4.  **Recovery**:
    -   Calls `authStore.get("token")`.
    -   Backend decrypts and returns the token from `app_settings`.
5.  **Validation**:
    -   `authAPI.validateSession(token)` is called.
    -   Backend checks if token exists in `sessions` table and hasn't expired.
6.  **Outcome**:
    -   **Valid**: User state is restored. App redirects to Dashboard (or last route).
    -   **Invalid/Expired**: Token is cleared. User is redirected to Login Screen.

### Scenario C: Clock-In vs Login (Difference)
-   **Login**: Authenticates the user to *access the system* (view dashboard, settings, etc.).
-   **Clock-In**: Starts a *Time Tracking Shift* for payroll/attendance.
-   **Flow**:
    -   A user can be Logged In but NOT Clocked In.
    -   To operate the POS (Process sales), a user MUST be Clocked In.

### Scenario D: Multi-User / Shared Terminal
1.  **Current User**: Logged in as "Cashier A".
2.  **Action**: Clicks "Logout" (or Switch User).
3.  **Cleanup**:
    -   `authAPI.logout(token)` called.
    -   Backend deletes session from `sessions` table.
    -   Frontend clears `token` and `user` from `authStore`.
    -   Clears React state.
4.  **New User**: "Cashier B" enters PIN.
5.  **Result**: Entire persistence flow restarts for "Cashier B".

---

## 4. Security Measures

1.  **Encryption**: Sensitive persisted data (Tokens) are encrypted at rest using system keychain/DPAPI via Electron `safeStorage`.
2.  **Rate Limiting**:
    -   Limits failed login attempts per username AND per terminal.
    -   Prevents brute-force attacks on the PIN.
    -   Audit logs all failed attempts.
3.  **Session Management**:
    -   Server-side validation of tokens on every critical action.
    -   Ability to revoke tokens (remote logout) by deleting from `sessions` table.
4.  **RBAC**:
    -   Permissions are validated against the `user_roles` and `permissions` tables on every sensitive IPC call.

## 5. Troubleshooting Persistence

If persistence fails (User has to log in every time):
1.  **Check SafeStorage**: Ensure `safeStorage.isEncryptionAvailable()` returns true in main process logs. (Linux requires a keyring).
2.  **Database Integrity**: Check if `app_settings` table is being cleared or corrupted locally.
3.  **Token Expiry**: Check if the logic in `auth.handlers.ts` sets an overly short expiry time for tokens.
