# Best Practice Testing Plan for AuraSwift POS

> **📘 This is a detailed reference. For the consolidated guide, see [README.md](./README.md)**

## Executive Summary

This document provides detailed explanations and justifications for the testing strategy. For quick reference and copy-paste patterns, see the [master README](./README.md).

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Recommended Testing Stack](#recommended-testing-stack)
3. [Test Architecture & Organization](#test-architecture--organization)
4. [Library Combinations & Justifications](#library-combinations--justifications)
5. [Configuration Best Practices](#configuration-best-practices)
6. [Testing Patterns & Examples](#testing-patterns--examples)
7. [Implementation Roadmap](#implementation-roadmap)
8. [CI/CD Integration](#cicd-integration)
9. [Performance & Coverage Goals](#performance--coverage-goals)

---

## Current State Analysis

### ✅ What's Already Good

- **Vitest** configured for unit/integration tests (fast, Vite-native)
- **Playwright** for E2E testing (industry standard)
- **React Testing Library** for component testing (best practice)
- **MSW (Mock Service Worker)** for API mocking (modern approach)
- **Coverage** with v8 provider configured
- Basic test structure in place

### 🔧 Areas for Improvement

1. **Missing Test Utilities**: Need more comprehensive mock factories and helpers
2. **Incomplete Coverage**: Many critical paths lack tests
3. **Hardware Testing**: Need better simulation/mocking strategies
4. **IPC Testing**: Electron IPC communication needs dedicated test utilities
5. **State Management Testing**: Redux Toolkit and TanStack Query testing patterns
6. **Visual Regression**: No visual/snapshot testing strategy
7. **Performance Testing**: No performance benchmarks
8. **Accessibility Testing**: Missing a11y testing

---

## Recommended Testing Stack

### Core Testing Framework

| Layer                | Library               | Version | Purpose                            |
| -------------------- | --------------------- | ------- | ---------------------------------- |
| **Unit/Integration** | Vitest                | ^2.1.0  | Fast, Vite-native, Jest-compatible |
| **E2E**              | Playwright            | ^1.55.0 | Cross-browser, Electron support    |
| **Component**        | React Testing Library | ^16.0.0 | User-centric component testing     |
| **API Mocking**      | MSW                   | ^2.6.0  | Service worker-based mocking       |
| **Coverage**         | @vitest/coverage-v8   | ^2.1.0  | V8 coverage provider               |

### Recommended Additions

| Library                            | Version         | Purpose                       | Priority                    |
| ---------------------------------- | --------------- | ----------------------------- | --------------------------- |
| **@testing-library/user-event**    | ^14.5.2         | ✅ Already have               | User interaction simulation |
| **@testing-library/jest-dom**      | ^6.6.0          | ✅ Already have               | DOM matchers                |
| **@testing-library/react-hooks**   | N/A             | ⚠️ Deprecated                 | Use renderHook from RTL     |
| **@tanstack/react-query**          | ✅ Already have | Query testing utilities       |
| **@reduxjs/toolkit**               | ✅ Already have | Redux testing utilities       |
| **happy-dom**                      | ^15.0.0         | Alternative to jsdom (faster) | Optional                    |
| **@storybook/test**                | ^8.0.0          | Component visual testing      | High                        |
| **@axe-core/react**                | ^4.10.0         | Accessibility testing         | High                        |
| **@testing-library/accessibility** | ^1.0.0          | A11y helpers                  | High                        |
| **miragejs**                       | ^0.1.47         | Alternative API mocking       | Optional                    |
| **nock**                           | ^13.5.0         | HTTP mocking (Node.js)        | Medium                      |
| **sinon**                          | ^18.0.0         | Spies, stubs, mocks           | Medium                      |
| **faker**                          | ^8.4.1          | Test data generation          | High                        |
| **@faker-js/faker**                | ^9.3.0          | Modern faker alternative      | High                        |
| **testcontainers**                 | ^11.0.0         | Docker-based testing          | Low                         |
| **chromatic**                      | Latest          | Visual regression             | Medium                      |

### Industry-Standard Combinations

#### 1. **React Component Testing** (Recommended)

```
Vitest + React Testing Library + @testing-library/user-event + @testing-library/jest-dom
```

**Why**: Most popular, well-documented, user-centric approach

#### 2. **State Management Testing**

```
Vitest + @reduxjs/toolkit (configureStore) + @tanstack/react-query (QueryClient)
```

**Why**: Official testing utilities from both libraries

#### 3. **API/Network Testing**

```
MSW (Browser) + nock (Node.js) + Vitest
```

**Why**: MSW for renderer, nock for main process

#### 4. **E2E Testing**

```
Playwright + @playwright/test + Electron support
```

**Why**: Best Electron support, cross-platform

#### 5. **Visual Testing** (Optional but Recommended)

```
Storybook + Chromatic + @storybook/test
```

**Why**: Industry standard for component visual testing

---

## Test Architecture & Organization

### Directory Structure

```
tests/
├── unit/                          # Pure unit tests (< 100ms each)
│   ├── main/                      # Main process unit tests
│   │   ├── database/
│   │   │   ├── managers/
│   │   │   │   ├── transactionManager.test.ts
│   │   │   │   ├── productManager.test.ts
│   │   │   │   └── userManager.test.ts
│   │   │   ├── validators/
│   │   │   │   └── transactionValidator.test.ts
│   │   │   └── utils/
│   │   │       └── dbHelpers.test.ts
│   │   ├── services/
│   │   │   ├── paymentService.test.ts
│   │   │   ├── printerService.test.ts
│   │   │   └── scaleService.test.ts
│   │   ├── modules/
│   │   │   ├── AutoUpdater.test.ts
│   │   │   └── WindowManager.test.ts
│   │   └── utils/
│   │       ├── logger.test.ts
│   │       └── validators.test.ts
│   └── renderer/                  # Renderer process unit tests
│       ├── features/
│       │   ├── sales/
│       │   │   ├── utils/
│       │   │   │   ├── cartCalculations.test.ts
│       │   │   │   └── discountCalculations.test.ts
│       │   │   └── hooks/
│       │   │       └── use-cart.test.ts
│       │   └── products/
│       │       └── utils/
│       │           └── ageRestriction.test.ts
│       └── shared/
│           ├── hooks/
│           │   └── use-auth.test.ts
│           └── utils/
│               └── formatters.test.ts
│
├── integration/                   # Integration tests (< 1s each)
│   ├── main/
│   │   ├── database/
│   │   │   ├── transaction-flow.test.ts
│   │   │   ├── inventory-flow.test.ts
│   │   │   └── user-authentication-flow.test.ts
│   │   ├── services/
│   │   │   ├── payment-integration.test.ts
│   │   │   └── printer-integration.test.ts
│   │   └── ipc/
│   │       ├── auth-ipc.test.ts
│   │       └── transaction-ipc.test.ts
│   └── renderer/
│       ├── features/
│       │   ├── sales/
│       │   │   └── transaction-flow.test.tsx
│       │   └── auth/
│       │       └── login-flow.test.tsx
│       └── state/
│           ├── redux-integration.test.ts
│           └── query-integration.test.ts
│
├── components/                    # Component tests (< 500ms each)
│   ├── ui/                        # Base UI components
│   │   ├── button.test.tsx
│   │   ├── input.test.tsx
│   │   └── dialog.test.tsx
│   ├── features/                  # Feature components
│   │   ├── sales/
│   │   │   ├── payment-panel.test.tsx
│   │   │   ├── product-card.test.tsx
│   │   │   └── cart-summary.test.tsx
│   │   └── inventory/
│   │       └── product-form.test.tsx
│   └── views/                     # Page-level components
│       ├── auth/
│       │   └── login-form.test.tsx
│       └── dashboard/
│           └── cashier-view.test.tsx
│
├── e2e/                           # End-to-end tests (< 10s each)
│   ├── auth/
│   │   ├── login-flow.spec.ts
│   │   └── register-flow.spec.ts
│   ├── cashier/
│   │   ├── transaction-flow.spec.ts
│   │   ├── payment-flow.spec.ts
│   │   └── receipt-printing.spec.ts
│   ├── hardware/
│   │   ├── scale-integration.spec.ts
│   │   ├── printer-integration.spec.ts
│   │   └── payment-terminal.spec.ts
│   └── admin/
│       ├── inventory-management.spec.ts
│       └── user-management.spec.ts
│
├── utils/                         # Test utilities
│   ├── test-helpers.ts            # Common utilities
│   ├── mock-factory.ts            # Mock data generators
│   ├── db-setup.ts                # Database setup/teardown
│   ├── electron-mock.ts           # Electron API mocks
│   ├── render-helpers.tsx         # React testing helpers
│   ├── msw-handlers.ts            # MSW request handlers
│   ├── redux-helpers.ts           # Redux testing utilities
│   ├── query-helpers.ts           # TanStack Query utilities
│   └── fixtures/                  # Test data fixtures
│       ├── users.ts
│       ├── products.ts
│       ├── transactions.ts
│       └── businesses.ts
│
├── performance/                   # Performance tests
│   ├── database-performance.test.ts
│   └── render-performance.test.ts
│
├── accessibility/                 # A11y tests
│   ├── component-a11y.test.tsx
│   └── page-a11y.test.tsx
│
└── setup.ts                       # Global test setup
```

---

## Library Combinations & Justifications

### 1. Vitest (Core Framework)

**Why Vitest?**

- ✅ Native Vite integration (no config needed)
- ✅ Jest-compatible API (easy migration)
- ✅ Fast execution (ESM-first)
- ✅ Built-in TypeScript support
- ✅ Excellent watch mode
- ✅ Great debugging experience

**Configuration Highlights:**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true, // Global test APIs
    environment: "jsdom", // DOM environment
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
    // Parallel execution
    pool: "threads",
    poolOptions: {
      threads: { singleThread: false },
    },
    // Test timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

### 2. React Testing Library + User Event

**Why This Combination?**

- ✅ User-centric testing (tests what users see/do)
- ✅ Encourages accessible components
- ✅ Less brittle than testing implementation
- ✅ Industry standard (used by React team)

**Best Practices:**

```typescript
// ✅ Good: Test user interactions
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

test("user can add product to cart", async () => {
  const user = userEvent.setup();
  render(<ProductCard product={mockProduct} />);

  await user.click(screen.getByRole("button", { name: /add to cart/i }));
  expect(mockOnAdd).toHaveBeenCalled();
});

// ❌ Bad: Testing implementation
expect(component.state.cartItems).toHaveLength(1);
```

### 3. MSW (Mock Service Worker)

**Why MSW?**

- ✅ Intercepts at network level (realistic)
- ✅ Works in Node.js and browser
- ✅ Can be shared between unit and E2E tests
- ✅ Modern, maintainable approach

**Setup Pattern:**

```typescript
// tests/utils/msw-handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/products", () => {
    return HttpResponse.json([{ id: "1", name: "Product 1", price: 10.99 }]);
  }),

  http.post("/api/transactions", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: "tx-123", ...body });
  }),
];

// tests/setup.ts
import { setupServer } from "msw/node";
import { handlers } from "./utils/msw-handlers";

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 4. Playwright for E2E

**Why Playwright?**

- ✅ Best Electron support
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Auto-waiting (reduces flakiness)
- ✅ Great debugging tools
- ✅ Network interception built-in

**Electron Configuration:**

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import { _electron } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    // Electron-specific config
  },
  projects: [
    {
      name: "electron",
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
```

### 5. Redux Toolkit Testing

**Recommended Pattern:**

```typescript
// tests/utils/redux-helpers.ts
import { configureStore } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";
import { rootReducer } from "@/app/rootReducer";

export function createTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false, // For testing
      }),
  });
}
```

### 6. TanStack Query Testing

**Recommended Pattern:**

```typescript
// tests/utils/query-helpers.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

export function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
```

---

## Configuration Best Practices

### 1. Vitest Configuration (Enhanced)

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],

    // Test file patterns
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", "packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      ".idea",
      ".git",
      ".cache",
      "tests/e2e", // Playwright handles these
      "**/*.spec.ts", // Playwright specs
    ],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      exclude: ["node_modules/", "tests/", "**/*.d.ts", "**/*.config.*", "**/dist/", "**/build/", "**/*.spec.ts", "**/migrations/", "**/seed.ts", "**/types/", "**/*.stories.{ts,tsx}"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      // Per-file thresholds for critical paths
      // 100: ['packages/main/src/services/paymentService.ts'],
    },

    // Performance
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 2,
      },
    },

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,

    // Retry flaky tests (use sparingly)
    retry: 0,

    // Reporter configuration
    reporters: ["default", "json", "html", ["junit", { outputFile: "./test-results/junit.xml" }]],

    // Output configuration
    outputFile: {
      json: "./test-results/results.json",
    },

    // Global test configuration
    isolate: true, // Isolate each test file
    watch: false, // Disable watch in CI
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./packages/renderer/src"),
      "@app/main": path.resolve(__dirname, "./packages/main/src"),
      "@app/preload": path.resolve(__dirname, "./packages/preload/src"),
      "@app/shared": path.resolve(__dirname, "./packages/shared/src"),
    },
  },
});
```

### 2. Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",

  // Timeout settings
  timeout: 30 * 1000, // 30 seconds per test
  expect: {
    timeout: 5000, // 5 seconds for assertions
  },

  // Run tests in parallel
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,

  // Reporter configuration
  reporter: [["html"], ["json", { outputFile: "test-results/results.json" }], ["junit", { outputFile: "test-results/junit.xml" }]],

  // Shared settings
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // Electron project
  projects: [
    {
      name: "electron",
      use: {
        // Electron-specific configuration
      },
    },
  ],

  // Web server for renderer process
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### 3. Enhanced Test Setup

```typescript
// tests/setup.ts
import { expect, afterEach, vi, beforeAll, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { setupServer } from "msw/node";
import { handlers } from "./utils/msw-handlers";

// MSW Server
export const server = setupServer(...handlers);

// Mock Electron APIs
if (typeof window !== "undefined") {
  (window as any).electron = {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
    },
  };

  // Mock all exposed APIs
  const mockAPIs = ["authAPI", "productAPI", "transactionAPI", "paymentAPI", "printerAPI", "scaleAPI"];
  mockAPIs.forEach((api) => {
    (window as any)[api] = new Proxy(
      {},
      {
        get: () => vi.fn(),
      }
    );
  });
}

