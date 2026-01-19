
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const forcePinChangeSchema = z
  .object({
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
  });

type ForcePinChangeValues = z.infer<typeof forcePinChangeSchema>;

interface ForcePinChangeScreenProps {
  onComplete: () => void;
}

type ActivePinField = "newPin" | "confirmPin";

const PIN_LENGTH = 4;

function sanitizePinValue(value: string) {
  return value.replace(/\D/g, "").slice(0, PIN_LENGTH);
}

export function ForcePinChangeScreen({ onComplete }: ForcePinChangeScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeField, setActiveField] = useState<ActivePinField>("newPin");
  const newPinInputRef = useRef<HTMLInputElement | null>(null);
  const confirmPinInputRef = useRef<HTMLInputElement | null>(null);
  const { completeForceChangePIN, logout } = useAuth(); // Destructure completeForceChangePIN

  const form = useForm<ForcePinChangeValues>({
    resolver: zodResolver(forcePinChangeSchema),
    defaultValues: {
      newPin: "",
      confirmPin: "",
    },
  });

  const newPin = form.watch("newPin");
  const confirmPin = form.watch("confirmPin");
  const activeValue = activeField === "newPin" ? newPin : confirmPin;

  const setActiveValue = (nextValue: string) => {
    form.setValue(activeField, nextValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const focusActiveInput = () => {
    if (activeField === "newPin") {
      newPinInputRef.current?.focus();
      return;
    }
    confirmPinInputRef.current?.focus();
  };

  const handleKeypadDigit = (digit: string) => {
    if (isLoading) return;
    focusActiveInput();

    const next = sanitizePinValue(activeValue + digit);
    if (next === activeValue) return;

    setActiveValue(next);

    if (activeField === "newPin" && next.length === PIN_LENGTH) {
      setActiveField("confirmPin");
      queueMicrotask(() => confirmPinInputRef.current?.focus());
    }
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

  const onSubmit = async (data: ForcePinChangeValues) => {
    setIsLoading(true);
    try {
      const result = await completeForceChangePIN(data.newPin);

      if (result.success) {
        toast.success("PIN set successfully");
        onComplete();
      } else {
        toast.error(result.message || "Failed to set PIN");
      }
    } catch (error) {
      console.error("Set PIN error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    logout();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="space-y-1 items-center text-center">
      
          <CardTitle className="text-2xl">Update Your PIN</CardTitle>
          <CardDescription>
            For security, you must set a new PIN before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        maxLength={4}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        placeholder="Enter new 4-digit PIN"
                        className="text-center text-lg tracking-widest"
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
                        maxLength={4}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        placeholder="Re-enter new PIN"
                        className="text-center text-lg tracking-widest"
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

              {/* Responsive Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <Button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadDigit(num.toString())}
                    disabled={isLoading || activeValue.length >= PIN_LENGTH}
                    className="h-12 sm:h-14 lg:h-16 text-lg sm:text-xl font-semibold bg-gray-200 hover:bg-gray-300 active:bg-primary active:text-primary-foreground text-gray-900 border-0 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
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
                  className="h-12 sm:h-14 lg:h-16 text-sm sm:text-base font-semibold rounded-lg touch-manipulation"
                  aria-label="Clear"
                >
                  Clear
                </Button>

                <Button
                  type="button"
                  onClick={() => handleKeypadDigit("0")}
                  disabled={isLoading || activeValue.length >= PIN_LENGTH}
                  className="h-12 sm:h-14 lg:h-16 text-lg sm:text-xl font-semibold bg-gray-200 hover:bg-gray-300 active:bg-primary active:text-primary-foreground text-gray-900 border-0 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
                  aria-label="Digit 0"
                >
                  0
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleKeypadBackspace}
                  disabled={isLoading || activeValue.length === 0}
                  className="h-12 sm:h-14 lg:h-16 text-lg sm:text-xl font-semibold rounded-lg touch-manipulation"
                  aria-label="Backspace"
                >
                  {"<-"}
                </Button>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating PIN...
                  </>
                ) : (
                  "Set New PIN"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={isLoading}
          >
            Sign out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
