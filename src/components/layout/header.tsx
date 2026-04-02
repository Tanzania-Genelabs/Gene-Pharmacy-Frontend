"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/api/auth.api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThemeToggle } from "./theme-toggle";
import { ProfileDialog } from "./profile-dialog";
import { NotificationBell } from "./notification-bell";
import { LogOut, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  pharmacyId: string;
  title?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function Header({ pharmacyId, title }: HeaderProps) {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore — clear client state regardless
    } finally {
      clearAuth();
      toast.success("You have been signed out.");
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      {/* Page title slot */}
      {title && (
        <h1 className="text-lg font-semibold text-foreground hidden md:block">{title}</h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <NotificationBell pharmacyId={pharmacyId} />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {getInitials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-medium">{user.fullName}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowProfile(true)}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {user && (
        <ProfileDialog
          open={showProfile}
          onOpenChange={setShowProfile}
          pharmacyId={pharmacyId}
        />
      )}
    </header>
  );
}
