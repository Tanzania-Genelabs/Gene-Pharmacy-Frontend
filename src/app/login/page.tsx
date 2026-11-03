"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { AuthResponse } from "@/types";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  // Set once the password was right for an account with two-factor: the code finishes the sign-in.
  const [challenge, setChallenge] = useState<{ token: string; email: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const finish = (response: AuthResponse) => {
    setAuth(response.user, response.accessToken);
    toast.success(`Welcome back, ${response.user.fullName}!`);
    const { role, pharmacyId } = response.user;
    if (role === "SuperAdmin") {
      router.push("/admin");
    } else if (pharmacyId) {
      router.push(`/${pharmacyId}`);
    } else {
      router.push("/onboarding");
    }
  };

  const submitCode = async () => {
    if (!challenge || !code.trim()) return;
    setVerifying(true);
    try {
      finish(await authApi.verifyTwoFactor(challenge.token, code.trim()));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "That code is not right.",
      );
      // The ticket is single-use after too many mistakes or when it expired: start again from the password.
      if (status === 401 || status === 423) {
        const expired = (err as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode === "TWO_FACTOR_EXPIRED";
        if (expired || status === 423) setChallenge(null);
      }
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await authApi.login(data);
      if ("twoFactorRequired" in response) {
        setChallenge({ token: response.challengeToken, email: response.email });
        return;
      }
      finish(response);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Invalid email or password. Please try again.";
      toast.error(message);
    }
  };

  if (challenge) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Two-factor sign-in</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app for {challenge.email}. Lost your phone? Use one of your recovery codes.
            </CardDescription>
          </CardHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode();
            }}
          >
            <CardContent className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" autoFocus autoComplete="one-time-code" inputMode="text" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
            </CardContent>
            <CardFooter className="flex-col gap-3 pt-2">
              <Button type="submit" className="w-full" disabled={verifying || !code.trim()}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify and sign in"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setChallenge(null); setCode(""); }}>
                Back
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Theme toggle — top-right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Logo + wordmark */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Pill className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Gene Pharmacy</h1>
        <p className="text-sm text-muted-foreground">Pharmacy Management System</p>
      </div>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl">Sign in to your account</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@genelabs.co.tz"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toast.info("Contact your admin to reset your password.")}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="pt-2 flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
            <div className="w-full border-t pt-3 text-center">
              <p className="text-sm text-muted-foreground">
                New pharmacy owner?{" "}
                <Link
                  href="/register"
                  className="font-medium text-primary hover:underline"
                >
                  Register your pharmacy →
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground text-center">
        © {new Date().getFullYear()} Gene Pharmacy · Powered by Genelabs Tanzania
      </p>
    </div>
  );
}

// Suspense boundary no longer needed
export default function LoginPage() {
  return <LoginForm />;
}