// Mock Electron app for main process tests
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === "userData") return "/tmp/test-user-data";
      return "/tmp/test-path";
    }),
    getName: vi.fn(() => "AuraSwift"),
    getVersion: vi.fn(() => "1.10.1"),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  },
}));

// Environment variables
process.env.NODE_ENV = "test";
process.env.HARDWARE_SIMULATION_MODE = "true";

// Setup MSW
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  server.resetHandlers();
});
afterAll(() => server.close());

// Global test timeout
vi.setConfig({
  testTimeout: 10000,
});
```

---

## Testing Patterns & Examples

### 1. Unit Test Pattern (Business Logic)

```typescript
// tests/unit/renderer/features/sales/utils/cartCalculations.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { calculateCartTotal, applyDiscount } from "@/features/sales/utils/cartCalculations";

describe("Cart Calculations", () => {
  describe("calculateCartTotal", () => {
    it("should calculate total for items without tax", () => {
      const items = [
        { price: 10.99, quantity: 2 },
        { price: 5.5, quantity: 1 },
      ];

      const result = calculateCartTotal(items);

      expect(result.subtotal).toBe(27.48);
      expect(result.tax).toBe(0);
      expect(result.total).toBe(27.48);
    });

    it("should handle empty cart", () => {
      const result = calculateCartTotal([]);
      expect(result.total).toBe(0);
    });
  });

  describe("applyDiscount", () => {
    it("should apply percentage discount correctly", () => {
      const result = applyDiscount(100, { type: "percentage", value: 10 });
      expect(result).toBe(90);
    });

    it("should apply fixed discount correctly", () => {
      const result = applyDiscount(100, { type: "fixed", value: 5 });
      expect(result).toBe(95);
    });
  });
});
```

### 2. Component Test Pattern

```typescript
// tests/components/features/sales/payment-panel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentPanel } from "@/features/sales/components/payment/payment-panel";
import { createTestStore } from "@/tests/utils/redux-helpers";
import { renderWithProviders } from "@/tests/utils/render-helpers";

