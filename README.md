# aurswift POS

Modern window based POS software for supermarket built using electron-vite-builder boilderplate.

## 🏗️ Application Architecture Overview

### Technology Stack

**Electron Multi-Process Architecture:**

- **Main Process:** Node.js with TypeScript
- **Renderer Process:** React 18 + Redux Toolkit + TanStack Query
- **Preload:** Secure IPC bridge with contextBridge

**Key Technologies:**

- **Framework:** Electron 38.1.2, React 18, TypeScript 5.9.2
- **Build Tools:** Vite 7.1.6, electron-builder 26.0.12
- **UI:** Radix UI, Tailwind CSS 4.1.13, Framer Motion
- **Database:** better-sqlite3 (SQLite)
- **Hardware:** node-hid, serialport, usb, node-thermal-printer
- **Payments:** Stripe Terminal (@stripe/stripe-js, @stripe/terminal-js)

---

## 📦 Package Structure

```
packages/
├── main/                    # Electron main process
│   ├── src/
│   │   ├── index.ts        # App entry point
│   │   ├── database.ts     # SQLite database layer (3200+ lines)
│   │   ├── services/
│   │   │   ├── paymentService.ts      # BBPOS WisePad 3 + Stripe
│   │   │   └── thermalPrinterService.ts # ESC/POS printer
│   │   └── modules/
│   │       ├── WindowManager.ts
│   │       ├── AutoUpdater.ts
│   │       └── ...
│   └── package.json        # Dependencies: better-sqlite3, node-thermal-printer
│
├── renderer/                # React UI
│   ├── src/
│   │   ├── main.tsx        # React app entry
│   │   ├── app/            # App providers
│   │   ├── components/     # UI components
│   │   │   ├── payment/    # Stripe Terminal UI
│   │   │   ├── printer/    # Printer status UI
│   │   │   └── scanner/    # Barcode scanner UI
│   │   ├── features/       # Business logic
│   │   │   ├── auth/
│   │   │   ├── inventory/
│   │   │   ├── sales/
│   │   │   └── user-management/
│   │   ├── hooks/
│   │   │   ├── useStripeTerminal.ts   # Card reader integration
│   │   │   ├── useThermalPrinter.ts   # Printer integration
│   │   │   └── useProductionScanner.ts # Barcode scanner
│   │   └── pages/
│   │       └── dashboard/
│   │           └── cashier/
│   │               └── features/
│   │                   └── new-transaction-view.tsx # Main POS UI
│   └── package.json        # 94 lines, 50+ dependencies
│
└── preload/                 # IPC bridge
    ├── src/
    │   ├── index.ts        # Exposes APIs to renderer
    │   └── exposed.ts      # Type definitions
    └── package.json
```

---

## 🔌 Hardware Integration Architecture

### 1. **Thermal Receipt Printer** (ESC/POS Protocol)

**Service:** `packages/main/src/services/thermalPrinterService.ts`

**Supported Hardware:**

- USB: Epson TM Series, Star TSP Series, Citizen CT, Bixolon SRP
- Bluetooth: DIERI BT, Epson TM-P Series, Star SM-L Series

**Key Features:**

- Print queue management
- USB/Bluetooth auto-detection
- Receipt formatting with ESC/POS commands
- Timeout handling (10 seconds)
- Connection monitoring

**IPC Handlers:**

```typescript
printer: initialize; // Connect to printer
printer: print; // Queue and print receipt
printer: status; // Get connection status
printer: test; // Print test receipt
printer: disconnect; // Disconnect printer
printer: interfaces; // Scan for available printers
```

**Implementation Details:**

- Uses `node-thermal-printer` v4.5.0
- Supports character sets (CP437, etc.)
- Handles paper width (58mm, 80mm)
- Native module requiring electron-rebuild

---

### 2. **BBPOS WisePad 3 Card Reader** (Stripe Terminal)

**Service:** `packages/main/src/services/paymentService.ts` (752 lines)

**Hardware:** BBPOS WisePad 3 (USB/Bluetooth)

