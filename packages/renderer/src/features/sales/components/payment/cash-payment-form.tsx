/**
 * Cash payment form component
 * 
 * Uses React Hook Form for validation and state management.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCashPaymentForm } from "@/features/sales/hooks/use-cash-payment-form";

interface CashPaymentFormProps {
  total: number;
  cashAmount: number;
  onCashAmountChange: (amount: number) => void;
  onSubmit?: (data: { cashAmount: number; total: number }) => Promise<void>;
}

export function CashPaymentForm({
  total,
  cashAmount,
  onCashAmountChange,
  onSubmit,
}: CashPaymentFormProps) {
  const { form, change, shortfall } = useCashPaymentForm({
    total,
    onSubmit: onSubmit || (async () => {}),
  });

  // Sync external cashAmount with form
  React.useEffect(() => {
    if (form.getValues("cashAmount") !== cashAmount) {
      form.setValue("cashAmount", cashAmount);
    }
  }, [cashAmount, form]);

  // Update external handler when form value changes
  const handleAmountChange = (value: number) => {
    form.setValue("cashAmount", value);
    onCashAmountChange(value);
  };

  return (
    <Form {...form}>
      <div className="space-y-3 sm:space-y-4">
        <div className="flex justify-between text-slate-700 text-sm sm:text-base">
          <span>Amount Due:</span>
          <span className="font-semibold">£{total.toFixed(2)}</span>
        </div>

        <FormField
          control={form.control}
          name="cashAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs sm:text-sm text-slate-600">
                Cash Received:
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="0.01"
                  placeholder="Enter cash amount"
                  value={field.value ? field.value.toFixed(2) : ""}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    field.onChange(value);
                    handleAmountChange(value);
                  }}
                  className={`mt-1 h-10 sm:h-11 text-sm sm:text-base ${
                    field.value > 0 && field.value < total
                      ? "border-red-300 bg-red-50"
                      : "bg-white border-slate-300"
                  }`}
                />
              </FormControl>
              {shortfall > 0 && (
                <p className="text-red-600 text-xs sm:text-sm mt-1">
                  Insufficient funds. Need £{shortfall.toFixed(2)} more.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div
          className={`flex justify-between font-bold text-base sm:text-lg pt-2 border-t border-slate-200 ${
            form.watch("cashAmount") >= total
              ? "text-sky-700"
              : form.watch("cashAmount") > 0
              ? "text-red-600"
              : "text-slate-600"
          }`}
        >
          <span>Change:</span>
          <span>
            {form.watch("cashAmount") >= total
              ? `£${change.toFixed(2)}`
              : form.watch("cashAmount") > 0
              ? `-£${shortfall.toFixed(2)}`
              : "£0.00"}
          </span>
        </div>

        {/* Quick cash amount buttons */}
        <div className="grid grid-cols-4 gap-2">
          {[5, 10, 20, 50].map((amount) => (
            <Button
              key={amount}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAmountChange(amount)}
              className="text-caption min-h-[44px] h-9 sm:h-10 touch-manipulation"
            >
              £{amount}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAmountChange(total)}
            className="flex-1 text-caption min-h-[44px] h-9 sm:h-10 touch-manipulation"
          >
            Exact Amount
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAmountChange(Math.ceil(total))}
            className="flex-1 text-caption min-h-[44px] h-9 sm:h-10 touch-manipulation"
          >
            Round Up
          </Button>
        </div>
      </div>
    </Form>
  );
}