describe("PaymentPanel", () => {
  const mockOnPaymentComplete = vi.fn();
  const mockCart = {
    items: [{ id: "1", name: "Product 1", price: 10.99, quantity: 2 }],
    total: 21.98,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render payment methods", () => {
    renderWithProviders(<PaymentPanel cart={mockCart} onPaymentComplete={mockOnPaymentComplete} />);

    expect(screen.getByRole("button", { name: /cash/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /card/i })).toBeInTheDocument();
  });

  it("should handle cash payment", async () => {
    const user = userEvent.setup();

    renderWithProviders(<PaymentPanel cart={mockCart} onPaymentComplete={mockOnPaymentComplete} />);

    await user.click(screen.getByRole("button", { name: /cash/i }));

    // Cash payment form should appear
    await waitFor(() => {
      expect(screen.getByLabelText(/amount received/i)).toBeInTheDocument();
    });
  });

  it("should display correct total", () => {
    renderWithProviders(<PaymentPanel cart={mockCart} onPaymentComplete={mockOnPaymentComplete} />);

    expect(screen.getByText(/\$21\.98/)).toBeInTheDocument();
  });
});
```

### 3. Integration Test Pattern (Database)

```typescript
// tests/integration/main/database/transaction-flow.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDB, teardownTestDB, cleanTestDB } from "@/tests/utils/db-setup";
import { TransactionManager } from "@app/main/database/managers/transactionManager";
import { ProductManager } from "@app/main/database/managers/productManager";
import type { DrizzleDB } from "@app/main/database/drizzle";

