/**
 * Break Policy Settings View
 *
 * Admin dashboard view for managing break types and policies.
 * Allows shop owners to configure break rules for their staff.
 */

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AdaptiveFormField } from "@/features/adaptive-keyboard/adaptive-form-field";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";
import { useForm } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import { AddBreakTypeDrawer } from "../components/dialogs/add-break-type-drawer";
import { AddPolicyRuleDrawer } from "../components/dialogs/add-policy-rule-drawer";
import type {
  BreakTypeFormData,
  BreakTypeUpdateData,
} from "../schemas/break-type-schema";
import type {
  PolicyRuleFormData,
  PolicyRuleUpdateData,
} from "../schemas/policy-rule-schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Coffee,
  UtensilsCrossed,
  Pause,
  Clock,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import { getLogger } from "@/shared/utils/logger";
import type {
  BreakTypeDefinition,
  BreakPolicy,
  BreakPolicyRule,
  BreakPolicyWithRules,
} from "@/shared/types/api/break-policy";

const logger = getLogger("break-policy-settings-view");

// Icon mapping for break types
const BREAK_TYPE_ICONS: Record<string, React.ElementType> = {
  coffee: Coffee,
  utensils: UtensilsCrossed,
  pause: Pause,
  clock: Clock,
};

const DEFAULT_BREAK_TYPE: BreakTypeFormData = {
  name: "",
  code: "",
  description: "",
  default_duration_minutes: 15,
  min_duration_minutes: 5,
  max_duration_minutes: 30,
  is_paid: false,
  is_required: false,
  counts_as_worked_time: false,
  allowed_window_start: "",
  allowed_window_end: "",
  icon: "coffee",
  color: "#6B7280",
  business_id: "",
};


