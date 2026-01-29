
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Assuming you have an Input component
// import { authAPI } from "@/shared/api/auth";
import { useAuth } from "@/shared/hooks/use-auth";

const changePinSchema = z
  .object({
    currentPin: z
      .string()
      .length(4, "PIN must be exactly 4 digits")
      .regex(/^\d+$/, "PIN must contain only numbers"),
    newPin: z
      .string()
      .length(4, "PIN must be exactly 4 digits")
      .regex(/^\d+$/, "PIN must contain only numbers"),
    confirmPin: z
      .string()
      .length(4, "PIN must be exactly 4 digits")
      .regex(/^\d+$/, "PIN must contain only numbers"),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  })
  .refine((data) => data.currentPin !== data.newPin, {
    message: "New PIN must be different from current PIN",
    path: ["newPin"],
  });

type ChangePinValues = z.infer<typeof changePinSchema>;

type ActivePinField = "currentPin" | "newPin" | "confirmPin";

const PIN_LENGTH = 4;

function sanitizePinValue(value: string) {
  return value.replace(/\D/g, "").slice(0, PIN_LENGTH);
}

interface ChangePinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

export function ChangePinDialog({
  open,
  onOpenChange,
  userId,
}: ChangePinDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeField, setActiveField] = useState<ActivePinField>("currentPin");
  const currentPinInputRef = useRef<HTMLInputElement | null>(null);
  const newPinInputRef = useRef<HTMLInputElement | null>(null);
  const confirmPinInputRef = useRef<HTMLInputElement | null>(null);
  const { sessionToken } = useAuth(); // Need to ensure useAuth exposes sessionToken or we verify user ID match

  const form = useForm<ChangePinValues>({
    resolver: zodResolver(changePinSchema),
    defaultValues: {
      currentPin: "",
      newPin: "",
      confirmPin: "",
    },
  });

  const currentPin = form.watch("currentPin");
  const newPin = form.watch("newPin");
  const confirmPin = form.watch("confirmPin");

  const activeValue =
    activeField === "currentPin"
      ? currentPin
      : activeField === "newPin"
        ? newPin
        : confirmPin;

  const setActiveValue = (nextValue: string) => {
    form.setValue(activeField, nextValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const focusActiveInput = () => {
    if (activeField === "currentPin") {
      currentPinInputRef.current?.focus();
      return;
    }
    if (activeField === "newPin") {
      newPinInputRef.current?.focus();
      return;
    }
    confirmPinInputRef.current?.focus();
  };

  const advanceFieldIfComplete = (nextLen: number) => {
    if (nextLen !== PIN_LENGTH) return;
    if (activeField === "currentPin") {
      setActiveField("newPin");
      queueMicrotask(() => newPinInputRef.current?.focus());
      return;
    }
    if (activeField === "newPin") {
      setActiveField("confirmPin");
      queueMicrotask(() => confirmPinInputRef.current?.focus());
    }
  };

  const handleKeypadDigit = (digit: string) => {
    if (isLoading) return;
    focusActiveInput();

    const next = sanitizePinValue(activeValue + digit);
    if (next === activeValue) return;

    setActiveValue(next);
    advanceFieldIfComplete(next.length);
  };

  const handleKeypadBackspace = () => {
    if (isLoading) return;
    focusActiveInput();
    if (!activeValue) return;
    setActiveValue(activeValue.slice(0, -1));
  };

  const handleKeypadClear = () => {
    if (isLoading) return;
    focusActiveInput();
    if (!activeValue) return;
    setActiveValue("");
  };

  const onSubmit = async (data: ChangePinValues) => {
    if (!userId || !sessionToken) {
        toast.error("Authentication error");
        return;
    }

    setIsLoading(true);
    try {
      const result = await window.authAPI.changePin(
        sessionToken,
        data.currentPin,
        data.newPin
      );

      if (result.success) {
        toast.success("PIN changed successfully");
        onOpenChange(false);
        form.reset();
      } else {
        toast.error(result.message || "Failed to change PIN");
        // If it was a wrong current PIN, maybe clear that field
        if (result.message?.toLowerCase().includes("current pin")) {
            form.setValue("currentPin", "");
        }
      }
    } catch (error) {
      console.error("Change PIN error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Change PIN</DialogTitle>
          <DialogDescription>
            Enter your current PIN and choose a new 4-digit PIN.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
              {/* Left: Fields */}
              <div className="flex-1 space-y-4">
                <FormField
                  control={form.control}
                  name="currentPin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current PIN</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          ref={(node) => {
                            field.ref(node);
                            currentPinInputRef.current = node;
                          }}
                          type="password"
                          maxLength={PIN_LENGTH}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          placeholder="Enter current PIN"
                          onFocus={() => setActiveField("currentPin")}
                          onChange={(e) =>
                            field.onChange(sanitizePinValue(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newPin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New PIN</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          ref={(node) => {
                            field.ref(node);
                            newPinInputRef.current = node;
                          }}
                          type="password"
                          maxLength={PIN_LENGTH}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          placeholder="Enter new 4-digit PIN"
                          onFocus={() => setActiveField("newPin")}
                          onChange={(e) =>
                            field.onChange(sanitizePinValue(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New PIN</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          ref={(node) => {
                            field.ref(node);
                            confirmPinInputRef.current = node;
                          }}
                          type="password"
                          maxLength={PIN_LENGTH}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          placeholder="Re-enter new PIN"
                          onFocus={() => setActiveField("confirmPin")}
                          onChange={(e) =>
                            field.onChange(sanitizePinValue(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right: Adaptive Keypad */}
              <div className="w-full lg:w-[280px]">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    Keypad 
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        onClick={() => handleKeypadDigit(num.toString())}
                        disabled={isLoading || activeValue.length >= PIN_LENGTH}
                        className="h-11 text-lg font-semibold bg-gray-200 hover:bg-gray-300 active:bg-primary active:text-primary-foreground text-gray-900 border-0 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
                        aria-label={`Digit ${num}`}
                      >
                        {num}
                      </Button>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleKeypadClear}
                      disabled={isLoading || activeValue.length === 0}
                      className="h-11 text-sm font-semibold rounded-lg touch-manipulation"
                      aria-label="Clear"
                    >
                      Clear
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleKeypadDigit("0")}
                      disabled={isLoading || activeValue.length >= PIN_LENGTH}
                      className="h-11 text-lg font-semibold bg-gray-200 hover:bg-gray-300 active:bg-primary active:text-primary-foreground text-gray-900 border-0 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
                      aria-label="Digit 0"
                    >
                      0
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleKeypadBackspace}
                      disabled={isLoading || activeValue.length === 0}
                      className="h-11 text-lg font-semibold rounded-lg touch-manipulation"
                      aria-label="Backspace"
                    >
                      {"<-"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  "Change PIN"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