describe("Transaction Flow Integration", () => {
  let db: DrizzleDB;
  let transactionManager: TransactionManager;
  let productManager: ProductManager;

  beforeAll(async () => {
    db = await setupTestDB();
    transactionManager = new TransactionManager(db);
    productManager = new ProductManager(db);
  });

  beforeEach(async () => {
    await cleanTestDB(db);
  });

  afterAll(async () => {
    await teardownTestDB(db);
  });

  it("should create complete transaction with products", async () => {
    // Create product
    const product = await productManager.createProduct({
      name: "Test Product",
      price: 10.99,
      stock: 100,
      businessId: "test-business",
      categoryId: "test-category",
    });

    // Create transaction
    const transaction = await transactionManager.createTransaction({
      businessId: "test-business",
      shiftId: "test-shift",
      type: "sale",
      subtotal: 10.99,
      tax: 0,
      total: 10.99,
      paymentMethod: "cash",
      status: "completed",
      receiptNumber: "R001",
      timestamp: new Date(),
    });

    // Add item
    await transactionManager.addTransactionItem({
      transactionId: transaction.id,
      productId: product.id,
      quantity: 1,
      unitPrice: 10.99,
      subtotal: 10.99,
    });

    // Verify
    const result = await transactionManager.getTransactionById(transaction.id);
    expect(result).toBeDefined();
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0].productId).toBe(product.id);
  });
});
```

### 4. Hook Testing Pattern

```typescript
// tests/unit/renderer/features/sales/hooks/use-cart.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCart } from "@/features/sales/hooks/use-cart";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

