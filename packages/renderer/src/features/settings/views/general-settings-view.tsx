import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import { useAuth } from "@/shared/hooks/use-auth";
import type { SalesUnitMode, SalesUnit } from "@/types/domain/sales-unit";
import {
  SALES_UNIT_OPTIONS,
  DEFAULT_SALES_UNIT_MODE,
  DEFAULT_FIXED_SALES_UNIT,
} from "@/types/domain/sales-unit";
import { invalidateSalesUnitSettingsCache } from "@/shared/hooks/use-sales-unit-settings";
import { BusinessForm } from "../components/business-form";
import { ReceiptEmailSettingsForm } from "../components/receipt-email-settings-form";

const logger = getLogger("general-settings-view");

interface GeneralSettingsFormData {
  salesUnitMode: SalesUnitMode;
  fixedSalesUnit: SalesUnit;
}

export default function GeneralSettingsView({
  onBack,
}: {
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<GeneralSettingsFormData>({
    defaultValues: {
      salesUnitMode: DEFAULT_SALES_UNIT_MODE,
      fixedSalesUnit: DEFAULT_FIXED_SALES_UNIT,
    },
  });

  const salesUnitMode = form.watch("salesUnitMode");

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.businessId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const response = await window.salesUnitSettingsAPI.get(user.businessId);

        if (response.success && response.settings) {
          form.reset({
            salesUnitMode:
              response.settings.salesUnitMode || DEFAULT_SALES_UNIT_MODE,
            fixedSalesUnit:
              response.settings.fixedSalesUnit || DEFAULT_FIXED_SALES_UNIT,
          });
        } else {
          // Use defaults if no settings found
          form.reset({
            salesUnitMode: DEFAULT_SALES_UNIT_MODE,
            fixedSalesUnit: DEFAULT_FIXED_SALES_UNIT,
          });
        }
      } catch (error) {
        logger.error("Error loading settings:", error);
        toast.error("Failed to load settings");
        form.reset({
          salesUnitMode: DEFAULT_SALES_UNIT_MODE,
          fixedSalesUnit: DEFAULT_FIXED_SALES_UNIT,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [form, user?.businessId]);

  const onSubmit = async (data: GeneralSettingsFormData) => {
    if (!user?.businessId) {
      toast.error("Business ID not found");
      return;
    }

    try {
      setIsSaving(true);

      const response = await window.salesUnitSettingsAPI.createOrUpdate(
        user.businessId,
        {
          salesUnitMode: data.salesUnitMode,
          fixedSalesUnit: data.fixedSalesUnit,
        }
      );

      if (!response.success) {
        throw new Error(response.message || "Failed to save settings");
      }

      // Invalidate cache to notify all components
      await invalidateSalesUnitSettingsCache(user.businessId);

      toast.success("Settings saved successfully");
    } catch (error) {
      logger.error("Error saving settings:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">General Settings</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">General Settings</h1>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Sales Unit Mode */}
            <FormField
              control={form.control}
              name="salesUnitMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sales Unit Mode</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSaving}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sales unit mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Fixed">Fixed</SelectItem>
                      <SelectItem value="Varying">Varying</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose whether to use a fixed sales unit for all products or
                    allow varying units per product.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fixed Sales Unit (only shown when mode is Fixed) */}
            {salesUnitMode === "Fixed" && (
              <FormField
                control={form.control}
                name="fixedSalesUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fixed Sales Unit</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSaving}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select fixed sales unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SALES_UNIT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      All products will use this unit for sales in the
                      transaction view.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Business Information Form */}
      <div className="bg-white rounded-lg border shadow-sm p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Business Information</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Update your business details and contact information.
        </p>
        <BusinessForm />
      </div>

      {/* Receipt Email (Gmail) */}
      <div className="bg-white rounded-lg border shadow-sm p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Receipt Email (Gmail)</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Configure the Gmail account used to send receipt emails to customers.
        </p>
        <ReceiptEmailSettingsForm />
      </div>
    </div>
  );
}
