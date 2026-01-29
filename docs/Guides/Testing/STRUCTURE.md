# Tests Directory Structure

This document describes the complete structure of the `tests/` directory and how it maps to test commands.

## 📁 Complete Directory Structure

```
tests/
├── setup.ts                          # Global Vitest setup (MSW, test helpers)
├── README.md                          # Main test documentation
├── STRUCTURE.md                       # This file
├── TESTING_IMPLEMENTATION_SUMMARY.md # Implementation summary
│
├── unit/                              # Unit Tests (npm run test:unit)
│   ├── main/                          # Main process unit tests
│   │   ├── database/
│   │   │   └── managers/
│   │   │       └── transactionManager.test.ts
│   │   └── utils/
│   │       ├── scheduleValidator.test.ts
│   │       ├── shiftRequirementResolver.test.ts
│   │       └── transactionValidator.test.ts
│   └── renderer/                      # Renderer process unit tests
│       └── features/
│           └── sales/
│               └── utils/
│                   └── cartCalculations.test.ts
│
├── components/                        # Component Tests (npm run test:components)
│   └── features/
│       └── sales/
│           └── ProductCard.test.tsx
│
├── integration/                       # Integration Tests (npm run test:integration)
│   ├── README.md                      # Integration test documentation
│   ├── main/                          # Main process integration tests
│   │   ├── .gitkeep
│   │   ├── ipc/                       # IPC communication tests
│   │   ├── database/                  # Database integration tests
│   │   └── services/                  # Service integration tests
│   └── renderer/                      # Renderer process integration tests
│       ├── .gitkeep
│       ├── api/                       # API integration tests
│       └── stores/                    # Store integration tests
│
├── e2e/                               # E2E Tests (npm run test:e2e)
│   ├── app.spec.ts                    # Main app tests + shared fixtures
│   ├── auth.spec.ts                   # Authentication flow tests
│   ├── hardware-integration.spec.ts   # Hardware integration tests
│   └── page-objects/                  # Page Object Models
│       ├── BasePage.ts
│       └── LoginPage.ts
│
├── mocks/                             # API Mocking (MSW)
│   ├── handlers.ts                    # Request handlers
│   └── server.ts                      # MSW server setup
│
├── utils/                             # Test Utilities
│   ├── render-helpers.tsx             # React testing utilities
│   ├── db-setup.ts                    # Database utilities
│   ├── test-helpers.ts                # General test helpers
│   └── fixtures/                      # Test Data Factories
│       ├── products.fixture.ts
│       ├── products.ts
│       ├── transactions.fixture.ts
│       ├── transactions.ts
│       ├── users.fixture.ts
│       └── users.ts
│
└── docs/                              # Test Documentation
    └── Testing/
        ├── IMPLEMENTATION_SUMMARY.md
        ├── QUICK_START_GUIDE.md
        ├── COMPREHENSIVE_TESTING_PLAN.md
        └── ... (other docs)
```

## 🎯 Command Mapping

### Development Commands

| Command              | What It Runs                  | Directory                                                |
| -------------------- | ----------------------------- | -------------------------------------------------------- |
| `npm run test`       | All Vitest tests (watch mode) | `tests/unit/`, `tests/components/`, `tests/integration/` |
| `npm run test:watch` | Watch mode for all tests      | All Vitest tests                                         |
| `npm run test:ui`    | Vitest UI                     | All Vitest tests                                         |

### CI/CD Commands

| Command                 | What It Runs                | Directory        |
| ----------------------- | --------------------------- | ---------------- |
| `npm run test:run`      | All tests once (via script) | All Vitest tests |
| `npm run test:coverage` | All tests with coverage     | All Vitest tests |

### Specific Test Commands

| Command                    | What It Runs           | Directory            |
| -------------------------- | ---------------------- | -------------------- |
| `npm run test:unit`        | Unit tests only        | `tests/unit/`        |
| `npm run test:integration` | Integration tests only | `tests/integration/` |
| `npm run test:components`  | Component tests only   | `tests/components/`  |
| `npm run test:e2e`         | E2E tests only         | `tests/e2e/`         |

### Combined Commands

| Command                 | What It Runs                                   |
| ----------------------- | ---------------------------------------------- |
| `npm run test:main`     | `tests/unit/main/` + `tests/integration/main/` |
| `npm run test:renderer` | `tests/unit/renderer/` + `tests/components/`   |
| `npm run test:all`      | All Vitest tests + E2E tests                   |

## 📝 File Naming Conventions

### Vitest Tests (Unit, Component, Integration)

- **Pattern**: `*.test.ts` or `*.test.tsx`
- **Examples**:
  - `cartCalculations.test.ts`
  - `ProductCard.test.tsx`
  - `transactionManager.test.ts`

### Playwright E2E Tests

- **Pattern**: `*.spec.ts`
- **Examples**:
  - `app.spec.ts`
  - `auth.spec.ts`
  - `hardware-integration.spec.ts`

### Test Utilities

- **Fixtures**: `*.fixture.ts`
- **Helpers**: `*-helpers.tsx` or `*-helpers.ts`
- **Setup**: `setup.ts`, `db-setup.ts`

## 🔍 Test Discovery

### Vitest Configuration (`vitest.config.ts`)

```typescript
include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"];
exclude: [
  "tests/e2e", // Exclude E2E (Playwright)
  "tests/**/*.spec.ts", // Exclude Playwright specs
];
```

**Runs**: All `*.test.*` files in:

- `tests/unit/`
- `tests/components/`
- `tests/integration/`

**Excludes**: All `*.spec.ts` files (Playwright)

### Playwright Configuration (`playwright.config.ts`)

```typescript
testDir: "./tests/e2e";
testMatch: /.*\.spec\.ts/;
```

**Runs**: All `*.spec.ts` files in `tests/e2e/`

## ✅ Verification Checklist

- [x] `tests/unit/` exists with test files
- [x] `tests/components/` exists with test files
- [x] `tests/integration/` exists (created)
- [x] `tests/e2e/` exists with spec files
- [x] `tests/utils/` exists with helpers and fixtures
- [x] `tests/mocks/` exists with MSW setup
- [x] `tests/setup.ts` exists for global setup
- [x] All commands in `package.json` match structure
- [x] Vitest config excludes E2E tests
- [x] Playwright config only runs E2E tests

## 🚀 Quick Reference

```bash
# Development
npm run test:watch          # Watch all Vitest tests
npm run test:ui             # Vitest UI

# CI/CD
npm run test:run            # Run all Vitest tests once
npm run test:coverage       # With coverage report

# Specific
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:components     # Component tests only
npm run test:e2e           # E2E tests only

# Combined
npm run test:main          # Main process tests (unit + integration)
npm run test:renderer       # Renderer tests (unit + components)
npm run test:all           # All tests (Vitest + E2E)
```

## 📚 Related Documentation

- [Main README](./README.md) - Complete test documentation
- [Integration Tests README](./integration/README.md) - Integration test guide
- [Implementation Summary](./TESTING_IMPLEMENTATION_SUMMARY.md) - Implementation details
- [Testing Docs](./docs/Testing/) - Comprehensive testing documentation
