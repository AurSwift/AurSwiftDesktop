import { useState } from "react";
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
import {
  DashboardGrid,
  FEATURE_REGISTRY,
  StatsCards,
} from "@/features/dashboard";
import { getLogger } from "@/shared/utils/logger";

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
  const [_isBackingUp, setIsBackingUp] = useState(false);
  const [_isEmptying, setIsEmptying] = useState(false);
  const [_isImporting, setIsImporting] = useState(false);

  // Backup/Export Database Handler
  const handleBackupDatabase = async () => {
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
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Import Database Handler
  const handleImportDatabase = async () => {
    setIsImporting(true);

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
        ).toFixed(
          2
        )} MB)${backupMsg}\n\nReloading application to initialize imported database...`,
        duration: 5000,
      });

      // Strategy: Use window reload for both dev and production
      // The database connection has been closed (with WAL checkpoint) and file swapped
      // Window reload will trigger fresh database initialization via getDatabase()
      // This works because:
      // 1. Main process has closed the old connection with WAL checkpoint
      // 2. Main process has verified the new database is valid
      // 3. Main process has swapped the database file
      // 4. Fresh page load calls getDatabase() which opens the new file
      // 5. Works in both dev (keeps dev server) and production
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      logger.error("Import error:", error);
      toast.error("Failed to import database", {
        id: "import",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Empty Database Handler
  const handleEmptyDatabase = () => {
    setIsEmptyDialogOpen(true);
  };

  const confirmEmptyDatabase = async () => {
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
  };

  // Handle feature action clicks
  const handleActionClick = (featureId: string, actionId: string) => {
    logger.info(
      `[handleActionClick] Feature: ${featureId}, Action: ${actionId}`
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
          `[handleActionClick] Unhandled feature: ${featureId}, action: ${actionId}`
        );
        break;
    }
  };

  return (
    <>
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-[1600px] space-y-6 sm:space-y-8">
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
        <StatsCards />

        {/* Admin Features - Permission-based rendering */}
        <DashboardGrid
          features={FEATURE_REGISTRY.filter(
            (feature) => feature.id !== "quick-actions"
          )}
          onActionClick={handleActionClick}
        />
      </div>
    </>
  );
};

export default AdminDashboardView;
