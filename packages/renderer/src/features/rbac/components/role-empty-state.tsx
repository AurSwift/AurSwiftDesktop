import { Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoleEmptyStateProps {
  searchTerm: string;
  onAddRole: () => void;
}

export function RoleEmptyState({ searchTerm, onAddRole }: RoleEmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">
        {searchTerm ? "No roles found" : "No custom roles yet"}
      </h3>
      <p className="text-muted-foreground mb-4">
        {searchTerm
          ? "Try adjusting your search terms"
          : "Get started by creating your first custom role"}
      </p>
      {!searchTerm && (
        <Button onClick={onAddRole}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      )}
    </div>
  );
}
