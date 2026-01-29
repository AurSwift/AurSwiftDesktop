/**
 * Till Lock Screen Component
 *
 * Full-screen overlay shown when till is locked
 * - Shows break status and timer
 * - PIN entry to unlock
 * - Automatically ends break on unlock
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Coffee, Clock, User, XCircle } from "lucide-react";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("lock-screen");

interface LockScreenProps {
  isLocked: boolean;
  onUnlock: () => void;
  /** User ID of the user who locked the till (used to verify PIN). */
  lockedByUserId: string;
  activeBreak?: {
    id: string;
    type: "meal" | "rest" | "other";
    start_time: string;
    is_paid: boolean;
  } | null;
  userName: string;
}

export function LockScreen({
  isLocked,
  onUnlock,
  lockedByUserId,
  activeBreak,
  userName,
}: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [breakDuration, setBreakDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const maxPinLength = 6;

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate break duration
  useEffect(() => {
    if (activeBreak?.start_time) {
      const interval = setInterval(() => {
        const breakStart = new Date(activeBreak.start_time).getTime();
        const now = Date.now();
        const seconds = Math.floor((now - breakStart) / 1000);
        setBreakDuration(seconds);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeBreak]);

  const handleUnlock = async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }

    setIsUnlocking(true);
    setError("");

    try {
      // Verify PIN for the user who locked the till
      const response = await window.authAPI.verifyPin(lockedByUserId, pin);

      if (response.success) {
        // If there's an active break, end it
        if (activeBreak) {
          const breakEndResponse = await window.timeTrackingAPI.endBreak(
            activeBreak.id
          );
          if (breakEndResponse.success) {
            logger.info("Break ended on unlock:", breakEndResponse.break);
          } else {
            logger.warn(
              "Failed to end break on unlock:",
              breakEndResponse.message
            );
          }
        }

        onUnlock();
        setPin("");
      } else {
        setError("Invalid PIN");
        setPin("");
      }
    } catch (err) {
      logger.error("Failed to unlock:", err);
      setError("An error occurred");
      setPin("");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handlePinChange = (value: string) => {
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, "");
    setPin(digitsOnly.slice(0, maxPinLength));
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUnlock();
    }
  };

  const handlePinInput = (digit: string) => {
    if (isUnlocking) return;
    setError("");
    setPin((prev) => {
      if (prev.length >= maxPinLength) return prev;
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    if (isUnlocking) return;
    setError("");
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClearPin = () => {
    if (isUnlocking) return;
    setError("");
    setPin("");
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getBreakTypeLabel = (type: string): string => {
    switch (type) {
      case "meal":
        return "Meal Break";
      case "rest":
        return "Rest Break";
      default:
        return "Break";
    }
  };

  if (!isLocked) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-9999 h-dvh bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center overflow-hidden p-2 sm:p-4 lg:p-5">
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto">
        {/* Lock Icon and Status */}
        <div className="text-center mb-3 sm:mb-4 lg:mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 lg:w-14 lg:h-14 rounded-full bg-slate-700/50 mb-2 sm:mb-3">
            <Lock className="w-6 h-6 sm:w-7 sm:h-7 lg:w-7 lg:h-7 text-slate-300" />
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-2xl font-bold text-white mb-1">
            Till Locked
          </h1>
          {userName && (
            <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm text-slate-300 mb-1">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              <span className="truncate max-w-[85%]">Locked by {userName}</span>
            </div>
          )}
          <p className="text-xs sm:text-sm text-slate-400">
            Enter your PIN to unlock
          </p>
        </div>

        {/* Current Time */}
        <div className="text-center mb-3 sm:mb-4">
          <div className="text-3xl sm:text-4xl lg:text-4xl leading-none font-mono font-bold text-white mb-1">
            {formatTime(currentTime)}
          </div>
          <div className="text-xs sm:text-sm text-slate-400">
            {currentTime.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>

        {/* Break Status */}
        {activeBreak && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                <span className="text-xs sm:text-sm font-medium text-amber-200">
                  {getBreakTypeLabel(activeBreak.type)}
                </span>
              </div>
              <span className="text-xs text-amber-400">
                {activeBreak.is_paid ? "Paid" : "Unpaid"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              <span className="text-lg sm:text-xl font-mono font-bold text-amber-300">
                {formatDuration(breakDuration)}
              </span>
            </div>
            <p className="text-caption text-amber-400 mt-2">
              Break will end automatically when you unlock
            </p>
          </div>
        )}



        {/* PIN Entry */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 sm:p-4">
          <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
            Enter PIN
          </label>
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => handlePinChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••"
            className="text-center text-lg sm:text-xl tracking-widest mb-2.5 sm:mb-3 bg-slate-900 border-slate-600 text-white"
            autoFocus
            maxLength={maxPinLength}
          />

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                type="button"
                onClick={() => handlePinInput(String(num))}
                disabled={isUnlocking || pin.length >= maxPinLength}
                className="h-10 sm:h-12 lg:h-12 text-base sm:text-lg lg:text-lg font-semibold bg-slate-700/40 hover:bg-slate-700/60 active:bg-blue-600 text-white border border-slate-600 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
              >
                {num}
              </Button>
            ))}

            {/* Backspace */}
            <Button
              type="button"
              onClick={handleBackspace}
              disabled={isUnlocking || pin.length === 0}
              className="h-10 sm:h-12 lg:h-12 text-base sm:text-lg lg:text-lg font-semibold bg-slate-700/30 hover:bg-slate-700/50 active:bg-slate-700/70 text-slate-100 border border-slate-600 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
            >
              ←
            </Button>

            {/* 0 */}
            <Button
              type="button"
              onClick={() => handlePinInput("0")}
              disabled={isUnlocking || pin.length >= maxPinLength}
              className="h-10 sm:h-12 lg:h-12 text-base sm:text-lg lg:text-lg font-semibold bg-slate-700/40 hover:bg-slate-700/60 active:bg-blue-600 text-white border border-slate-600 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
            >
              0
            </Button>

            {/* Clear */}
            <Button
              type="button"
              onClick={handleClearPin}
              disabled={isUnlocking || pin.length === 0}
              className="h-10 sm:h-12 lg:h-12 text-caption font-semibold bg-slate-700/30 hover:bg-slate-700/50 active:bg-slate-700/70 text-slate-100 border border-slate-600 rounded-lg transition-colors duration-150 disabled:opacity-50 touch-manipulation"
            >
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 shrink-0" />
              <span className="truncate">Clear</span>
            </Button>
          </div>

          {error && (
            <div className="text-xs sm:text-sm text-red-400 mb-3 sm:mb-4 text-center">
              {error}
            </div>
          )}

          <Button
            onClick={handleUnlock}
            disabled={isUnlocking || pin.length < 4}
            className="w-full h-11 sm:h-12 bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {isUnlocking ? (
              <>
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-sm">Unlocking...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                <span className="text-sm">Unlock Till</span>
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-caption text-slate-500 mt-3 sm:mt-4">
          Aurswift Epos System © {currentTime.getFullYear()}
        </p>
      </div>
    </div>
  );
}
