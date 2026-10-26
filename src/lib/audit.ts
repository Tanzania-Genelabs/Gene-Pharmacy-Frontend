/** Display helpers shared by the two audit log screens. */

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/** "SaleVoided" -> "Sale voided", "PlanChanged" -> "Plan changed", "Login" -> "Login". */
export function actionLabel(action: string): string {
  const words = action.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Colour by what kind of thing happened, so risky events stand out without a hand-kept list. */
export function actionVariant(action: string): BadgeVariant {
  if (/(Failed|Locked|Revoked|Deleted|Deactivated|Voided|Rejected|Suspended|Cancelled)$/.test(action)) return "destructive";
  if (/(Created|Registered|Approved|Activated|Reactivated|Paid|Received|Opened)$/.test(action)) return "default";
  if (/^(Login|Logout)$/.test(action)) return "outline";
  return "secondary";
}

/** "3 minutes ago", "2 days ago", or "never". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
  ];
  let value = Math.floor(seconds / 60);
  let unit = "minute";
  for (const [size, name] of units) {
    if (seconds >= size) {
      value = Math.floor(seconds / size);
      unit = name;
    }
  }
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}