describe("useCart", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

  it("should add item to cart", async () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.addItem({
        productId: "1",
        quantity: 2,
        price: 10.99,
      });
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(result.current.items[0].quantity).toBe(2);
  });
});
```

### 5. E2E Test Pattern

```typescript
// tests/e2e/cashier/transaction-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Transaction Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login as cashier
    await page.goto("/login");
    await page.fill('[name="email"]', "cashier@test.com");
    await page.fill('[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard/cashier");
  });

  test("should complete a cash transaction", async ({ page }) => {
    // Add product to cart
    await page.click('[data-testid="product-card-1"]');
    await expect(page.locator('[data-testid="cart-item"]')).toBeVisible();

    // Proceed to payment
    await page.click('button:has-text("Checkout")');

    // Select cash payment
    await page.click('button:has-text("Cash")');

    // Enter amount
    await page.fill('[name="amountReceived"]', "20.00");
    await page.click('button:has-text("Complete Payment")');

    // Verify success
    await expect(page.locator("text=Transaction Complete")).toBeVisible();
    await expect(page.locator("text=Receipt #")).toBeVisible();
  });
});
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goals:**

- Enhance existing test setup
- Add missing utilities
- Set up additional libraries

**Tasks:**

1. ✅ Install recommended libraries:
   ```bash
   npm install -D @faker-js/faker @axe-core/react @testing-library/accessibility
   ```
2. ✅ Create comprehensive mock factories
3. ✅ Enhance test utilities (Redux, Query helpers)
4. ✅ Set up MSW handlers for all APIs
5. ✅ Create Electron IPC testing utilities

**Deliverables:**

- Enhanced `tests/utils/` directory
- Updated `tests/setup.ts`
- Mock factories for all entities

### Phase 2: Critical Path Testing (Week 3-4)

**Goals:**

- Test payment processing
- Test transaction flow
- Test authentication

**Tasks:**

