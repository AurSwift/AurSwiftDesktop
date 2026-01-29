
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  ArrowLeft,
  Delete,


} from "lucide-react";
import type { UserForLogin } from "@/types/domain";

interface PinEntryScreenProps {
  user: UserForLogin;
  pin: string;
  loginError: string;
  isLoading: boolean;
  onPinInput: (digit: string) => void;
  onDeletePin: () => void;
  onBack: () => void;
}

export function PinEntryScreen({
  user,
  pin,
  loginError,
  isLoading,
  onPinInput,
  onDeletePin,
  onBack,
}: PinEntryScreenProps) {



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

        

        {/* PIN Input Display */}
        <div className="bg-gray-100 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
          <div className="flex items-center justify-center gap-1 mb-2">
            <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
            <span className="text-gray-600 text-caption uppercase tracking-wider font-medium">
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
            <p className="text-red-500 text-caption text-center mt-2">
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
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
      </div>
    </Card>
  );
}
