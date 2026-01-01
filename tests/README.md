# aurswift Test Suite

This directory contains all tests for the aurswift POS System.

## 📚 Documentation

- **[Quick Start Guide](../docs/Testing/QUICK_START_GUIDE.md)** - Get started in 5 minutes
- **[Comprehensive Testing Plan](../docs/Testing/COMPREHENSIVE_TESTING_PLAN.md)** - Complete testing strategy
- **[Implementation Checklist](../docs/Testing/IMPLEMENTATION_CHECKLIST.md)** - Track progress

## 🚀 Quick Start

```bash
# Run all unit & component tests
npm run test

# Run tests in watch mode (recommended)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📁 Structure

```
tests/
├── setup.ts                      # Global test setup
├── mocks/                        # API mocking (MSW)
│   ├── handlers.ts               # Request handlers
│   └── server.ts                 # Server setup
├── utils/                        # Test utilities
│   ├── render-helpers.tsx        # React testing utilities
│   ├── db-setup.ts               # Database utilities
│   └── fixtures/                 # Test data factories
│       ├── products.fixture.ts
│       ├── transactions.fixture.ts
│       └── users.fixture.ts
├── unit/                         # Unit tests
│   ├── main/                     # Main process tests
│   └── renderer/                 # Renderer process tests
├── components/                   # React component tests
│   └── features/
├── integration/                  # Integration tests
│   ├── main/
│   └── renderer/
└── e2e/                          # End-to-end tests
    ├── page-objects/             # Page object models
    └── *.spec.ts                 # E2E test specs
```

## 🎯 Test Types

### Unit Tests (70% of suite)

Test isolated functions and business logic.

**Example**: `tests/unit/renderer/features/sales/utils/cartCalculations.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { calculateTotal } from "./cartCalculations";

describe("calculateTotal", () => {
  it("should calculate total with tax and discount", () => {
    expect(calculateTotal(100, 20, 10)).toBe(110);
  });
});
```

### Component Tests (20% of suite)

Test React components in isolation.

**Example**: `tests/components/features/sales/ProductCard.test.tsx`

```typescript
import { render, screen, userEvent } from "../../../utils/render-helpers";
import { createMockProduct } from "../../../utils/fixtures/products.fixture";

it("should add product to cart when clicked", async () => {
  const user = userEvent.setup();
  const product = createMockProduct();
  const onAdd = vi.fn();

  render(<ProductCard product={product} onAddToCart={onAdd} />);
  await user.click(screen.getByRole("button", { name: /add to cart/i }));

  expect(onAdd).toHaveBeenCalledWith(product);
});
```

### Integration Tests (8% of suite)

Test interactions between multiple modules.

```typescript
import { server } from "../mocks/server";

it("should create transaction and update inventory", async () => {
  // Test database operations, IPC communication, etc.
});
```

### E2E Tests (2% of suite)

Test complete user workflows in Electron.

**Example**: `tests/e2e/auth.spec.ts`

```typescript
import { LoginPage } from "./page-objects/LoginPage";

electronTest("should login successfully", async ({ electronApp }) => {
  const page = await electronApp.firstWindow();
  const loginPage = new LoginPage(page);

  await loginPage.login("cashier@test.com", "password123");

  expect(await loginPage.isLoggedIn()).toBe(true);
});
```

## 🛠️ Test Utilities

### Fixtures (Test Data Factories)

```typescript
import { createMockProduct, createMockTransaction, createMockUser } from "./utils/fixtures";

const product = createMockProduct({ name: "Test Product", price: 19.99 });
const transaction = createCashTransaction({ total: 50.0 });
const user = createAdminUser();
```

### Render Helpers

```typescript
import { render, screen } from "./utils/render-helpers";

render(<MyComponent />, { initialRoute: "/dashboard" });
```

### API Mocking (MSW)

```typescript
import { server } from "./mocks/server";
import { http, HttpResponse } from "msw";

server.use(
  http.get("/api/products", () => {
    return HttpResponse.json([{ id: "1", name: "Test" }]);
  })
);
```

## 📊 Coverage Goals

| Category           | Minimum | Target |
| ------------------ | ------- | ------ |
| **Overall**        | 70%     | 80%    |
| **Business Logic** | 85%     | 95%    |
| **Components**     | 75%     | 85%    |
| **Utilities**      | 90%     | 95%    |

View coverage:

```bash
npm run test:coverage
open coverage/index.html
```

## ✅ Best Practices

### Do's ✅

- Test behavior, not implementation
- Use descriptive test names: `should do X when Y`
- Keep tests isolated (no shared state)
- Mock external dependencies
- Use fixtures for test data
- Clean up after tests

### Don'ts ❌

- Don't test third-party libraries
- Don't test implementation details
- Don't write flaky tests
- Don't skip cleanup
- Don't hardcode test data
- Don't commit `.only` or `.skip`

## 🐛 Debugging

### Run Single Test

```bash
npm run test -- tests/unit/path/to/file.test.ts
```

### Use `.only` for Focused Testing

```typescript
it.only("should test this specific case", () => {
  // Only this test runs
});
```

### Vitest UI

```bash
npm run test:ui
```

Opens interactive UI for running and debugging tests.

### E2E Debugging

```bash
npm run test:e2e:debug
npm run test:e2e:ui
```

## 📖 Examples

- **Unit Test**: `tests/unit/renderer/features/sales/utils/cartCalculations.test.ts`
- **Component Test**: `tests/components/features/sales/ProductCard.test.tsx`
- **E2E Test**: `tests/e2e/auth.spec.ts`
- **Page Object**: `tests/e2e/page-objects/LoginPage.ts`
- **Fixtures**: `tests/utils/fixtures/*.fixture.ts`

## 🔗 Related Documentation

- [Comprehensive Testing Plan](../docs/Testing/COMPREHENSIVE_TESTING_PLAN.md)
- [Quick Start Guide](../docs/Testing/QUICK_START_GUIDE.md)
- [Implementation Checklist](../docs/Testing/IMPLEMENTATION_CHECKLIST.md)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)

## 🆘 Need Help?

- Check the [Quick Start Guide](../docs/Testing/QUICK_START_GUIDE.md)
- Review example tests in this directory
- Ask in #testing Slack channel

---

**Happy Testing!** 🎉
