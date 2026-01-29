import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/types/domain";

/**
 * Age verification data returned when verification is successful
 * Used to create audit records in the age_verification_records table
 */
export interface AgeVerificationData {
  verified: boolean;
  verificationMethod: "manual" | "scan" | "override";
  customerBirthdate?: string;
  calculatedAge?: number;
  overrideReason?: string;
  managerId?: string;
}

interface AgeVerificationModalProps {
  isOpen: boolean;
  product: Product;
  onVerify: (data: AgeVerificationData) => void;
  onCancel: () => void;
  currentUser: { id: string; role: string } | null;
}

export const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({
  isOpen,
  product,
  onVerify,
  onCancel,
  currentUser,
}) => {
  const [verificationMethod, setVerificationMethod] = useState<
    "manual" | "scan" | "override"
  >("manual");
  const [birthdate, setBirthdate] = useState("");
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // Get minimum age from restriction level
  const getMinimumAge = (level: string): number => {
    switch (level) {
      case "AGE_16":
        return 16;
      case "AGE_18":
        return 18;
      case "AGE_21":
        return 21;
      default:
        return 0;
    }
  };

  const requiredAge = getMinimumAge(product.ageRestrictionLevel || "NONE");

  const calculateAge = (dateString: string): number | null => {
    if (!dateString) return null;

    const birth = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  };

  const handleDateChange = (date: string) => {
    setBirthdate(date);
    const age = calculateAge(date);
    setCalculatedAge(age);
  };

  const handleVerify = () => {
    if (verificationMethod === "manual") {
      if (!birthdate || !calculatedAge) {
        toast.error("Please enter customer date of birth");
        return;
      }

      if (calculatedAge < requiredAge) {
        toast.error(
          `Customer is ${calculatedAge} years old. Minimum age required: ${requiredAge}`
        );
        return;
      }

      onVerify({
        verified: true,
        verificationMethod: "manual",
        customerBirthdate: birthdate,
        calculatedAge: calculatedAge,
      });
    } else if (verificationMethod === "scan") {
      // TODO: Implement ID scanner integration
      // Tracking: docs/TODO_TRACKING.md#4
      toast.info("ID scanner integration coming soon");
      // For now, allow manual entry
      if (!birthdate || !calculatedAge) {
        toast.error("Please enter customer date of birth");
        return;
      }
      onVerify({
        verified: true,
        verificationMethod: "scan",
        customerBirthdate: birthdate,
        calculatedAge: calculatedAge,
      });
    } else if (verificationMethod === "override") {
      if (!overrideReason.trim()) {
        toast.error("Please provide a reason for override");
        return;
      }

      if (currentUser?.role !== "manager" && currentUser?.role !== "admin") {
        toast.error("Only managers can override age verification");
        return;
      }

      onVerify({
        verified: true,
        verificationMethod: "override",
        overrideReason: overrideReason.trim(),
        managerId: currentUser?.id,
      });
    }
  };

  const isEligible = calculatedAge !== null && calculatedAge >= requiredAge;

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-[calc(100vw-2rem)] mx-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 shrink-0" />
            Age Verification Required
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            This product requires age verification ({requiredAge}+)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-4">
          {/* Product Info */}
          <div className="bg-slate-50 p-2 sm:p-3 rounded-lg">
            <p className="font-semibold text-slate-900 text-sm sm:text-base line-clamp-2">
              {product.name}
            </p>
            <Badge
              variant="outline"
              className="mt-1 text-caption bg-orange-50 text-orange-700 border-orange-200"
            >
              {product.ageRestrictionLevel}
            </Badge>
            {product.restrictionReason && (
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                {product.restrictionReason}
              </p>
            )}
          </div>

          {/* Verification Method Selection */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm">Verification Method</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={
                  verificationMethod === "manual" ? "default" : "outline"
                }
                size="sm"
                onClick={() => setVerificationMethod("manual")}
                className="h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
              >
                Manual
              </Button>
              <Button
                variant={verificationMethod === "scan" ? "default" : "outline"}
                size="sm"
                onClick={() => setVerificationMethod("scan")}
                disabled={true} // TODO: Enable when ID scanner is integrated
                // Tracking: docs/TODO_TRACKING.md#4
                className="h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
              >
                ID Scan
              </Button>
              <Button
                variant={
                  verificationMethod === "override" ? "default" : "outline"
                }
                size="sm"
                onClick={() => setVerificationMethod("override")}
                disabled={
                  currentUser?.role !== "manager" &&
                  currentUser?.role !== "admin"
                }
                className="h-9 sm:h-10 text-xs sm:text-sm touch-manipulation"
              >
                Override
              </Button>
            </div>
          </div>

          {/* Manual Entry */}
          {verificationMethod === "manual" && (
            <div className="space-y-2">
              <Label htmlFor="birthdate" className="text-xs sm:text-sm">
                Customer Date of Birth
              </Label>
              <Input
                id="birthdate"
                type="date"
                value={birthdate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full h-10 sm:h-11 text-sm sm:text-base"
              />

              {calculatedAge !== null && (
                <div
                  className={`p-2 sm:p-3 rounded-lg ${
                    isEligible
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-2">
                      {isEligible ? (
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 shrink-0" />
                      )}
                      <span className="font-semibold text-xs sm:text-sm">
                        Age: {calculatedAge} years
                      </span>
                    </div>
                    <Badge
                      variant={isEligible ? "default" : "destructive"}
                      className={`text-caption ${
                        isEligible ? "bg-green-600" : "bg-red-600"
                      }`}
                    >
                      {isEligible
                        ? "Eligible to purchase"
                        : "Below required age"}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ID Scan */}
          {verificationMethod === "scan" && (
            <div className="p-3 sm:p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-xs sm:text-sm text-slate-600">
                ID Scanner integration coming soon. Please use manual entry for
                now.
              </p>
              <div className="mt-3 space-y-2">
                <Label htmlFor="scan-birthdate" className="text-xs sm:text-sm">
                  Customer Date of Birth
                </Label>
                <Input
                  id="scan-birthdate"
                  type="date"
                  value={birthdate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full h-10 sm:h-11 text-sm sm:text-base"
                />
                {calculatedAge !== null && (
                  <p className="text-xs sm:text-sm font-semibold">
                    Age: {calculatedAge} years
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Manager Override */}
          {verificationMethod === "override" && (
            <div className="space-y-2">
              <Label htmlFor="override-reason" className="text-xs sm:text-sm">
                Override Reason
              </Label>
              <Input
                id="override-reason"
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g., Parent present, Valid ID shown, etc."
                className="w-full h-10 sm:h-11 text-sm sm:text-base"
              />
              <p className="text-caption text-slate-500">
                Manager override will be logged for audit purposes.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto min-h-[44px] h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={verificationMethod === "manual" && !isEligible}
            className={`w-full sm:w-auto min-h-[44px] h-10 sm:h-11 text-sm sm:text-base touch-manipulation ${
              verificationMethod === "override"
                ? "bg-orange-600 hover:bg-orange-700"
                : ""
            }`}
          >
            <span className="truncate">
              {verificationMethod === "override"
                ? "Override & Continue"
                : "Verify & Continue"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
