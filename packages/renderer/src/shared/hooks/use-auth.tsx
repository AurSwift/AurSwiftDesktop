import { useContext } from "react";
import { AuthContext } from "@/features/auth/context/auth-context";
import type { AuthContextType } from "@/types/domain";

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
