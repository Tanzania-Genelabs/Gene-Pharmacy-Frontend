"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/store/auth.store";
import { pharmacyApi } from "@/api/pharmacy.api";
import { SUBSCRIPTION_REQUIRED_EVENT } from "@/lib/api";
import { Loader2, Clock, ShieldX, CreditCard } from "lucide-react";
import type { PharmacyResponse } from "@/types";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ pharmacyId: string }>;
}

export default function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { pharmacyId } = use(params);
  const { isAuthenticated, isInitializing, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [pharmacy, setPharmacy] = useState<PharmacyResponse | null>(null);
  const [pharmacyLoading, setPharmacyLoading] = useState(true);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isInitializing, router]);

  useEffect(() => {
    const lock = () => setSubscriptionRequired(true);
    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, lock);
    return () => window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, lock);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !pharmacyId) return;
    pharmacyApi.getById(pharmacyId)
      .then(setPharmacy)
      .catch(() => setPharmacy(null))
      .finally(() => setPharmacyLoading(false));
  }, [isAuthenticated, pharmacyId]);

  if (isInitializing || pharmacyLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  // Block access if pharmacy is not Active
  if (pharmacy && pharmacy.status !== "Active") {
    const isPending = pharmacy.status === "PendingApproval";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className={`flex items-center justify-center w-20 h-20 rounded-full ${isPending ? "bg-amber-100 dark:bg-amber-900/30" : "bg-destructive/10"}`}>
            {isPending
              ? <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              : <ShieldX className="w-10 h-10 text-destructive" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{isPending ? "Awaiting Approval" : `Pharmacy ${pharmacy.status}`}</h1>
            <p className="mt-2 text-muted-foreground">
              {isPending
                ? `Your pharmacy "${pharmacy.name}" has been submitted and is pending review by a platform admin. You'll have full access once approved.`
                : `Your pharmacy "${pharmacy.name}" is currently ${pharmacy.status.toLowerCase()}. Please contact support for assistance.`}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Questions? Contact <span className="font-medium text-foreground">support@genelabs.co.tz</span>
          </p>
        </div>
      </div>
    );
  }

  // No running subscription: only the billing page (where the owner pays) stays usable.
  if (subscriptionRequired && !pathname.endsWith("/billing")) {
    const isOwner = user.role === "Owner";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <CreditCard className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Subscription required</h1>
            <p className="mt-2 text-muted-foreground">
              {isOwner
                ? `"${pharmacy?.name ?? "Your pharmacy"}" has no active subscription. Choose a plan and pay to start using Gene Pharmacy.`
                : `"${pharmacy?.name ?? "Your pharmacy"}" has no active subscription. Please ask the pharmacy owner to subscribe.`}
            </p>
          </div>
          {isOwner && (
            <Link
              href={`/${pharmacyId}/billing`}
              className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Choose a plan
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar pharmacyId={pharmacyId} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header pharmacyId={pharmacyId} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
