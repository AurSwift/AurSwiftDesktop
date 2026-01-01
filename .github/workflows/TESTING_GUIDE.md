# Testing Infrastructure Guide

This document describes the comprehensive testing infrastructure for aurswift, including how tests run both locally and in CI/CD.

## 🏗️ Architecture

### Test Types

1. **Type Checking** - TypeScript type validation
2. **Unit Tests** - Fast, isolated function tests (Vitest)
3. **Component Tests** - React component tests (Vitest + Testing Library)
4. **Integration Tests** - Multi-module interaction tests (Vitest)
5. **E2E Tests** - Full application tests (Playwright)

### Test Execution Flow

```
┌─────────────────┐
│   Type Check    │  (Fast, runs first)
└────────┬────────┘
         │
    ┌────┴────┐
    │        │
┌───▼───┐ ┌──▼──────┐
│ Unit  │ │Component│  (Parallel execution)
└───┬───┘ └──┬──────┘
    │        │
    └───┬────┘
        │
┌───────▼────────┐
│  Integration   │  (After unit/component)
└───────┬────────┘
        │
┌───────▼────────┐
│   Coverage     │  (Aggregates all Vitest tests)
└───────┬────────┘
        │
┌───────▼────────┐
│   E2E Tests    │  (Requires build, runs on Windows)
└────────────────┘
```

## 🚀 Local Development

### Quick Start

```bash
# Run all tests in watch mode (recommended for development)
npm run test:watch

# Run all tests once
npm run test:run

# Run with UI
npm run test:ui
```

### Running Specific Test Types

```bash
# Unit tests only
npm run test:unit

# Component tests only
npm run test:components

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e
```

### Running Tests by Package

```bash
# Main process tests (unit + integration)
npm run test:main

# Renderer process tests (unit + components)
npm run test:renderer
```

### Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open coverage in browser
npm run test:coverage:html
```

### E2E Testing

```bash
# Run E2E tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

## 🔄 CI/CD Pipeline

### Workflow: `.github/workflows/tests.yml`

This workflow runs on:

- Pull requests (when test files change)
- Pushes to main (when test files change)
- Manual trigger
- Called from other workflows

### Job Structure

1. **typecheck** (5 min timeout)

   - Fast type checking
   - Runs on Ubuntu
   - No dependencies needed

2. **unit-tests** (10 min timeout)

   - Matrix strategy: `tests/unit/main`, `tests/unit/renderer`
   - Runs in parallel
   - Fast execution

3. **component-tests** (15 min timeout)

   - React component tests
   - Runs on Ubuntu

4. **integration-tests** (20 min timeout)

   - Matrix strategy: `tests/integration/main`, `tests/integration/renderer`
   - Runs in parallel

5. **coverage** (15 min timeout)

   - Aggregates all Vitest tests
   - Generates coverage reports
   - Uploads artifacts

6. **e2e-tests** (30 min timeout)

   - Requires application build
   - Runs on Windows (for Electron compatibility)
   - Installs Playwright browsers
   - Captures screenshots/videos on failure

7. **test-summary** (aggregation)
   - Collects all test results
   - Generates summary report
   - Fails if any test suite fails

### Artifacts

The workflow generates the following artifacts:

- `unit-test-results-*` - JUnit XML for unit tests
- `component-test-results` - JUnit XML for component tests
- `integration-test-results-*` - JUnit XML for integration tests
- `coverage-report` - Coverage HTML, JSON, LCOV
- `e2e-test-results` - Playwright HTML report, JUnit XML
- `e2e-screenshots` - Screenshots from failed E2E tests
- `e2e-videos` - Videos from failed E2E tests

### Integration with Main CI

The test workflow is integrated into the main CI pipeline (`.github/workflows/ci.yml`):

```
prepare → tests → compile-and-test → semantic-release
```

Tests must pass before building and releasing.

## 📊 Best Practices

### 1. Test Organization

- **Unit tests**: `tests/unit/` - Fast, isolated, no side effects
- **Component tests**: `tests/components/` - React components in isolation
- **Integration tests**: `tests/integration/` - Multiple modules working together
- **E2E tests**: `tests/e2e/` - Full user workflows

### 2. Test Naming

- Vitest: `*.test.ts` or `*.test.tsx`
- Playwright: `*.spec.ts`

### 3. Running Tests Locally

**Before committing:**

```bash
# Run all tests
npm run test:all

# Or run specific types
npm run test:unit && npm run test:components && npm run test:e2e
```

**During development:**

```bash
# Watch mode (recommended)
npm run test:watch

# Or UI mode
npm run test:ui
```

### 4. CI Considerations

- Tests run in parallel where possible
- Matrix strategy for different test paths
- Proper caching to speed up runs
- Artifacts for debugging failures
- Coverage thresholds enforced

### 5. Debugging Failed Tests

**Local:**

```bash
# Vitest UI
npm run test:ui

# Playwright UI
npm run test:e2e:ui

# Playwright debug
npm run test:e2e:debug
```

**CI:**

- Check workflow artifacts for test results
- Download coverage reports
- View E2E screenshots/videos for failures
- Check individual job logs

## 🔧 Configuration Files

- `vitest.config.ts` - Vitest configuration
- `playwright.config.ts` - Playwright configuration
- `.github/workflows/tests.yml` - CI test workflow
- `scripts/run-vitest.js` - Vitest runner script

## 📈 Coverage Goals

| Category       | Minimum | Target |
| -------------- | ------- | ------ |
| Overall        | 70%     | 80%    |
| Business Logic | 85%     | 95%    |
| Components     | 75%     | 85%    |
| Utilities      | 90%     | 95%    |

Coverage is enforced in CI and reported in artifacts.

## 🐛 Troubleshooting

### Tests fail locally but pass in CI

- Check Node.js version (should be 22.x)
- Clear `node_modules` and reinstall
- Check for uncommitted changes

### E2E tests fail

- Ensure application is built: `npm run build`
- Check Playwright browsers are installed: `npx playwright install`
- Verify Electron binary exists

### Coverage not generating

- Ensure tests actually run (not skipped)
- Check `vitest.config.ts` coverage settings
- Verify coverage provider is installed: `@vitest/coverage-v8`

### CI tests timeout

- Check for infinite loops or hanging tests
- Increase timeout in workflow if needed
- Review test execution logs

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

---

**Last Updated**: 2024
**Maintained by**: Development Team
