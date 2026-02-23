import { useCallback } from "react";
import { PIN_LENGTH } from "./constants";
import { sanitizePinValue } from "./sanitize-pin";

interface PinKeypadControllerOptions<TField extends string> {
  isLoading: boolean;
  activeField: TField;
  setActiveField: (field: TField) => void;
  getValue: (field: TField) => string;
  setValue: (field: TField, value: string) => void;
  focusField: (field: TField) => void;
  getNextField?: (field: TField) => TField | null;
}

export function usePinKeypadController<TField extends string>({
  isLoading,
  activeField,
  setActiveField,
  getValue,
  setValue,
  focusField,
  getNextField,
}: PinKeypadControllerOptions<TField>) {
  const activeValue = getValue(activeField);

  const handleDigit = useCallback(
    (digit: string) => {
      if (isLoading) return;

      focusField(activeField);
      const nextValue = sanitizePinValue(activeValue + digit);
      if (nextValue === activeValue) return;

      setValue(activeField, nextValue);

      if (nextValue.length === PIN_LENGTH && getNextField) {
        const nextField = getNextField(activeField);
        if (nextField) {
          setActiveField(nextField);
          queueMicrotask(() => focusField(nextField));
        }
      }
    },
    [
      activeField,
      activeValue,
      focusField,
      getNextField,
      isLoading,
      setActiveField,
      setValue,
    ],
  );

  const handleBackspace = useCallback(() => {
    if (isLoading) return;

    focusField(activeField);
    if (!activeValue) return;

    setValue(activeField, activeValue.slice(0, -1));
  }, [activeField, activeValue, focusField, isLoading, setValue]);

  const handleClear = useCallback(() => {
    if (isLoading) return;

    focusField(activeField);
    if (!activeValue) return;

    setValue(activeField, "");
  }, [activeField, activeValue, focusField, isLoading, setValue]);

  return {
    activeValue,
    handleDigit,
    handleBackspace,
    handleClear,
  };
}
