import { createContext, useContext } from "react";

export interface RetryContextValue {
  retryKey: number;
  retry: () => void;
}

const defaultRetry = (): void => {};

const RetryContext = createContext<RetryContextValue>({
  retryKey: 0,
  retry: defaultRetry,
});

export function useRetryContext(): RetryContextValue {
  return useContext(RetryContext);
}

export { RetryContext };
