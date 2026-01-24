import {
  AuthFooter,
  AuthHeader,
  AuthUserSelection,
} from "@/features/auth/components";

export default function AuthPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AuthHeader />
      <main className="flex-1 bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <AuthUserSelection />
      </main>
      <AuthFooter />
    </div>
  );
}
