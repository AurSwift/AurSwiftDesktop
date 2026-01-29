import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrinterConfig } from "@/types/features/printer";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("printer-setup-dialog");

type PrinterInterface = {
  type: "usb" | "bluetooth";
  name: string;
  address: string;
};

export interface PrinterSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Default paper width for thermal receipts (Metapace T-3 is typically 80mm).
   */
  defaultPaperWidthMm?: number;
  onConnected?: (config: PrinterConfig) => void;
}

export function PrinterSetupDialog({
  open,
  onOpenChange,
  defaultPaperWidthMm = 80,
  onConnected,
}: PrinterSetupDialogProps) {
  const [interfaces, setInterfaces] = useState<PrinterInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const selected = useMemo(
    () => interfaces.find((i) => i.address === selectedInterface) || null,
    [interfaces, selectedInterface],
  );

  const refreshInterfaces = useCallback(async () => {
    if (!window.printerAPI) {
      toast.error("Printer API not available");
      return;
    }
    setIsLoading(true);
    try {
      const list = await window.printerAPI.getAvailableInterfaces();
      setInterfaces(list);
      if (!selectedInterface && list.length > 0) {
        setSelectedInterface(list[0]!.address);
      }
      if (list.length === 0) {
        // Platform-specific help message
        const platform = navigator.platform.toLowerCase();
        if (platform.includes("mac")) {
          toast.warning(
            "No thermal printer found. Connect the Metapace T-3 via USB and check System Information > USB.",
          );
        } else if (platform.includes("win")) {
          toast.warning(
            "No printer ports found. Make sure the printer is connected and check Device Manager for a COM port.",
          );
        } else {
          toast.warning(
            "No printer ports found. Make sure the printer is connected via USB.",
          );
        }
      }
    } catch (error) {
      logger.error("Failed to load printer interfaces", error);
      toast.error("Failed to scan printer ports");
      setInterfaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedInterface]);

  useEffect(() => {
    if (open) {
      refreshInterfaces();
    }
  }, [open, refreshInterfaces]);

  const handleConnect = useCallback(async () => {
    if (!window.printerAPI) {
      toast.error("Printer API not available");
      return;
    }
    if (!selected) {
      toast.error("Please select a printer port");
      return;
    }

    const config: PrinterConfig = {
      type: "epson",
      interface: selected.address,
      width: defaultPaperWidthMm,
    };

    setIsConnecting(true);
    try {
      const result = await window.printerAPI.connect(config);
      if (!result?.success) {
        throw new Error(result?.error || "Connection failed");
      }

      localStorage.setItem("printer_config", JSON.stringify(config));
      toast.success("Printer connected");
      onConnected?.(config);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to connect printer: ${message}`);
    } finally {
      setIsConnecting(false);
    }
  }, [defaultPaperWidthMm, onConnected, onOpenChange, selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Receipt Printer</DialogTitle>
          <DialogDescription>
            Select the printer port for your Metapace T-3 thermal printer. On
            Windows, it typically appears as COM3/COM4. On macOS, look for a USB
            serial port. The selection will be saved for auto-connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <div className="text-sm font-medium">Printer Port</div>
            <Select
              value={selectedInterface}
              onValueChange={setSelectedInterface}
              disabled={isLoading || interfaces.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={isLoading ? "Scanning..." : "Select a port"}
                />
              </SelectTrigger>
              <SelectContent>
                {interfaces.map((i) => (
                  <SelectItem key={i.address} value={i.address}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Paper width: {defaultPaperWidthMm}mm
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={refreshInterfaces}
            disabled={isLoading || isConnecting}
          >
            Refresh
          </Button>
          <Button onClick={handleConnect} disabled={!selected || isConnecting}>
            {isConnecting ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
