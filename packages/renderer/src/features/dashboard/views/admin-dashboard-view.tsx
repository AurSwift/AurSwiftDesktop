import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import {
  DashboardGrid,
  FEATURE_REGISTRY,
  StatsCards,
} from "@/features/dashboard";
import { getLogger } from "@/shared/utils/logger";
import type { DatabaseImportProgress } from "@/types/api/database";

const logger = getLogger("admin-dashboard-view");

interface AdminDashboardViewProps {
  onFront: () => void;
  onNewTransaction?: () => void;
  onNavigateToRoles?: () => void;
  onNavigateToUserRoles?: () => void;
  onManageUsers?: () => void;
  onManageCashiers?: () => void;
  onManageProducts?: () => void;
  onStaffSchedules?: () => void;
  onGeneralSettings?: () => void;
  onActionClick?: (featureId: string, actionId: string) => void;
}

const AdminDashboardView = ({
  onFront: _onFront,
  onNewTransaction: _onNewTransaction,
  onNavigateToRoles: _onNavigateToRoles,
  onNavigateToUserRoles: _onNavigateToUserRoles,
  onManageUsers: _onManageUsers,
  onManageProducts: _onManageProducts,
  onStaffSchedules: _onStaffSchedules,
  onGeneralSettings: _onGeneralSettings,
  onActionClick,
}: AdminDashboardViewProps) => {
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isEmptyDialogOpen, setIsEmptyDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<DatabaseImportProgress | null>(null);

  // Progress stage labels for user-friendly display
  const getProgressStageLabel = (stage: DatabaseImportProgress["stage"]) => {
    switch (stage) {
      case "validating":
        return "Validating database...";
      case "backing-up":
        return "Creating backup...";
      case "copying":
        return "Copying database...";
      case "reinitializing":
        return "Reinitializing...";
      case "restoring-license":
        return "Restoring license...";
      case "complete":
        return "Import complete!";
      case "error":
        return "Import failed";
      default:
        return "Processing...";
    }
  };

  // Subscribe to import progress and ready signal
  useEffect(() => {
    if (!isImporting) return;

    const unsubscribeProgress = window.databaseAPI.onImportProgress(
      (progress: DatabaseImportProgress) => {
        logger.info(
          `Import progress: ${progress.stage} - ${progress.percent}%`,
        );
        setImportProgress(progress);

        // Handle error state
        if (progress.stage === "error") {
          logger.error("Import failed:", progress.message);
          setIsImporting(false);
          setImportProgress(null);
        }
      },
    );

    const unsubscribeReady = window.databaseAPI.onImportReady(() => {
      logger.info("Database import ready, reloading window...");
      // Database is fully ready, reload immediately
      window.location.reload();
    });

    return () => {
      unsubscribeProgress();
      unsubscribeReady();
    };
  }, [isImporting]);

  // Backup/Export Database Handler
  const handleBackupDatabase = useCallback(async () => {
    setIsBackupDialogOpen(false);
    setIsBackingUp(true);

    try {
      toast.loading("Opening save dialog...", { id: "backup" });

      const response = await window.databaseAPI.backup();

      if (!response || !response.success) {
        const responseWithCancelled = response as typeof response & {
          cancelled?: boolean;
        };
        if (responseWithCancelled.cancelled) {
          toast.dismiss("backup");
          toast.info("Backup cancelled");
          return;
        }
        throw new Error(response?.message || "Could not backup database");
      }

      const data = response.data as {
        path: string;
        size: number;
        timestamp: string;
      };

      toast.success(`Database backed up successfully!`, {
        id: "backup",
        description: `Saved to: ${data.path} (${(
          data.size /
          (1024 * 1024)
        ).toFixed(2)} MB)`,
        duration: 6000,
      });
    } catch (error) {
      logger.error("Backup error:", error);
      toast.error("Failed to backup database", {
        id: "backup",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsBackingUp(false);
    }
  }, []);

  // Import Database Handler - shows confirmation dialog first
  const handleImportDatabase = useCallback(() => {
    setIsImportDialogOpen(true);
  }, []);

  // Confirm and execute database import
  const confirmImportDatabase = useCallback(async () => {
    setIsImportDialogOpen(false);
    setIsImporting(true);
    setImportProgress(null);

    try {
      toast.loading("Opening file picker...", { id: "import" });

      const response = await window.databaseAPI.import();

      if (!response || !response.success) {
        const responseWithCancelled = response as typeof response & {
          cancelled?: boolean;
        };
        if (responseWithCancelled.cancelled) {
          toast.dismiss("import");
          toast.info("Import cancelled");
          setIsImporting(false);
          setImportProgress(null);
          return;
        }
        throw new Error(response?.message || "Could not import database");
      }

      const data = response.data as {
        importedFrom: string;
        importSize: number;
        backupPath?: string;
        newSize: number;
      };

      const backupMsg = data.backupPath
        ? `\nPrevious database backed up to: ${data.backupPath}`
        : "";

      toast.success("Database imported successfully!", {
        id: "import",
        description: `Imported from: ${data.importedFrom} (${(
          data.importSize /
          (1024 * 1024)
        ).toFixed(2)} MB)${backupMsg}\n\nReloading application...`,
        duration: 5000,
      });

      // Note: Reload is now triggered by the "database:import:ready" event
      // This ensures we wait for the database to be fully reinitialized
      // Fallback timeout in case ready signal doesn't arrive
      setTimeout(() => {
        logger.warn("Ready signal not received, forcing reload");
        window.location.reload();
      }, 10000);
    } catch (error) {
      logger.error("Import error:", error);
      toast.error("Failed to import database", {
        id: "import",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        duration: 6000,
      });
      setIsImporting(false);
      setImportProgress(null);
    }
  }, [isImporting]);

  // Empty Database Handler
  const handleEmptyDatabase = useCallback(() => {
    setIsEmptyDialogOpen(true);
  }, []);

  const confirmEmptyDatabase = useCallback(async () => {
    setIsEmptyDialogOpen(false);
    setIsEmptying(true);

    try {
      toast.loading("Creating backup and emptying database...", {
        id: "empty-db",
      });

      const response = await window.databaseAPI.empty();

      if (!response || !response.success) {
        throw new Error(response?.message || "Could not empty database");
      }

      const data = response.data as {
        backupPath: string;
        backupSize: number;
        tablesEmptied: number;
        totalRowsDeleted: number;
        tableList: string[];
      };

      toast.success("Database emptied successfully!", {
        id: "empty-db",
        description: `Backup saved to: ${data.backupPath}\n${data.tablesEmptied} tables emptied, ${data.totalRowsDeleted} rows deleted.\nDatabase has been reseeded with default data.`,
        duration: 5000,
      });

      // Reload the window instead of full app restart
      // This avoids dev server connection issues and is faster
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      logger.error("Empty database error:", error);
      toast.error("Failed to empty database", {
        id: "empty-db",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsEmptying(false);
    }
  }, []);

  // Handle feature action clicks
  const handleActionClick = useCallback(
    (featureId: string, actionId: string) => {
      // Prevent database operations while another is in progress
      const isDatabaseOperationInProgress =
        isImporting || isBackingUp || isEmptying;

      logger.info(
        `[handleActionClick] Feature: ${featureId}, Action: ${actionId}`,
      );

      // Use navigation handler if provided (for actions that map to views)
      if (onActionClick) {
        onActionClick(featureId, actionId);
      }

      // Handle actions that don't map to views (modals, dialogs, etc.)
      switch (featureId) {
        // Actions that map to views are handled by onActionClick (navigation handler)
        // Only handle actions that don't map to views (modals, dialogs, etc.)

        case "database-management":
          if (isDatabaseOperationInProgress) {
            toast.warning(
              "Please wait for the current database operation to complete",
            );
            return;
          }
          if (actionId === "import-database") {
            handleImportDatabase();
          } else if (actionId === "backup-database") {
            setIsBackupDialogOpen(true);
          } else if (actionId === "empty-database") {
            handleEmptyDatabase();
          }
          break;

        // system-settings actions are handled by onActionClick (navigation handler)

        default:
          logger.warn(
            `[handleActionClick] Unhandled feature: ${featureId}, action: ${actionId}`,
          );
          break;
      }
    },
    [
      isImporting,
      isBackingUp,
      isEmptying,
      onActionClick,
      handleImportDatabase,
      handleEmptyDatabase,
    ],
  );

  return (
    <>
      {/* Import Progress Overlay */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-lg p-6 sm:p-8 max-w-md w-[90vw] shadow-xl border">
            <div className="space-y-4">
              {/* Header with spinner or success icon */}
              <div className="flex items-center gap-3">
                {importProgress?.stage === "complete" ? (
                  <div className="h-5 w-5 text-green-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                )}
                <h3 className="text-lg font-semibold">Importing Database</h3>
              </div>

              {importProgress && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {getProgressStageLabel(importProgress.stage)}
                      </span>
                      <span className="font-medium">
                        {importProgress.percent}%
                      </span>
                    </div>
                    <Progress value={importProgress.percent} className="h-2" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {importProgress.message}
                  </p>

                  {/* Show reloading message when complete */}
                  {importProgress.stage === "complete" && (
                    <p className="text-sm font-medium text-green-600">
                      Reloading application...
                    </p>
                  )}
                </>
              )}

              {!importProgress && (
                <p className="text-sm text-muted-foreground">
                  Waiting for file selection...
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-4">
                Please do not close the application during import.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-[1600px] space-y-6 sm:space-y-8">
        {/* Import Database Confirmation Dialog */}
        <AlertDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
        >
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg mx-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg sm:text-xl text-amber-600">
                ⚠️ Import Database
              </AlertDialogTitle>
              <div className="space-y-3 text-sm sm:text-base text-muted-foreground">
                <p className="font-semibold">
                  This will replace your current database!
                </p>
                <p>When you import a database:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Your current database will be backed up automatically</li>
                  <li>All current data will be replaced with imported data</li>
                  <li>Your license information will be preserved</li>
                  <li>The application will reload after import</li>
                </ul>
                <p className="text-amber-600 font-semibold mt-2">
                  Large databases may take several minutes to import.
                </p>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel className="w-full sm:w-auto mt-2 sm:mt-0">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmImportDatabase}
                className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto"
              >
                Continue to Select File
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Backup Confirmation Dialog */}
        <AlertDialog
          open={isBackupDialogOpen}
          onOpenChange={setIsBackupDialogOpen}
        >
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg mx-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg sm:text-xl">
                Backup Database
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm sm:text-base">
                You will be prompted to choose where to save your database
                backup file. The backup will include all your business data,
                products, transactions, and settings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel className="w-full sm:w-auto mt-2 sm:mt-0">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBackupDatabase}
                className="w-full sm:w-auto"
              >
                Choose Location & Backup
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Empty Database Confirmation Dialog */}
        <AlertDialog
          open={isEmptyDialogOpen}
          onOpenChange={setIsEmptyDialogOpen}
        >
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg mx-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg sm:text-xl text-red-600">
                ⚠️ Empty Database
              </AlertDialogTitle>
              <div className="space-y-3 text-sm sm:text-base text-muted-foreground">
                <p className="font-semibold">This action cannot be undone!</p>
                <p>This will permanently delete ALL data from your database:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>All user accounts and permissions</li>
                  <li>All products and categories</li>
                  <li>All transactions and sales history</li>
                  <li>All business data</li>
                </ul>
                <p className="text-red-600 font-semibold mt-2">
                  A backup will be created automatically before emptying.
                </p>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel className="w-full sm:w-auto mt-2 sm:mt-0">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmEmptyDatabase}
                className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
              >
                I Understand, Empty Database
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Admin Stats */}
        <StatsCards onActionClick={handleActionClick} />

        {/* Admin Features - Permission-based rendering */}
        <DashboardGrid
          features={FEATURE_REGISTRY.filter(
            (feature) => feature.id !== "quick-actions",
          )}
          onActionClick={handleActionClick}
        />
      </div>
    </>
  );
};

export default AdminDashboardView;
