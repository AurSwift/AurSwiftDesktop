# Testing Quick Start Guide

A practical guide to get started with testing in AuraSwift POS System.

## 🚀 Quick Start

### Run Tests

```bash
# Run all unit & component tests
npm run test

# Run tests in watch mode (recommended for development)
npm run test:watch

# Run tests with UI (interactive)
npm run test:ui

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Write Your First Test

#### 1. Unit Test Example

Create `packages/main/src/utils/myFunction.ts`:
```typescript
export function calculateTotal(price: number, quantity: number): number {
  return price * quantity;
}
```

Create `tests/unit/main/utils/myFunction.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateTotal } from '@app/main/utils/myFunction';

describe('calculateTotal', () => {
  it('should calculate total correctly', () => {
    const result = calculateTotal(10, 5);
    expect(result).toBe(50);
  });
});
```

Run the test:
```bash
npm run test:unit
```

#### 2. Component Test Example

Create `tests/components/MyButton.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '../utils/render-helpers';

function MyButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick}>Click Me</button>;
}

describe('MyButton', () => {
  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<MyButton onClick={handleClick} />);
    
    await user.click(screen.getByText('Click Me'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

#### 3. E2E Test Example

Create `tests/e2e/my-feature.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { test as electronTest } from '../e2e.spec';

electronTest('should perform basic operation', async ({ electronApp }) => {
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  
  // Your test logic here
  expect(await page.title()).toBeTruthy();
});
```

## 📁 Where to Put Tests

```
tests/
├── unit/                     # Pure logic tests
│   ├── main/                 # Main process
│   └── renderer/             # Renderer process
├── components/               # React component tests
│   └── features/
├── integration/              # Multi-module tests
└── e2e/                      # End-to-end tests
```

## 🎯 What to Test

### ✅ DO Test

- **Business logic** (calculations, validations)
- **User interactions** (clicks, form submissions)
- **Edge cases** (null, empty, max values)
- **Error handling** (invalid input, API failures)
- **Critical paths** (checkout, payment)

### ❌ DON'T Test

- Third-party libraries
- Simple getters/setters
- CSS styling
- Implementation details

## 🛠️ Common Patterns

### Mock Electron APIs

```typescript
import { vi } from 'vitest';

// Mock is auto-configured in tests/setup.ts
const mockResult = await window.productAPI.getAll();
```

### Mock API Calls (MSW)

```typescript
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

// Override handler for specific test
server.use(
  http.get('/api/products', () => {
    return HttpResponse.json([{ id: '1', name: 'Test' }]);
  })
);
```

### Use Test Fixtures

```typescript
import { createMockProduct } from '../utils/fixtures/products.fixture';

const product = createMockProduct({ name: 'Custom Name', price: 29.99 });
```

### Test Async Code

```typescript
it('should load data asynchronously', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

### Test User Interactions

```typescript
import { render, screen, userEvent } from '../utils/render-helpers';

it('should submit form', async () => {
  const user = userEvent.setup();
  render(<MyForm />);
  
  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

## 🐛 Debugging Tests

### Run Single Test File

```bash
npm run test -- tests/unit/main/utils/myFunction.test.ts
```

### Run Single Test Case

```typescript
it.only('should test this specific case', () => {
  // This test will run exclusively
});
```

### Use Vitest UI

```bash
npm run test:ui
```

Then open the UI in your browser to:
- See test results visually
- Filter and search tests
- View code coverage
- Rerun failed tests

### Debug in VSCode

1. Install "Vitest" extension
2. Click the green play button next to any test
3. Set breakpoints in your test code
4. Debug like any other TypeScript code

### View E2E Test Traces

```bash
# Run E2E with traces
npm run test:e2e

# View traces for failed tests
npx playwright show-trace test-results/[test-name]/trace.zip
```

## 📊 Coverage

### View Coverage Report

```bash
npm run test:coverage
open coverage/index.html
```

### Coverage Targets

- **Business Logic**: 80%+
- **Components**: 75%+
- **Utilities**: 90%+

### Ignore Coverage for Specific Code

```typescript
/* istanbul ignore next */
function debugOnly() {
  console.log('Debug code');
}
```

## 🔧 Troubleshooting

### Tests Timeout

Increase timeout in test:
```typescript
it('slow test', async () => {
  // Test code
}, 15000); // 15 second timeout
```

Or in config (`vitest.config.ts`):
```typescript
test: {
  testTimeout: 15000
}
```

### Module Not Found

Check aliases in `vitest.config.ts`:
```typescript
resolve: {
  alias: {
    "@": "./packages/renderer/src",
    "@app/main": "./packages/main/src",
  }
}
```

### Electron APIs Not Mocked

Check `tests/setup.ts` - all Electron APIs should be mocked there.

### Tests Pass Locally but Fail in CI

- Check for timing issues (add `waitFor`)
- Check for hardcoded paths
- Check for environment-specific code

## 📚 Next Steps

1. Read the [Comprehensive Testing Plan](./COMPREHENSIVE_TESTING_PLAN.md)
2. Study the example tests in `tests/` directory
3. Write tests for your feature
4. Aim for 70%+ coverage
5. Run tests before committing

## 🆘 Need Help?

- **Documentation**: `docs/Testing/`
- **Examples**: `tests/**/*.test.{ts,tsx}`
- **Slack**: #testing channel
- **Email**: dev-team@auraswift.com

---

Happy Testing! 🎉