**Stripe Integration:**

- Stripe API v2025-10-29.clover
- Payment Intent creation
- Card swipe/tap/chip processing
- Terminal reader management

**IPC Handlers:**

```typescript
payment: initialize - reader; // Connect BBPOS device
payment: discover - readers; // Scan for readers
payment: reader - status; // Get connection status
payment: test - reader; // Test reader connection
payment: create - intent; // Create payment intent
payment: process - card; // Process card payment
payment: cancel; // Cancel payment
payment: connection - token; // Get Stripe Terminal token
```

**Implementation Details:**

- Uses `node-hid` for USB communication
- Stripe SDK for payment processing
- Simulated mode for development/testing
- Event-driven architecture
- Battery level monitoring
- Firmware version tracking

**React Hook:** `useStripeTerminal` (500+ lines)

- Auto-initialization
- Payment flow state management
- Error handling
- Progress tracking

---

### 3. **Barcode Scanner Integration**

**Hook:** `packages/renderer/src/hooks/useProductionScanner.ts`

**Features:**

- Hardware scanner event listening
- Audio feedback on successful scan
- Automatic product lookup
- Weight-based product handling

**Implementation:**

- Listens for keyboard input from USB scanner
- Validates barcode format
- Integrates with inventory system

---

## 💾 Database Architecture

**File:** `packages/main/src/database.ts` (3204 lines)

**Database:** SQLite (better-sqlite3)

**Tables:**

- Users (authentication, roles, permissions)
- Businesses (multi-tenant)
- Products (inventory with modifiers)
- Categories
- Transactions (sales records)
- TransactionItems (line items)
- Shifts (cashier shift management)
- CashDrawerCounts (cash reconciliation)
- AuditLogs (comprehensive audit trail)
- StockAdjustments (inventory changes)
- PaymentMethods
- Modifiers/ModifierOptions

**Key Features:**

- RBAC (Role-Based Access Control)
- Multi-tenant support
- Comprehensive audit logging
- Automatic shift closure (30-minute intervals)
- Transaction history
- Inventory tracking
- Cash drawer reconciliation

**Special Product Types:**

- Regular products (fixed price)
- Weight-based products (price per unit: lb, kg, oz, g)
- Products with modifiers

---

## 🔐 Security & Authentication

**Auth Implementation:**

- bcryptjs password hashing
- Session-based authentication
- Token expiration
- Role-based permissions
- IPC handler protection

**Files:**

- `packages/main/src/authApi.ts` - Authentication logic
- `packages/main/src/authStore.ts` - Session management
- `packages/main/src/passwordUtils.ts` - Password hashing

---

## 🔄 Auto-Update System

**Module:** `packages/main/src/modules/AutoUpdater.ts`

**Features:**

- electron-updater integration
- Automatic update checking
- Update download and installation
- User notification
- Version checking

**Disabled in:**

- Test environment (`NODE_ENV=test`)
- When `ELECTRON_UPDATER_DISABLED=1`

---

## 🎨 UI Architecture

### **Component Library:** Shadcn UI + Tailwind CSS

**Key Pages:**

1. **Authentication**

   - Login/Register
   - Password management

2. **Dashboard**

   - Cashier view (main POS interface)
   - Inventory management
   - Sales reporting
   - User management
   - Shift management

3. **POS Transaction Flow**
   - Product search/barcode scan
   - Cart management
   - Weight-based product handling
   - Payment processing (cash/card)
   - Receipt printing
   - Shift management

### **State Management:**

- Redux Toolkit for global state
- TanStack Query for server state
- Local state with React hooks

---

## 🧪 Testing Architecture

**Framework:** Playwright 1.55.0

**Test Files:**

1. `tests/e2e.spec.ts` - End-to-end tests
2. `tests/hardware-integration.spec.ts` - Hardware API tests

**Test Environment:**

- Headless Electron
- Mock hardware devices
- Simulated payment processing
- Test database

**Environment Variables:**

