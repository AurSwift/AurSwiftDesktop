# Integration Tests

Integration tests for aurswift POS System.

## Structure

```
integration/
├── main/              # Main process integration tests
│   ├── ipc/          # IPC communication tests
│   ├── database/     # Database integration tests
│   └── services/     # Service integration tests
└── renderer/         # Renderer process integration tests
    ├── api/          # API integration tests
    └── stores/       # Store integration tests
```

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run main process integration tests
npm run test:main

# Run specific integration test file
npm run test tests/integration/main/ipc/example.test.ts
```

## Writing Integration Tests

Integration tests verify that multiple units work together correctly. They test:

- IPC communication between main and renderer
- Database operations with real queries
- Service interactions
- API integrations with mocked external services

## Example

```typescript
// tests/integration/main/database/transaction.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDatabase, cleanupTestDatabase } from "../../utils/db-setup";

describe("Transaction Integration", () => {
  beforeEach(async () => {
    await createTestDatabase();
  });

  it("should create and retrieve transaction", async () => {
    // Test database operations
  });
});
```
