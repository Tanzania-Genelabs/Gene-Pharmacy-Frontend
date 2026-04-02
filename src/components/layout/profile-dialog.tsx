"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { userApi } from "@/api/user.api";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Lock, Mail, Phone, ShieldCheck } from "lucide-react";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const ROLE_COLORS: Record<string, string> = {
  SuperAdmin: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  Owner: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Manager: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Seller: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

export function ProfileDialog({ open, onOpenChange, pharmacyId }: ProfileDialogProps) {
  const { user, updateUser } = useAuthStore();

  // Fetch full user profile (includes phone) when dialog opens
  const { data: fullProfile } = useQuery({
    queryKey: ["user-profile-self", pharmacyId],
    queryFn: () => userApi.getSelf(pharmacyId),
    enabled: open && !!pharmacyId,
  });

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  // Sync form when profile loads
  useEffect(() => {
    if (fullProfile) {
      setProfileForm({
        firstName: fullProfile.firstName ?? "",
        lastName: fullProfile.lastName ?? "",
        phone: fullProfile.phone ?? "",
      });
    } else if (user) {
      setProfileForm({
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        phone: "",
      });
    }
  }, [fullProfile, user]);

  const updateMutation = useMutation({
    mutationFn: () =>
      userApi.updateSelf(pharmacyId, {
        firstName: profileForm.firstName.trim() || undefined,
        lastName: profileForm.lastName.trim() || undefined,
        phone: profileForm.phone.trim() || undefined,
      }),
    onSuccess: (updated) => {
      updateUser({
        firstName: updated.firstName,
        lastName: updated.lastName,
        fullName: updated.fullName,
      });
      toast.success("Profile updated successfully");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to update profile";
      toast.error(msg);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      userApi.changeSelfPassword(pharmacyId, {
        newPassword: passwordForm.newPassword,
      }),
    onSuccess: () => {
      toast.success("Password changed successfully");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to change password";
      toast.error(msg);
    },
  });

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    updateMutation.mutate();
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    passwordMutation.mutate();
  }

  if (!user) return null;

  const roleColor = ROLE_COLORS[user.role] ?? "bg-muted text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
        </DialogHeader>

        {/* Identity card */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
              {getInitials(user.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-base leading-tight truncate">{user.fullName}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${roleColor}`}>
                <ShieldCheck className="h-3 w-3" />
                {user.role}
              </span>
              {fullProfile?.phone && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {fullProfile.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1 gap-1.5">
              <User className="h-3.5 w-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-1 gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* ── Profile Tab ─────────────────────────── */}
          <TabsContent value="profile" className="mt-4">
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-first">First Name</Label>
                  <Input
                    id="p-first"
                    placeholder="First name"
                    value={profileForm.firstName}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-last">Last Name</Label>
                  <Input
                    id="p-last"
                    placeholder="Last name"
                    value={profileForm.lastName}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" value={user.email} readOnly className="bg-muted/50 cursor-not-allowed" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-phone">Phone Number</Label>
                <Input
                  id="p-phone"
                  type="tel"
                  placeholder="+255 700 000 000"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <div className="h-9 flex items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                  <Badge
                    variant="outline"
                    className={`text-xs ${roleColor} border-0`}
                  >
                    {user.role}
                  </Badge>
                  <span className="ml-2 text-muted-foreground text-xs">
                    Role is managed by your administrator
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ── Security Tab ─────────────────────────── */}
          <TabsContent value="security" className="mt-4">
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
                Choose a strong password with at least 6 characters. You will need to
                log in again after changing your password.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s-new">New Password</Label>
                <Input
                  id="s-new"
                  type="password"
                  placeholder="New password (min. 6 characters)"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
                  }
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s-confirm">Confirm Password</Label>
                <Input
                  id="s-confirm"
                  type="password"
                  placeholder="Repeat new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
                  }
                  required
                />
                {passwordForm.confirmPassword &&
                  passwordForm.newPassword !== passwordForm.confirmPassword && (
                    <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                  )}
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={
                    passwordMutation.isPending ||
                    !passwordForm.newPassword ||
                    passwordForm.newPassword !== passwordForm.confirmPassword
                  }
                >
                  {passwordMutation.isPending ? "Changing…" : "Change Password"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
