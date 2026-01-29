# Testing Quick Start Guide

> **📘 For complete guide, see [README.md](./README.md)**

## Installation

Install all test dependencies:

```bash
npm install
```

## Running Tests

### Quick Commands

```bash
# Run all unit and integration tests
npm run test:run

# Run tests in watch mode (development)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run specific test type
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:components    # Component tests only
npm run test:e2e           # E2E tests (Playwright)

# Run with coverage
npm run test:coverage
```

## Writing Your First Test

### 1. Unit Test (Main Process)

Create `tests/unit/main/database/managers/yourManager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { YourManager } from "@app/main/database/managers/yourManager";
import { createMockDB, createMockUUID } from "../../../utils/test-helpers";

describe("YourManager", () => {
  let manager: YourManager;
  let mockDB: any;
  let mockUUID: any;

  beforeEach(() => {
    mockDB = createMockDB();
    mockUUID = createMockUUID();
    manager = new YourManager(mockDB, mockUUID);
  });

  it("should do something", () => {
    expect(true).toBe(true);
  });
});
```

### 2. Component Test (Renderer)

Create `tests/components/your-component.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YourComponent } from "@/path/to/your-component";

describe("YourComponent", () => {
  it("should render", () => {
    render(<YourComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### 3. Integration Test

Create `tests/integration/your-feature.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDB, teardownTestDB } from "../utils/db-setup";

describe("Your Feature Integration", () => {
  let db: any;

  beforeAll(async () => {
    db = await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB(db);
  });

  it("should work end-to-end", async () => {
    // Your integration test
  });
});
```

## Test Utilities

### Mock Database

```typescript
import { createMockDB } from "../utils/test-helpers";
const mockDB = createMockDB();
```

### Mock UUID

```typescript
import { createMockUUID } from "../utils/test-helpers";
const mockUUID = createMockUUID();
```

### Test Fixtures

```typescript
import { testUsers, testProducts, testTransactions } from "../utils/fixtures";
const user = testUsers.cashier;
```

### Test Data Builders

```typescript
import { createTestTransaction, createTestProduct } from "../utils/test-helpers";
const transaction = createTestTransaction({ total: 150 });
```

## Common Patterns

### Testing Async Functions

```typescript
it("should handle async operations", async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Errors

```typescript
it("should throw error on invalid input", async () => {
  await expect(manager.doSomething(invalidData)).rejects.toThrow();
});
```

### Mocking Functions

```typescript
import { vi } from "vitest";

const mockFn = vi.fn();
mockFn.mockReturnValue("value");
expect(mockFn).toHaveBeenCalled();
```

### Testing User Interactions

```typescript
import userEvent from "@testing-library/user-event";

const user = userEvent.setup();
await user.click(screen.getByRole("button"));
```

## Coverage

View coverage report:

```bash
npm run test:coverage
```

Open HTML report:

```bash
open coverage/index.html
```

## Troubleshooting

### Tests not finding modules

- Check `vitest.config.ts` alias configuration
- Ensure paths match your tsconfig.json

### Database tests failing

- Ensure test database is cleaned up
- Check database path in `db-setup.ts`

### Component tests not rendering

- Check if React Testing Library is imported
- Verify jsdom environment in vitest.config.ts

## Next Steps

- Read [TESTING_STRUCTURE.md](./TESTING_STRUCTURE.md) for comprehensive guide
- Check example tests in `tests/unit/` and `tests/components/`
- Review test utilities in `tests/utils/`
