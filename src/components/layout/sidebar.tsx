"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Pill,
  Tag,
  Package,
  ShoppingCart,
  Clock,
  Truck,
  FileText,
  BarChart3,
  Bell,
  Users,
  Shield,
  Building2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Heart,
  Gift,
  TrendingUp,
  CreditCard,
  ScanBarcode,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthStore } from "@/store/auth.store";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If omitted, the item is visible to every authenticated role. */
  roles?: string[];
}

/**
 * Role-based access matrix:
 *
 * | Item             | SuperAdmin | Owner | Manager | Seller |
 * |------------------|-----------|-------|---------|--------|
 * | Dashboard        | ✅        | ✅    | ✅      | ✅     |
 * | Drugs            | ✅        | ✅    | ✅      | ❌     |
 * | Drug Categories  | ✅        | ✅    | ✅      | ❌     |
 * | Inventory        | ✅        | ✅    | ✅      | ❌     |
 * | Sales            | ✅        | ✅    | ✅      | ✅     |
 * | Shifts           | ✅        | ✅    | ✅      | ✅     |
 * | Suppliers        | ✅        | ✅    | ✅      | ❌     |
 * | Purchase Orders  | ✅        | ✅    | ✅      | ❌     |
 * | Reports          | ✅        | ✅    | ✅      | ❌     |
 * | Notifications    | ✅        | ✅    | ✅      | ✅     |
 * | Users            | ✅        | ✅    | ❌      | ❌     |
 * | Audit Logs       | ✅        | ✅    | ❌      | ❌     |
 * | Branches         | ✅        | ✅    | ❌      | ❌     |
 */
function buildNavItems(pharmacyId: string): NavItem[] {
  const ALL = ["SuperAdmin", "Owner", "Manager", "Seller"];
  const NO_SELLER = ["SuperAdmin", "Owner", "Manager"];
  const OWNER_AND_ABOVE = ["SuperAdmin", "Owner"];

  return [
    { label: "Dashboard",        href: `/${pharmacyId}`,                  icon: LayoutDashboard, roles: ALL },
    { label: "Quick POS",        href: `/${pharmacyId}/pos`,              icon: ScanBarcode,     roles: ALL },
    { label: "Drugs",            href: `/${pharmacyId}/drugs`,             icon: Pill,            roles: NO_SELLER },
    { label: "Drug Categories",  href: `/${pharmacyId}/drug-categories`,   icon: Tag,             roles: NO_SELLER },
    { label: "Inventory",        href: `/${pharmacyId}/inventory`,         icon: Package,         roles: NO_SELLER },
    { label: "Expiry & Stock",   href: `/${pharmacyId}/expiry`,            icon: AlertTriangle,   roles: NO_SELLER },
    { label: "Sales",            href: `/${pharmacyId}/sales`,             icon: ShoppingCart,    roles: ALL },
    { label: "Payments",         href: `/${pharmacyId}/payments`,          icon: CreditCard,      roles: NO_SELLER },
    { label: "Shifts",           href: `/${pharmacyId}/shifts`,            icon: Clock,           roles: ALL },
    { label: "Customers",        href: `/${pharmacyId}/customers`,         icon: Heart,           roles: NO_SELLER },
    { label: "Loyalty",          href: `/${pharmacyId}/loyalty`,           icon: Gift,            roles: NO_SELLER },
    { label: "Suppliers",        href: `/${pharmacyId}/suppliers`,         icon: Truck,           roles: NO_SELLER },
    { label: "Purchase Orders",  href: `/${pharmacyId}/purchase-orders`,   icon: FileText,        roles: NO_SELLER },
    { label: "Analytics",        href: `/${pharmacyId}/analytics`,         icon: TrendingUp,      roles: OWNER_AND_ABOVE },
    { label: "Reports",          href: `/${pharmacyId}/reports`,           icon: BarChart3,       roles: NO_SELLER },
    { label: "Notifications",    href: `/${pharmacyId}/notifications`,     icon: Bell,            roles: ALL },
    { label: "Users",            href: `/${pharmacyId}/users`,             icon: Users,           roles: OWNER_AND_ABOVE },
    { label: "Audit Logs",       href: `/${pharmacyId}/audit-logs`,        icon: Shield,          roles: OWNER_AND_ABOVE },
    { label: "Branches",         href: `/${pharmacyId}/branches`,          icon: Building2,       roles: OWNER_AND_ABOVE },
  ];
}

interface SidebarProps {
  pharmacyId: string;
  pharmacyName?: string;
}

export function Sidebar({ pharmacyId, pharmacyName = "Gene Pharmacy" }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();
  const userRole = user?.role ?? "";

  const navItems = buildNavItems(pharmacyId).filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex flex-col h-screen border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo + pharmacy name */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border min-h-[64px]">
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
            <Pill className="w-4 h-4" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-foreground truncate">{pharmacyName}</span>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="flex flex-col gap-1 px-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== `/${pharmacyId}` && pathname.startsWith(item.href));

              const linkContent = (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.href}>{linkContent}</div>;
            })}
          </nav>
        </ScrollArea>

        {/* Collapse toggle */}
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-8"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
