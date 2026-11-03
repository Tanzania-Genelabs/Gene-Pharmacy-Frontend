"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Lock,
  MousePointerClick,
  PartyPopper,
  Rocket,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stepsForRole, type GuideStep, type GuideStepId } from "@/lib/setup-guide";
import { useAuthStore } from "@/store/auth.store";
import { useGuideStore } from "@/store/guide.store";
import { authApi } from "@/api/auth.api";
import { branchApi } from "@/api/branch.api";
import { drugApi } from "@/api/drug.api";
import { inventoryApi } from "@/api/inventory.api";
import { salesApi } from "@/api/sales.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type DoneMap = Record<GuideStepId, boolean>;

/**
 * Works out which steps are already finished from real data (a branch exists, a product exists, ...),
 * so the guide never asks anyone to redo something they have already done - and moves on by itself.
 */
function useGuideProgress(pharmacyId: string, steps: GuideStep[], isSeller: boolean, needBranches: boolean, polling: boolean) {
  const salesVisited = useGuideStore((s) => s.salesVisited);
  const has = (id: GuideStepId) => steps.some((s) => s.id === id);
  /** While the coach card is open, keep checking only the things that are not done yet. */
  const poll = (finished: (data: never) => boolean) => (query: { state: { data: unknown } }) =>
    polling && !finished(query.state.data as never) ? 3000 : false;

  const branches = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
    enabled: has("branch") || needBranches,
    refetchInterval: poll((d: Awaited<ReturnType<typeof branchApi.list>> | undefined) => (d?.length ?? 0) > 0),
  });
  const drugs = useQuery({
    queryKey: ["guide", "drugs", pharmacyId],
    queryFn: () => drugApi.list(pharmacyId, { page: 0, size: 1 }),
    enabled: has("product"),
    refetchInterval: poll((d: Awaited<ReturnType<typeof drugApi.list>> | undefined) => (d?.totalElements ?? 0) > 0),
  });
  const stock = useQuery({
    queryKey: ["guide", "stock", pharmacyId],
    queryFn: () => inventoryApi.list(pharmacyId, { page: 0, size: 100 }),
    enabled: has("stock"),
    refetchInterval: poll((d: Awaited<ReturnType<typeof inventoryApi.list>> | undefined) => d?.content.some((x) => x.quantity > 0) ?? false),
  });
  const sales = useQuery({
    queryKey: ["guide", "sales", pharmacyId],
    queryFn: () => salesApi.list(pharmacyId, { page: 0, size: 1 }),
    enabled: has("sell") && !isSeller,
    refetchInterval: poll((d: Awaited<ReturnType<typeof salesApi.list>> | undefined) => (d?.totalElements ?? 0) > 0),
  });

  const done: DoneMap = {
    branch: (branches.data?.length ?? 0) > 0,
    product: (drugs.data?.totalElements ?? 0) > 0,
    stock: stock.data?.content.some((s) => s.quantity > 0) ?? false,
    // A seller cannot see every sale, so for them opening the till is the lesson.
    sell: isSeller ? salesVisited : (sales.data?.totalElements ?? 0) > 0,
  };
  const loading = branches.isLoading || drugs.isLoading || stock.isLoading || sales.isLoading;
  /** Branches were fetched and there are none: a manager cannot stock or sell anything yet. */
  const noBranches = needBranches && branches.isSuccess && branches.data.length === 0;
  return { done, loading, noBranches };
}

/** Makes the buttons for the current step glow, even when the page draws them a moment later. */
function useGlow(selector: string | null) {
  useEffect(() => {
    if (!selector) return;
    let lit: Element[] = [];
    const apply = () => {
      const found = Array.from(document.querySelectorAll(selector));
      lit.filter((el) => !found.includes(el)).forEach((el) => el.removeAttribute("data-guide-glow"));
      found.forEach((el) => el.setAttribute("data-guide-glow", "true"));
      lit = found;
    };
    apply();
    // childList only: setting our own attribute must not re-trigger the observer.
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      lit.forEach((el) => el.removeAttribute("data-guide-glow"));
    };
  }, [selector]);
}

