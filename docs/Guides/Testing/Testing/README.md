# AuraSwift Testing Guide - Master Documentation

> **Single source of truth for all testing practices, patterns, and setup**

## Quick Navigation

- **[Complete Testing Guide](#complete-testing-guide)** - Start here for everything
- **[Quick Start](#quick-start)** - Get testing in 5 minutes
- **[Library Stack](#library-stack)** - Recommended tools and why
- **[Test Patterns](#test-patterns)** - Copy-paste ready examples
- **[Configuration](#configuration)** - Setup files

---

## Complete Testing Guide

### Recommended Stack (Industry Standard)

```
✅ Vitest (v2.1.0)          - Test runner (fast, Vite-native)
✅ React Testing Library    - Component testing (user-centric)
✅ Playwright (v1.55.0)     - E2E testing (Electron support)
✅ MSW (v2.6.0)             - API mocking (network-level)
✅ @testing-library/user-event - User interactions
✅ @testing-library/jest-dom - DOM matchers
```

**Why this combination?**

- Vitest: Fast, Jest-compatible, TypeScript-first, excellent DX
- React Testing Library: Tests user behavior, encourages accessibility
- Playwright: Best Electron support, auto-waiting, cross-platform
- MSW: Realistic API mocking, works in Node and browser

### Installation

```bash
# All dependencies are already installed! Verify:
npm list vitest @testing-library/react @playwright/test msw

# If missing anything:
npm install -D vitest @vitest/ui @vitest/coverage-v8 \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom msw
```

---

## Quick Start

### 1. Run Tests

```bash
npm test              # Watch mode (development)
npm run test:run      # Run once (CI)
npm run test:ui       # Visual UI
npm run test:coverage # With coverage
```

### 2. Write Your First Test

**Component Test:**

```typescript
// tests/components/button.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("should render and handle clicks", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

**Unit Test:**

```typescript
// tests/unit/renderer/utils/calculator.test.ts
import { describe, it, expect } from "vitest";
import { calculateTotal } from "@/utils/calculator";

describe("calculateTotal", () => {
  it("should sum items correctly", () => {
    const items = [
      { price: 10, qty: 2 },
      { price: 5, qty: 1 },
    ];
    expect(calculateTotal(items)).toBe(25);
  });
});
```

---

## Library Stack

### Core Libraries

| Library                         | Purpose           | Version | Status       |
| ------------------------------- | ----------------- | ------- | ------------ |
| **Vitest**                      | Test runner       | ^2.1.0  | ✅ Installed |
| **@testing-library/react**      | Component testing | ^16.0.0 | ✅ Installed |
| **@testing-library/user-event** | User interactions | ^14.5.2 | ✅ Installed |
| **@testing-library/jest-dom**   | DOM matchers      | ^6.6.0  | ✅ Installed |
| **Playwright**                  | E2E testing       | ^1.55.0 | ✅ Installed |
| **MSW**                         | API mocking       | ^2.6.0  | ✅ Installed |
| **jsdom**                       | DOM environment   | ^25.0.0 | ✅ Installed |

### Optional (Recommended)

```bash
npm install -D @faker-js/faker @axe-core/react @testing-library/accessibility
```

---

## Test Patterns

### Pattern 1: Component with User Interaction

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("Component", () => {
  it("should handle user interaction", async () => {
    const mockFn = vi.fn();
    render(<Component onSubmit={mockFn} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith("test@example.com");
    });
  });
});
```

### Pattern 2: Component with Redux

```typescript
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { renderWithProviders } from "@/tests/utils/render-helpers";

it("should work with Redux", () => {
  renderWithProviders(<Component />, {
    preloadedState: { cart: { items: [] } },
  });
  expect(screen.getByText(/cart/i)).toBeInTheDocument();
});
```

### Pattern 3: Component with TanStack Query

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

it("should fetch and display data", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <Component />
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(screen.getByText(/loaded/i)).toBeInTheDocument();
  });
});
```

### Pattern 4: Testing Hooks

```typescript
import { renderHook, act } from "@testing-library/react";
import { useCart } from "@/hooks/use-cart";

it("should add item to cart", () => {
  const { result } = renderHook(() => useCart());

  act(() => {
    result.current.addItem({ id: "1", price: 10 });
  });

  expect(result.current.items).toHaveLength(1);
});
```

### Pattern 5: Mocking Electron APIs

```typescript
import { vi } from "vitest";

// In test file
vi.spyOn(window.electron.ipcRenderer, "invoke").mockResolvedValue({
  success: true,
});

// Or in setup.ts (global)
(window as any).electron = {
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
  },
};
```

### Pattern 6: Mocking with MSW

```typescript
// tests/utils/msw-handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/products", () => {
    return HttpResponse.json([{ id: "1", name: "Product" }]);
  }),
];

