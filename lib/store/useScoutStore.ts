import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EvaluatedCandidate } from '@/components/CandidateCard';
import type { CustomCandidate } from '@/lib/agent/state';

// ============================================================
// Types
// ============================================================
export interface LogEntry {
  id: string;
  message: string;
  timestamp: number;
}

interface ScoutStore {
  // ── State ──────────────────────────────────────────────────
  rawJD: string;
  logs: LogEntry[];
  results: EvaluatedCandidate[];
  customCandidates: CustomCandidate[];
  isScouting: boolean;
  isTerminalExpanded: boolean;
  abortController: AbortController | null;

  // ── Actions ────────────────────────────────────────────────
  setJD: (jd: string) => void;
  addLog: (message: string) => void;
  addResult: (candidate: EvaluatedCandidate) => void;
  addCustomCandidate: (candidate: CustomCandidate) => void;
  addCustomCandidates: (candidates: CustomCandidate[]) => void;
  clearSession: () => void;
  startScout: () => AbortController;
  abortScout: () => void;
  finishScout: () => void;
  toggleTerminalSize: () => void;
}

export const useScoutStore = create<ScoutStore>()(
  persist(
    (set, get) => ({
      // ── Initial State ────────────────────────────────────────
      rawJD: '',
      logs: [],
      results: [],
      customCandidates: [],
      isScouting: false,
      isTerminalExpanded: false,
      abortController: null,

      // ── Action Implementations ───────────────────────────────
      setJD: (jd) => set({ rawJD: jd }),

      addLog: (message) =>
        set((state) => ({
          logs: [
            ...state.logs,
            { id: `${Date.now()}-${Math.random()}`, message, timestamp: Date.now() },
          ],
        })),

      addResult: (candidate) =>
        set((state) => ({
          results: [...state.results, candidate].sort(
            (a, b) => b.final_score - a.final_score
          ),
        })),

      addCustomCandidate: (candidate) =>
        set((state) => ({
          customCandidates: [...state.customCandidates, candidate],
        })),

      addCustomCandidates: (candidates) =>
        set((state) => ({
          customCandidates: [...state.customCandidates, ...candidates],
        })),

      // Wipes entire session — JD, logs, results
      clearSession: () =>
        set({
          rawJD: '',
          logs: [],
          results: [],
          customCandidates: [],
          isScouting: false,
          abortController: null,
        }),

      // Creates and stores an AbortController for the active SSE stream
      startScout: () => {
        const controller = new AbortController();
        set({ isScouting: true, logs: [], results: [], abortController: controller });
        return controller;
      },

      // Fires abort on the active stream and resets isScouting
      abortScout: () => {
        const { abortController } = get();
        abortController?.abort();
        set({ isScouting: false, abortController: null });
      },

      finishScout: () => set({ isScouting: false, abortController: null }),

      toggleTerminalSize: () =>
        set((state) => ({ isTerminalExpanded: !state.isTerminalExpanded })),
    }),
    {
      name: 'catalyst-scout-session',
      storage: createJSONStorage(() => sessionStorage),
      // isTerminalExpanded intentionally excluded — always resets to false on refresh
      partialize: (state) => ({
        rawJD: state.rawJD,
        logs: state.logs,
        results: state.results,
        customCandidates: state.customCandidates,
      }),
    }
  )
);
