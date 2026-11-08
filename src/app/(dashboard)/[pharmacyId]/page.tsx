"use client";

import { use } from "react";
import { useAuthStore } from "@/store/auth.store";
import { OwnerDashboard } from "@/components/dashboard/owner-dashboard";
import { SellerDashboard } from "@/components/dashboard/seller-dashboard";

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

/** Owners and Managers get the full business overview; Sellers a simple view of their branch's day. */
export default function DashboardPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const role = useAuthStore((s) => s.user?.role);

  return role === "Seller" ? <SellerDashboard pharmacyId={pharmacyId} /> : <OwnerDashboard pharmacyId={pharmacyId} />;
}
