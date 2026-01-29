# Vitest + React Testing Library: Complete Guide

## Overview

This guide provides comprehensive information about using **Vitest** and **React Testing Library** together in the AuraSwift project. This is the recommended combination for testing React components and renderer process code.

---

## Why This Combination?

### Vitest Benefits

✅ **Fast**: Native ESM support, faster than Jest  
✅ **Vite Integration**: Zero-config with Vite projects  
✅ **Jest-Compatible**: Familiar API, easy migration  
✅ **TypeScript**: First-class TypeScript support  
✅ **Watch Mode**: Excellent developer experience  
✅ **Coverage**: Built-in coverage with v8 provider  
✅ **UI**: Beautiful test UI for debugging

### React Testing Library Benefits

✅ **User-Centric**: Tests what users see and do  
✅ **Accessible**: Encourages accessible components  
✅ **Maintainable**: Less brittle than testing implementation  
✅ **Industry Standard**: Used by React team and community  
✅ **Simple API**: Easy to learn and use

### Why They Work Great Together

- Vitest provides the test runner and assertion library
- React Testing Library provides component rendering and querying
- Both follow modern best practices
- Excellent TypeScript support
- Great developer experience

---

## Installation & Setup

### Current Installation Status

Check your `package.json`:

```json
{
  "devDependencies": {
    "vitest": "^2.1.0",
    "@vitest/ui": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.0"
  }
}
```

✅ You already have everything installed!

### Verify Installation

```bash
# Check versions
npm list vitest @testing-library/react

# Run a test to verify
npm test
```

---

## Configuration

### Vitest Configuration (`vitest.config.ts`)

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()], // Required for React component testing

  test: {
    // Global test APIs (describe, it, expect, etc.)
    globals: true,

    // DOM environment for React components
    environment: "jsdom",

    // Setup file runs before all tests
    setupFiles: ["./tests/setup.ts"],

    // Test file patterns
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],

    // Exclude patterns
    exclude: [
      "node_modules",
      "dist",
      "tests/e2e", // Playwright handles these
    ],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: ["node_modules/", "tests/", "**/*.d.ts", "**/*.config.*"],
    },

    // Performance
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
      },
    },

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
  },

  // Path aliases (must match tsconfig.json)
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./packages/renderer/src"),
      "@app/main": path.resolve(__dirname, "./packages/main/src"),
      "@app/preload": path.resolve(__dirname, "./packages/preload/src"),
    },
  },
});
```

### Test Setup File (`tests/setup.ts`)

```typescript
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom"; // Adds custom matchers

// Mock Electron APIs for renderer tests
if (typeof window !== "undefined") {
  (window as any).electron = {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
    },
  };
}

// Cleanup after each test
afterEach(() => {
  cleanup(); // Cleans up rendered components
  vi.clearAllMocks(); // Clears all mocks
});

// Environment variables
process.env.NODE_ENV = "test";
```

---

## Core Concepts

### 1. Vitest Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Feature Name", () => {
  beforeEach(() => {
    // Setup before each test
  });

  it("should do something", () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### 2. React Testing Library Queries

**Priority Order** (use in this order):

1. **getByRole** - Most accessible, preferred
2. **getByLabelText** - Forms
3. **getByPlaceholderText** - Inputs
4. **getByText** - Text content
5. **getByDisplayValue** - Form values
6. **getByAltText** - Images
7. **getByTitle** - Title attribute
8. **getByTestId** - Last resort

```typescript
import { render, screen } from "@testing-library/react";

// ✅ Good: Use role queries
const button = screen.getByRole("button", { name: /submit/i });

// ✅ Good: Use label text for forms
const input = screen.getByLabelText(/email/i);

// ⚠️ OK: Use text as fallback
const heading = screen.getByText("Welcome");

// ❌ Avoid: Only use as last resort
const element = screen.getByTestId("my-element");
```

### 3. User Interactions

```typescript
import userEvent from "@testing-library/user-event";

// Setup user event
const user = userEvent.setup();

// Click
await user.click(button);

// Type
await user.type(input, "hello@example.com");

// Clear and type
await user.clear(input);
await user.type(input, "new value");

// Select options
await user.selectOptions(select, "option1");

// Keyboard
await user.keyboard("{Enter}");
await user.keyboard("{Tab}");
```

---

## Common Patterns

### Pattern 1: Basic Component Test

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("should render with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

### Pattern 2: Component with User Interaction

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCard } from "@/features/sales/components/product-card";

describe("ProductCard", () => {
  it("should call onAdd when add button is clicked", async () => {
    const mockOnAdd = vi.fn();
    const product = { id: "1", name: "Product", price: 10.99 };

    render(<ProductCard product={product} onAdd={mockOnAdd} />);

    const user = userEvent.setup();
    const addButton = screen.getByRole("button", { name: /add to cart/i });

    await user.click(addButton);

    expect(mockOnAdd).toHaveBeenCalledWith(product.id);
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });
});
```

### Pattern 3: Component with Async Operations

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PaymentPanel } from "@/features/sales/components/payment/payment-panel";