export function SetupGuide({ pharmacyId }: { pharmacyId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const role = user?.role;
  const isSeller = role === "Seller";
  const isManager = role === "Manager";

  // The server says whether this person is new. A new person is guided and cannot skip; anyone else can only replay.
  const pending = user?.onboardingCompleted === false;
  const phase = useGuideStore((s) => s.phase);
  const replayRequested = useGuideStore((s) => s.replay);
  const replay = replayRequested && !pending;
  const cursor = useGuideStore((s) => s.cursor);
  const minimized = useGuideStore((s) => s.minimized);
  const { setPhase, setCursor, endReplay, markSalesVisited, setLock, setMinimized } = useGuideStore.getState();

  const allSteps = useMemo(() => stepsForRole(role), [role]);
  const progress = useGuideProgress(pharmacyId, allSteps, isSeller, pending && isManager, pending && phase === "coach");
  const { done, loading } = progress;
  // A manager cannot create branches. With none, stocking and selling are impossible, so ask only for what they can do.
  const steps = useMemo(() => (progress.noBranches ? allSteps.filter((s) => s.id === "product") : allSteps), [progress.noBranches, allSteps]);

  const doneCount = steps.filter((s) => done[s.id]).length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  const nextTodo = steps.findIndex((s) => !done[s.id]);
  const index = replay ? Math.min(cursor, steps.length - 1) : Math.min(nextTodo === -1 ? steps.length : nextTodo, steps.length - 1);
  const step = steps[index];

  const onStepPage = !!step && pathname.startsWith(`/${pharmacyId}/${step.path}`);
  const settled = !!user && !loading && steps.length > 0;

  useEffect(() => {
    if (pathname.startsWith(`/${pharmacyId}/sales`)) markSalesVisited();
  }, [pathname, pharmacyId, markSalesVisited]);

  // Someone who got here through the old replay while still being guided: ignore it.
  useEffect(() => {
    if (pending && replayRequested) endReplay();
  }, [pending, replayRequested, endReplay]);

  /** Tells the server this person is done, so they are never forced through it again. */
  async function saveCompleted(): Promise<boolean> {
    try {
      await authApi.completeOnboarding();
      updateUser({ onboardingCompleted: true });
      return true;
    } catch {
      toast.error("Could not save your progress. Check your internet and try again.");
      return false;
    }
  }

  // A new person: welcome them - unless everything is already in place (new staff joining an established pharmacy).
  const silentlySaved = useRef(false);
  useEffect(() => {
    if (!settled || !pending || phase !== "idle") return;
    if (allDone && !isSeller) {
      if (!silentlySaved.current) {
        silentlySaved.current = true;
        void saveCompleted().then((ok) => {
          if (!ok) silentlySaved.current = false;
        });
      }
    } else {
      setPhase("welcome");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, pending, phase, allDone, isSeller, setPhase]);

  // Everything done: celebrate.
  useEffect(() => {
    if (settled && pending && allDone && phase === "coach") setPhase("done");
  }, [settled, pending, allDone, phase, setPhase]);

  // While being guided, the only page that works is the current step's. Everything else bounces back to it.
  const lock = pending && settled && phase !== "done" && !allDone && step ? `/${pharmacyId}/${step.path}` : null;
  useEffect(() => {
    setLock(lock);
    return () => setLock(null);
  }, [lock, setLock]);
  useEffect(() => {
    // The billing page stays reachable: an owner whose subscription ran out has to be able to pay.
    if (lock && !pathname.startsWith(lock) && !pathname.endsWith("/billing")) router.replace(lock);
  }, [lock, pathname, router]);

  // A step just got finished while guiding: say so.
  const finishedBefore = useRef<GuideStepId[] | null>(null);
  useEffect(() => {
    if (!settled) return;
    const now = steps.filter((s) => done[s.id]);
    const before = finishedBefore.current;
    if (before && phase === "coach" && !replay && !allDone) {
      const fresh = now.find((s) => !before.includes(s.id));
      if (fresh) toast.success(fresh.done, { icon: "🎉" });
    }
    finishedBefore.current = now.map((s) => s.id);
  }, [settled, phase, replay, allDone, steps, done]);

  // The sales page has its checkout in the bottom-right corner, right where the card sits: start folded there.
  const stepId = step?.id;
  useEffect(() => {
    if (phase === "coach") setMinimized(stepId === "sell");
  }, [stepId, phase, setMinimized]);

  useGlow(phase === "coach" && onStepPage && step && (replay || !done[step.id]) ? step.target : null);

  if (!user || steps.length === 0) return null;

  const go = (s: GuideStep) => router.push(`/${pharmacyId}/${s.path}`);

  function start() {
    setPhase("coach");
    if (step && !onStepPage) go(step);
  }

  /** "Start working": for a new person the server is told first, so closing the app now does not lose it. */
  async function finish() {
    if (pending && !(await saveCompleted())) return;
    endReplay();
    setPhase("idle");
  }

  return (
    <>
      <GuideDialog
        kind={phase === "welcome" || phase === "done" ? phase : null}
        forced={pending}
        name={user.firstName}
        steps={steps}
        done={done}
        replay={replay}
        onStart={start}
        onCloseWelcome={() => {
          endReplay();
          setPhase("idle");
        }}
        onFinish={() => void finish()}
      />

      {phase === "coach" && step && (
        <CoachCard
          steps={steps}
          done={done}
          index={index}
          step={step}
          replay={replay}
          forced={pending}
          minimized={minimized}
          onToggle={() => setMinimized(!minimized)}
          onStepPage={onStepPage}
          onGo={() => go(step)}
          onClose={() => {
            endReplay();
            setPhase("idle");
          }}
          onPick={(i) => {
            setCursor(i);
            if (!pathname.startsWith(`/${pharmacyId}/${steps[i].path}`)) go(steps[i]);
          }}
          onBack={() => {
            setCursor(index - 1);
            go(steps[index - 1]);
          }}
          onNext={() => {
            if (index + 1 >= steps.length) {
              setPhase("done");
              return;
            }
            setCursor(index + 1);
            go(steps[index + 1]);
          }}
        />
      )}
    </>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Roadmap({
  steps,
  done,
  index,
  replay,
  onPick,
}: {
  steps: GuideStep[];
  done: DoneMap;
  index: number;
  replay: boolean;
  onPick?: (i: number) => void;
}) {
  return (
    <ol className="flex items-center" aria-label="Setup steps">
      {steps.map((s, i) => {
        const isDone = done[s.id];
        const isCurrent = i === index;
        const locked = !replay && !isDone && !isCurrent;
        return (
          <li key={s.id} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <button
              type="button"
              disabled={!replay}
              onClick={() => onPick?.(i)}
              title={s.label}
              aria-label={`${s.label}${isDone ? " (done)" : locked ? " (locked)" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                isDone && "border-[var(--guide-accent)] bg-[var(--guide-accent)] text-white",
                isCurrent && !isDone && "border-[var(--guide-accent)] text-[var(--guide-accent)] guide-node-pulse",
                isCurrent && isDone && "ring-2 ring-[var(--guide-accent)]/40",
                locked && "border-muted bg-muted text-muted-foreground",
                !isDone && !isCurrent && !locked && "border-border text-muted-foreground",
                replay && "cursor-pointer hover:scale-110",
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3 w-3" /> : i + 1}
            </button>
            {i < steps.length - 1 && (
              <span className={cn("mx-1 h-0.5 flex-1 rounded-full", isDone ? "bg-[var(--guide-accent)]" : "bg-muted")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface CoachCardProps {
  steps: GuideStep[];
  done: DoneMap;
  index: number;
  step: GuideStep;
  replay: boolean;
  /** A new person: the guide cannot be hidden and the steps cannot be skipped. */
  forced: boolean;
  minimized: boolean;
  onToggle: () => void;
  onStepPage: boolean;
  onGo: () => void;
  onClose: () => void;
  onPick: (i: number) => void;
  onBack: () => void;
  onNext: () => void;
}

function CoachCard({ steps, done, index, step, replay, forced, minimized, onToggle, onStepPage, onGo, onClose, onPick, onBack, onNext }: CoachCardProps) {
  const stepDone = done[step.id];
  const last = index + 1 >= steps.length;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Show the setup guide"
        className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border bg-card py-2 pl-3 pr-4 shadow-lg animate-in fade-in slide-in-from-bottom-2"
      >
        <Rocket className="h-4 w-4 shrink-0 text-[var(--guide-accent)]" />
        <span className="truncate text-sm font-medium">
          Quest {index + 1} of {steps.length} · {step.title}
        </span>
        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <section
      aria-label="Setup guide"
      className="fixed bottom-4 right-4 z-40 flex max-h-[calc(100vh-2rem)] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-[var(--guide-accent)] transition-[width] duration-700"
          style={{ width: `${(steps.filter((s) => done[s.id]).length / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--guide-accent)]">
              {replay ? "Replay" : "Quest"} {index + 1} of {steps.length}
            </p>
            <h3 className="mt-0.5 text-base font-semibold leading-snug">{step.title}</h3>
          </div>
          <div className="flex shrink-0 items-center">
            <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label="Fold the guide away so you can see the page" title="Fold away">
              <ChevronDown className="h-4 w-4" />
            </Button>
            {!forced && (
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close the setup guide">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {steps.length > 1 && <Roadmap steps={steps} done={done} index={index} replay={replay} onPick={onPick} />}

        <div className="rounded-xl bg-muted/60 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-[var(--guide-accent)]" />
            Why this matters
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.why}</p>
        </div>

        <ol className="space-y-1.5 text-sm">
          {step.how.map((line, i) => (
            <li key={line} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--guide-accent)]/15 text-[11px] font-bold text-[var(--guide-accent)]">
                {i + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>

        {stepDone && !replay ? (
          <p className="flex items-center gap-2 rounded-lg bg-[var(--guide-accent)]/10 p-2.5 text-sm font-medium">
            <Check className="h-4 w-4 text-[var(--guide-accent)]" />
            {step.done}
          </p>
        ) : onStepPage ? (
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--guide-accent)]">
            <MousePointerClick className="h-4 w-4" />
            Look for the glowing {step.id === "sell" ? "branch box" : "button"} on this page.{step.id === "sell" && " Fold this card away (the arrow) to reach the checkout."}
          </p>
        ) : (
          <Button className="w-full" onClick={onGo}>
            Take me there
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {forced && !stepDone && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Finish this quest to unlock the rest of the app.
          </p>
        )}

        {replay && (
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={onBack} disabled={index === 0}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button size="sm" onClick={onNext}>
              {last ? "Finish" : "Next"}
              {!last && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Welcome and "all done" share ONE Radix dialog. Two separate modal dialogs that close and open in the same moment
 * (a seller opens Sales, so the guide jumps from welcome straight to done) leave the new one with pointer-events: none -
 * a card in the middle of the screen where nothing can be clicked.
 */
function GuideDialog({
  kind,
  forced,
  name,
  steps,
  done,
  replay,
  onStart,
  onCloseWelcome,
  onFinish,
}: {
  kind: "welcome" | "done" | null;
  forced: boolean;
  name: string | null;
  steps: GuideStep[];
  done: DoneMap;
  replay: boolean;
  onStart: () => void;
  onCloseWelcome: () => void;
  onFinish: () => void;
}) {
  // Keep showing the last content while the dialog fades out.
  const [lastKind, setLastKind] = useState<"welcome" | "done">("welcome");
  if (kind && kind !== lastKind) setLastKind(kind);
  const shown = kind ?? lastKind;
  const close = shown === "welcome" ? onCloseWelcome : onFinish;

  // Safety net: if Radix ever leaves the page unclickable after the dialog is gone, give the page back.
  useEffect(() => {
    if (kind) return;
    const t = window.setTimeout(() => {
      if (!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
        document.body.style.pointerEvents = "";
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [kind]);

  return (
    <Dialog open={kind !== null} onOpenChange={(o) => !o && !forced && close()}>
      <DialogContent
        className={cn(
          "overflow-hidden",
          shown === "welcome" ? "max-w-md p-0" : "max-w-sm px-6 py-8 text-center",
          forced && "[&>button]:hidden",
        )}
        aria-describedby={shown === "welcome" ? "guide-welcome-desc" : "guide-done-desc"}
        onEscapeKeyDown={(e) => forced && e.preventDefault()}
        onInteractOutside={(e) => forced && e.preventDefault()}
      >
        {shown === "welcome" ? (
          <WelcomeContent forced={forced} name={name} steps={steps} done={done} replay={replay} onStart={onStart} onClose={onCloseWelcome} />
        ) : (
          <DoneContent steps={steps} replay={replay} onClose={onFinish} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WelcomeContent({
  forced,
  name,
  steps,
  done,
  replay,
  onStart,
  onClose,
}: {
  forced: boolean;
  name: string | null;
  steps: GuideStep[];
  done: DoneMap;
  replay: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  const doneCount = steps.filter((s) => done[s.id]).length;
  return (
    <>
        <div className="bg-[var(--guide-accent)] px-6 py-6 text-white">
          <Rocket className="mb-3 h-9 w-9 guide-float" />
          <DialogTitle className="text-xl font-bold">{replay ? "Setup guide" : `Welcome${name ? `, ${name}` : ""}! Let's get your pharmacy ready`}</DialogTitle>
          <DialogDescription id="guide-welcome-desc" className="mt-1 text-sm text-white/85">
            {replay
              ? "A quick refresher of how the app fits together. Go through it any time."
              : `${steps.length === 1 ? "One quick step" : `${steps.length} quick quests`} before you start - each one unlocks the next, and I'll explain why it matters. It takes about 5 minutes.`}
          </DialogDescription>
        </div>

        <ol className="space-y-3 px-6 pt-5">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                  done[s.id] ? "border-[var(--guide-accent)] bg-[var(--guide-accent)] text-white" : "border-border text-muted-foreground",
                )}
              >
                {done[s.id] ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{s.why.split(". ")[0].replace(/\.$/, "")}.</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between gap-2 px-6 pb-6 pt-5">
          {forced ? (
            <span />
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
          <Button onClick={onStart}>
            {replay ? "Start the tour" : doneCount > 0 ? "Continue" : "Let's go"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
    </>
  );
}

const CONFETTI = ["#f59e0b", "#10b981", "#6366f1", "#ef4444", "#06b6d4", "#ec4899"];

function DoneContent({ steps, replay, onClose }: { steps: GuideStep[]; replay: boolean; onClose: () => void }) {
  return (
    <>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden" aria-hidden>
          {Array.from({ length: 22 }, (_, i) => (
            <span
              key={i}
              className="guide-confetti"
              style={{
                left: `${(i * 37) % 100}%`,
                background: CONFETTI[i % CONFETTI.length],
                animationDelay: `${(i % 7) * 0.12}s`,
                animationDuration: `${2.2 + (i % 5) * 0.35}s`,
              }}
            />
          ))}
        </div>
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--guide-accent)] text-white guide-pop">
          {replay ? <PartyPopper className="h-8 w-8" /> : <Trophy className="h-8 w-8" />}
        </div>
        <DialogTitle className="relative text-xl font-bold">{replay ? "That's the whole loop" : "You're all set!"}</DialogTitle>
        <DialogDescription id="guide-done-desc" className="relative mt-1 text-sm">
          {steps.map((s) => s.label.toLowerCase()).join(" → ")}. That is how everything in Gene Pharmacy flows.
        </DialogDescription>
        <p className="relative mt-3 text-xs text-muted-foreground">
          Want to see it again? Open the <span className="font-medium text-foreground">Setup guide</span> from the sidebar or your profile menu.
        </p>
        <Button className="relative mt-5 w-full" onClick={onClose}>
          Start working
        </Button>
    </>
  );
}
