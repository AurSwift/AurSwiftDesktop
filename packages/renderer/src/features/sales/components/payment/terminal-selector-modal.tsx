/**
 * Terminal Selector Modal
 * Allows users to select and connect to a Viva Wallet terminal
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  WifiOff,
  Smartphone,
  Radio,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useVivaWallet, type Terminal } from "../../hooks/use-viva-wallet";

interface TerminalSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (terminal: Terminal) => void;
}

/**
 * Terminal Status Badge Component
 */
function TerminalStatusBadge({
  status,
}: {
  status: "online" | "offline" | "busy";
}) {
  const variants = {
    online: {
      className: "bg-green-100 text-green-700 border-green-200",
      icon: <CheckCircle2 className="h-3 w-3" />,
      text: "Online",
    },
    offline: {
      className: "bg-gray-100 text-gray-700 border-gray-200",
      icon: <WifiOff className="h-3 w-3" />,
      text: "Offline",
    },
    busy: {
      className: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      text: "Busy",
    },
  };

  const variant = variants[status];

  return (
    <Badge
      variant="outline"
      className={`${variant.className} text-xs flex items-center gap-1`}
    >
      {variant.icon}
      {variant.text}
    </Badge>
  );
}

/**
 * Terminal Type Badge Component
 */
function TerminalTypeBadge({
  type,
}: {
  type: "dedicated" | "device-based";
}) {
  if (type === "device-based") {
    return (
      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1"
      >
        <Smartphone className="h-3 w-3" />
        Device
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="bg-purple-50 text-purple-700 border-purple-200 text-xs flex items-center gap-1"
    >
      <Radio className="h-3 w-3" />
      Dedicated
    </Badge>
  );
}

/**
 * Payment Capability Badges Component
 */
function PaymentCapabilityBadges({
  capabilities,
}: {
  capabilities: Terminal["paymentCapabilities"];
}) {
  const badges: React.ReactElement[] = [];

  if (capabilities.supportsTap || capabilities.supportsNFC) {
    badges.push(
      <Badge
        key="tap"
        variant="outline"
        className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs"
      >
        Tap
      </Badge>
    );
  }

  if (capabilities.supportsChip) {
    badges.push(
      <Badge
        key="chip"
        variant="outline"
        className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs"
      >
        Chip
      </Badge>
    );
  }

  if (capabilities.supportsSwipe) {
    badges.push(
      <Badge
        key="swipe"
        variant="outline"
        className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs"
      >
        Swipe
      </Badge>
    );
  }

  if (badges.length === 0) {
    return null;
  }

  return <div className="flex gap-1 flex-wrap">{badges}</div>;
}

/**
 * Terminal Card Component
 */
function TerminalCard({
  terminal,
  onSelect,
  isConnecting,
}: {
  terminal: Terminal;
  onSelect: (terminal: Terminal) => void;
  isConnecting: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(terminal)}
      disabled={terminal.status !== "online" || isConnecting}
      className={`w-full text-left p-4 rounded-lg border transition-all ${
        terminal.status === "online" && !isConnecting
          ? "border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
          : "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-5 w-5 text-slate-600 shrink-0" />
            <h3 className="font-semibold text-slate-900 truncate">
              {terminal.name}
            </h3>
          </div>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <TerminalStatusBadge status={terminal.status} />
            <TerminalTypeBadge type={terminal.terminalType} />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">
              {terminal.ipAddress}:{terminal.port}
            </p>
            <PaymentCapabilityBadges
              capabilities={terminal.paymentCapabilities}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

export function TerminalSelectorModal({
  open,
  onClose,
  onSelect,
}: TerminalSelectorModalProps) {
  const {
    terminals,
    isDiscovering,
    isConnecting,
    discoverTerminals,
    connectTerminal,
  } = useVivaWallet();

  const [connectingTerminalId, setConnectingTerminalId] = useState<
    string | null
  >(null);

  // Discover terminals when modal opens
  useEffect(() => {
    if (open && terminals.length === 0) {
      discoverTerminals();
    }
  }, [open, terminals.length, discoverTerminals]);

  const handleTerminalSelect = async (terminal: Terminal) => {
    if (terminal.status !== "online") {
      toast.error("Terminal is not available. Please select an online terminal.");
      return;
    }

    setConnectingTerminalId(terminal.id);
    const connected = await connectTerminal(terminal.id);
    setConnectingTerminalId(null);

    if (connected) {
      onSelect(terminal);
      onClose();
    }
  };

  const handleRefresh = async () => {
    await discoverTerminals();
  };

  const onlineTerminals = terminals.filter((t) => t.status === "online");
  const hasTerminals = terminals.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Select Payment Terminal
          </DialogTitle>
          <DialogDescription>
            Choose a Viva Wallet terminal to process card payments
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Discovery Controls */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isDiscovering}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isDiscovering ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            {isDiscovering && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Discovering terminals...</span>
              </div>
            )}
          </div>

          {/* Terminals List */}
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {isDiscovering && !hasTerminals ? (
              // Loading state
              <div className="space-y-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : !hasTerminals ? (
              // No terminals found
              <div className="text-center py-8 text-slate-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <p className="text-sm font-medium mb-1">No terminals found</p>
                <p className="text-xs">
                  Make sure terminals are powered on and on the same network
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : onlineTerminals.length === 0 ? (
              // All terminals offline
              <div className="text-center py-8 text-slate-500">
                <WifiOff className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <p className="text-sm font-medium mb-1">
                  No online terminals available
                </p>
                <p className="text-xs">
                  All discovered terminals are currently offline
                </p>
              </div>
            ) : (
              // Terminals list
              terminals.map((terminal) => (
                <TerminalCard
                  key={terminal.id}
                  terminal={terminal}
                  onSelect={handleTerminalSelect}
                  isConnecting={
                    isConnecting && connectingTerminalId === terminal.id
                  }
                />
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

