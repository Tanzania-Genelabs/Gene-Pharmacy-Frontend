"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminHeader } from "@/components/layout/admin-header";
import { Loader2 } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { isAuthenticated, isInitializing, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isInitializing) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    // Only SuperAdmin may access /admin routes
    if (user?.role !== "SuperAdmin") {
      router.replace(user?.pharmacyId ? `/${user.pharmacyId}` : "/login");
    }
  }, [isAuthenticated, isInitializing, user, router]);

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user || user.role !== "SuperAdmin") {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
