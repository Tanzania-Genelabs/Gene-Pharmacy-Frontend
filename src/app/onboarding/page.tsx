"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pill, Building2, CheckCircle2, LogOut, Clock, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pharmacyApi } from "@/api/pharmacy.api";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { PharmacyResponse } from "@/types";

const schema = z.object({
  name: z.string().min(2, "Pharmacy name is required"),
  registrationNumber: z.string().min(2, "Registration number is required"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  phone: z.string().min(9, "Valid phone number required"),
  email: z.string().email("Valid email required"),
});

type FormData = z.infer<typeof schema>;

type PageState = "loading" | "register" | "pending" | "suspended" | "active" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setPharmacyId, clearAuth } = useAuthStore();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [existingPharmacy, setExistingPharmacy] = useState<PharmacyResponse | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Check if owner already has a pharmacy before showing the form
  useEffect(() => {
    pharmacyApi.getMine()
      .then((pharmacy) => {
        if (!pharmacy) {
          setPageState("register");
          return;
        }
        setExistingPharmacy(pharmacy);
        if (pharmacy.status === "Active") {
          setPharmacyId(pharmacy.id);
          router.replace(`/${pharmacy.id}`);
        } else if (pharmacy.status === "PendingApproval") {
          setPageState("pending");
        } else {
          setPageState("suspended");
        }
      })
      .catch(() => setPageState("register"));
  }, [router, setPharmacyId]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    router.push("/login");
  };

  const onSubmit = async (data: FormData) => {
    try {
      const pharmacy = await pharmacyApi.create(data);
      setPharmacyId(pharmacy.id);
      setExistingPharmacy(pharmacy);
      setPageState("done");
      toast.success("Pharmacy registered! Awaiting admin approval.");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to register pharmacy. Please try again.";
      toast.error(message);
    }
  };

  const TopBar = () => (
    <div className="absolute top-4 right-4 flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />Sign out
      </Button>
      <ThemeToggle />
    </div>
  );

  const Logo = () => (
    <div className="flex flex-col items-center gap-2 mb-8">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Pill className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Gene Pharmacy</h1>
      <p className="text-sm text-muted-foreground">Pharmacy Management System</p>
    </div>
  );

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pageState === "pending" || pageState === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <TopBar />
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30">
            {pageState === "done"
              ? <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              : <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {pageState === "done" ? "Pharmacy Registered!" : "Awaiting Approval"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              <span className="font-semibold text-foreground">{existingPharmacy?.name}</span> has
              been submitted and is pending review by a platform admin. You will have full access
              once approved.
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300">
            You can log out and come back once your pharmacy is approved. No action is needed from
            you at this stage.
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (pageState === "suspended") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <TopBar />
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
            <ShieldX className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Account Suspended</h1>
            <p className="mt-2 text-muted-foreground">
              Your pharmacy <span className="font-semibold text-foreground">{existingPharmacy?.name}</span> is
              currently {existingPharmacy?.status?.toLowerCase()}. Please contact platform support.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Contact: <span className="font-medium text-foreground">support@genelabs.co.tz</span>
          </p>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </div>
      </div>
    );
  }

  // pageState === "register"
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <TopBar />
      <Logo />

      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Register Your Pharmacy</CardTitle>
              <CardDescription>
                Welcome{user?.firstName ? `, ${user.firstName}` : ""}! Set up your pharmacy profile to get started.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Pharmacy Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Karibu Pharmacy" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Registration Number <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. TZ-PHARM-2024-001" {...register("registrationNumber")} />
              {errors.registrationNumber && <p className="text-sm text-destructive">{errors.registrationNumber.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Dar es Salaam" {...register("city")} />
                {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-destructive">*</span></Label>
                <Input placeholder="+255 7XX XXX XXX" {...register("phone")} />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Address <span className="text-destructive">*</span></Label>
              <Input placeholder="Street address, building" {...register("address")} />
              {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Business Email <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="pharmacy@example.com" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300">
              After submitting, your pharmacy will be reviewed by a platform admin before you gain
              full access.
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering…</>
                : "Register Pharmacy"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
