import { Card } from "@/components/ui/card";
import { User } from "lucide-react";
import type { UserForLogin } from "@/types/domain";

interface UserSelectionGridProps {
  users: UserForLogin[];
  onUserSelect: (user: UserForLogin) => void;
}

export function UserSelectionGrid({
  users,
  onUserSelect,
}: UserSelectionGridProps) {
  // Empty state
  if (users.length === 0) {
    return (
      <Card className="border-0 shadow-none bg-transparent rounded-3xl overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
              Select User
            </h2>
            <p className="text-gray-600 text-xs sm:text-sm">
              Tap your profile to login
            </p>
          </div>
          <div className="text-center py-12 text-gray-600">
            <p>No users found. Please contact administrator.</p>
          </div>
        </div>
      </Card>
    );
  }

  // Actual content
  return (
    <Card className="border-0 shadow-none bg-transparent rounded-3xl overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="text-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
            Select User
          </h2>
          <p className="text-gray-600 text-xs sm:text-sm">
            Tap your profile to login
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => onUserSelect(user)}
              className="group relative flex flex-col items-center p-2 sm:p-3 hover:rounded-full hover:bg-blue-50 transition-all duration-200 hover:scale-105"
            >
              <div
                className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 ${user.color} rounded-full flex items-center justify-center mb-2 transition-shadow`}
              >
                <User className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 text-xs sm:text-sm lg:text-base mb-0.5 text-center line-clamp-2">
                {user.firstName} {user.lastName}
              </h3>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
