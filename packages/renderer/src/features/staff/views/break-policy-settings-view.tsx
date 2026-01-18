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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface BreakTypeFormData {
  name: string;
  code: string;
  description: string;
  default_duration_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  is_paid: boolean;
  is_required: boolean;
  counts_as_worked_time: boolean;
  allowed_window_start: string;
  allowed_window_end: string;
  icon: string;
  color: string;
}

interface PolicyRuleFormData {
  break_type_id: number;
  min_shift_hours: number;
  max_shift_hours: number | null;
  allowed_count: number;
  is_mandatory: boolean;
  earliest_after_hours: number | null;
  latest_before_end_hours: number | null;
}

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
};

const DEFAULT_POLICY_RULE: PolicyRuleFormData = {
  break_type_id: 0,
  min_shift_hours: 4,
  max_shift_hours: null,
  allowed_count: 1,
  is_mandatory: false,
  earliest_after_hours: null,
  latest_before_end_hours: null,
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

  // Form state
  const [breakTypeForm, setBreakTypeForm] =
    useState<BreakTypeFormData>(DEFAULT_BREAK_TYPE);
  const [ruleForm, setRuleForm] =
    useState<PolicyRuleFormData>(DEFAULT_POLICY_RULE);

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
  const handleSaveBreakType = async () => {
    if (!user?.businessId) return;

    try {
      setIsSaving(true);

      if (editingBreakType) {
        // Update existing
        const res = await window.breakPolicyAPI.updateBreakType(
          editingBreakType.id,
          breakTypeForm
        );
        if (res.success) {
          toast.success("Break type updated");
        } else {
          throw new Error(res.message);
        }
      } else {
        // Create new
        const res = await window.breakPolicyAPI.createBreakType({
          ...breakTypeForm,
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
  const handleSaveRule = async () => {
    if (!activePolicy) return;

    try {
      setIsSaving(true);

      if (editingRule) {
        // Update existing
        const res = await window.breakPolicyAPI.updatePolicyRule(
          editingRule.id,
          {
            ...ruleForm,
            max_shift_hours: ruleForm.max_shift_hours ?? undefined,
            earliest_after_hours: ruleForm.earliest_after_hours ?? undefined,
            latest_before_end_hours:
              ruleForm.latest_before_end_hours ?? undefined,
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
          ...ruleForm,
          policy_id: activePolicy.id,
          max_shift_hours: ruleForm.max_shift_hours ?? undefined,
          earliest_after_hours: ruleForm.earliest_after_hours ?? undefined,
          latest_before_end_hours:
            ruleForm.latest_before_end_hours ?? undefined,
        });
        if (res.success) {
          toast.success("Rule created");
        } else {
          throw new Error(res.message);
        }
      }

      setShowRuleDialog(false);
      setEditingRule(null);
      setRuleForm(DEFAULT_POLICY_RULE);
      await loadData();
    } catch (error) {
      logger.error("Failed to save rule:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save rule"
      );
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

  // Open edit dialogs
  const openEditBreakType = (type: BreakTypeDefinition) => {
    setEditingBreakType(type);
    setBreakTypeForm({
      name: type.name,
      code: type.code,
      description: type.description || "",
      default_duration_minutes: type.default_duration_minutes,
      min_duration_minutes: type.min_duration_minutes,
      max_duration_minutes: type.max_duration_minutes,
      is_paid: type.is_paid,
      is_required: type.is_required,
      counts_as_worked_time: type.counts_as_worked_time,
      allowed_window_start: type.allowed_window_start || "",
      allowed_window_end: type.allowed_window_end || "",
      icon: type.icon || "coffee",
      color: type.color || "#6B7280",
    });
    setShowBreakTypeDialog(true);
  };

  const openEditRule = (rule: BreakPolicyRule) => {
    setEditingRule(rule);
    setRuleForm({
      break_type_id: rule.break_type_id,
      min_shift_hours: rule.min_shift_hours,
      max_shift_hours: rule.max_shift_hours ?? null,
      allowed_count: rule.allowed_count,
      is_mandatory: rule.is_mandatory,
      earliest_after_hours: rule.earliest_after_hours ?? null,
      latest_before_end_hours: rule.latest_before_end_hours ?? null,
    });
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
              defaults for a small grocery shop, compliant with UK Working Time
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

      <Tabs defaultValue="types" className="space-y-6">
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
                setBreakTypeForm(DEFAULT_BREAK_TYPE);
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
                setRuleForm({
                  ...DEFAULT_POLICY_RULE,
                  break_type_id: breakTypes[0]?.id || 0,
                });
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
        <TabsContent value="settings" className="space-y-4">
          {activePolicy && (
            <Card>
              <CardHeader>
                <CardTitle>Policy Settings</CardTitle>
                <CardDescription>
                  Configure enforcement and compliance settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="max-consecutive">
                      Max Consecutive Hours (before required break)
                    </Label>
                    <Input
                      id="max-consecutive"
                      type="number"
                      step="0.5"
                      value={activePolicy.max_consecutive_hours}
                      onChange={(e) =>
                        handleUpdatePolicy({
                          max_consecutive_hours: parseFloat(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      UK Working Time Directive requires a break after 6 hours
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="warn-before">
                      Warning Before Required Break (minutes)
                    </Label>
                    <Input
                      id="warn-before"
                      type="number"
                      value={activePolicy.warn_before_required_minutes}
                      onChange={(e) =>
                        handleUpdatePolicy({
                          warn_before_required_minutes: parseInt(
                            e.target.value
                          ),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Show warning this many minutes before break is required
                    </p>
                  </div>
                </div>

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
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      UK Working Time Directive
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
        </TabsContent>
      </Tabs>

      {/* Break Type Dialog */}
      <Dialog open={showBreakTypeDialog} onOpenChange={setShowBreakTypeDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingBreakType ? "Edit Break Type" : "Add Break Type"}
            </DialogTitle>
            <DialogDescription>
              Define a type of break available to staff
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={breakTypeForm.name}
                  onChange={(e) =>
                    setBreakTypeForm({ ...breakTypeForm, name: e.target.value })
                  }
                  placeholder="Tea Break"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={breakTypeForm.code}
                  onChange={(e) =>
                    setBreakTypeForm({ ...breakTypeForm, code: e.target.value })
                  }
                  placeholder="tea"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={breakTypeForm.description}
                onChange={(e) =>
                  setBreakTypeForm({
                    ...breakTypeForm,
                    description: e.target.value,
                  })
                }
                placeholder="Short break for tea/coffee"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default-duration">Default (min)</Label>
                <Input
                  id="default-duration"
                  type="number"
                  value={breakTypeForm.default_duration_minutes}
                  onChange={(e) =>
                    setBreakTypeForm({
                      ...breakTypeForm,
                      default_duration_minutes: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-duration">Min (min)</Label>
                <Input
                  id="min-duration"
                  type="number"
                  value={breakTypeForm.min_duration_minutes}
                  onChange={(e) =>
                    setBreakTypeForm({
                      ...breakTypeForm,
                      min_duration_minutes: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-duration">Max (min)</Label>
                <Input
                  id="max-duration"
                  type="number"
                  value={breakTypeForm.max_duration_minutes}
                  onChange={(e) =>
                    setBreakTypeForm({
                      ...breakTypeForm,
                      max_duration_minutes: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="window-start">Window Start</Label>
                <Input
                  id="window-start"
                  type="time"
                  value={breakTypeForm.allowed_window_start}
                  onChange={(e) =>
                    setBreakTypeForm({
                      ...breakTypeForm,
                      allowed_window_start: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="window-end">Window End</Label>
                <Input
                  id="window-end"
                  type="time"
                  value={breakTypeForm.allowed_window_end}
                  onChange={(e) =>
                    setBreakTypeForm({
                      ...breakTypeForm,
                      allowed_window_end: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="is-paid"
                  checked={breakTypeForm.is_paid}
                  onCheckedChange={(checked) =>
                    setBreakTypeForm({ ...breakTypeForm, is_paid: checked })
                  }
                />
                <Label htmlFor="is-paid">Paid Break</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is-required"
                  checked={breakTypeForm.is_required}
                  onCheckedChange={(checked) =>
                    setBreakTypeForm({ ...breakTypeForm, is_required: checked })
                  }
                />
                <Label htmlFor="is-required">Required by Law</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="counts-as-worked"
                  checked={breakTypeForm.counts_as_worked_time}
                  onCheckedChange={(checked) =>
                    setBreakTypeForm({
                      ...breakTypeForm,
                      counts_as_worked_time: checked,
                    })
                  }
                />
                <Label htmlFor="counts-as-worked">Counts as Worked Time</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icon">Icon</Label>
                <Select
                  value={breakTypeForm.icon}
                  onValueChange={(value) =>
                    setBreakTypeForm({ ...breakTypeForm, icon: value })
                  }
                >
                  <SelectTrigger id="icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coffee">☕ Coffee</SelectItem>
                    <SelectItem value="utensils">🍽️ Meal</SelectItem>
                    <SelectItem value="pause">⏸️ Pause</SelectItem>
                    <SelectItem value="clock">⏰ Clock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  type="color"
                  value={breakTypeForm.color}
                  onChange={(e) =>
                    setBreakTypeForm({
                      ...breakTypeForm,
                      color: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBreakTypeDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveBreakType} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBreakType ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy Rule Dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Policy Rule" : "Add Policy Rule"}
            </DialogTitle>
            <DialogDescription>
              Define when this break type is available based on shift length
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="break-type">Break Type</Label>
              <Select
                value={ruleForm.break_type_id.toString()}
                onValueChange={(value) =>
                  setRuleForm({ ...ruleForm, break_type_id: parseInt(value) })
                }
              >
                <SelectTrigger id="break-type">
                  <SelectValue placeholder="Select break type" />
                </SelectTrigger>
                <SelectContent>
                  {breakTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-shift">Min Shift Hours</Label>
                <Input
                  id="min-shift"
                  type="number"
                  step="0.5"
                  value={ruleForm.min_shift_hours}
                  onChange={(e) =>
                    setRuleForm({
                      ...ruleForm,
                      min_shift_hours: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-shift">Max Shift Hours (optional)</Label>
                <Input
                  id="max-shift"
                  type="number"
                  step="0.5"
                  value={ruleForm.max_shift_hours || ""}
                  onChange={(e) =>
                    setRuleForm({
                      ...ruleForm,
                      max_shift_hours: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  placeholder="No limit"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="allowed-count">Allowed Count</Label>
                <Input
                  id="allowed-count"
                  type="number"
                  value={ruleForm.allowed_count}
                  onChange={(e) =>
                    setRuleForm({
                      ...ruleForm,
                      allowed_count: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Switch
                  id="is-mandatory"
                  checked={ruleForm.is_mandatory}
                  onCheckedChange={(checked) =>
                    setRuleForm({ ...ruleForm, is_mandatory: checked })
                  }
                />
                <Label htmlFor="is-mandatory">Mandatory Break</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="earliest-after">Earliest After (hours)</Label>
                <Input
                  id="earliest-after"
                  type="number"
                  step="0.5"
                  value={ruleForm.earliest_after_hours || ""}
                  onChange={(e) =>
                    setRuleForm({
                      ...ruleForm,
                      earliest_after_hours: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  placeholder="Any time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="latest-before">Latest Before End (hours)</Label>
                <Input
                  id="latest-before"
                  type="number"
                  step="0.5"
                  value={ruleForm.latest_before_end_hours || ""}
                  onChange={(e) =>
                    setRuleForm({
                      ...ruleForm,
                      latest_before_end_hours: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  placeholder="Any time"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRule ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
