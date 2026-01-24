import { AuthProvider } from "@/features/auth";
import { LicenseProvider } from "@/features/license";

interface AppProvidersProps {
  children: React.ReactNode;
}

import { UpdateToastProvider } from "@/features/updates/context/UpdateToastContext";

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <LicenseProvider>
      <AuthProvider>
        <UpdateToastProvider>{children}</UpdateToastProvider>
      </AuthProvider>
    </LicenseProvider>
  );
}
