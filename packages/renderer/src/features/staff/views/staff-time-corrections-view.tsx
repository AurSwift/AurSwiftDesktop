import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/shared/hooks/use-auth";
import { getLogger } from "@/shared/utils/logger";
import {
  getUserFacingErrorMessage,
  sanitizeUserFacingMessage,
} from "@/shared/utils/user-facing-errors";

const logger = getLogger("StaffTimeCorrectionsView");

interface StaffTimeCorrectionsViewProps {
  onBack: () => void;
}

/**
 * Time Corrections / Overrides Queue
 *
 * Note: Full data wiring is implemented in subsequent steps (IPC + preload).
 */
export default function StaffTimeCorrectionsView({
  onBack,
}: StaffTimeCorrectionsViewProps) {
  const { user } = useAuth();

  const businessId = user?.businessId || "";
  const managerId = user?.id || "";

  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const [activeRow, setActiveRow] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject">(
    "approve"
  );
  const [pin, setPin] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aT = new Date(a.createdAt || 0).getTime();
      const bT = new Date(b.createdAt || 0).getTime();
      return bT - aT;
    });
  }, [rows]);

  const load = async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const resp = await window.timeTrackingAPI.getPendingTimeCorrections(
        businessId
      );
      if (resp.success) {
        setRows(resp.data || []);
      } else {
        toast.error("Failed to load time corrections", {
          description: sanitizeUserFacingMessage(resp.message, "Please try again"),
        });
      }
    } catch (error) {
      logger.error("Failed to load pending time corrections", error);
      toast.error("Failed to load time corrections", {
        description: getUserFacingErrorMessage(error, "Please try again"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const verifyOptionalPin = async (): Promise<boolean> => {
    const trimmed = pin.trim();
    if (!trimmed) return true;
    try {
      const resp = await window.authAPI.verifyPin(managerId, trimmed);
      if (resp?.success) return true;
      toast.error("PIN verification failed", {
        description: sanitizeUserFacingMessage(resp?.message, "Invalid PIN"),
      });
      return false;
    } catch (error) {
      logger.error("PIN verification failed", error);
      toast.error("PIN verification failed", {
        description: getUserFacingErrorMessage(error, "Invalid PIN"),
      });
      return false;
    }
  };

  const openConfirm = (row: any, action: "approve" | "reject") => {
    setActiveRow(row);
    setConfirmAction(action);
    setPin("");
    setConfirmOpen(true);
  };

  const process = async () => {
    if (!activeRow) return;
    const ok = await verifyOptionalPin();
    if (!ok) return;

    setIsProcessing(true);
    try {
      const resp = await window.timeTrackingAPI.processTimeCorrection({
        correctionId: activeRow.id,
        managerId,
        approved: confirmAction === "approve",
      });
      if (resp.success) {
        toast.success(
          confirmAction === "approve"
            ? "Correction approved"
            : "Correction rejected"
        );
        setConfirmOpen(false);
        setActiveRow(null);
        await load();
      } else {
        toast.error("Failed to process correction", {
          description: sanitizeUserFacingMessage(resp.message, "Please try again"),
        });
      }
    } catch (error) {
      logger.error("Failed to process time correction", error);
      toast.error("Failed to process correction", {
        description: getUserFacingErrorMessage(error, "Please try again"),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const fmt = (v: any) => {
    if (!v) return "—";
    const d = v instanceof Date ? v : typeof v === "number" ? new Date(v) : new Date(v);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  return (
    <div className="w-full min-h-screen p-2 sm:p-3 md:p-4 lg:p-6 pb-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6 lg:mb-8">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="p-1.5 sm:p-2 shrink-0"
            aria-label="Go back to previous page"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-slate-900 mb-0.5 sm:mb-1 lg:mb-2 break-word">
              Time Corrections
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 line-clamp-2">
              Review and audit manager overrides and time corrections.
            </p>
          </div>
        </div>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-sky-600" />
              Pending corrections
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading…
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No pending corrections.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Original</TableHead>
                    <TableHead>Corrected</TableHead>
                    <TableHead>Δ (sec)</TableHead>
                    <TableHead>Requested by</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium min-w-[180px]">
                        {r.user
                          ? `${r.user.firstName} ${r.user.lastName}`
                          : r.user_id}
                      </TableCell>
                      <TableCell>{r.correction_type}</TableCell>
                      <TableCell>{fmt(r.original_time)}</TableCell>
                      <TableCell>{fmt(r.corrected_time)}</TableCell>
                      <TableCell>{r.time_difference_seconds}</TableCell>
                      <TableCell className="min-w-[160px]">
                        {r.requestedBy
                          ? `${r.requestedBy.firstName} ${r.requestedBy.lastName}`
                          : r.requested_by}
                      </TableCell>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        {r.reason}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openConfirm(r, "reject")}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openConfirm(r, "approve")}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "approve" ? "Approve correction" : "Reject correction"}
            </DialogTitle>
            <DialogDescription>
              This action will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Manager PIN (optional)</Label>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                type="password"
                placeholder="Enter PIN to confirm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction === "approve" ? "default" : "destructive"}
              onClick={() => void process()}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Working…
                </>
              ) : confirmAction === "approve" ? (
                "Approve"
              ) : (
                "Reject"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

