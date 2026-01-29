# Comprehensive Testing Plan for AuraSwift POS System

## Table of Contents
1. [Overview & Philosophy](#overview--philosophy)
2. [Testing Strategy](#testing-strategy)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Test Organization](#test-organization)
5. [Testing Patterns & Best Practices](#testing-patterns--best-practices)
6. [Coverage Targets](#coverage-targets)
7. [CI/CD Integration](#cicd-integration)
8. [Implementation Roadmap](#implementation-roadmap)

---

## Overview & Philosophy

### Project Context
- **Tech Stack**: Electron + React 18 + TypeScript + Vite
- **Architecture**: Multi-process (Main, Preload, Renderer)
- **Domain**: Point-of-Sale System with hardware integration
- **Scale**: Enterprise-grade with RBAC, inventory, transactions, payments

### Testing Philosophy
- **Test Pyramid**: Many unit tests → Fewer integration tests → Few E2E tests
- **Pragmatic Coverage**: Focus on business logic and critical paths
- **Fast Feedback**: Unit tests run in <1s, full suite in <5min
- **Maintainability**: Tests as documentation, clear naming, DRY principles
- **CI-First**: All tests run on every PR, blocking on failures

---

## Testing Strategy

### 1. Unit Tests (70% of test suite)
**Purpose**: Test isolated functions, utilities, and business logic

**Tools**:
```json
{
  "vitest": "^2.1.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/jest-dom": "^6.6.0",
  "jsdom": "^25.0.0",
  "@vitest/ui": "^2.1.0",
  "@vitest/coverage-v8": "^2.1.0"
}
```

**What to Test**:
- ✅ Pure functions and utilities
- ✅ Validators (scheduleValidator, transactionValidator)
- ✅ Managers (businessManager, productManager, etc.)
- ✅ State machines (transaction-state-machine)
- ✅ Calculation logic (cart totals, discounts, tax)
- ✅ RBAC helpers and permission checks
- ❌ Don't test: Third-party libraries, trivial getters/setters

### 2. Component Tests (20% of test suite)
**Purpose**: Test React components in isolation with mocked dependencies

**Tools**: Same as Unit Tests + React Testing Library

**What to Test**:
- ✅ Component rendering with different props
- ✅ User interactions (click, type, submit)
- ✅ Conditional rendering logic
- ✅ Form validation and error states
- ✅ Accessibility (a11y)
- ❌ Don't test: Styling details, exact DOM structure

### 3. Integration Tests (8% of test suite)
**Purpose**: Test interactions between multiple modules/services

**Tools**:
```json
{
  "msw": "^2.6.0",
  "whatwg-fetch": "^3.0.0"
}
```

**What to Test**:
- ✅ IPC communication (Main ↔ Renderer)
- ✅ Database operations (CRUD with real SQLite)
- ✅ Service interactions (e.g., transaction + inventory + audit)
- ✅ API mocking with MSW for external services
- ✅ Hardware service integration (with simulation mode)

### 4. E2E Tests (2% of test suite)
**Purpose**: Test complete user workflows in real Electron environment

**Tools**:
```json
{
  "playwright": "^1.55.0",
  "@playwright/test": "^1.55.0"
}
```

**What to Test**:
- ✅ Critical user journeys (login → sale → payment → receipt)
- ✅ Multi-window workflows (main + receipt printer)
- ✅ Electron-specific features (menu, tray, shortcuts)
- ✅ Window state management (minimize, restore, close)
- ✅ Auto-update flows
- ❌ Don't test: Every possible path (too slow/brittle)

---

## Infrastructure Setup

### 1. Vitest Configuration

**Current Setup** (`vitest.config.ts`):
```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      "tests/e2e",
      "tests/**/*.spec.ts" // Playwright specs
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/",
        "**/migrations/",
        "**/seed.ts"
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      "@": "./packages/renderer/src",
      "@app/main": "./packages/main/src",
      "@app/preload": "./packages/preload/src"
    }
  }
});
```

**Enhancement Recommendations**:
1. Add workspace-specific configs for renderer/main/preload
2. Enable parallel test execution with `--threads`
3. Add custom reporters for CI (JUnit XML)

### 2. Playwright Configuration

**Create** `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential for Electron
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // One worker for Electron tests
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'electron',
      testMatch: /.*\.spec\.ts/,
    }
  ]
});
```

### 3. Test Setup File

**Enhance** `tests/setup.ts`:
```typescript
import { expect, afterEach, vi, beforeAll, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Electron APIs
if (typeof window !== "undefined") {
  // IPC Renderer
  (window as any).electron = {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
    },
  };

  // Context Bridge APIs
  const mockAPIs = {
    authAPI: {
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      validateSession: vi.fn(),
      getCurrentUser: vi.fn(),
    },
    productAPI: {
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
    },
    transactionAPI: {
      create: vi.fn(),
      getById: vi.fn(),
      getAll: vi.fn(),
      refund: vi.fn(),
      void: vi.fn(),
    },
    paymentAPI: {
      initializeReader: vi.fn(),
      getReaderStatus: vi.fn(),
      processCardPayment: vi.fn(),
      cancelPayment: vi.fn(),
    },
    printerAPI: {
      getStatus: vi.fn(),
      connect: vi.fn(),
      printReceipt: vi.fn(),
    },
    scaleAPI: {
      connect: vi.fn(),
      getWeight: vi.fn(),
      disconnect: vi.fn(),
    },
    categoryAPI: {
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    databaseAPI: {
      backup: vi.fn(),
      restore: vi.fn(),
    },
  };

  Object.assign(window, mockAPIs);
}

// Set test environment
process.env.NODE_ENV = "test";
process.env.HARDWARE_SIMULATION_MODE = "true";

// Mock Electron modules
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === "userData") return "/tmp/test-user-data";
      return "/tmp/test-path";
    }),
    getName: vi.fn(() => "AuraSwift"),
    getVersion: vi.fn(() => "1.16.0"),
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
  BrowserWindow: vi.fn(),
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Global test configuration
vi.setConfig({
  testTimeout: 10000,
  hookTimeout: 10000,
});

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () => `expected ${received} to be a valid UUID`,
    };
  },
});
```

### 4. MSW Setup for API Mocking

**Create** `tests/mocks/handlers.ts`:
```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Example: Mock Viva Wallet API
  http.post('/api/viva-wallet/payment', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      transactionId: 'mock-txn-123',
      status: 'COMPLETED',
      amount: body.amount,
    });
  }),

  // Mock external receipt printer service
  http.post('/api/printer/print', () => {
    return HttpResponse.json({ success: true, jobId: 'print-job-123' });
  }),
];
```

**Create** `tests/mocks/server.ts`:
```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Close server after all tests
afterAll(() => server.close());
```

---

## Test Organization

### Directory Structure

```
tests/
├── setup.ts                          # Global test setup
├── mocks/
│   ├── handlers.ts                   # MSW request handlers
│   ├── server.ts                     # MSW server setup
│   └── electron.ts                   # Electron API mocks
├── utils/
│   ├── test-helpers.ts               # Mock factories & utilities
│   ├── db-setup.ts                   # Test database setup
│   ├── render-helpers.tsx            # React render utilities
│   └── fixtures/
│       ├── products.fixture.ts
│       ├── transactions.fixture.ts
│       └── users.fixture.ts
├── unit/
│   ├── main/
│   │   ├── database/
│   │   │   └── managers/
│   │   │       ├── transactionManager.test.ts
│   │   │       ├── productManager.test.ts
│   │   │       └── userManager.test.ts
│   │   ├── services/
│   │   │   ├── vivaWallet/
│   │   │   │   ├── vivaWalletService.test.ts
│   │   │   │   └── transaction-state-machine.test.ts
│   │   │   ├── pdfReceiptService.test.ts
│   │   │   └── expiryNotificationService.test.ts
│   │   └── utils/
│   │       ├── scheduleValidator.test.ts
│   │       ├── transactionValidator.test.ts
│   │       └── rbacHelpers.test.ts
│   ├── renderer/
│   │   ├── features/
│   │   │   ├── sales/
│   │   │   │   ├── utils/
│   │   │   │   │   ├── cartCalculations.test.ts
│   │   │   │   │   └── discountCalculator.test.ts
│   │   │   │   └── hooks/
│   │   │   │       └── useCart.test.ts
│   │   │   ├── inventory/
│   │   │   │   └── utils/
│   │   │   │       └── stockValidator.test.ts
│   │   │   └── auth/
│   │   │       └── utils/
│   │   │           └── authHelpers.test.ts
│   │   └── shared/
│   │       └── utils/
│   │           ├── logger.test.ts
│   │           └── rbac-helpers.test.ts
│   └── preload/
│       └── ipc/
│           └── contextBridge.test.ts
├── components/
│   ├── ui/
│   │   ├── button.test.tsx
│   │   ├── dialog.test.tsx
│   │   └── form.test.tsx
│   └── features/
│       ├── sales/
│       │   ├── ProductCard.test.tsx
│       │   ├── CartSummary.test.tsx
│       │   └── PaymentDialog.test.tsx
│       ├── inventory/
│       │   ├── ProductForm.test.tsx
│       │   └── StockAdjustment.test.tsx
│       └── auth/
│           └── LoginForm.test.tsx
├── integration/
│   ├── main/
│   │   ├── ipc-communication.test.ts    # Main <-> Renderer IPC
│   │   ├── database-operations.test.ts  # Full DB workflows
│   │   └── hardware-services.test.ts    # Hardware integration
│   └── renderer/
│       ├── sales-workflow.test.tsx      # Cart -> Payment -> Receipt
│       └── inventory-workflow.test.tsx  # Product CRUD workflow
├── e2e/
│   ├── fixtures/
│   │   └── auth.json                    # Playwright fixtures
│   ├── page-objects/
│   │   ├── LoginPage.ts
│   │   ├── SalesPage.ts
│   │   └── InventoryPage.ts
│   ├── auth.spec.ts                     # Login/Logout/Session
│   ├── sales.spec.ts                    # Complete sale journey
│   ├── inventory.spec.ts                # Product management
│   ├── payments.spec.ts                 # Payment processing
│   └── hardware-integration.spec.ts     # Hardware devices
└── README.md
```

### Naming Conventions

1. **Test Files**: `{filename}.test.{ts|tsx}` or `{filename}.spec.{ts|tsx}` (E2E only)
2. **Test Suites**: `describe('{Component/Function/Feature Name}', ...)`
3. **Test Cases**: `it('should {expected behavior} when {condition}', ...)`
4. **Fixtures**: `{domain}.fixture.ts`
5. **Helpers**: `{purpose}-helper.ts`

**Examples**:
```typescript
// ✅ Good
describe('TransactionManager', () => {
  it('should create transaction with valid data when all fields are provided', ...);
  it('should throw ValidationError when total is negative', ...);
});

// ❌ Bad
describe('Tests', () => {
  it('works', ...);
  it('test 2', ...);
});
```

---

## Testing Patterns & Best Practices

### 1. Unit Test Pattern (AAA - Arrange, Act, Assert)

```typescript
// packages/main/src/utils/discountCalculator.ts
export function calculateDiscount(
  subtotal: number,
  discountType: 'percentage' | 'fixed',
  discountValue: number
): number {
  if (subtotal < 0) throw new Error('Subtotal cannot be negative');
  if (discountValue < 0) throw new Error('Discount value cannot be negative');

  if (discountType === 'percentage') {
    return subtotal * (discountValue / 100);
  }
  return Math.min(discountValue, subtotal);
}

// tests/unit/main/utils/discountCalculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDiscount } from '@app/main/utils/discountCalculator';

describe('calculateDiscount', () => {
  describe('percentage discounts', () => {
    it('should calculate 10% discount correctly', () => {
      // Arrange
      const subtotal = 100;
      const discountType = 'percentage';
      const discountValue = 10;

      // Act
      const result = calculateDiscount(subtotal, discountType, discountValue);

      // Assert
      expect(result).toBe(10);
    });

    it('should handle 0% discount', () => {
      const result = calculateDiscount(100, 'percentage', 0);
      expect(result).toBe(0);
    });

    it('should handle 100% discount', () => {
      const result = calculateDiscount(100, 'percentage', 100);
      expect(result).toBe(100);
    });
  });

  describe('fixed discounts', () => {
    it('should apply full discount when less than subtotal', () => {
      const result = calculateDiscount(100, 'fixed', 20);
      expect(result).toBe(20);
    });

    it('should cap discount at subtotal amount', () => {
      const result = calculateDiscount(100, 'fixed', 150);
      expect(result).toBe(100);
    });
  });

  describe('error handling', () => {
    it('should throw error for negative subtotal', () => {
      expect(() => calculateDiscount(-100, 'percentage', 10))
        .toThrow('Subtotal cannot be negative');
    });

    it('should throw error for negative discount value', () => {
      expect(() => calculateDiscount(100, 'percentage', -10))
        .toThrow('Discount value cannot be negative');
    });
  });
});
```

### 2. Component Test Pattern (React Testing Library)

```typescript
// packages/renderer/src/features/sales/components/ProductCard.tsx
interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  disabled?: boolean;
}

export function ProductCard({ product, onAddToCart, disabled }: ProductCardProps) {
  return (
    <div data-testid={`product-card-${product.id}`}>
      <img src={product.imageUrl} alt={product.name} />
      <h3>{product.name}</h3>
      <p>£{product.price.toFixed(2)}</p>
      {product.stock === 0 && <span>Out of Stock</span>}
      <button 
        onClick={() => onAddToCart(product)}
        disabled={disabled || product.stock === 0}
      >
        Add to Cart
      </button>
    </div>
  );
}

// tests/components/features/sales/ProductCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductCard } from '@/features/sales/components/ProductCard';
import { createMockProduct } from '../../../utils/fixtures/products.fixture';

describe('ProductCard', () => {
  const mockOnAddToCart = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render product information correctly', () => {
    const product = createMockProduct({
      name: 'Test Product',
      price: 19.99,
      stock: 10
    });

    render(<ProductCard product={product} onAddToCart={mockOnAddToCart} />);

    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('£19.99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeEnabled();
  });

  it('should call onAddToCart when button is clicked', async () => {
    const user = userEvent.setup();
    const product = createMockProduct();

    render(<ProductCard product={product} onAddToCart={mockOnAddToCart} />);

    const button = screen.getByRole('button', { name: /add to cart/i });
    await user.click(button);

    expect(mockOnAddToCart).toHaveBeenCalledTimes(1);
    expect(mockOnAddToCart).toHaveBeenCalledWith(product);
  });

  it('should disable button when product is out of stock', () => {
    const product = createMockProduct({ stock: 0 });

    render(<ProductCard product={product} onAddToCart={mockOnAddToCart} />);

    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });

  it('should disable button when disabled prop is true', () => {
    const product = createMockProduct({ stock: 10 });

    render(<ProductCard product={product} onAddToCart={mockOnAddToCart} disabled />);

    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });

  it('should have accessible image alt text', () => {
    const product = createMockProduct({ name: 'Accessible Product' });

    render(<ProductCard product={product} onAddToCart={mockOnAddToCart} />);

    const image = screen.getByAltText('Accessible Product');
    expect(image).toBeInTheDocument();
  });
});
```

### 3. Integration Test Pattern (IPC Communication)

```typescript
// tests/integration/main/ipc-communication.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ipcMain, ipcRenderer } from 'electron';
import { setupAuthHandlers } from '@app/main/ipc/auth.handlers';
import { UserManager } from '@app/main/database/managers/userManager';

describe('IPC Communication - Auth', () => {
  let userManager: UserManager;

  beforeEach(async () => {
    // Setup test database
    const db = await createTestDatabase();
    userManager = new UserManager(db);
    
    // Register IPC handlers
    setupAuthHandlers(userManager);
  });

  afterEach(async () => {
    // Clean up IPC handlers
    ipcMain.removeHandler('auth:login');
    ipcMain.removeHandler('auth:register');
    
    // Clean up database
    await cleanupTestDatabase();
  });

  it('should authenticate user via IPC and return user data', async () => {
    // Arrange: Create test user
    await userManager.create({
      email: 'test@example.com',
      password: 'hashedPassword123',
      role: 'cashier'
    });

    // Act: Simulate IPC call from renderer
    const result = await ipcRenderer.invoke('auth:login', {
      email: 'test@example.com',
      password: 'password123'
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      email: 'test@example.com',
      role: 'cashier'
    });
    expect(result.user.password).toBeUndefined(); // Password should not be returned
  });

  it('should return error for invalid credentials', async () => {
    const result = await ipcRenderer.invoke('auth:login', {
      email: 'nonexistent@example.com',
      password: 'wrongpassword'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
  });
});
```

### 4. E2E Test Pattern (Playwright)

```typescript
// tests/e2e/page-objects/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
  }

  async login(email: string, password: string) {
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
  }

  async isLoggedIn() {
    await this.page.waitForURL(/.*#\/dashboard/, { timeout: 5000 });
    return this.page.url().includes('#/dashboard');
  }
}

// tests/e2e/sales.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './page-objects/LoginPage';
import { SalesPage } from './page-objects/SalesPage';

test.describe('Complete Sale Workflow', () => {
  let loginPage: LoginPage;
  let salesPage: SalesPage;

  test.beforeEach(async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    loginPage = new LoginPage(page);
    salesPage = new SalesPage(page);
    
    await loginPage.navigate();
    await loginPage.login('cashier@test.com', 'password123');
  });

  test('should complete a cash sale with receipt printing', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    
    // Navigate to sales
    await page.click('[data-testid="nav-sales"]');
    
    // Add products to cart
    await salesPage.addProductToCart('Product-123');
    await salesPage.addProductToCart('Product-456');
    
    // Verify cart total
    const total = await salesPage.getCartTotal();
    expect(total).toBeGreaterThan(0);
    
    // Process payment
    await salesPage.selectPaymentMethod('cash');
    await salesPage.enterCashAmount(100);
    await salesPage.clickCompletePayment();
    
    // Verify success
    await expect(page.locator('.payment-success')).toBeVisible();
    
    // Verify receipt printed
    const receiptPrinted = await page.evaluate(() => {
      return (window as any).printerAPI.printReceipt.mock.calls.length > 0;
    });
    expect(receiptPrinted).toBe(true);
  });
});
```

### 5. Test Helpers & Fixtures

```typescript
// tests/utils/fixtures/products.fixture.ts
import type { Product } from '@/types/domain/product';

export function createMockProduct(overrides?: Partial<Product>): Product {
  return {
    id: overrides?.id || 'product-test-123',
    name: overrides?.name || 'Test Product',
    barcode: overrides?.barcode || '1234567890123',
    price: overrides?.price || 19.99,
    costPrice: overrides?.costPrice || 10.00,
    stock: overrides?.stock || 100,
    categoryId: overrides?.categoryId || 'cat-1',
    vatCategoryId: overrides?.vatCategoryId || 'vat-standard',
    requiresAgeVerification: overrides?.requiresAgeVerification || false,
    isWeighed: overrides?.isWeighed || false,
    imageUrl: overrides?.imageUrl || 'https://example.com/product.jpg',
    createdAt: overrides?.createdAt || new Date(),
    updatedAt: overrides?.updatedAt || new Date(),
    ...overrides
  };
}

export function createMockProducts(count: number): Product[] {
  return Array.from({ length: count }, (_, i) => 
    createMockProduct({ 
      id: `product-${i}`,
      name: `Product ${i}`,
      barcode: `123456789000${i}`
    })
  );
}

// tests/utils/test-helpers.ts
import { vi } from 'vitest';

export function createMockDB() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([])
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([])
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([])
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ changes: 1 })
    })
  };
}

export function createMockUUID() {
  let counter = 0;
  return {
    v4: vi.fn(() => `mock-uuid-${++counter}`)
  };
}

// tests/utils/render-helpers.tsx
import { render as rtlRender } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function render(ui: React.ReactElement, options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
    options
  );
}
```

---

## Coverage Targets

### Overall Targets
| Category | Minimum | Target | Aspirational |
|----------|---------|--------|--------------|
| **Lines** | 70% | 80% | 90% |
| **Functions** | 70% | 80% | 90% |
| **Branches** | 65% | 75% | 85% |
| **Statements** | 70% | 80% | 90% |

### Category-Specific Targets

#### Critical Business Logic (95%+)
- Transaction calculations
- Discount & tax logic
- RBAC permission checks
- Payment processing
- Inventory calculations
- Shift validation

#### Services & Managers (85%+)
- Database managers (UserManager, ProductManager, etc.)
- Business services (VivaWallet, PDF generation)
- Hardware services (Printer, Scale)

#### React Components (75%+)
- Form components
- Interactive UI components
- Feature views (Sales, Inventory)

#### Utilities (90%+)
- Validators
- Helpers
- Formatters
- Constants

#### Infrastructure (<50%)
- Configuration files
- Build scripts
- Type definitions
- Migrations

### Tracking Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html

# CI coverage report (upload to Codecov/Coveralls)
npm run test:coverage -- --reporter=lcov
```

**Coverage Enforcement** (vitest.config.ts):
```typescript
coverage: {
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 65,
    statements: 70,
    perFile: true, // Enforce per file
  }
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

**Create** `.github/workflows/test.yml`:
```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: windows-latest # Electron native modules
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit & component tests
        run: npm run test:run
      
      - name: Generate coverage report
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info
          flags: unit
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: unit-test-results
          path: |
            coverage/
            test-results/

  integration-tests:
    runs-on: windows-latest
    needs: unit-tests
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: integration-test-results
          path: test-results/

  e2e-tests:
    runs-on: windows-latest
    needs: [unit-tests, integration-tests]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-results
          path: test-results/
      
      - name: Upload screenshots/videos
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-artifacts
          path: |
            test-results/**/*.png
            test-results/**/*.webm

  test-summary:
    runs-on: windows-latest
    needs: [unit-tests, integration-tests, e2e-tests]
    if: always()
    
    steps:
      - name: Download all test results
        uses: actions/download-artifact@v4
      
      - name: Publish test summary
        uses: test-summary/action@v2
        with:
          paths: "**/*.xml"
```

### Pre-commit Hooks (Husky)

**Install**:
```bash
npm install -D husky lint-staged
npx husky init
```

**Create** `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run tests on staged files only
npm run test:staged
```

**Update** `package.json`:
```json
{
  "scripts": {
    "test:staged": "vitest related --run"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "vitest related --run"
    ]
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Setup Playwright configuration
- [ ] Create test helpers and fixtures library
- [ ] Setup MSW for API mocking
- [ ] Configure CI/CD pipeline
- [ ] Write test documentation

### Phase 2: Critical Path Tests (Week 3-4)
- [ ] Auth flow (login, logout, session)
- [ ] Product management (CRUD)
- [ ] Transaction creation & calculation
- [ ] Payment processing
- [ ] RBAC permission checks

### Phase 3: Feature Tests (Week 5-8)
- [ ] Inventory management
- [ ] Sales workflows
- [ ] Reporting
- [ ] User management
- [ ] Settings & configuration

### Phase 4: Integration & E2E (Week 9-10)
- [ ] IPC communication tests
- [ ] Database integration tests
- [ ] Hardware service tests
- [ ] Critical E2E user journeys
- [ ] Multi-window workflows

### Phase 5: Coverage & Optimization (Week 11-12)
- [ ] Achieve 70% coverage
- [ ] Performance optimization
- [ ] Test maintenance automation
- [ ] Documentation & training
- [ ] Retrospective & improvements

### Success Metrics
- ✅ All tests pass in CI
- ✅ Coverage thresholds met (70/70/65/70)
- ✅ E2E tests complete in <5 minutes
- ✅ Unit tests complete in <1 minute
- ✅ Zero flaky tests
- ✅ Test maintenance time <10% of development time

---

## Best Practices Summary

### Do's ✅
1. **Write tests first** for new features (TDD)
2. **Test behavior, not implementation** (avoid testing private methods)
3. **Use descriptive test names** (should do X when Y)
4. **Keep tests isolated** (no shared state between tests)
5. **Mock external dependencies** (APIs, hardware, file system)
6. **Test edge cases** (null, undefined, empty arrays, max values)
7. **Use fixtures for test data** (DRY principle)
8. **Clean up after tests** (database, mocks, timers)
9. **Run tests in CI** (every PR)
10. **Monitor coverage trends** (prevent regression)

### Don'ts ❌
1. **Don't test third-party libraries** (assume they work)
2. **Don't test implementation details** (CSS classes, DOM structure)
3. **Don't write flaky tests** (random failures, timing issues)
4. **Don't skip cleanup** (memory leaks, hanging processes)
5. **Don't hardcode test data** (use factories/fixtures)
6. **Don't test everything** (focus on business logic)
7. **Don't ignore failing tests** (fix immediately)
8. **Don't commit `.only` or `.skip`** (pre-commit hook)
9. **Don't test getters/setters** (trivial code)
10. **Don't write long tests** (break into smaller tests)

---

## Resources

### Documentation
- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Docs](https://playwright.dev/)
- [MSW Docs](https://mswjs.io/)

### Internal Docs
- `tests/README.md` - Quick reference
- `tests/utils/test-helpers.ts` - Helper functions
- `tests/**/*.example.ts` - Example tests

### Support
- **Slack**: #testing channel
- **Email**: dev-team@auraswift.com
- **Wiki**: https://wiki.auraswift.com/testing

---

## Appendix

### A. Test Scripts Reference

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:components": "vitest run tests/components",
    "test:main": "vitest run tests/unit/main tests/integration/main",
    "test:renderer": "vitest run tests/unit/renderer tests/components",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:all": "npm run test:run && npm run test:e2e",
    "test:all:clean": "npm run db:dev:clean && npm run test:all",
    "test:staged": "vitest related --run",
    "test:changed": "vitest --changed"
  }
}
```

### B. VSCode Test Integration

**Create** `.vscode/settings.json`:
```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm run test",
  "testing.automaticallyOpenPeekView": "failureInVisibleDocument",
  "testing.followRunningTest": true
}
```

**Install Extensions**:
- Vitest (vitest.explorer)
- Playwright Test for VSCode (ms-playwright.playwright)

---

**Document Version**: 1.0.0  
**Last Updated**: December 6, 2025  
**Author**: Development Team  
**Status**: Active

