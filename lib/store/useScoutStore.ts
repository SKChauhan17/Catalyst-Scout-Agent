import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CustomCandidate, EvaluatedCandidate } from '@/lib/agent/state';

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
  isScoutLaunchLocked: boolean;
  isTerminalExpanded: boolean;
  currentJobId: string | null;

  // ── Actions ────────────────────────────────────────────────
  setJD: (jd: string) => void;
  addLog: (message: string) => void;
  addResult: (candidate: EvaluatedCandidate) => void;
  addCustomCandidate: (candidate: CustomCandidate) => void;
  addCustomCandidates: (candidates: CustomCandidate[]) => void;
  clearSession: () => void;
  tryLockScoutLaunch: () => boolean;
  releaseScoutLaunchLock: () => void;
  startScout: () => void;
  attachScoutJob: (jobId: string) => void;
  resolveScoutLaunchFailure: (message: string, status?: number) => void;
  abortScout: () => void;
  finishScout: (jobId?: string) => void;
  toggleTerminalSize: () => void;
}

export const useScoutStore = create<ScoutStore>()(
  persist(
    (set) => ({
      // ── Initial State ────────────────────────────────────────
      rawJD: '',
      logs: [],
      results: [],
      customCandidates: [],
      isScouting: false,
      isScoutLaunchLocked: false,
      isTerminalExpanded: false,
      currentJobId: null,

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
          results: [
            ...state.results.filter((existing) => existing.id !== candidate.id),
            candidate,
          ].sort(
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
          currentJobId: null,
        }),

      tryLockScoutLaunch: () => {
        let didLock = false;

        set((state) => {
          if (state.isScoutLaunchLocked) {
            return state;
          }

          didLock = true;
          return { isScoutLaunchLocked: true };
        });

        return didLock;
      },

      releaseScoutLaunchLock: () => set({ isScoutLaunchLocked: false }),

      startScout: () => {
        set({
          isScouting: true,
          logs: [],
          results: [],
          currentJobId: null,
        });
      },

      attachScoutJob: (jobId) =>
        set((state) => ({
          currentJobId: jobId,
          logs: [
            ...state.logs,
            {
              id: `${Date.now()}-${Math.random()}`,
              message: `📨 Worker job queued (${jobId.slice(0, 8)}...). Waiting for realtime updates...`,
              timestamp: Date.now(),
            },
          ],
        })),

      resolveScoutLaunchFailure: (message, status) =>
        set((state) => {
          const nextLogs: LogEntry[] = [
            ...state.logs,
            {
              id: `${Date.now()}-${Math.random()}`,
              message,
              timestamp: Date.now(),
            },
          ];

          if (status === 429 && state.currentJobId) {
            return {
              isScouting: true,
              logs: [
                ...nextLogs,
                {
                  id: `${Date.now()}-${Math.random()}`,
                  message: 'ℹ️ Rate limit hit on a duplicate launch request. Continuing live updates for the active scout job.',
                  timestamp: Date.now(),
                },
              ],
            };
          }

          return {
            isScouting: false,
            currentJobId: null,
            logs: nextLogs,
          };
        }),

      abortScout: () => {
        set((state) => ({
          isScouting: false,
          isScoutLaunchLocked: false,
          currentJobId: null,
          logs: [
            ...state.logs,
            {
              id: `${Date.now()}-${Math.random()}`,
              message: '⏹ Live updates disconnected. The background worker may still be processing this scout job.',
              timestamp: Date.now(),
            },
          ],
        }));
      },

      finishScout: (jobId) =>
        set((state) => {
          if (jobId && state.currentJobId && state.currentJobId !== jobId) {
            return state;
          }

          return {
            isScouting: false,
            isScoutLaunchLocked: false,
            currentJobId: null,
          };
        }),

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
