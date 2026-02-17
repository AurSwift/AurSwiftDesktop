/**
 * React Testing Utilities
 *
 * Custom render function with common providers for component testing.
 * This ensures consistent test setup across all component tests.
 */

import { render as rtlRender, RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "@/features/auth/context/auth-context";
import type { AuthContextType } from "@/types/domain/user";

/**
 * Minimal user shape for tests (RBAC hooks need id, businessId, primaryRole)
 */
export interface MockAuthUser {
  id: string;
  businessId: string;
  primaryRole?: { name: string; displayName?: string };
  roleName?: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * Create a mock AuthContext value for testing (e.g. RBAC components using useAuth)
 */
export function createMockAuthContext(authUser: MockAuthUser | null): AuthContextType {
  const noop = async () => ({ success: false, message: "Not implemented" });
  const noopVoid = async () => {};
  return {
    user: authUser as AuthContextType["user"],
    sessionToken: authUser ? "test-token" : null,
    requiresPinChange: false,
    completeForceChangePIN: noop,
    login: noop,
    register: noop,
    registerBusiness: noop,
    createUser: noop,
    logout: noopVoid,
    clockIn: noop,
    clockOut: noop,
    getActiveShift: async () => null,
    isLoading: false,
    error: null,
    isInitializing: false,
  };
}

/**
 * Custom render options
 */
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  /**
   * Initial route for MemoryRouter
   */
  initialRoute?: string;

  /**
   * QueryClient instance (creates new one if not provided)
   */
  queryClient?: QueryClient;

  /**
   * Additional wrapper component
   */
  additionalWrapper?: React.ComponentType<{ children: React.ReactNode }>;

  /**
   * When set, wraps with AuthContext so useAuth() returns this user (e.g. for RBAC tests)
   */
  authUser?: MockAuthUser | null;
}

/**
 * Custom render function that wraps components with common providers
 *
 * @example
 * ```tsx
 * render(<MyComponent />, { initialRoute: '/dashboard' });
 * ```
 */
export function render(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): ReturnType<typeof rtlRender> {
  const {
    initialRoute = "/",
    queryClient = createTestQueryClient(),
    additionalWrapper,
    authUser,
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    let wrappedChildren = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );

    if (authUser !== undefined) {
      const authValue = createMockAuthContext(authUser ?? null);
      wrappedChildren = (
        <AuthContext.Provider value={authValue}>
          {wrappedChildren}
        </AuthContext.Provider>
      );
    }

    if (additionalWrapper) {
      const AdditionalWrapper = additionalWrapper;
      wrappedChildren = (
        <AdditionalWrapper>{wrappedChildren}</AdditionalWrapper>
      );
    }

    return wrappedChildren;
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Create a test QueryClient with sensible defaults
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry in tests
        gcTime: Infinity, // Don't garbage collect
        staleTime: Infinity, // Never become stale
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {}, // Silence errors in tests
    },
  });
}

/**
 * Wait for async operations to complete
 * Useful after triggering actions that update state asynchronously
 */
export async function waitForAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Re-export everything from RTL for convenience
 */
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