```env
CI=true
NODE_ENV=test
ELECTRON_DISABLE_GPU=1
ELECTRON_NO_SANDBOX=1
PLAYWRIGHT_HEADLESS=1
HARDWARE_SIMULATION_MODE=true
MOCK_PRINTER_ENABLED=true
MOCK_CARD_READER_ENABLED=true
MOCK_SCANNER_ENABLED=true
ELECTRON_UPDATER_DISABLED=1
```

---

## 📝 Build & Distribution

### **Build Process:**

1. Build renderer (Vite)
2. Build main process (Vite + TypeScript)
3. Build preload (Vite)
4. Run electron-rebuild for native modules
5. Package with electron-builder

### **Native Modules Requiring Rebuild:**

- `better-sqlite3` - Database
- `node-hid` - USB device communication
- `serialport` - Serial port communication
- `usb` - USB device access

### **Platforms:**

- Primary: Windows (windows-latest runner)
- Configuration: `electron-builder.mjs`

### **Artifacts:**

- Windows installers (.exe)
- Portable apps
- Auto-update manifests (latest.yml)

---

## 📊 Dependency Analysis

### **Heavy Dependencies (Build Time Impact):**

1. **Electron** (38.1.2)

   - Large download (~150 MB)
   - Version-locked with native modules
   - Skipped in semantic-release job

2. **Playwright** (~300 MB with browsers)

   - Only needed for testing
   - Now conditionally installed

3. **Native Modules** (compilation required)

   - better-sqlite3
   - node-hid
   - serialport
   - usb

4. **UI Framework** (Radix UI)
   - 20+ Radix UI packages
   - Now grouped in dependabot

### **Optimization Strategy:**

- Skip Electron download when not needed
- Skip Playwright download when not needed
- Cache compiled native modules
- Group related dependency updates

---

## 🔍 Code Quality Observations

### **Strengths:**

✅ Well-organized monorepo structure  
✅ Clear separation of concerns  
✅ Comprehensive error handling  
✅ Extensive documentation  
✅ Type safety with TypeScript  
✅ Hardware abstraction layers

### **Areas for Future Improvement:**

- Consider removing mock printer service to avoid confusion
- Consolidate documentation across multiple files
- Add unit tests for business logic
- Consider splitting large database file (3200 lines)

---

## 🎯 Future Workflow Optimization Alignment

1. **Native Module Caching:**

   - The app has 4 native modules requiring compilation
   - Each rebuild: 3-5 minutes
   - Cached: <30 seconds
   - **Impact:** Critical for development velocity

2. **Dependency Grouping:**

   - 20+ Radix UI packages update frequently
   - Grouping reduces 20 PRs → 1 PR
   - **Impact:** Less workflow noise and cost

3. **Job Consolidation:**

   - Typecheck + compile shared identical setup
   - Separate jobs wasted 5+ minutes on duplicate setup
   - **Impact:** 40% faster builds

4. **Smart Test Execution:**
   - Playwright (300MB) not always needed
   - Conditional installation saves time and bandwidth
   - **Impact:** Faster builds when tests unchanged

---

## 📈 Performance Characteristics

### **App Startup:**

- Database initialization
- Hardware service initialization (printer, card reader)
- Auto-update check
- Shift cleanup (auto-close old shifts)

### **Runtime:**

- Real-time barcode scanning
- Card payment processing
- Receipt printing
- Database queries
- Audit logging

### **Build Characteristics:**

- TypeScript compilation: ~30 seconds
- Vite bundling: ~1-2 minutes
- Native module rebuild: 3-5 minutes (or cached: ~30 seconds)
- Electron packaging: ~2 minutes

---

## 🎓 Lessons for Workflow Design

### **Key Insights:**

1. **Native modules are expensive**

   - Cache aggressively
   - Rebuild only when necessary
   - Verify builds before running tests

2. **Hardware integration is complex**

   - Mock/simulate for CI
   - Test real hardware separately
   - Document hardware requirements

3. **Electron apps are large**

   - Skip downloads when possible
   - Use artifacts for distribution
   - Cache everything feasible

