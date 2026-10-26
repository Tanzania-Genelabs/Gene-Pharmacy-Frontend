import { Banknote, Gift, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PaymentMethod } from "@/types";

/** How a subscription was paid: cash recorded by Gene Pharmacy, a free promotion, or mobile money in the app. */
export function MethodBadge({ method }: { method: PaymentMethod | null }) {
  if (method === "Cash") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Banknote className="h-3 w-3" /> Cash
      </Badge>
    );
  }

  if (method === "Promotion") {
    return (
      <Badge variant="outline" className="gap-1">
        <Gift className="h-3 w-3" /> Promotion
      </Badge>
    );
  }

  return (
    <Badge className="gap-1">
      <Smartphone className="h-3 w-3" /> Mobile money
    </Badge>
  );
}
