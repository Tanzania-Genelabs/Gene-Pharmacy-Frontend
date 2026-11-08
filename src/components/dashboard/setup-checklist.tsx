"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Circle, Rocket, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OwnerDashboardResponse } from "@/types";

const LINKS: Record<string, string> = {
  branch: "branches",
  drugs: "drugs",
  stock: "inventory",
  sellingPrices: "drugs?quick=noSelling",
  buyingPrices: "drugs?quick=noBuying",
  firstSale: "pos",
  secondUser: "users",
};

type View = "open" | "collapsed" | "dismissed";

function readView(key: string): View {
  try {
    const v = localStorage.getItem(key);
    return v === "collapsed" || v === "dismissed" ? v : "open";
  } catch {
    return "open";
  }
}

/** A checklist for new shops; shown until everything is done, can be folded or hidden on this browser. */
export function SetupChecklist({ setup, pharmacyId }: { setup: OwnerDashboardResponse["setup"]; pharmacyId: string }) {
  const key = `gene:dashboard-setup:${pharmacyId}`;
  const [view, setViewState] = useState<View>(() => readView(key));
  function setView(v: View) {
    setViewState(v);
    try {
      if (v === "open") localStorage.removeItem(key);
      else localStorage.setItem(key, v);
    } catch {
      /* not remembered */
    }
  }

  if (setup.doneCount >= setup.total || view === "dismissed") return null;
  const pct = Math.round((setup.doneCount / Math.max(1, setup.total)) * 100);

  return (
    <Card className="gap-3 border-blue-500/30">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setView(view === "open" ? "collapsed" : "open")} aria-expanded={view === "open"}>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4 text-blue-500" /> Getting started
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", view === "open" && "rotate-180")} />
          </CardTitle>
          <p className="mt-1.5 text-xs text-muted-foreground">{setup.doneCount} of {setup.total} done</p>
          <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </button>
        <Button variant="ghost" size="icon-sm" onClick={() => setView("dismissed")} aria-label="Hide getting started" title="Hide">
          <X />
        </Button>
      </CardHeader>
      {view === "open" && (
        <CardContent className="px-3 sm:px-6">
          <ul className="grid gap-1 sm:grid-cols-2">
            {setup.items.map((item) => (
              <li key={item.key}>
                <Link
                  href={`/${pharmacyId}/${LINKS[item.key] ?? ""}`}
                  className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60", item.done && "text-muted-foreground")}
                >
                  {item.done
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className={cn(item.done && "line-through")}>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
