import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
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
import { PIN_LENGTH } from "./pin/constants";
import { sanitizePinValue } from "./pin/sanitize-pin";
import { usePinKeypadController } from "./pin/pin-keypad-controller";

const logger = getLogger("force-pin-change-screen");

const forcePinChangeSchema = z
  .object({
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
  });

type ForcePinChangeValues = z.infer<typeof forcePinChangeSchema>;
type ActivePinField = "newPin" | "confirmPin";

interface ForcePinChangeScreenProps {
  onComplete: () => void;
}

export function ForcePinChangeScreen({ onComplete }: ForcePinChangeScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeField, setActiveField] = useState<ActivePinField>("newPin");
  const newPinInputRef = useRef<HTMLInputElement | null>(null);
  const confirmPinInputRef = useRef<HTMLInputElement | null>(null);
  const { completeForceChangePIN, logout } = useAuth();

  const form = useForm<ForcePinChangeValues>({
    resolver: zodResolver(forcePinChangeSchema),
    defaultValues: {
      newPin: "",
      confirmPin: "",
    },
  });

  const newPin = form.watch("newPin");
  const confirmPin = form.watch("confirmPin");

  const { activeValue, handleDigit, handleBackspace, handleClear } =
    usePinKeypadController<ActivePinField>({
      isLoading,
      activeField,
      setActiveField,
      getValue: (field) => (field === "newPin" ? newPin : confirmPin),
      setValue: (field, value) => {
        form.setValue(field, value, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      },
      focusField: (field) => {
        if (field === "newPin") {
          newPinInputRef.current?.focus();
          return;
        }
        confirmPinInputRef.current?.focus();
      },
      getNextField: (field) => (field === "newPin" ? "confirmPin" : null),
    });

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
      logger.error("Set PIN error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    void logout();
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
                        maxLength={PIN_LENGTH}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        placeholder="Enter new 4-digit PIN"
                        className="text-center text-lg tracking-widest"
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
                        className="text-center text-lg tracking-widest"
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

              <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <Button
                    key={num}
                    type="button"
                    onClick={() => handleDigit(num.toString())}
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
                  onClick={handleClear}
                  disabled={isLoading || activeValue.length === 0}
                  className="h-12 sm:h-14 lg:h-16 text-sm sm:text-base font-semibold rounded-lg touch-manipulation"
                  aria-label="Clear"
                >
                  Clear
                </Button>

                <Button
                  type="button"
                  onClick={() => handleDigit("0")}
                  disabled={isLoading || activeValue.length >= PIN_LENGTH}
                  className="h-12 sm:h-14 lg:h-16 text-lg sm:text-xl font-semibold bg-gray-200 hover:bg-gray-300 active:bg-primary active:text-primary-foreground text-gray-900 border-0 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
                  aria-label="Digit 0"
                >
                  0
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackspace}
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
