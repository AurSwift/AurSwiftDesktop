import { getAppVersion } from "@/shared/utils/version";

export function AuthFooter() {
  return (
    <footer className="shrink-0 py-2 sm:py-3 border-t border-gray-200 text-center bg-white/80">
      <p className="text-caption text-gray-600 px-2">
        Version {getAppVersion()} | {new Date().getFullYear()} aurswift Systems
        | All rights reserved
      </p>
    </footer>
  );
}
