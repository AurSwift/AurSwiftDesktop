import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  ArrowLeft,
  Delete,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { UserForLogin } from "@/types/domain";
import { ClockInOutButtons } from "@/features/auth/components/clock-in-out-buttons";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("pin-entry-screen");

interface PinEntryScreenProps {
  user: UserForLogin;
  pin: string;
  loginError: string;
  isLoading: boolean;
  isClockingIn: boolean;
  isClockingOut: boolean;
  clockMessage: string;
  onPinInput: (digit: string) => void;
  onDeletePin: () => void;
  onBack: () => void;
  onClockIn: () => Promise<void>;
  onClockOut: () => Promise<void>;
}

export function PinEntryScreen({
  user,
  pin,
  loginError,
  isLoading,
  isClockingIn,
  isClockingOut,
  clockMessage,
  onPinInput,
  onDeletePin,
  onBack,
  onClockIn,
  onClockOut,
}: PinEntryScreenProps) {
  const [schedule, setSchedule] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isLoadingShiftInfo, setIsLoadingShiftInfo] = useState(false);
  const isCashierOrManager =
    user.roleName === "cashier" || user.roleName === "manager";

  // Fetch schedule and shift info for cashiers/managers
  useEffect(() => {
    if (!isCashierOrManager) return;

    const fetchShiftInfo = async () => {
      setIsLoadingShiftInfo(true);
      try {
        // Fetch today's schedule
        const scheduleResponse = await window.shiftAPI.getTodaySchedule(
          user.id
        );
        if (scheduleResponse.success && scheduleResponse.data) {
          setSchedule(scheduleResponse.data);
        }

        // Fetch active shift
        const shiftResponse = await window.shiftAPI.getActive(user.id);
        if (shiftResponse.success && shiftResponse.data) {
          setActiveShift(shiftResponse.data);
        }
      } catch (error) {
        logger.error("Failed to fetch shift info:", error);
      } finally {
        setIsLoadingShiftInfo(false);
      }
    };

    fetchShiftInfo();
  }, [user.id, isCashierOrManager]);

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeString;
    }
  };

  return (
    <Card className="border-0 shadow-none bg-transparent rounded-3xl overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="text-center mb-4 sm:mb-6">
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 ${user.color} rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3`}
          >
            <User className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1">
            {user.firstName} {user.lastName}
          </h2>
        </div>

        {/* Shift/Schedule Information (for cashiers/managers) */}
        {isCashierOrManager && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            {isLoadingShiftInfo ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-xs sm:text-sm text-blue-800">
                  Loading schedule...
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Schedule Information */}
                {schedule ? (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-blue-900">
                        Today's Schedule
                      </div>
                      <div className="text-xs text-blue-700">
                        {formatTime(schedule.startTime)} -{" "}
                        {formatTime(schedule.endTime)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-xs sm:text-sm text-yellow-800">
                      No schedule for today
                    </span>
                  </div>
                )}

                {/* Active Shift Information */}
                {activeShift && (
                  <div className="flex items-start gap-2 pt-2 border-t border-blue-200">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-green-900">
                        Active Shift
                      </div>
                      <div className="text-xs text-green-700">
                        Started at {formatTime(activeShift.startTime)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PIN Input Display */}
        <div className="bg-gray-100 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
          <div className="flex items-center justify-center gap-1 mb-2">
            <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
            <span className="text-gray-600 text-[10px] sm:text-xs uppercase tracking-wider font-medium">
              Enter PIN
            </span>
          </div>
          <div className="flex justify-center gap-1.5 sm:gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-lg border-2 flex items-center justify-center text-lg sm:text-xl font-bold transition-all ${
                  pin.length > i
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-300 text-transparent"
                }`}
              >
                {pin.length > i ? "●" : "○"}
              </div>
            ))}
          </div>
          {loginError && (
            <p className="text-red-500 text-[10px] sm:text-xs text-center mt-2">
              {loginError}
            </p>
          )}
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Button
              key={num}
              onClick={() => onPinInput(num.toString())}
              disabled={isLoading || pin.length >= 4}
              className="h-12 sm:h-14 lg:h-16 text-lg sm:text-xl lg:text-2xl font-semibold bg-gray-200 hover:bg-gray-300 active:bg-blue-400 active:text-white text-gray-900 border-0 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
            >
              {num}
            </Button>
          ))}
          <Button
            onClick={() => onPinInput("0")}
            disabled={isLoading || pin.length >= 4}
            className="h-12 sm:h-14 lg:h-16 text-lg sm:text-xl lg:text-2xl font-semibold bg-gray-200 hover:bg-gray-300 active:bg-blue-400 active:text-white text-gray-900 border-0 rounded-lg col-span-3 disabled:opacity-50 touch-manipulation transition-colors duration-150"
          >
            0
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3">
          <Button
            onClick={onBack}
            disabled={isLoading}
            variant="outline"
            className="h-11 sm:h-12 text-xs sm:text-sm font-medium bg-gray-200 hover:bg-gray-300 active:bg-gray-400 active:text-white text-gray-900 border-0 rounded-lg touch-manipulation transition-colors duration-150"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            BACK
          </Button>
          <Button
            onClick={onDeletePin}
            disabled={isLoading || pin.length === 0}
            className="h-11 sm:h-12 text-xs sm:text-sm font-medium bg-red-100 hover:bg-red-200 active:bg-red-400 active:text-white text-red-700 border-0 rounded-lg disabled:opacity-50 touch-manipulation transition-colors duration-150"
          >
            <Delete className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            DELETE
          </Button>
        </div>

        {/* Clock In/Out Buttons */}
        <ClockInOutButtons
          user={user}
          isLoading={isLoading}
          isClockingIn={isClockingIn}
          isClockingOut={isClockingOut}
          clockMessage={clockMessage}
          onClockIn={onClockIn}
          onClockOut={onClockOut}
        />
      </div>
    </Card>
  );
}
