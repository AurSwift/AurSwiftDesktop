import React from "react";
import { Banknote } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericKeypad } from "../shared/numeric-keypad";
import { PaymentActions } from "./payment-actions";
import type { PaymentMethod } from "@/types/domain/payment";

function getCurrencySymbol(currency: string) {
  switch (currency.toUpperCase()) {
    case "GBP":
      return "£";
    case "EUR":
      return "€";
    case "USD":
      return "$";
    default:
      return "";
  }
}

function normalizeMoneyInput(raw: string) {
  // Keep only digits and dot.
  let s = raw.replace(/[^\d.]/g, "");
  if (s === "") return "";

  // Collapse multiple dots into one.
  const parts = s.split(".");
  if (parts.length > 2) {
    s = `${parts[0]}.${parts.slice(1).join("")}`;
  }

  // Normalize leading dot.
  if (s.startsWith(".")) s = `0${s}`;

  const [wholeRaw, fracRaw] = s.split(".");
  const whole = (wholeRaw || "0").replace(/^0+(?=\d)/, "") || "0";
  const frac = fracRaw?.slice(0, 2);

  return fracRaw !== undefined ? `${whole}.${frac ?? ""}` : whole;
}

function parseMoneyInput(input: string) {
  const n = Number.parseFloat(input);
  return Number.isFinite(n) ? n : 0;
}

interface CashPaymentModalProps {
  open: boolean;
  total: number;
  cashAmount: number;
  currency?: string;
  onCashAmountChange: (amount: number) => void;
  onComplete: () => void;
  onCancel: () => void;
}

export function CashPaymentModal({
  open,
  total,
  cashAmount,
  currency = "GBP",
  onCashAmountChange,
  onComplete,
  onCancel,
}: CashPaymentModalProps) {
  const currencySymbol = getCurrencySymbol(currency) || `${currency} `;
  const cashPaymentMethod = React.useMemo<PaymentMethod>(
    () => ({ type: "cash", amount: total }),
    [total],
  );

  // Source of truth for keypad editing (keeps partial states like "12.")
  const [cashInput, setCashInput] = React.useState("");

  // Start empty each time the modal opens (per requirement).
  React.useEffect(() => {
    if (!open) return;
    if (cashAmount > 0) {
      // If caller opens with an amount, reflect it.
      setCashInput(cashAmount.toFixed(2));
    } else {
      setCashInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cashValue = React.useMemo(
    () => parseMoneyInput(cashInput),
    [cashInput],
  );

  const change = cashValue >= total ? cashValue - total : 0;
  const shortfall = cashValue > 0 && cashValue < total ? total - cashValue : 0;
  const isCashValid = cashValue >= total && cashValue > 0;

  const setAmount = React.useCallback((amount: number) => {
    const normalized = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    const nextInput = normalized === 0 ? "" : normalized.toFixed(2);
    setCashInput(nextInput);
    onCashAmountChange(normalized);
  }, []);

  const handleBackspace = React.useCallback(() => {
    setCashInput((prev) => {
      const next = prev.slice(0, -1);
      onCashAmountChange(parseMoneyInput(next));
      return next;
    });
  }, [onCashAmountChange]);

  const handleClear = React.useCallback(() => {
    setCashInput("");
    onCashAmountChange(0);
  }, [onCashAmountChange]);

  const handleKeypadInput = React.useCallback(
    (value: string) => {
      if (value === "Clear") {
        handleClear();
        return;
      }

      if (value === "Enter") {
        // Prevent keypad Enter from bypassing cash validation.
        if (isCashValid) {
          onComplete();
        }
        return;
      }

      if (value === "Backspace" || value === "<-" || value === "←") {
        handleBackspace();
        return;
      }

      setCashInput((prev) => {
        const nextRaw =
          value === "."
            ? prev.includes(".")
              ? prev
              : prev === ""
                ? "0."
                : `${prev}.`
            : `${prev}${value}`;
        const next = normalizeMoneyInput(nextRaw);
        onCashAmountChange(parseMoneyInput(next));
        return next;
      });
    },
    [handleBackspace, handleClear, isCashValid, onCashAmountChange, onComplete],
  );

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-4xl max-w-[calc(100vw-1rem)] w-full p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-600" />
            Cash Payment
          </DialogTitle>
          <DialogDescription>
            Enter the cash received using the keypad or the input field.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Left: amounts + quick actions */}
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between text-sm sm:text-base text-slate-700">
                <span>Amount Due</span>
                <span className="font-semibold">
                  {currencySymbol}
                  {total.toFixed(2)}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <Label className="text-xs sm:text-sm text-slate-600">
                  Cash Received
                </Label>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cashInput}
                  onChange={(e) => {
                    const next = normalizeMoneyInput(e.target.value);
                    setCashInput(next);
                    onCashAmountChange(parseMoneyInput(next));
                  }}
                  className={`h-11 text-base sm:text-lg ${
                    cashValue > 0 && cashValue < total
                      ? "border-red-300 bg-red-50"
                      : "bg-white border-slate-300"
                  }`}
                />
                {shortfall > 0 && (
                  <p className="text-red-600 text-xs sm:text-sm">
                    Insufficient funds. Need {currencySymbol}
                    {shortfall.toFixed(2)} more.
                  </p>
                )}
              </div>

              <div
                className={`flex justify-between font-bold text-base sm:text-lg pt-4 mt-4 border-t border-slate-200 ${
                  cashValue >= total
                    ? "text-sky-700"
                    : cashValue > 0
                      ? "text-red-600"
                      : "text-slate-600"
                }`}
              >
                <span>Change</span>
                <span>
                  {cashValue >= total
                    ? `${currencySymbol}${change.toFixed(2)}`
                    : cashValue > 0
                      ? `-${currencySymbol}${shortfall.toFixed(2)}`
                      : `${currencySymbol}0.00`}
                </span>
              </div>
            </div>

            {/* Quick cash buttons */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm text-slate-600">
                Quick Select
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 20, 50].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    onClick={() => setAmount(amount)}
                    className="min-h-[44px] h-10 text-sm touch-manipulation"
                  >
                    {currencySymbol}
                    {amount}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAmount(total)}
                  className="flex-1 min-h-[44px] h-11 text-sm touch-manipulation"
                >
                  Exact Amount
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAmount(Math.ceil(total))}
                  className="flex-1 min-h-[44px] h-11 text-sm touch-manipulation"
                >
                  Round Up
                </Button>
              </div>
            </div>

            {/* Actions (shared component for consistent validation/labels) */}
            <div className="pt-2">
              <PaymentActions
                paymentMethod={cashPaymentMethod}
                cashAmount={cashValue}
                total={total}
                onComplete={onComplete}
                onCancel={onCancel}
              />
            </div>
          </div>

          {/* Right: numeric field keypad (Clear and Backspace in grid) */}
          <div>
            <Label className="text-xs sm:text-sm text-slate-600">Keypad</Label>
            <NumericKeypad
              layout="numericField"
              includeClear
              includeBackspace
              onInput={handleKeypadInput}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
