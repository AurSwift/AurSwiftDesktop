/**
 * User-facing error helpers
 *
 * Goal: avoid leaking internal/backend/IPC details into UI (toasts, dialogs),
 * while still allowing detailed logging for debugging.
 */
 
function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return String((error as any).message);
    } catch {
      return null;
    }
  }
  return null;
}

const INTERNAL_MESSAGE_PATTERNS: RegExp[] = [
  /Error invoking remote method/i,
  /No handler registered for/i,
  /\bipc(main|renderer)?\b/i,
  /\bSQLITE\b/i,
  /\bat\s+.+:\d+:\d+/i, // stack-like lines
];

export function isProbablyInternalErrorMessage(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  if (m.length > 180) return true; // almost always too detailed for a toast
  return INTERNAL_MESSAGE_PATTERNS.some((re) => re.test(m));
}

export function sanitizeUserFacingMessage(
  message: unknown,
  fallback = "Please try again"
): string {
  const str = typeof message === "string" ? message.trim() : "";
  if (!str) return fallback;
  if (isProbablyInternalErrorMessage(str)) return fallback;
  return str;
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallback = "Please try again"
): string {
  const msg = (extractMessage(error) || "").trim();
  if (!msg) return fallback;

  // IPC / Electron invoke errors (never show raw channel names)
  if (/Error invoking remote method/i.test(msg) || /No handler registered for/i.test(msg)) {
    return "This feature isn't available right now. Please restart the app or update to the latest version.";
  }

  // Network-ish errors
  if (
    /Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(msg)
  ) {
    return "Can't connect right now. Check your connection and try again.";
  }

  // Auth-ish errors
  if (/\b(401|403)\b|unauthorized|forbidden/i.test(msg)) {
    return "You don't have permission to do that.";
  }

  // Default: only show message if it doesn't look internal/too detailed
  if (isProbablyInternalErrorMessage(msg)) return fallback;
  return msg;
}

