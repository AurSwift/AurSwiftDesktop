export { useAuth } from "./use-auth";
export { useIsMobile } from "./use-mobile";
export * from "./use-office-printer";
export { useFormNotification, getErrorMessage } from "./use-form-notification";
export { useDebouncedCallback } from "./use-debounced-callback";
export { useAdaptiveKeyboard } from "../../features/adaptive-keyboard/hooks/use-adaptive-keyboard";
export type {
  UseAdaptiveKeyboardOptions,
  FieldConfig,
} from "../../features/adaptive-keyboard/hooks/use-adaptive-keyboard";
export { useKeyboardWithRHF } from "../../features/adaptive-keyboard/hooks/use-keyboard-with-react-hook-form";
export type { UseKeyboardWithRHFOptions } from "../../features/adaptive-keyboard/hooks/use-keyboard-with-react-hook-form";
