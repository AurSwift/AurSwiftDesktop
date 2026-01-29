import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield } from "lucide-react";
import type { StaffUser } from "../schemas/types";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";

interface UserStatsCardsProps {
  staffUsers: StaffUser[];
}

export function UserStatsCards({ staffUsers }: UserStatsCardsProps) {
  const cashierCount = staffUsers.filter(
    (u) => getUserRoleName(u) === "cashier"
  ).length;
  const managerCount = staffUsers.filter(
    (u) => getUserRoleName(u) === "manager"
  ).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 md:px-6">
          <CardTitle className="text-xs sm:text-sm md:text-base lg:text-base font-medium">
            Total Staff
          </CardTitle>
          <Users className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6">
          <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">
            {staffUsers.length}
          </div>
          <p className="text-caption md:text-sm lg:text-sm text-muted-foreground">
            Active staff members
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 md:px-6">
          <CardTitle className="text-xs sm:text-sm md:text-base lg:text-base font-medium">
            Cashiers
          </CardTitle>
          <Shield className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6">
          <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">
            {cashierCount}
          </div>
          <p className="text-caption md:text-sm lg:text-sm text-muted-foreground">
            Front desk staff
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 md:px-6">
          <CardTitle className="text-xs sm:text-sm md:text-base lg:text-base font-medium">
            Managers
          </CardTitle>
          <Shield className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6">
          <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">
            {managerCount}
          </div>
          <p className="text-caption md:text-sm lg:text-sm text-muted-foreground">
            Management staff
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
