import { create } from "zustand";

/**
 * idle    - nothing on screen
 * welcome - the intro dialog with the roadmap
 * coach   - the floating card guiding the current step
 * done    - the celebration dialog
 *
 * Who must do the guide is decided by the server (user.onboardingCompleted), not remembered here.
 * This store only holds what is on screen right now.
 */
export type GuidePhase = "idle" | "welcome" | "coach" | "done";

interface GuideState {
  phase: GuidePhase;
  /** A voluntary walk-through for someone who already finished the guide: no locking, any step, any time. */
  replay: boolean;
  cursor: number;
  /** Sellers cannot see every sale, so for them opening the Sales page counts as the lesson. */
  salesVisited: boolean;
  /** While a new person is being guided, the only page they may use (the sidebar greys out the rest). */
  lock: string | null;
  /** The coach card is folded into a small bar so it does not cover the page (e.g. the checkout). */
  minimized: boolean;

  setPhase: (phase: GuidePhase) => void;
  startReplay: () => void;
  endReplay: () => void;
  setCursor: (cursor: number) => void;
  markSalesVisited: () => void;
  setLock: (lock: string | null) => void;
  setMinimized: (minimized: boolean) => void;
}

export const useGuideStore = create<GuideState>()((set) => ({
  phase: "idle",
  replay: false,
  cursor: 0,
  salesVisited: false,
  lock: null,
  minimized: false,

  setPhase: (phase) => set({ phase }),
  startReplay: () => set({ replay: true, cursor: 0, phase: "welcome" }),
  endReplay: () => set({ replay: false, cursor: 0 }),
  setCursor: (cursor) => set({ cursor }),
  markSalesVisited: () => set({ salesVisited: true }),
  setLock: (lock) => set({ lock }),
  setMinimized: (minimized) => set({ minimized }),
}));
