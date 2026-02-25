# Aurswift Desktop POS

Modern Electron-based Point of Sale system for supermarkets with integrated hardware support, real-time synchronization, and automated updates.

## 🚀 Quick Setup

See [SSH Cloning & Setup](#-ssh-cloning--setup) for clone and environment setup (Windows full guide is there); see [Development](#-development) for Mac/Linux and run instructions.

---

## 🔑 SSH Cloning & Setup

To securely clone and contribute to this repository using SSH, set up SSH keys and (on Windows) the development environment as below.

### Mac & Linux

1. **Check for existing SSH keys:**
   ```bash
   ls -al ~/.ssh
   ```
2. **Generate a new SSH key:**
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```
   > **Note:** When prompted for the file to save the key (e.g., `/Users/admin/.ssh/id_ed25519`), type the name of the file or directory, like `id_personal` or a full path.
   > Leave the passphrase as it is (empty) by pressing Enter.
3. **Start the SSH agent:**
   ```bash
   eval "$(ssh-agent -s)"
   ```
4. **Add your SSH key to the ssh-agent:**
   ```bash
   ssh-add ~/.ssh/id_personal
   ```
5. **Add the SSH key to GitHub:**
   - Copy the contents of your `.pub` file (e.g., `cat ~/.ssh/id_personal.pub`).
   - Paste the `.pub` content into your GitHub website personal account SSH keys section.
6. **Clone or update remote URL:**
   - Check out freshly: `git clone git@github.com:AurSwift/AurSwiftDesktop.git`
   - Or redefine the remote pattern the SSH way for an existing clone:
     ```bash
     git remote set-url origin git@github.com:AurSwift/AurSwiftDesktop.git
     ```

Then follow [Development](#-development) for install and run steps.

### Windows

Use **Git Bash** where possible so commands match Mac/Linux.

#### SSH keys

1. **Check for existing SSH keys:**
   ```bash
   ls -al ~/.ssh
   ```
2. **Generate a new SSH key:**
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```
   > **Note:** When prompted for the file to save the key (e.g., `C:\Users\username\.ssh\id_ed25519`), type the name of the file, like `id_personal` or a full path.
   > Leave the passphrase as it is (empty) by pressing Enter.
3. **Start the SSH agent:**
   - In **Git Bash**: `eval "$(ssh-agent -s)"`
   - In **PowerShell** (Run as Administrator):
     ```powershell
     Get-Service ssh-agent | Set-Service -StartupType Manual
     Start-Service ssh-agent
     ```
4. **Add your SSH key to the ssh-agent:** `ssh-add ~/.ssh/id_personal`
5. **Add the SSH key to GitHub:** Copy your `.pub` contents (e.g., open `~/.ssh/id_personal.pub` in Notepad) and add to GitHub → Settings → SSH keys.
6. **Clone or update remote URL:**
   - Fresh clone: `git clone git@github.com:AurSwift/AurSwiftDesktop.git`
   - Existing clone: `git remote set-url origin git@github.com:AurSwift/AurSwiftDesktop.git`

#### Windows development environment

AurSwift needs **Node.js 22.12.0+** and native build tools on Windows. Set these up before installing dependencies.

**Prerequisites:** Windows 10/11 (64-bit), ~10GB free space, Administrator access.

1. **Node.js (NVM recommended)**  
   - Install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) (`nvm-setup.exe`), then:
     ```powershell
     nvm install 22.12.0
     nvm use 22.12.0
     ```
   - Or install Node.js 22.x from [nodejs.org](https://nodejs.org/) and restart.  
   - Verify: `node --version` (v22.12.0 or higher), `npm --version` (≥10).  
   - With NVM you can run `nvm use` in the repo to match `.nvmrc`.

2. **Visual Studio Build Tools**  
   Native modules (`better-sqlite3`, `serialport`, `node-hid`, `usb`) require C++ build tools.  
   - Download [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/).  
   - In the installer, select **Desktop development with C++** and ensure:  
     MSVC v143 (latest), Windows SDK (latest), C++ CMake tools, C++ ATL for v143 (x86 & x64).  
   - Then:
     ```powershell
     npm config set msvs_version 2022
     npm config set python python3
     ```

3. **Python**  
   `node-gyp` needs Python 3.x.  
   - Install [Python 3.11 or 3.12](https://www.python.org/downloads/) and **check "Add Python to PATH"**.  
   - Configure: `npm config set python python3`

4. **Clone** (if not done above):  
   `git clone git@github.com:AurSwift/AurSwiftDesktop.git` then `cd AurSwiftDesktop`

5. **Install dependencies:**
   ```powershell
   npm cache clean --force
   npm install
   ```
   Native modules will compile (can take 10–20 minutes). `npm run postinstall` runs `electron-rebuild` automatically.

6. **Verify:**  
   `npm start` (dev server + Electron window). Optional: `npm run test:unit`, `npm run test:e2e`, `npm run compile`.

---

## 🏗️ Architecture Overview

### Technology Stack

**Core Framework:**

- **Electron** 38.1.2 (Multi-process architecture)
- **React** 18 with TypeScript 5.9.2
- **Node.js** ≥22.12.0

**Build & Development:**

- **Vite** 7.1.6 (Build tool)
- **electron-builder** 26.0.12 (Packaging & distribution)
- **Playwright** 1.55.0 (E2E testing)

**UI & Styling:**

- **Radix UI** (Component library)
- **Tailwind CSS** 4.1.13
- **Framer Motion** (Animations)

**Database:**

- **SQLite** via better-sqlite3 12.5.0
- **Drizzle ORM** (Schema management & migrations)

**Hardware Integration:**

- **Thermal Printers:** node-thermal-printer (ESC/POS protocol)
- **Card Readers:** Viva Wallet integration
- **Barcode Scanners:** USB HID device support
- **Digital Scales:** Serial port communication

**State Management:**

- **Redux Toolkit** (Global state)
- **TanStack Query** (Server state & caching)

---

## 📦 Package Structure

```
packages/
├── main/                    # Electron main process (Node.js)
│   ├── src/
│   │   ├── index.ts        # Application entry point
│   │   ├── database/       # SQLite database layer
│   │   │   ├── schema.ts   # Database schema (105KB)
│   │   │   ├── db-manager.ts
│   │   │   ├── drizzle-migrator.ts
│   │   │   └── managers/   # Business logic managers
│   │   ├── services/       # Hardware & external services
│   │   │   ├── thermalPrinterService.ts
│   │   │   ├── paymentService.ts
│   │   │   ├── scaleService.ts
│   │   │   ├── licenseService.ts
│   │   │   └── subscriptionEventClient.ts
│   │   ├── modules/        # Core application modules
│   │   │   ├── WindowManager.ts
│   │   │   ├── AutoUpdater.ts
│   │   │   └── SingleInstanceApp.ts
│   │   └── ipc/            # IPC handlers
│   └── package.json
│
├── renderer/                # React UI (Browser context)
│   ├── src/
│   │   ├── main.tsx        # React entry point
│   │   ├── features/       # Feature modules
│   │   │   ├── auth/
│   │   │   ├── inventory/
│   │   │   ├── sales/
│   │   │   └── user-management/
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── useThermalPrinter.ts
│   │   │   ├── useProductionScanner.ts
│   │   │   └── useOfficePrinter.ts
│   │   └── pages/
│   │       └── dashboard/
│   │           ├── cashier/
│   │           ├── manager/
│   │           └── admin/
│   └── package.json
│
└── preload/                 # IPC bridge (Secure context)
    ├── src/
    │   ├── index.ts        # Exposes APIs to renderer
    │   └── exposed.ts      # Type definitions
    └── package.json
```

---

## 💾 Database Architecture

**Database Engine:** SQLite (better-sqlite3)  
**ORM:** Drizzle ORM with TypeScript schema  
**Schema Size:** 105KB (comprehensive business logic)

### Core Tables

**User Management:**

- `users` - Authentication, roles, permissions
- `businesses` - Multi-tenant support
- `attendance_reports` - Staff clock-in/out tracking
- `pos_shift_reports` - Cashier shift management

**Inventory:**

- `products` - Product catalog with modifiers
- `categories` - Product categorization
- `stock_adjustments` - Inventory change tracking
- `suppliers` - Supplier management

**Sales & Transactions:**

- `transactions` - Sales records
- `transaction_items` - Line items with modifiers
- `payment_methods` - Payment type configuration
- `cash_drawer_counts` - Cash reconciliation

**Audit & Compliance:**

- `audit_logs` - Comprehensive activity tracking
- `licenses` - Software licensing
- `subscriptions` - Subscription management

### Key Features

- **RBAC:** Role-based access control with granular permissions
- **Multi-tenant:** Support for multiple business entities
- **Audit Trail:** Comprehensive logging of all operations
- **Migrations:** Automated schema migrations via Drizzle
- **Backup & Restore:** Built-in database management tools

### Database Location

- **Development:** `./data/pos_system.db`
- **Production:** OS-specific user data directory
  - macOS: `~/Library/Application Support/aurswift/pos_system.db`
  - Windows: `%APPDATA%/aurswift/pos_system.db`

### Database Commands

```bash
npm run db:dev:clean      # Remove development database
npm run db:dev:backup     # Create timestamped backup
npm run db:generate       # Generate migration files
npm run db:push           # Push schema changes
npm run db:studio         # Open Drizzle Studio
```

---

## 🔌 Hardware Integration

### 1. Thermal Receipt Printers

**Protocol:** ESC/POS  
**Service:** `packages/main/src/services/thermalPrinterService.ts`

**Supported Devices:**

- USB: Epson TM Series, Star TSP Series, Citizen CT, Bixolon SRP
- Bluetooth: DIERI BT, Epson TM-P Series, Star SM-L Series

**Features:**

- Auto-detection of USB/Bluetooth printers
- Print queue management
- Receipt formatting with custom layouts
- Connection monitoring & timeout handling (10s)
- Paper width support (58mm, 80mm)

### 2. Payment Processing

**Service:** `packages/main/src/services/paymentService.ts`  
**Provider:** Viva Wallet

**Features:**

- Card payment processing (swipe/tap/chip)
- Payment intent creation
- Transaction verification
- Refund processing
- Receipt generation

### 3. Barcode Scanners

**Hook:** `packages/renderer/src/hooks/useProductionScanner.ts`

**Features:**

- USB HID scanner support
- Automatic product lookup
- Audio feedback on scan
- Weight-based product handling

### 4. Digital Scales

**Service:** `packages/main/src/services/scaleService.ts`

**Features:**

- Serial port communication
- Real-time weight reading
- Automatic price calculation for weight-based products

---

## 🔐 Security & Authentication

**Authentication:**

- bcryptjs password hashing
- Session-based authentication with token expiration
- Role-based access control (RBAC)
- IPC handler protection

**Licensing:**

- Machine fingerprinting
- License activation & validation
- Subscription management
- Real-time sync with web platform

**Data Security:**

- SQLite database encryption support
- Secure IPC communication via contextBridge
- No remote code execution vulnerabilities

---

## 🔄 Auto-Update System

**Module:** `packages/main/src/modules/AutoUpdater.ts`  
**Provider:** GitHub Releases  
**Update Mechanism:** electron-updater

### Update Strategy

**Smart Scheduling:**

- Checks for updates every 4 hours
- Skips checks if user idle >30 minutes
- 5-second startup delay
- 15-minute cache to avoid redundant downloads

**Differential Updates:**

- Uses `.blockmap` files for block-level updates
- Downloads only changed blocks (saves bandwidth)
- Falls back to full installer if differential not available

**User Experience:**

- Background download with progress tracking
- "Install Now" / "Remind Me Later" / "Skip Version" options
- 2-hour postpone interval (max 3 times)
- SHA512 checksum verification

**Supported Platforms:**

- Windows: NSIS (one-click installer) + Squirrel (delta updates)

**Configuration:**

```typescript
// Update check interval: 4 hours
// Idle threshold: 30 minutes
// Cache duration: 15 minutes
// Request timeout: 10 seconds
// Max retries: 3 attempts
```

---

## 📝 Build & Distribution

### Build Process

```bash
# 1. Install dependencies
npm install

# 2. Rebuild native modules
npm run postinstall  # Runs electron-rebuild

# 3. Build all packages
npm run build        # Builds renderer, main, and preload

# 4. Package application
npm run compile      # Runs electron-builder
```

### Native Modules

The following native modules require compilation:

- **better-sqlite3** - SQLite database
- **node-hid** - USB device communication
- **serialport** - Serial port communication
- **usb** - USB device access

These are automatically rebuilt via `electron-rebuild` after installation.

### Build Targets

**Windows (Primary):**

- **NSIS Installer:** One-click installation to user profile (no admin required)
- **Squirrel Package:** Delta updates via `.nupkg` files
- **Architecture:** x64

**Configuration:** `electron-builder.mjs`

### Build Artifacts

```
dist/
├── aurswift-{version}-win-x64.exe          # NSIS installer
├── aurswift-{version}-win-x64.exe.blockmap # Differential update map
├── squirrel-windows/
│   ├── aurswift-{version}-win-x64.nupkg   # Squirrel package
│   └── RELEASES                            # Squirrel manifest
└── latest.yml                              # Auto-updater manifest
```

### Distribution

**Platform:** GitHub Releases  
**Repository:** [AurSwift/AurSwift](https://github.com/AurSwift/AurSwift)

**Release Automation:**

- Semantic versioning via `semantic-release`
- Automated changelog generation
- Conventional commit message parsing
- Automatic asset upload to GitHub Releases

---

## 🚀 Release Workflow

### Semantic Versioning

The project uses **Conventional Commits** for automated versioning:

| Commit Type                            | Example                    | Release Type | Version Impact    |
| -------------------------------------- | -------------------------- | ------------ | ----------------- |
| `feat`                                 | `feat: add offline mode`   | Minor        | `1.0.0` → `1.1.0` |
| `fix`                                  | `fix: login crash`         | Patch        | `1.0.1` → `1.0.2` |
| `perf`                                 | `perf: improve startup`    | Patch        | `1.0.1` → `1.0.2` |
| `refactor`                             | `refactor: user context`   | Patch        | `1.0.1` → `1.0.2` |
| `build`                                | `build: update deps`       | Patch        | `1.0.1` → `1.0.2` |
| `feat!` or `BREAKING CHANGE`           | `feat!: drop win7 support` | Major        | `1.0.0` → `2.0.0` |
| `docs`, `style`, `test`, `chore`, `ci` | -                          | None         | No release        |

### CI/CD Pipeline

**Trigger:** Push to `main` branch or workflow dispatch  
**Workflow:** `.github/workflows/ci.yml`

**Pipeline Stages:**

1. **Prepare** - Determine version with semantic-release (dry-run)
2. **Typecheck** - Fast TypeScript validation
3. **Build** - Compile Windows artifacts on `windows-2022` runner
4. **Tests** - Run unit, integration, and E2E tests (Playwright)
5. **Semantic Release** - Generate changelog, create GitHub release, upload assets

**Optimizations:**

- Skip Electron download when not needed (`ELECTRON_SKIP_BINARY_DOWNLOAD=1`)
- Skip Playwright browsers when not testing (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`)
- Conditional job execution based on commit types
- Native module caching for faster builds

---

## 🧪 Testing

### Test Framework

- **Unit/Integration:** Vitest 2.1.0
- **E2E:** Playwright 1.55.0
- **Component Testing:** @testing-library/react

### Test Commands

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Test Environment

```env
CI=true
NODE_ENV=test
ELECTRON_DISABLE_GPU=1
ELECTRON_NO_SANDBOX=1
PLAYWRIGHT_HEADLESS=1
HARDWARE_SIMULATION_MODE=true
MOCK_PRINTER_ENABLED=true
ELECTRON_UPDATER_DISABLED=1
```

---

## 🛠️ Development

> **Windows:** Full setup (Node, Build Tools, Python, clone, install) is in [SSH Cloning & Setup — Windows](#windows).

### 🍎 Mac/Linux Setup Guide

Ensure you have:
- **Node.js:** ≥22.12.0
- **npm:** ≥10.0.0
- **Python:** 3.x
- **C/C++ Build Tools:** Xcode Command Line Tools (macOS) or `build-essential` (Linux)

### 🚀 Getting Started

1. **Install Git & Clone** (if not done via SSH earlier):
   ```bash
   git clone git@github.com:AurSwift/AurSwiftDesktop.git
   cd AurSwiftDesktop
   ```

2. **Clean npm cache (recommended):**
   ```bash
   npm cache clean --force
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```
   > ⏳ **Note:** This process may take 10-20 minutes. Native modules will be compiled during this step. After installation, `npm run postinstall` will automatically run `electron-rebuild`.

4. **Run Development Server:**
   ```bash
   npm start
   ```

### Project Scripts

```bash
npm run build           # Build all packages
npm run compile         # Build + package with electron-builder
npm run typecheck       # TypeScript type checking
npm run test            # Run all tests
npm run db:studio       # Open Drizzle Studio
npm start               # Start development mode
```

---

## 📚 Documentation

Comprehensive guides are available in the `docs/` directory:

- **Auto-Update:** `docs/Guides/AutoUpdate/RELEASE_AND_UPDATE_WORKFLOW.md`
- **Database:** `docs/DATABASE_CONFIG.md`
- **Hardware:** `docs/Guides/Hardwares/README.md`
- **Logging:** `docs/Guides/LOGGING_GUIDE.md`
- **Performance:** `docs/Guides/Optimizations/PERFORMANCE_OPTIMIZATIONS.md`

---

## 📄 License

See [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

## 📞 Support

- **Email:** aurswiftassistanceteam@gmail.com
- **Website:** [https://aurswift.vercel.app](https://aurswift.vercel.app)
- **Repository:** [https://github.com/AurSwift/AurSwift](https://github.com/AurSwift/AurSwift)
