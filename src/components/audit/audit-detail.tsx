import type { AuditLogResponse } from "@/types";

const show = (v: unknown): string => (v === null || v === undefined ? "none" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** What happened, why the admin says they did it, and what it changed (old value -> new value). */
export function AuditDetail({ log }: { log: Pick<AuditLogResponse, "description" | "reason" | "before" | "after"> }) {
  const keys = Array.from(new Set([...Object.keys(log.before ?? {}), ...Object.keys(log.after ?? {})]));
  const changed = keys.filter((k) => show(log.before?.[k]) !== show(log.after?.[k]));

  return (
    <div className="space-y-1">
      <p>{log.description}</p>
      {log.reason && (
        <p className="text-foreground">
          <span className="font-medium">Reason:</span> {log.reason}
        </p>
      )}
      {changed.length > 0 && (
        <ul className="text-xs">
          {changed.map((k) => (
            <li key={k}>
              <span className="font-medium text-foreground">{k}</span>: {log.before && k in log.before ? show(log.before[k]) : "-"} → {log.after && k in log.after ? show(log.after[k]) : "-"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