1. Unit tests for payment calculations
2. Integration tests for transaction creation
3. Component tests for payment UI
4. E2E tests for complete transaction flow

**Deliverables:**

- Payment service tests (80%+ coverage)
- Transaction manager tests (80%+ coverage)
- Payment component tests

### Phase 3: Feature Coverage (Week 5-6)

**Goals:**

- Test inventory management
- Test user management
- Test reporting features

**Tasks:**

1. Product/inventory tests
2. User management tests
3. Reporting/analytics tests

**Deliverables:**

- Feature test suites
- 70%+ overall coverage

### Phase 4: Hardware & Integration (Week 7-8)

**Goals:**

- Test hardware integrations
- Test IPC communication
- Test error handling

**Tasks:**

1. Printer service tests
2. Scale service tests
3. Payment terminal tests
4. IPC handler tests

**Deliverables:**

- Hardware integration tests
- IPC communication tests

### Phase 5: Polish & Optimization (Week 9-10)

**Goals:**

- Accessibility testing
- Performance testing
- Visual regression (optional)

**Tasks:**

1. Add a11y tests
2. Performance benchmarks
3. CI/CD integration
4. Documentation

**Deliverables:**

- Complete test suite
- CI/CD pipeline
- Testing documentation

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - run: npm ci
      - run: npm run test:integration

  component-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - run: npm ci
      - run: npm run test:components

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Performance & Coverage Goals

### Coverage Targets

| Category           | Target | Critical Paths                   |
| ------------------ | ------ | -------------------------------- |
| **Business Logic** | 80%+   | Payment, Transactions, Inventory |
| **Services**       | 75%+   | Payment, Printer, Scale          |
| **UI Components**  | 60%+   | Payment Panel, Cart, Forms       |
| **Utilities**      | 90%+   | Calculations, Formatters         |
| **Overall**        | 70%+   | All code                         |

### Performance Targets

| Test Type             | Target Time | Max Time |
| --------------------- | ----------- | -------- |
| **Unit Tests**        | < 100ms     | < 500ms  |
| **Component Tests**   | < 500ms     | < 2s     |
| **Integration Tests** | < 1s        | < 5s     |
| **E2E Tests**         | < 10s       | < 30s    |

### Test Execution Goals

- **Full test suite**: < 5 minutes
- **Unit tests only**: < 30 seconds
- **Component tests**: < 1 minute
- **Integration tests**: < 2 minutes
- **E2E tests**: < 3 minutes

---

## Additional Recommendations

### 1. Test Data Management

**Use Faker for Realistic Data:**

```typescript
// tests/utils/mock-factory.ts
import { faker } from "@faker-js/faker";

export function createMockProduct(overrides = {}) {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    price: parseFloat(faker.commerce.price()),
    stock: faker.number.int({ min: 0, max: 1000 }),
    businessId: faker.string.uuid(),
    ...overrides,
  };
}
```

### 2. Accessibility Testing

```typescript
// tests/accessibility/component-a11y.test.tsx
import { describe, it } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { PaymentPanel } from "@/features/sales/components/payment/payment-panel";

expect.extend(toHaveNoViolations);

describe("PaymentPanel Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<PaymentPanel />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### 3. Snapshot Testing (Use Sparingly)

```typescript
// Only for stable UI components
import { render } from "@testing-library/react";
import { ProductCard } from "@/components/product-card";

it("should match snapshot", () => {
  const { container } = render(<ProductCard product={mockProduct} />);
  expect(container).toMatchSnapshot();
});
```

---

## Summary

This testing plan provides:

1. ✅ **Industry-standard library combinations** (Vitest, RTL, Playwright, MSW)
2. ✅ **Comprehensive test architecture** (unit, integration, component, E2E)
3. ✅ **Best practice patterns** for each test type
4. ✅ **Clear implementation roadmap** (10-week plan)
5. ✅ **CI/CD integration** examples
6. ✅ **Performance and coverage goals**

**Next Steps:**

1. Review and approve this plan
2. Begin Phase 1 implementation
3. Set up additional recommended libraries
4. Start with critical path testing (payments, transactions)

---

## Resources

- 📘 [Vitest + React Testing Library Guide](./VITEST_REACT_TESTING_LIBRARY_GUIDE.md) - Complete guide for using Vitest and RTL together
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Best Practices (Kent C. Dodds)](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
