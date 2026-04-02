"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { Loader2 } from "lucide-react";

/**
 * Root page — redirects authenticated users to their pharmacy dashboard
 * (or /admin for SuperAdmin), and unauthenticated users to login.
 */
export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isInitializing, pharmacyId, user } = useAuthStore();

  useEffect(() => {
    if (isInitializing) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (user?.role === "SuperAdmin") {
      router.replace("/admin");
    } else if (pharmacyId) {
      router.replace(`/${pharmacyId}`);
    } else {
      // Owner/Manager/Seller with no pharmacy assigned yet
      router.replace("/onboarding");
    }
  }, [isAuthenticated, isInitializing, pharmacyId, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