4. **POS systems need reliability**
   - Comprehensive error handling
   - Audit logging
   - Transaction integrity
   - Hardware failure recovery

---

## 🗄️ Database Configuration

This POS system uses **environment-aware database storage**:

- **Development**: `./data/pos_system.db` (project directory)
- **Production**: OS-specific user data directory (e.g., `~/Library/Application Support/aurswift/pos_system.db` on macOS)

### Quick Commands

```bash
npm run db:dev:clean    # Remove development database
npm run db:dev:backup   # Create timestamped backup
npm run db:info         # Show database information
```

For detailed configuration, environment variables, custom paths, and migration options, see [docs/DATABASE_CONFIG.md](docs/DATABASE_CONFIG.md).

## Contribution

See [Contributing Guide](CONTRIBUTING.md).

[vite]: https://github.com/vitejs/vite/
[electron]: https://github.com/electron/electron
[electron-builder]: https://github.com/electron-userland/electron-builder
[playwright]: https://playwright.dev

```
aurswift
├─ .editorconfig
├─ .env
├─ .idea
│  ├─ codeStyles
│  │  ├─ Project.xml
│  │  └─ codeStyleConfig.xml
│  ├─ deployment.xml
│  ├─ git_toolbox_blame.xml
│  ├─ git_toolbox_prj.xml
│  ├─ inspectionProfiles
│  │  └─ Project_Default.xml
│  ├─ jsLibraryMappings.xml
│  ├─ jsLinters
│  │  └─ eslint.xml
│  ├─ jsonSchemas.xml
│  ├─ modules.xml
│  ├─ php.xml
│  ├─ prettier.xml
│  ├─ runConfigurations
│  │  └─ Attach_Debugger.xml
│  ├─ scopes
│  │  ├─ main.xml
│  │  ├─ preload.xml
│  │  └─ renderer.xml
│  ├─ vcs.xml
│  └─ webResources.xml
├─ .npmrc
├─ .releaserc.json
├─ .versionrc.json
├─ CHANGELOG.md
├─ CONTRIBUTING.md
├─ DATABASE_CONFIG.md
├─ LICENSE
├─ README.md
├─ buildResources
│  ├─ icon.icns
│  └─ icon.ico
├─ docs
│  ├─ AutoUpdate
│  │  ├─ AUTO_UPDATE_FEATURE_IN_DETAIL.md
│  │  ├─ AUTO_UPDATE_GUIDE.md
│  │  ├─ CLIENT_MIGRATION_COMPREHENSIVE_ANALYSIS.md
│  │  ├─ CLIENT_MIGRATION_TESTING_GUIDE.md
│  │  ├─ CLIENT_MIGRATION_TESTING_PLAN.md
│  │  ├─ CLIENT_RELEASE_TESTING_GUIDE.md
│  │  ├─ DATABASE_MIGRATION_BEST_PRACTICES.md
│  │  ├─ DATABASE_SCHEMA_CHANGES_GUIDE.md
│  │  ├─ FIRST_RELEASE_TEST_PLAN.md
│  │  ├─ IN_DETAIL_UPDATE_WORKFLOW.md
│  │  ├─ MIGRATION_REFACTOR_SUMMARY.md
│  │  ├─ MIGRATION_SAFETY_IMPLEMENTATION.md
│  │  ├─ QUICK_TESTING_CHECKLIST.md
│  │  ├─ README.md
│  │  └─ VISUAL_UPDATE_GUIDE.md
│  ├─ CASHIER_QUICK_REFERENCE.md
│  ├─ CASHIER_TRANSACTION_WORKFLOW.md
│  ├─ CLOCK_IN_OUT_QUICK_REFERENCE.md
│  ├─ CLOCK_IN_OUT_SYSTEM.md
│  ├─ ChangeLog
│  │  └─ CHANGELOG_GENERATION_GUIDE.md
│  ├─ DATABASE_MIGRATION_SYSTEM.md
│  ├─ DATABASE_SEEDING.md
│  ├─ DISCOUNT_SYSTEM.md
│  ├─ DRIZZLE_MIGRATION_GUIDE.md
│  ├─ HP_LASERJET_ANALYSIS.md
│  ├─ Hardwares
│  │  ├─ CARD_READERD_HARDWARE_SETUP.md
│  │  ├─ PAYMENT_ISSUES_SUMMARY.md
│  │  ├─ PAYMENT_PRODUCTION_READINESS_ANALYSIS.md
│  │  ├─ PAYMENT_QUICK_FIXES.md
│  │  ├─ PCICompilanceGuide.md
│  │  ├─ PRINTER_INTEGRATION_SUMMARY.md
│  │  ├─ PRINTER_ISSUES_SUMMARY.md
│  │  ├─ PRINTER_PRODUCTION_ANALYSIS.md
│  │  ├─ PRINTER_TESTING_GUIDE.md
│  │  ├─ README.md
│  │  └─ SUPPORTED_PRINTERS.md
│  ├─ InstallerTypes
│  │  ├─ INSTALLER_TYPES_GUIDE.md
│  │  ├─ INSTALLER_VS_PORTABLE_EXPLAINED.md
│  │  └─ NSISANDSQUIRRELApproach.MD
│  ├─ Issues_LifeCycle
│  │  └─ index.md
│  ├─ MIGRATION_WORKFLOW.md
│  ├─ NOTES.md
│  ├─ USER_CREATION_VALIDATION.md
│  ├─ Validations
│  │  └─ AUTH_FORM_VALIDATION.md
│  ├─ WebHooks
│  │  ├─ WebhookInDetail.md
│  │  └─ readme.md
│  ├─ Zod
│  │  ├─ DRIZZLE_ZOD_VALIDATION.md
│  │  ├─ MIGRATION_SUMMARY.md
│  │  └─ ZOD_VALIDATION_GUIDE.md
│  └─ new_auth_system.md
├─ drizzle.config.ts
├─ electron-builder.mjs
├─ migrate-existing-db.mjs
├─ package-lock.json
├─ package.json
├─ packages
│  ├─ dev-mode.js
│  ├─ electron-versions
│  │  ├─ README.md
│  │  ├─ index.js
│  │  └─ package.json
│  ├─ entry-point.mjs
│  ├─ integrate-renderer
│  │  ├─ create-renderer.js
│  │  ├─ index.js
│  │  └─ package.json
│  ├─ main
│  │  ├─ package.json
│  │  ├─ src
│  │  │  ├─ AppInitConfig.ts
│  │  │  ├─ AppModule.ts
│  │  │  ├─ ModuleContext.ts
│  │  │  ├─ ModuleRunner.ts
│  │  │  ├─ appApi.ts
│  │  │  ├─ appStore.ts
│  │  │  ├─ index.ts
│  │  │  ├─ modules
│  │  │  │  ├─ AbstractSecurityModule.ts
│  │  │  │  ├─ ApplicationTerminatorOnLastWindowClose.ts
│  │  │  │  ├─ AutoUpdater.ts
│  │  │  │  ├─ BlockNotAllowdOrigins.ts
│  │  │  │  ├─ ChromeDevToolsExtension.ts
│  │  │  │  ├─ ExternalUrls.ts
│  │  │  │  ├─ HardwareAccelerationModule.ts
│  │  │  │  ├─ SingleInstanceApp.ts
│  │  │  │  └─ WindowManager.ts
│  │  │  ├─ passwordUtils.ts
│  │  │  ├─ services
│  │  │  │  ├─ officePrinterService.ts
│  │  │  │  ├─ paymentService.ts
│  │  │  │  ├─ pdfReceiptService.ts
│  │  │  │  └─ thermalPrinterService.ts
│  │  │  └─ thermalPrinterService.ts
│  │  ├─ tsconfig.json
│  │  └─ vite.config.js
│  ├─ preload
│  │  ├─ package.json
│  │  ├─ src
│  │  │  ├─ exposed.ts
│  │  │  ├─ index.ts
│  │  │  ├─ nodeCrypto.ts
│  │  │  └─ versions.ts
│  │  ├─ tsconfig.json
│  │  └─ vite.config.js
│  └─ renderer
│     ├─ README.md
│     ├─ components.json
│     ├─ docs
│     │  ├─ SalesVsCashDrawerCount.md
│     │  ├─ auditLogs.md
│     │  ├─ barcodeintegrationRoughFlow.md
│     │  ├─ cashdrawercountlogic.md
│     │  ├─ cashierFlow.md
│     │  ├─ refundtransactionlogic.md
│     │  ├─ shiftallCases.md
│     │  ├─ shifttimeCase.md
│     │  └─ voidtransactionlogic.md
│     ├─ eslint.config.js
│     ├─ index.html
│     ├─ package.json
│     ├─ public
│     │  ├─ modern-retail-store-interior-with-sleek-pos-system.jpg
│     │  └─ vite.svg
│     ├─ src
│     │  ├─ app
│     │  │  ├─ App.tsx
│     │  │  └─ providers
│     │  │     └─ app-providers.tsx
│     │  ├─ assets
│     │  │  └─ react.svg
│     │  ├─ components
│     │  │  ├─ payment
│     │  │  │  └─ PaymentComponents.tsx
│     │  │  ├─ printer
│     │  │  │  └─ ReceiptPrinterComponents.tsx
│     │  │  ├─ scanner
│     │  │  │  └─ ScannerStatusComponents.tsx
│     │  │  └─ ui
│     │  │     ├─ accordion.tsx
│     │  │     ├─ alert-dialog.tsx
│     │  │     ├─ alert.tsx
│     │  │     ├─ aspect-ratio.tsx
│     │  │     ├─ avatar.tsx
│     │  │     ├─ badge.tsx
│     │  │     ├─ breadcrumb.tsx
│     │  │     ├─ button.tsx
│     │  │     ├─ calendar.tsx
│     │  │     ├─ card.tsx
│     │  │     ├─ carousel.tsx
│     │  │     ├─ chart.tsx
│     │  │     ├─ checkbox.tsx
│     │  │     ├─ collapsible.tsx
│     │  │     ├─ command.tsx
│     │  │     ├─ context-menu.tsx
│     │  │     ├─ dialog.tsx
│     │  │     ├─ drawer.tsx
│     │  │     ├─ dropdown-menu.tsx
│     │  │     ├─ form.tsx
│     │  │     ├─ hover-card.tsx
│     │  │     ├─ input-otp.tsx
│     │  │     ├─ input.tsx
│     │  │     ├─ label.tsx
│     │  │     ├─ menubar.tsx
│     │  │     ├─ navigation-menu.tsx
│     │  │     ├─ pagination.tsx
│     │  │     ├─ popover.tsx
│     │  │     ├─ progress.tsx
│     │  │     ├─ radio-group.tsx
│     │  │     ├─ resizable.tsx
│     │  │     ├─ scroll-area.tsx
│     │  │     ├─ select.tsx
│     │  │     ├─ separator.tsx
│     │  │     ├─ sheet.tsx
│     │  │     ├─ sidebar.tsx
│     │  │     ├─ skeleton.tsx
│     │  │     ├─ slider.tsx
│     │  │     ├─ sonner.tsx
│     │  │     ├─ switch.tsx
│     │  │     ├─ table.tsx
│     │  │     ├─ tabs.tsx
│     │  │     ├─ textarea.tsx
│     │  │     ├─ toggle-group.tsx
│     │  │     ├─ toggle.tsx
│     │  │     └─ tooltip.tsx
│     │  ├─ features
│     │  │  ├─ auth
│     │  │  │  ├─ components
│     │  │  │  │  ├─ auth-hero-section.tsx
│     │  │  │  │  ├─ index.ts
│     │  │  │  │  ├─ login-form.tsx
│     │  │  │  │  └─ register-form.tsx
│     │  │  │  ├─ context
│     │  │  │  │  └─ auth-context.tsx
│     │  │  │  ├─ services
│     │  │  │  └─ types
│     │  │  │     └─ auth.types.ts
│     │  │  ├─ inventory
│     │  │  ├─ sales
│     │  │  └─ user-management
│     │  ├─ hooks
│     │  │  ├─ useOfficePrinter.ts
│     │  │  ├─ useProductionScanner.ts
│     │  │  ├─ useStripeTerminal.ts
│     │  │  └─ useThermalPrinter.ts
│     │  ├─ index.css
│     │  ├─ layouts
│     │  │  └─ dashboard-layout.tsx
│     │  ├─ lib
│     │  │  ├─ auth.ts
│     │  │  └─ utils.ts
│     │  ├─ main.tsx
│     │  ├─ pages
│     │  │  ├─ auth
│     │  │  │  └─ index.tsx
│     │  │  └─ dashboard
│     │  │     ├─ admin
│     │  │     │  ├─ features
│     │  │     │  │  ├─ admin-dashboard-view.tsx
│     │  │     │  │  └─ user-management-view.tsx
│     │  │     │  └─ index.tsx
│     │  │     ├─ cashier
│     │  │     │  ├─ features
│     │  │     │  │  ├─ cash-drawer-count-modal.tsx
│     │  │     │  │  ├─ cashier-dashboard-view.tsx
│     │  │     │  │  ├─ new-transaction-view.tsx
│     │  │     │  │  ├─ refund-transaction-view.tsx
│     │  │     │  │  └─ void-transaction-view.tsx
│     │  │     │  └─ index.tsx
│     │  │     ├─ index.tsx
│     │  │     └─ manager
│     │  │        ├─ features
│     │  │        │  ├─ manage-cashier-view.tsx
│     │  │        │  ├─ manage-categories-view.tsx
│     │  │        │  ├─ manage-product-view.tsx
│     │  │        │  ├─ manager-dashboard-view.tsx
│     │  │        │  └─ staff-schedules-view.tsx
│     │  │        └─ index.tsx
│     │  ├─ redux
│     │  │  ├─ AuthSlice.tsx
│     │  │  └─ store.ts
│     │  ├─ schemas
│     │  │  ├─ category-schema.ts
│     │  │  ├─ design1.png
│     │  │  └─ product-schema.ts
│     │  ├─ shared
│     │  │  ├─ components
│     │  │  │  ├─ avatar-upload.tsx
│     │  │  │  ├─ index.ts
│     │  │  │  ├─ loading-screen.tsx
│     │  │  │  ├─ protected-route.tsx
│     │  │  │  ├─ public-route.tsx
│     │  │  │  └─ user-avatar.tsx
│     │  │  ├─ constants
│     │  │  ├─ hooks
│     │  │  │  ├─ index.ts
│     │  │  │  ├─ use-auth.tsx
│     │  │  │  └─ use-mobile.ts
│     │  │  ├─ services
│     │  │  ├─ types
│     │  │  │  └─ global.d.ts
│     │  │  └─ utils
│     │  │     ├─ auth.ts
│     │  │     ├─ cn.ts
│     │  │     └─ index.ts
│     │  ├─ store
│     │  │  └─ index.ts
│     │  ├─ types
│     │  │  ├─ auth-store.d.ts
│     │  │  ├─ officePrinter.ts
│     │  │  ├─ printer.ts
│     │  │  └─ product.types.ts
│     │  ├─ utils
│     │  │  ├─ paymentFlow.ts
│     │  │  ├─ pdfReceiptGenerator.ts
│     │  │  ├─ receiptGenerator.ts
│     │  │  └─ scannerAudio.ts
│     │  └─ vite-env.d.ts
│     ├─ tsconfig.app.json
│     ├─ tsconfig.json
│     ├─ tsconfig.node.json
│     └─ vite.config.ts
├─ scripts
│  ├─ README.md
│  └─ bridge-migration.mjs
├─ test-db-path.mjs
├─ test-payment-flow.js
├─ test-stripe-config.js
├─ tests
│  ├─ e2e.spec.ts
│  └─ hardware-integration.spec.ts
└─ types
   ├─ env.d.ts
   └─ payment.d.ts

```