// In setup.ts
import { setupServer } from "msw/node";
import { handlers } from "./utils/msw-handlers";

export const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Configuration

### Vitest Config (`vitest.config.ts`)

```typescript
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
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "tests/e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
    pool: "threads",
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./packages/renderer/src"),
      "@app/main": path.resolve(__dirname, "./packages/main/src"),
    },
  },
});
```

### Test Setup (`tests/setup.ts`)

```typescript
import { afterEach, vi } from "vitest";
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
      send: vi.fn(),
    },
  };
}

// Cleanup
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  server.resetHandlers();
});

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
```

---

## Test Organization

```
tests/
├── unit/              # Pure functions, utilities (< 100ms)
│   ├── main/          # Main process tests
│   └── renderer/      # Renderer process tests
├── components/         # React components (< 500ms)
│   ├── ui/            # Base components
│   └── features/      # Feature components
├── integration/       # Multi-module tests (< 1s)
│   ├── main/          # Main process integration
│   └── renderer/      # Renderer integration
├── e2e/               # End-to-end tests (< 10s)
│   ├── auth/
│   ├── cashier/
│   └── hardware/
└── utils/             # Test utilities
    ├── render-helpers.tsx
    ├── redux-helpers.ts
    ├── query-helpers.tsx
    ├── msw-handlers.ts
    └── fixtures/
```

---

## Best Practices

### ✅ DO

1. **Test user behavior, not implementation**

   ```typescript
   // ✅ Good
   expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();

   // ❌ Bad
   expect(component.state.isSubmitted).toBe(true);
   ```

2. **Use accessible queries first**

   - `getByRole` → `getByLabelText` → `getByText` → `getByTestId` (last resort)

3. **Wait for async operations**

   ```typescript
   await waitFor(() => {
     expect(screen.getByText(/loaded/i)).toBeInTheDocument();
   });
   ```

4. **Use userEvent for interactions**
   ```typescript
   const user = userEvent.setup();
   await user.click(button);
   ```

### ❌ DON'T

1. **Don't test implementation details**
2. **Don't use container.querySelector()**
3. **Don't forget to await async operations**
4. **Don't use getByTestId unless necessary**

---

## Coverage Goals

| Category           | Target | Critical Files        |
| ------------------ | ------ | --------------------- |
| **Business Logic** | 80%+   | Payment, Transactions |
| **Services**       | 75%+   | Payment, Printer      |
| **UI Components**  | 60%+   | Forms, Panels         |
| **Utilities**      | 90%+   | Calculations          |
| **Overall**        | 70%+   | All code              |

---

## Common Commands

```bash
# Development
npm test                    # Watch mode
npm run test:ui             # Visual UI
npm run test:watch          # Watch mode (alias)

# CI/CD
npm run test:run            # Run once
npm run test:coverage       # With coverage

# Specific types
npm run test:unit           # Unit tests only
npm run test:components     # Component tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests

# Debugging
npm test -- --inspect-brk   # Debug unit tests
npm run test:e2e:debug      # Debug E2E tests
```

---

## Test Utilities

### Render Helpers (`tests/utils/render-helpers.tsx`)

```typescript
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";

export function renderWithProviders(ui: React.ReactElement, { preloadedState = {}, store, queryClient, ...options } = {}) {
  const defaultStore = configureStore({
    reducer: {
      /* your reducers */
    },
    preloadedState,
  });

  const defaultQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store || defaultStore}>
        <QueryClientProvider client={queryClient || defaultQueryClient}>{children}</QueryClientProvider>
      </Provider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
```

---

## Troubleshooting

### Issue: "Cannot find module"

**Solution**: Check path aliases in `vitest.config.ts` match `tsconfig.json`

### Issue: "window is not defined"

**Solution**: Ensure `environment: "jsdom"` in `vitest.config.ts`

### Issue: "act() warning"

**Solution**: Use `waitFor` or `findBy` queries

### Issue: Tests are slow

**Solution**:

- Use `pool: "threads"` for parallel execution
- Mock expensive operations
- Use `vi.useFakeTimers()` for time-dependent tests

---

## Resources

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Docs](https://playwright.dev/)
- [MSW Docs](https://mswjs.io/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## Next Steps

1. ✅ **Setup Complete** - All libraries installed
2. 📝 **Write Tests** - Start with critical paths (payments, transactions)
3. 🎯 **Coverage** - Aim for 70%+ overall, 80%+ on business logic
4. 🚀 **CI/CD** - Integrate tests into your pipeline

---

**This is the single source of truth for testing in AuraSwift. All other testing docs reference this guide.**
