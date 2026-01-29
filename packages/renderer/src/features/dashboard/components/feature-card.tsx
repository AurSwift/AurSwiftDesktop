/**
 * FeatureCard Component
 *
 * Base component for rendering dashboard feature cards.
 * Automatically handles permission-based visibility and action rendering.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFeatureVisibility } from "../hooks/use-feature-visibility";
import { useUserPermissions } from "../hooks/use-user-permissions";
import { UpgradeBadge } from "@/features/subscription";
import type { FeatureConfig } from "../types/feature-config";
import { getLogger } from "@/shared/utils/logger";
import { cn } from "@/shared/utils/cn";

const logger = getLogger("feature-card");

interface FeatureCardProps {
  feature: FeatureConfig;
}

export function FeatureCard({ feature }: FeatureCardProps) {
  const visibility = useFeatureVisibility(feature);
  const { hasAnyPermission, isLoading } = useUserPermissions();

  // Don't render if feature is not visible (also waits for permissions to load)
  if (!visibility.isVisible) return null;

  const Icon = feature.icon;

  // Filter actions based on permissions
  const visibleActions = feature.actions.filter((action) => {
    // If still loading permissions, hide actions that require permissions
    if (isLoading && action.permissions && action.permissions.length > 0) {
      return false;
    }

    // Check if user has permission for this specific action
    if (action.permissions && action.permissions.length > 0) {
      return hasAnyPermission(action.permissions);
    }

    // No permissions required, show action
    return true;
  });

  // Don't render card if no visible actions
  if (visibleActions.length === 0) return null;

  return (
    <Card
      className={cn(
        "flex flex-col h-full shadow-sm hover:shadow-md transition-all relative overflow-hidden border",
        !visibility.canAccess &&
          "border-sky-200/60 dark:border-sky-800/40 bg-sky-50/20 dark:bg-sky-950/10"
      )}
    >
      <CardHeader className="relative pb-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "p-2 rounded-lg shrink-0 transition-colors",
              visibility.canAccess
                ? "bg-primary/10 text-primary"
                : "bg-muted/50 text-muted-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <CardTitle
                className={cn(
                  "text-base sm:text-lg leading-tight font-semibold",
                  !visibility.canAccess && "text-muted-foreground"
                )}
              >
                {feature.title}
              </CardTitle>
              {/* Show compact upgrade badge in top-right */}
              {visibility.requiresUpgrade && visibility.upgradeInfo && (
                <UpgradeBadge
                  message={visibility.upgradeInfo.message}
                  planId={visibility.upgradeInfo.planId}
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                />
              )}
            </div>
            <CardDescription
              className={cn(
                "text-caption",
                !visibility.canAccess && "opacity-70"
              )}
            >
              {feature.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 flex-1 pt-0 pb-6">
        {visibleActions.map((action) => {
          const ActionIcon = action.icon;
          const isDisabled = action.disabled || !visibility.canAccess;

          return (
            <Button
              key={action.id}
              className={cn(
                "w-full justify-start text-sm sm:text-base h-9 touch-manipulation transition-all relative group",
                isDisabled &&
                  "opacity-50 cursor-not-allowed hover:opacity-50 hover:bg-background hover:border-border/50"
              )}
              variant={action.variant || "outline"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                // Don't allow action if feature requires upgrade
                if (!visibility.canAccess) {
                  logger.warn(
                    `Action blocked: ${feature.id} -> ${action.id} (requires upgrade)`
                  );
                  return;
                }

                logger.debug(`Button clicked: ${feature.id} -> ${action.id}`);
                if (action.onClick) {
                  action.onClick();
                } else {
                  logger.warn(`No onClick handler for action: ${action.id}`);
                }
              }}
              disabled={isDisabled}
              title={
                isDisabled
                  ? `Upgrade to ${
                      visibility.upgradeInfo?.planId === "professional"
                        ? "Professional"
                        : ""
                    } plan to access this feature`
                  : undefined
              }
            >
              <ActionIcon
                className={cn(
                  "w-3.5 h-3.5 mr-2 shrink-0",
                  isDisabled && "opacity-40"
                )}
              />
              <span
                className={cn(
                  "flex-1 text-left truncate",
                  isDisabled && "opacity-70"
                )}
              >
                {action.label}
              </span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