describe("PaymentPanel", () => {
  it("should show loading state while processing payment", async () => {
    const mockProcessPayment = vi.fn().mockResolvedValue({ success: true });

    render(<PaymentPanel onProcessPayment={mockProcessPayment} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /pay/i }));

    // Wait for loading state
    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });
});
```

### Pattern 4: Component with Redux

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { CartSummary } from "@/features/sales/components/cart-summary";
import cartReducer from "@/features/sales/store/cartSlice";

describe("CartSummary", () => {
  const createTestStore = (preloadedState = {}) => {
    return configureStore({
      reducer: {
        cart: cartReducer,
      },
      preloadedState,
    });
  };

  it("should display cart total", () => {
    const store = createTestStore({
      cart: {
        items: [{ id: "1", name: "Product", price: 10.99, quantity: 2 }],
        total: 21.98,
      },
    });

    render(
      <Provider store={store}>
        <CartSummary />
      </Provider>
    );

    expect(screen.getByText(/\$21\.98/)).toBeInTheDocument();
  });
});
```

### Pattern 5: Component with TanStack Query

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductList } from "@/features/products/components/product-list";

describe("ProductList", () => {
  const createTestQueryClient = () => {
    return new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Don't retry in tests
          cacheTime: 0, // Don't cache in tests
        },
      },
    });
  };

  it("should display products from API", async () => {
    const queryClient = createTestQueryClient();

    // Mock API response
    vi.spyOn(window.productAPI, "getAll").mockResolvedValue([
      { id: "1", name: "Product 1", price: 10.99 },
      { id: "2", name: "Product 2", price: 15.99 },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <ProductList />
      </QueryClientProvider>
    );

    // Wait for products to load
    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
      expect(screen.getByText("Product 2")).toBeInTheDocument();
    });
  });
});
```

### Pattern 6: Custom Render Helper

Create `tests/utils/render-helpers.tsx`:

```typescript
import { render, RenderOptions } from "@testing-library/react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import type { ReactElement } from "react";

// Redux store helper
export function renderWithRedux(
  ui: ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: {
        // Add your reducers here
      },
      preloadedState,
    }),
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

// TanStack Query helper
export function renderWithQuery(
  ui: ReactElement,
  {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

// Combined helper
export function renderWithProviders(ui: ReactElement, { preloadedState = {}, store, queryClient, ...renderOptions } = {}) {
  const defaultStore = configureStore({
    reducer: {
      // Add your reducers here
    },
    preloadedState,
  });

  const defaultQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store || defaultStore}>
        <QueryClientProvider client={queryClient || defaultQueryClient}>{children}</QueryClientProvider>
      </Provider>
    );
  }

  return {
    store: store || defaultStore,
    queryClient: queryClient || defaultQueryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
```

Usage:

```typescript
import { renderWithProviders } from "@/tests/utils/render-helpers";

it("should work with Redux and Query", () => {
  const { getByText } = renderWithProviders(<MyComponent />);
  expect(getByText("Hello")).toBeInTheDocument();
});
```

---

## Testing Hooks

### Using `renderHook` from React Testing Library

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCart } from "@/features/sales/hooks/use-cart";

describe("useCart", () => {
  it("should add item to cart", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem({
        productId: "1",
        quantity: 2,
        price: 10.99,
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });
});
```

### Testing Hooks with Providers

```typescript
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProducts } from "@/features/products/hooks/use-products";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

it("should fetch products", async () => {
  const { result } = renderHook(() => useProducts(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });
});
```

---

## Mocking with Vitest

### Mocking Functions

```typescript
import { vi } from "vitest";

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue("value");
mockFn.mockResolvedValue({ data: "value" });
mockFn.mockRejectedValue(new Error("Error"));

// Mock a module
vi.mock("@/utils/api", () => ({
  fetchData: vi.fn().mockResolvedValue({ data: "test" }),
}));

// Mock Electron APIs
vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: vi.fn().mockResolvedValue({ success: true }),
  },
}));
```

### Mocking Components

```typescript
import { vi } from "vitest";

// Mock a component
vi.mock("@/components/expensive-component", () => ({
  ExpensiveComponent: () => <div>Mocked</div>,
}));
```

### Partial Mocks

```typescript
import { vi } from "vitest";
import * as module from "@/utils/helpers";

// Mock only specific functions
vi.spyOn(module, "expensiveFunction").mockReturnValue("mocked");
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

   ```typescript
   // ✅ Good
   screen.getByRole("button");
   screen.getByLabelText("Email");

   // ❌ Bad
   screen.getByTestId("submit-button");
   ```

3. **Wait for async operations**

   ```typescript
   // ✅ Good
   await waitFor(() => {
     expect(screen.getByText("Loaded")).toBeInTheDocument();
   });

   // ❌ Bad
   expect(screen.getByText("Loaded")).toBeInTheDocument();
   ```

4. **Use userEvent for interactions**

   ```typescript
   // ✅ Good
   const user = userEvent.setup();
   await user.click(button);

   // ❌ Bad
   fireEvent.click(button);
   ```

5. **Clean up after tests**
   ```typescript
   // Vitest handles this automatically via setup.ts
   afterEach(() => {
     cleanup();
     vi.clearAllMocks();
   });
   ```

### ❌ DON'T

1. **Don't test implementation details**

   ```typescript
   // ❌ Bad
   expect(component.state.count).toBe(5);

   // ✅ Good
   expect(screen.getByText("5")).toBeInTheDocument();
   ```

2. **Don't use container queries**

   ```typescript
   // ❌ Bad
   const { container } = render(<Component />);
   container.querySelector("button");

   // ✅ Good
   screen.getByRole("button");
   ```

3. **Don't use getByTestId unless necessary**

   ```typescript
   // ❌ Bad
   screen.getByTestId("submit-button");

   // ✅ Good
   screen.getByRole("button", { name: /submit/i });
   ```

4. **Don't forget to await async operations**

   ```typescript
   // ❌ Bad
   user.click(button);
   expect(screen.getByText("Success")).toBeInTheDocument();

   // ✅ Good
   await user.click(button);
   await waitFor(() => {
     expect(screen.getByText("Success")).toBeInTheDocument();
   });
   ```

---

## Debugging Tests

### Using Vitest UI

```bash
npm run test:ui
```

Opens a beautiful UI where you can:

- See all tests
- Filter and search
- See test output
- Debug failed tests
- See coverage

### Using `screen.debug()`

```typescript
import { screen } from "@testing-library/react";

it("should debug component", () => {
  render(<MyComponent />);
  screen.debug(); // Prints entire DOM
  screen.debug(screen.getByRole("button")); // Prints specific element
});
```

### Using `logRoles`

```typescript
import { logRoles } from "@testing-library/react";

it("should show available roles", () => {
  const { container } = render(<MyComponent />);
  logRoles(container); // Prints all available roles
});
```

### Using `prettyDOM`

```typescript
import { prettyDOM } from "@testing-library/react";

it("should pretty print", () => {
  const { container } = render(<MyComponent />);
  console.log(prettyDOM(container));
});
```

---

## Common Issues & Solutions

### Issue 1: "Cannot find module" errors

**Solution**: Check path aliases in `vitest.config.ts` match `tsconfig.json`

```typescript
// vitest.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './packages/renderer/src'),
  },
}
```

### Issue 2: "window is not defined"

**Solution**: Ensure `environment: 'jsdom'` in `vitest.config.ts`

```typescript
test: {
  environment: 'jsdom',
}
```

### Issue 3: "act() warning"

**Solution**: Use `waitFor` or `findBy` queries

```typescript
// ❌ Bad
await user.click(button);
expect(screen.getByText("Updated")).toBeInTheDocument();