export default function BreakPolicySettingsView({
  onBack,
}: {
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSetup, setHasSetup] = useState(false);

  // Settings form for keyboard integration
  const settingsForm = useForm<{
    max_consecutive_hours: string;
    warn_before_required_minutes: string;
  }>({
    defaultValues: {
      max_consecutive_hours: "",
      warn_before_required_minutes: "",
    },
  });

  // Keyboard integration for settings tab
  const settingsKeyboard = useKeyboardWithRHF({
    setValue: settingsForm.setValue,
    watch: settingsForm.watch,
    fieldConfigs: {
      max_consecutive_hours: { keyboardMode: "numeric" },
      warn_before_required_minutes: { keyboardMode: "numeric" },
    },
  });

  // Data state
  const [breakTypes, setBreakTypes] = useState<BreakTypeDefinition[]>([]);
  const [activePolicy, setActivePolicy] = useState<BreakPolicyWithRules | null>(
    null
  );

  // Dialog state
  const [showBreakTypeDialog, setShowBreakTypeDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingBreakType, setEditingBreakType] =
    useState<BreakTypeDefinition | null>(null);
  const [editingRule, setEditingRule] = useState<BreakPolicyRule | null>(null);
  const [activeTab, setActiveTab] = useState("types");

  // Form state (kept for backward compatibility, but not used in drawer mode)
  const [_breakTypeForm, setBreakTypeForm] =
    useState<BreakTypeFormData>(DEFAULT_BREAK_TYPE);

  // Load data
  const loadData = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      setIsLoading(true);

      // Check if setup exists
      const setupRes = await window.breakPolicyAPI.hasSetup(user.businessId);
      setHasSetup(setupRes.data || false);

      // Load break types
      const typesRes = await window.breakPolicyAPI.getBreakTypes(
        user.businessId
      );
      if (typesRes.success && typesRes.data) {
        setBreakTypes(typesRes.data);
      }

      // Load policies
      const policiesRes = await window.breakPolicyAPI.getPolicies(
        user.businessId
      );
      if (policiesRes.success && policiesRes.data) {
        // Load active policy with rules
        const activePolicyRes = await window.breakPolicyAPI.getActivePolicy(
          user.businessId
        );
        if (activePolicyRes.success && activePolicyRes.data) {
          const policyWithRulesRes =
            await window.breakPolicyAPI.getPolicyWithRules(
              activePolicyRes.data.id
            );
          if (policyWithRulesRes.success && policyWithRulesRes.data) {
            setActivePolicy(policyWithRulesRes.data);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to load break policy data:", error);
      toast.error("Failed to load break policy settings");
    } finally {
      setIsLoading(false);
    }
  }, [user?.businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Seed defaults
  const handleSeedDefaults = async () => {
    if (!user?.businessId) return;

    try {
      setIsSaving(true);
      const res = await window.breakPolicyAPI.seedDefaults(user.businessId);

      if (res.success) {
        toast.success("Default break policies created successfully!");
        await loadData();
      } else {
        toast.error(res.message || "Failed to create defaults");
      }
    } catch (error) {
      logger.error("Failed to seed defaults:", error);
      toast.error("Failed to create default policies");
    } finally {
      setIsSaving(false);
    }
  };

  // Break Type CRUD
  const handleSaveBreakType = async (
    data: BreakTypeFormData | BreakTypeUpdateData
  ) => {
    if (!user?.businessId) return;

    try {
      setIsSaving(true);

      if (editingBreakType && "id" in data) {
        // Update existing
        const res = await window.breakPolicyAPI.updateBreakType(
          editingBreakType.id,
          {
            name: data.name,
            code: data.code,
            description: data.description,
            default_duration_minutes: data.default_duration_minutes,
            min_duration_minutes: data.min_duration_minutes,
            max_duration_minutes: data.max_duration_minutes,
            is_paid: data.is_paid,
            is_required: data.is_required,
            counts_as_worked_time: data.counts_as_worked_time,
            allowed_window_start: data.allowed_window_start || undefined,
            allowed_window_end: data.allowed_window_end || undefined,
            icon: data.icon,
            color: data.color,
          }
        );
        if (res.success) {
          toast.success("Break type updated");
        } else {
          throw new Error(res.message);
        }
      } else {
        // Create new
        const res = await window.breakPolicyAPI.createBreakType({
          name: data.name,
          code: data.code,
          description: data.description,
          default_duration_minutes: data.default_duration_minutes,
          min_duration_minutes: data.min_duration_minutes,
          max_duration_minutes: data.max_duration_minutes,
          is_paid: data.is_paid,
          is_required: data.is_required,
          counts_as_worked_time: data.counts_as_worked_time,
          allowed_window_start: data.allowed_window_start || undefined,
          allowed_window_end: data.allowed_window_end || undefined,
          icon: data.icon,
          color: data.color,
          business_id: user.businessId,
        });
        if (res.success) {
          toast.success("Break type created");
        } else {
          throw new Error(res.message);
        }
      }

      setShowBreakTypeDialog(false);
      setEditingBreakType(null);
      setBreakTypeForm(DEFAULT_BREAK_TYPE);
      await loadData();
    } catch (error) {
      logger.error("Failed to save break type:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save break type"
      );
      throw error; // Re-throw so form can handle it
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBreakType = async (id: number) => {
    try {
      const res = await window.breakPolicyAPI.deleteBreakType(id);
      if (res.success) {
        toast.success("Break type deleted");
        await loadData();
      } else {
        toast.error(res.message || "Failed to delete");
      }
    } catch (error) {
      logger.error("Failed to delete break type:", error);
      toast.error("Failed to delete break type");
    }
  };

  // Policy Rule CRUD
  const handleSaveRule = async (
    data: PolicyRuleFormData | PolicyRuleUpdateData
  ) => {
    if (!activePolicy) return;

    try {
      setIsSaving(true);

      if (editingRule && "id" in data) {
        // Update existing
        const res = await window.breakPolicyAPI.updatePolicyRule(
          editingRule.id,
          {
            break_type_id: data.break_type_id,
            min_shift_hours: data.min_shift_hours,
            max_shift_hours: data.max_shift_hours ?? undefined,
            allowed_count: data.allowed_count,
            is_mandatory: data.is_mandatory,
            earliest_after_hours: data.earliest_after_hours ?? undefined,
            latest_before_end_hours: data.latest_before_end_hours ?? undefined,
          }
        );
        if (res.success) {
          toast.success("Rule updated");
        } else {
          throw new Error(res.message);
        }
      } else {
        // Create new
        const res = await window.breakPolicyAPI.createPolicyRule({
          break_type_id: data.break_type_id,
          min_shift_hours: data.min_shift_hours,
          max_shift_hours: data.max_shift_hours ?? undefined,
          allowed_count: data.allowed_count,
          is_mandatory: data.is_mandatory,
          earliest_after_hours: data.earliest_after_hours ?? undefined,
          latest_before_end_hours: data.latest_before_end_hours ?? undefined,
          policy_id: activePolicy.id,
        });
        if (res.success) {
          toast.success("Rule created");
        } else {
          throw new Error(res.message);
        }
      }

      setShowRuleDialog(false);
      setEditingRule(null);
      await loadData();
    } catch (error) {
      logger.error("Failed to save rule:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save rule"
      );
      throw error; // Re-throw so form can handle it
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      const res = await window.breakPolicyAPI.deletePolicyRule(id);
      if (res.success) {
        toast.success("Rule deleted");
        await loadData();
      } else {
        toast.error(res.message || "Failed to delete");
      }
    } catch (error) {
      logger.error("Failed to delete rule:", error);
      toast.error("Failed to delete rule");
    }
  };

  // Update policy settings
  const handleUpdatePolicy = async (updates: Partial<BreakPolicy>) => {
    if (!activePolicy) return;

    try {
      const updatesForApi: Record<string, unknown> = { ...updates };
      if (
        "description" in updatesForApi &&
        updatesForApi.description === null
      ) {
        delete (updatesForApi as { description?: unknown }).description;
      }

      const res = await window.breakPolicyAPI.updatePolicy(
        activePolicy.id,
        updatesForApi as any
      );
      if (res.success) {
        toast.success("Policy updated");
        await loadData();
      } else {
        toast.error(res.message || "Failed to update policy");
      }
    } catch (error) {
      logger.error("Failed to update policy:", error);
      toast.error("Failed to update policy");
    }
  };

  // Sync settings form with active policy
  useEffect(() => {
    if (activePolicy) {
      settingsForm.reset({
        max_consecutive_hours: activePolicy.max_consecutive_hours?.toString() || "",
        warn_before_required_minutes: activePolicy.warn_before_required_minutes?.toString() || "",
      });
    }
  }, [activePolicy, settingsForm]);

  // Open edit dialogs
  const openEditBreakType = (type: BreakTypeDefinition) => {
    setEditingBreakType(type);
    setShowBreakTypeDialog(true);
  };

  const openEditRule = (rule: BreakPolicyRule) => {
    setEditingRule(rule);
    setShowRuleDialog(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Break Policies</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // No setup - show setup wizard
  if (!hasSetup) {
    return (
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Break Policies</h1>
        </div>

        <Card className="border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Coffee className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Set Up Break Policies</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Configure break rules for your staff. We'll create sensible
              defaults for a small grocery shop, compliant with xWorking Time
              Directive.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-left">
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <Coffee className="w-5 h-5 text-purple-600" />
                  <span className="font-medium">Tea Break</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  15 min paid break
                </p>
              </div>
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <UtensilsCrossed className="w-5 h-5 text-amber-600" />
                  <span className="font-medium">Lunch Break</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  30 min unpaid (required after 6h)
                </p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <Pause className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium">Rest Break</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  10 min paid short break
                </p>
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleSeedDefaults}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Create Default Policies
            </Button>

            <p className="text-xs text-muted-foreground mt-4">
              You can customize these settings after setup
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Break Policies</h1>
          <p className="text-sm text-muted-foreground">
            Configure break types and rules for your staff
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        // Close keyboard when switching tabs
        if (value !== "settings") {
          settingsKeyboard.handleCloseKeyboard();
        }
      }} className="space-y-6">
        <TabsList>
          <TabsTrigger value="types">Break Types</TabsTrigger>
          <TabsTrigger value="rules">Policy Rules</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Break Types Tab */}
        <TabsContent value="types" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Break Types</h2>
              <p className="text-sm text-muted-foreground">
                Define the types of breaks available to staff
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingBreakType(null);
                setShowBreakTypeDialog(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Break Type
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {breakTypes.map((type) => {
              const IconComponent =
                BREAK_TYPE_ICONS[type.icon || "coffee"] || Coffee;
              return (
                <Card key={type.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${type.color}20` }}
                        >
                          <IconComponent
                            className="w-5 h-5"
                            style={{ color: type.color || undefined }}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold">{type.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {type.description || `${type.code} break`}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">
                              {type.default_duration_minutes} min
                            </Badge>
                            <Badge
                              variant={type.is_paid ? "default" : "secondary"}
                            >
                              {type.is_paid ? "Paid" : "Unpaid"}
                            </Badge>
                            {type.is_required && (
                              <Badge variant="destructive">Required</Badge>
                            )}
                            {type.allowed_window_start && (
                              <Badge variant="outline">
                                {type.allowed_window_start} -{" "}
                                {type.allowed_window_end}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditBreakType(type)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBreakType(type.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Policy Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Policy Rules</h2>
              <p className="text-sm text-muted-foreground">
                Define break entitlements based on shift length
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingRule(null);
                setShowRuleDialog(true);
              }}
              className="gap-2"
              disabled={breakTypes.length === 0}
            >
              <Plus className="w-4 h-4" />
              Add Rule
            </Button>
          </div>

          {activePolicy && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  {activePolicy.name}
                </CardTitle>
                <CardDescription>{activePolicy.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Break Type</TableHead>
                      <TableHead>Shift Length</TableHead>
                      <TableHead>Allowed</TableHead>
                      <TableHead>Mandatory</TableHead>
                      <TableHead>Timing</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePolicy.rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const IconComponent =
                                BREAK_TYPE_ICONS[
                                  rule.breakType.icon || "coffee"
                                ] || Coffee;
                              return (
                                <IconComponent
                                  className="w-4 h-4"
                                  style={{
                                    color: rule.breakType.color || undefined,
                                  }}
                                />
                              );
                            })()}
                            <span>{rule.breakType.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rule.min_shift_hours}h
                          {rule.max_shift_hours
                            ? ` - ${rule.max_shift_hours}h`
                            : "+"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.allowed_count}x</Badge>
                        </TableCell>
                        <TableCell>
                          {rule.is_mandatory ? (
                            <Badge variant="destructive">Yes</Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {rule.earliest_after_hours &&
                            `After ${rule.earliest_after_hours}h`}
                          {rule.earliest_after_hours &&
                            rule.latest_before_end_hours &&
                            " • "}
                          {rule.latest_before_end_hours &&
                            `Before last ${rule.latest_before_end_hours}h`}
                          {!rule.earliest_after_hours &&
                            !rule.latest_before_end_hours &&
                            "Any time"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditRule(rule)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {activePolicy.rules.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No rules defined. Add rules to specify break
                          entitlements.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4 relative">
          {activePolicy && (
            <Card>
              <CardHeader>
                <CardTitle>Policy Settings</CardTitle>
                <CardDescription>
                  Configure enforcement and compliance settings
                </CardDescription>
              </CardHeader>
              <CardContent className={cn(
                "space-y-6",
                settingsKeyboard.showKeyboard && "pb-[340px]"
              )}>
                <Form {...settingsForm}>
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={settingsForm.control}
                      name="max_consecutive_hours"
                      render={() => (
                        <FormItem>
                          <FormLabel>
                            Max Consecutive Hours (before required break)
                          </FormLabel>
                          <FormControl>
                            <AdaptiveFormField
                              {...settingsForm.register("max_consecutive_hours")}
                              label=""
                              value={settingsKeyboard.formValues.max_consecutive_hours || ""}
                              placeholder="6.0"
                              readOnly
                              onClick={() =>
                                settingsKeyboard.handleFieldFocus("max_consecutive_hours")
                              }
                              onFocus={() =>
                                settingsKeyboard.handleFieldFocus("max_consecutive_hours")
                              }
                              className={cn(
                                "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                                settingsKeyboard.activeField === "max_consecutive_hours" &&
                                  "ring-2 ring-primary border-primary"
                              )}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Working Time Directive requires a break after 6 hours
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const value = parseFloat(
                                settingsKeyboard.formValues.max_consecutive_hours || "0"
                              );
                              if (!isNaN(value) && activePolicy) {
                                handleUpdatePolicy({
                                  max_consecutive_hours: value,
                                });
                                settingsKeyboard.handleCloseKeyboard();
                              }
                            }}
                            className="text-xs h-7 px-2"
                          >
                            Save
                          </Button>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="warn_before_required_minutes"
                      render={() => (
                        <FormItem>
                          <FormLabel>
                            Warning Before Required Break (minutes)
                          </FormLabel>
                          <FormControl>
                            <AdaptiveFormField
                              {...settingsForm.register("warn_before_required_minutes")}
                              label=""
                              value={settingsKeyboard.formValues.warn_before_required_minutes || ""}
                              placeholder="15"
                              readOnly
                              onClick={() =>
                                settingsKeyboard.handleFieldFocus("warn_before_required_minutes")
                              }
                              onFocus={() =>
                                settingsKeyboard.handleFieldFocus("warn_before_required_minutes")
                              }
                              className={cn(
                                "text-xs sm:text-sm md:text-base lg:text-base h-8 sm:h-9 md:h-10",
                                settingsKeyboard.activeField === "warn_before_required_minutes" &&
                                  "ring-2 ring-primary border-primary"
                              )}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Show warning this many minutes before break is required
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const value = parseInt(
                                settingsKeyboard.formValues.warn_before_required_minutes || "0"
                              );
                              if (!isNaN(value) && activePolicy) {
                                handleUpdatePolicy({
                                  warn_before_required_minutes: value,
                                });
                                settingsKeyboard.handleCloseKeyboard();
                              }
                            }}
                            className="text-xs h-7 px-2"
                          >
                            Save
                          </Button>
                        </FormItem>
                      )}
                    />
                  </div>
                </Form>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-enforce Breaks</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically prompt staff to take required breaks
                      </p>
                    </div>
                    <Switch
                      checked={activePolicy.auto_enforce_breaks}
                      onCheckedChange={(checked) =>
                        handleUpdatePolicy({ auto_enforce_breaks: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Skip Break</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow employees to skip entitled breaks
                      </p>
                    </div>
                    <Switch
                      checked={activePolicy.allow_skip_break}
                      onCheckedChange={(checked) =>
                        handleUpdatePolicy({ allow_skip_break: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Manager Override</Label>
                      <p className="text-sm text-muted-foreground">
                        Require manager approval to skip breaks
                      </p>
                    </div>
                    <Switch
                      checked={activePolicy.require_manager_override}
                      onCheckedChange={(checked) =>
                        handleUpdatePolicy({
                          require_manager_override: checked,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Working Time Directive
                    </p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Workers are entitled to a 20-minute rest break if they
                      work more than 6 hours. This break can be unpaid unless
                      the employment contract states otherwise.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Adaptive Keyboard for Settings Tab - Full width, bottommost */}
          {activeTab === "settings" && settingsKeyboard.showKeyboard && (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg w-full">
              <div className="w-full max-w-full overflow-hidden">
                <AdaptiveKeyboard
                  onInput={settingsKeyboard.handleInput}
                  onBackspace={settingsKeyboard.handleBackspace}
                  onClear={settingsKeyboard.handleClear}
                  onEnter={() => {
                    // Save the current field value
                    if (settingsKeyboard.activeField === "max_consecutive_hours") {
                      const value = parseFloat(
                        settingsKeyboard.formValues.max_consecutive_hours || "0"
                      );
                      if (!isNaN(value) && activePolicy) {
                        handleUpdatePolicy({
                          max_consecutive_hours: value,
                        });
                      }
                    } else if (settingsKeyboard.activeField === "warn_before_required_minutes") {
                      const value = parseInt(
                        settingsKeyboard.formValues.warn_before_required_minutes || "0"
                      );
                      if (!isNaN(value) && activePolicy) {
                        handleUpdatePolicy({
                          warn_before_required_minutes: value,
                        });
                      }
                    }
                    settingsKeyboard.handleCloseKeyboard();
                  }}
                  initialMode={
                    (
                      settingsKeyboard.activeFieldConfig as {
                        keyboardMode?: "qwerty" | "numeric" | "symbols";
                      }
                    )?.keyboardMode || "numeric"
                  }
                  visible={settingsKeyboard.showKeyboard}
                  onClose={settingsKeyboard.handleCloseKeyboard}
                />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Break Type Drawer */}
      <AddBreakTypeDrawer
        open={showBreakTypeDialog}
        onOpenChange={(open) => {
          setShowBreakTypeDialog(open);
          if (!open) {
            setEditingBreakType(null);
            setBreakTypeForm(DEFAULT_BREAK_TYPE);
          }
        }}
        onSubmit={handleSaveBreakType}
        isLoading={isSaving}
        editingBreakType={editingBreakType}
      />

      {/* Policy Rule Drawer */}
      {activePolicy && (
        <AddPolicyRuleDrawer
          open={showRuleDialog}
          onOpenChange={(open) => {
            setShowRuleDialog(open);
            if (!open) {
              setEditingRule(null);
            }
          }}
          onSubmit={handleSaveRule}
          isLoading={isSaving}
          editingRule={editingRule}
          breakTypes={breakTypes}
          policyId={activePolicy.id}
        />
      )}
    </div>
  );
}
