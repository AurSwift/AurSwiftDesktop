import { PIN_LENGTH } from "./constants";

export function sanitizePinValue(value: string, maxLength = PIN_LENGTH) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}