// ✅ Good
await user.click(button);
await waitFor(() => {
  expect(screen.getByText("Updated")).toBeInTheDocument();
});
```

### Issue 4: Tests are slow

**Solution**:

- Use `pool: 'threads'` for parallel execution
- Mock expensive operations
- Use `vi.useFakeTimers()` for time-dependent tests

### Issue 5: Electron APIs not mocked

**Solution**: Add mocks in `tests/setup.ts`

```typescript
(window as any).electron = {
  ipcRenderer: {
    invoke: vi.fn(),
  },
};
```

---

## Performance Tips

1. **Run tests in parallel**

   ```typescript
   pool: 'threads',
   poolOptions: {
     threads: { singleThread: false },
   },
   ```

2. **Mock expensive operations**

   ```typescript
   vi.mock("@/utils/expensive-operation", () => ({
     expensiveFunction: vi.fn().mockReturnValue("mocked"),
   }));
   ```

3. **Use `vi.useFakeTimers()` for time-dependent tests**

   ```typescript
   beforeEach(() => {
     vi.useFakeTimers();
   });

   afterEach(() => {
     vi.useRealTimers();
   });
   ```

4. **Isolate tests** (default in Vitest)
   ```typescript
   test: {
     isolate: true, // Each test file runs in isolation
   },
   ```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Documentation](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about/)
- [User Event Documentation](https://testing-library.com/docs/user-event/intro/)
- [Common Mistakes with RTL](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Best Practices](https://kentcdodds.com/blog/write-tests)

---

## Quick Reference

### Import Statements

```typescript
// Vitest
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// React Testing Library
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";

// Jest DOM matchers
import "@testing-library/jest-dom";
```

### Common Assertions

```typescript
// Presence
expect(element).toBeInTheDocument();
expect(element).not.toBeInTheDocument();

// Visibility
expect(element).toBeVisible();
expect(element).not.toBeVisible();

// Disabled/Enabled
expect(element).toBeDisabled();
expect(element).toBeEnabled();

// Form values
expect(input).toHaveValue("value");
expect(checkbox).toBeChecked();

// Text content
expect(element).toHaveTextContent("text");
expect(element).toContainHTML("<div>content</div>");

// Attributes
expect(element).toHaveAttribute("aria-label", "value");
expect(element).toHaveClass("className");
```

---

This guide should give you everything you need to effectively use Vitest and React Testing Library together in your AuraSwift project!
