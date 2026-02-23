import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
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
import { Input } from "@/components/ui/input";
import { useAuth } from "@/shared/hooks/use-auth";
import { PIN_LENGTH } from "./pin/constants";
import { sanitizePinValue } from "./pin/sanitize-pin";
import { usePinKeypadController } from "./pin/pin-keypad-controller";

const logger = getLogger("change-pin-dialog");

const changePinSchema = z
  .object({
    currentPin: z
      .string()
      .length(PIN_LENGTH, `PIN must be exactly ${PIN_LENGTH} digits`)
      .regex(/^\d+$/, "PIN must contain only numbers"),
    newPin: z
      .string()
      .length(PIN_LENGTH, `PIN must be exactly ${PIN_LENGTH} digits`)
      .regex(/^\d+$/, "PIN must contain only numbers"),
    confirmPin: z
      .string()
      .length(PIN_LENGTH, `PIN must be exactly ${PIN_LENGTH} digits`)
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
  const { sessionToken } = useAuth();

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

  const { activeValue, handleDigit, handleBackspace, handleClear } =
    usePinKeypadController<ActivePinField>({
      isLoading,
      activeField,
      setActiveField,
      getValue: (field) => {
        if (field === "currentPin") return currentPin;
        if (field === "newPin") return newPin;
        return confirmPin;
      },
      setValue: (field, value) => {
        form.setValue(field, value, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      },
      focusField: (field) => {
        if (field === "currentPin") {
          currentPinInputRef.current?.focus();
          return;
        }
        if (field === "newPin") {
          newPinInputRef.current?.focus();
          return;
        }
        confirmPinInputRef.current?.focus();
      },
      getNextField: (field) => {
        if (field === "currentPin") return "newPin";
        if (field === "newPin") return "confirmPin";
        return null;
      },
    });

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
        data.newPin,
      );

      if (result.success) {
        toast.success("PIN changed successfully");
        onOpenChange(false);
        form.reset();
      } else {
        toast.error(result.message || "Failed to change PIN");
        if (result.message?.toLowerCase().includes("current pin")) {
          form.setValue("currentPin", "");
          setActiveField("currentPin");
          currentPinInputRef.current?.focus();
        }
      }
    } catch (error) {
      logger.error("Change PIN error:", error);
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
                          onChange={(event) =>
                            field.onChange(sanitizePinValue(event.target.value))
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
                          onChange={(event) =>
                            field.onChange(sanitizePinValue(event.target.value))
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
                          onChange={(event) =>
                            field.onChange(sanitizePinValue(event.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        onClick={() => handleDigit(num.toString())}
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
                      onClick={handleClear}
                      disabled={isLoading || activeValue.length === 0}
                      className="h-11 text-sm font-semibold rounded-lg touch-manipulation"
                      aria-label="Clear"
                    >
                      Clear
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleDigit("0")}
                      disabled={isLoading || activeValue.length >= PIN_LENGTH}
                      className="h-11 text-lg font-semibold bg-gray-200 hover:bg-gray-300 active:bg-primary active:text-primary-foreground text-gray-900 border-0 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
                      aria-label="Digit 0"
                    >
                      0
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBackspace}
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
