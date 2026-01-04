/**
 * Terminal Configuration Form Component
 * Allows users to manually configure or edit terminal settings
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TestTube, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import type {
  TerminalConfig,
  DiscoveredTerminal,
} from "../hooks/use-viva-wallet-settings";

const logger = getLogger("terminal-config-form");

// Validation schema
const terminalConfigSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  ipAddress: z
    .string()
    .min(1, "IP address is required")
    .regex(
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      "Invalid IP address format"
    ),
  port: z
    .number()
    .int("Port must be a whole number")
    .min(1, "Port must be at least 1")
    .max(65535, "Port must be at most 65535"),
  apiKey: z.string().min(1, "API key is required"),
  enabled: z.boolean(),
  autoConnect: z.boolean(),
  terminalType: z.enum(["dedicated", "device-based"]).optional(),
});

type TerminalConfigFormData = z.infer<typeof terminalConfigSchema>;

interface TerminalConfigFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TerminalConfigFormData) => void;
  terminal?: TerminalConfig | DiscoveredTerminal | null;
  onTestConnection?: (data: TerminalConfigFormData) => Promise<boolean>;
}

export function TerminalConfigForm({
  open,
  onClose,
  onSubmit,
  terminal,
  onTestConnection,
}: TerminalConfigFormProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [defaultTerminalName, setDefaultTerminalName] = useState("");
  const isEditing = !!terminal && "apiKey" in terminal;

  const form = useForm<TerminalConfigFormData>({
    resolver: zodResolver(terminalConfigSchema),
    defaultValues: {
      name: terminal?.name || "",
      ipAddress: terminal?.ipAddress || "",
      port: terminal?.port || 8080,
      apiKey: (terminal && "apiKey" in terminal ? terminal.apiKey : "") || "",
      enabled: terminal && "enabled" in terminal ? terminal.enabled : true,
      autoConnect:
        terminal && "autoConnect" in terminal ? terminal.autoConnect : false,
      terminalType: terminal?.terminalType,
    },
  });

  // Load terminal name from license activation on mount
  useEffect(() => {
    const loadLicenseTerminalName = async () => {
      if (!terminal) {
        try {
          const license = await window.licenseAPI.getLicense();
          if (license?.terminalName) {
            setDefaultTerminalName(license.terminalName);
          }
        } catch (error) {
          logger.error("Failed to load license terminal name:", error);
        }
      }
    };

    if (open) {
      loadLicenseTerminalName();
    }
  }, [open, terminal]);

  useEffect(() => {
    if (terminal) {
      form.reset({
        name: terminal.name || "",
        ipAddress: terminal.ipAddress || "",
        port: terminal.port || 8080,
        apiKey: (terminal && "apiKey" in terminal ? terminal.apiKey : "") || "",
        enabled: terminal && "enabled" in terminal ? terminal.enabled : true,
        autoConnect:
          terminal && "autoConnect" in terminal ? terminal.autoConnect : false,
        terminalType: terminal.terminalType,
      });
    } else {
      form.reset({
        name: defaultTerminalName || "",
        ipAddress: "",
        port: 8080,
        apiKey: "",
        enabled: true,
        autoConnect: false,
        terminalType: undefined,
      });
    }
  }, [terminal, form, open, defaultTerminalName]);

  const handleSubmit = (data: TerminalConfigFormData) => {
    onSubmit(data);
    form.reset();
    onClose();
  };

  const handleTestConnection = async () => {
    const data = form.getValues();
    const validationResult = terminalConfigSchema.safeParse(data);

    if (!validationResult.success) {
      form.handleSubmit(() => {})();
      toast.error("Please fix validation errors before testing");
      return;
    }

    if (!onTestConnection) {
      toast.info("Connection testing not available");
      return;
    }

    setIsTesting(true);
    try {
      const success = await onTestConnection(validationResult.data);
      if (success) {
        toast.success("Connection test successful!");
      }
    } catch (error) {
      logger.error("Connection test failed:", error);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Terminal" : "Add Terminal"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update terminal configuration"
              : "Configure a new Viva Wallet terminal manually"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terminal Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Counter 1 Terminal" {...field} />
                  </FormControl>
                  <FormDescription>
                    A friendly name to identify this terminal
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ipAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="192.168.1.100"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    The IP address of the terminal on your local network
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="8080"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10) || 8080)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    The port number the terminal is listening on (default: 8080)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter API key"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The API key for authenticating with the terminal
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terminalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terminal Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select terminal type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="dedicated">
                        Dedicated Terminal
                      </SelectItem>
                      <SelectItem value="device-based">
                        Device-Based (Smartphone/Tablet)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the type of terminal you're configuring
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Enabled</FormLabel>
                    <FormDescription>
                      Enable this terminal for payment processing
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="autoConnect"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Auto-Connect</FormLabel>
                    <FormDescription>
                      Automatically connect to this terminal on startup
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              {onTestConnection && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {isEditing ? "Update" : "Add"} Terminal
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
