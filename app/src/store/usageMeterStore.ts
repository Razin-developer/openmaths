import { create } from "zustand";

/** A version counter, not the data itself — `UsageMeter.tsx` owns fetching/caching the actual
 * budget status. Any code that just completed a generation calls `bump()` so the meter refetches
 * immediately instead of waiting for its next poll tick (PRD "User System — Usage Metering &
 * Notifications" §4.4's "near-real-time visibility"). */
interface UsageMeterStore {
  version: number;
  bump: () => void;
}

export const useUsageMeterStore = create<UsageMeterStore>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
