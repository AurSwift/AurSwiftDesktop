# Testing Quick Reference Guide

> **📘 For complete guide, see [README.md](./README.md)**

## Quick Commands

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:components        # Component tests only
npm run test:e2e               # E2E tests (Playwright)

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# UI mode (Vitest)
npm run test:ui

# E2E UI mode (Playwright)
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

## Test File Naming

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.test.ts` or `*.test.tsx`
- Component tests: `*.test.tsx`
- E2E tests: `*.spec.ts` (Playwright)

## Test Structure Template

### Unit Test

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("FeatureName", () => {
  beforeEach(() => {
    // Setup
  });

  it("should do something", () => {
    // Test
    expect(result).toBe(expected);
  });
});
```

### Component Test

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component } from "@/path/to/component";

describe("Component", () => {
  it("should render", () => {
    render(<Component />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("should handle user interaction", async () => {
    const user = userEvent.setup();
    render(<Component />);
    await user.click(screen.getByRole("button"));
    // Assertions
  });
});
```

### Integration Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDB, teardownTestDB } from "@/tests/utils/db-setup";

describe("Feature Integration", () => {
  beforeAll(async () => {
    db = await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB(db);
  });

  it("should work end-to-end", async () => {
    // Integration test
  });
});
```

## Common Patterns

### Mocking Electron APIs

```typescript
vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: vi.fn(),
  },
}));
```

### Mocking with MSW

```typescript
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/products", () => {
    return HttpResponse.json([{ id: "1", name: "Product" }]);
  }),
];
```

### Testing Redux

```typescript
import { createTestStore } from "@/tests/utils/redux-helpers";

const store = createTestStore({
  /* preloadedState */
});
```

### Testing TanStack Query

```typescript
import { renderWithQuery } from "@/tests/utils/query-helpers";

renderWithQuery(<Component />);
```

## Coverage Goals

- **Business Logic**: 80%+
- **Services**: 75%+
- **UI Components**: 60%+
- **Utilities**: 90%+
- **Overall**: 70%+

## Performance Targets

- Unit tests: < 100ms each
- Component tests: < 500ms each
- Integration tests: < 1s each
- E2E tests: < 10s each

## Resources

- 📘 [Vitest + React Testing Library Guide](./VITEST_REACT_TESTING_LIBRARY_GUIDE.md) - **Start here for Vitest & RTL**
- [Full Testing Plan](./BEST_PRACTICE_TESTING_PLAN.md)
- [Testing Structure](./TESTING_STRUCTURE.md)
- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Docs](https://playwright.dev/)
