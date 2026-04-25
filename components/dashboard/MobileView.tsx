'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, RotateCcw, ChevronDown, Terminal, Users } from 'lucide-react';
import { useScoutStore } from '@/lib/store/useScoutStore';
import AgentTerminal from '@/components/AgentTerminal';
import CandidateCard from '@/components/CandidateCard';
import BYODController from '@/components/dashboard/BYODController';
import { streamScout } from '@/lib/scout/streamScout';

const MAC_LAYOUT_SPRING = {
  type: 'spring',
  stiffness: 280,
  damping: 30,
  mass: 0.95,
} as const;

const MAC_EASE = [0.22, 1, 0.36, 1] as const;

const MAC_REVEAL_TRANSITION = {
  height: MAC_LAYOUT_SPRING,
  opacity: { duration: 0.2, ease: MAC_EASE },
  filter: { duration: 0.24, ease: MAC_EASE },
  scaleY: { duration: 0.24, ease: MAC_EASE },
} as const;

const MOBILE_COLLAPSE_TRANSITION = {
  height: MAC_LAYOUT_SPRING,
  opacity: { duration: 0.08, ease: MAC_EASE },
  filter: { duration: 0.08, ease: MAC_EASE },
  scaleY: { duration: 0.12, ease: MAC_EASE },
} as const;

// ── AI Enhancer (same logic as DashboardSidebar) ──────────────
const ENHANCED_TEMPLATE = (input: string) =>
  `We are looking for a ${input}.

In this role, you will architect and ship full-stack features across our product suite, owning entire feature verticals from database schema design through to polished React interfaces. You will collaborate closely with product and design to translate requirements into reliable, scalable systems. You will be responsible for maintaining a high engineering bar — writing clean, testable code, conducting thorough code reviews, and improving our internal tooling.

We value engineers who move fast without breaking things, communicate async-first, and have strong opinions loosely held. Competitive compensation, remote-first culture, and a team that genuinely cares about craft.`;

async function runEnhancer(
  input: string,
  onChar: (char: string) => void,
  onDone: () => void
) {
  const expanded = ENHANCED_TEMPLATE(input.trim() || 'Senior Engineer');
  for (const char of expanded) {
    await new Promise((r) => setTimeout(r, 8));
    onChar(char);
  }
  onDone();
}

// ── Collapsible section header ────────────────────────────────
function AccordionTab({
  id,
  label,
  icon: Icon,
  badge,
  open,
  onToggle,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      layout
      id={id}
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.03]"
      whileTap={{ scale: 0.985 }}
      transition={MAC_LAYOUT_SPRING}
      style={{
        backgroundColor: '#0a0a0a',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid transparent',
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" style={{ color: '#00d992' }} />
        <span
          className="text-[11px] uppercase tracking-[0.12em] font-[500]"
          style={{ fontFamily: 'var(--font-geist-mono)', color: '#f7f8f8' }}
        >
          {label}
        </span>
        {badge !== undefined && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              backgroundColor: 'rgba(0,217,146,0.1)',
              border: '1px solid rgba(0,217,146,0.2)',
              color: '#00d992',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <motion.div
        animate={{ rotate: open ? 180 : 0 }}
        transition={MAC_LAYOUT_SPRING}
      >
        <ChevronDown className="w-3.5 h-3.5" style={{ color: '#8b949e' }} />
      </motion.div>
    </motion.button>
  );
}

// ── Main mobile layout component ──────────────────────────────
export default function MobileView() {
  const {
    rawJD, setJD, logs, results, customCandidates, isScouting,
    startScout, abortScout, finishScout, addLog, addResult, clearSession,
  } = useScoutStore();

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-expand terminal when scouting starts
  const handleScout = async () => {
    if (!rawJD.trim() || isScouting) return;
    setTerminalOpen(true);  // Auto-open log tab on launch

    const controller = startScout();
    abortRef.current = controller;

    try {
      await streamScout({
        rawJD,
        customCandidates,
        signal: controller.signal,
        onLog: addLog,
        onCandidate: (candidate) => {
          addResult(candidate);
          setCandidatesOpen(true);
        },
        onDone: finishScout,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') addLog(`❌ ${err.message}`);
    } finally {
      finishScout();
    }
  };

  const handleEnhance = async () => {
    if (isEnhancing || isScouting) return;
    setIsEnhancing(true);
    setJD('');
    await runEnhancer(
      rawJD,
      (char) => setJD(useScoutStore.getState().rawJD + char),
      () => setIsEnhancing(false)
    );
  };

  const terminalStatus = isScouting ? 'running' : logs.length > 0 ? 'done' : 'idle';

  return (
    <div className="flex flex-col flex-1 overflow-y-auto bg-[#050507]">

      {/* ── Section 1: JD Input (always visible, never collapsible) ── */}
      <section
        className="shrink-0 p-4"
        style={{ backgroundColor: '#0f1011' }}
      >
        {/* Label row */}
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="jd-input-mobile"
            className="text-[11px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
          >
            Job Description
          </label>
          <button
            onClick={handleEnhance}
            disabled={isEnhancing || isScouting}
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-all disabled:opacity-40"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              backgroundColor: 'rgba(0,217,146,0.08)',
              border: '1px solid rgba(0,217,146,0.2)',
              color: '#00d992',
              boxShadow: isEnhancing ? '0 0 10px rgba(0,217,146,0.3)' : 'none',
            }}
          >
            <Sparkles className="w-3 h-3" />
            {isEnhancing ? 'Writing...' : 'Enhance'}
          </button>
        </div>

        <textarea
          id="jd-input-mobile"
          value={rawJD}
          onChange={(e) => setJD(e.target.value)}
          placeholder="Paste a job description, or type a role and click ✨ Enhance..."
          rows={7}
          disabled={isScouting || isEnhancing}
          className="w-full resize-none text-[13px] leading-6 outline-none transition-colors rounded-lg p-3 placeholder:text-[#8b949e]/40 disabled:opacity-60"
          style={{
            fontFamily: 'var(--font-inter)',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#f7f8f8',
          }}
        />

        <BYODController context="mobile" />

        {/* Scout CTA */}
        <button
          id="mobile-scout-button"
          onClick={isScouting ? abortScout : handleScout}
          disabled={!rawJD.trim() && !isScouting}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-[13px] font-[500] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98]"
          style={{
            backgroundColor: '#0f0f0f',
            border: `1px solid ${isScouting ? 'rgba(255,80,80,0.6)' : '#fafafa'}`,
            color: isScouting ? '#f87171' : '#2fd6a1',
            fontFamily: 'var(--font-geist-sans)',
          }}
        >
          {isScouting ? (
            <>
              <span
                className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                style={{ borderColor: '#f87171', borderTopColor: 'transparent' }}
              />
              Abort Scout
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              Scout Candidates
            </>
          )}
        </button>

        {/* Reset session */}
        <button
          onClick={clearSession}
          disabled={isScouting}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[12px] transition-all hover:bg-white/5 disabled:opacity-30"
          style={{
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#8b949e',
            fontFamily: 'var(--font-geist-mono)',
          }}
        >
          <RotateCcw className="w-3 h-3" />
          Reset Session
        </button>
      </section>

      {/* ── Section 2: Agent Execution Log (collapsible) ── */}
      <motion.section layout transition={MAC_LAYOUT_SPRING} className="shrink-0">
        <AccordionTab
          id="mobile-terminal-tab"
          label="Agent Execution Log"
          icon={Terminal}
          badge={terminalStatus === 'running' ? '●' : logs.length > 0 ? logs.length : undefined}
          open={terminalOpen}
          onToggle={() => setTerminalOpen((o) => !o)}
        />
        <AnimatePresence initial={false}>
          {terminalOpen && (
            <motion.div
              layout
              key="terminal-body"
              initial={{ height: 0, opacity: 0, filter: 'blur(10px)', scaleY: 0.98 }}
              animate={{ height: 288, opacity: 1, filter: 'blur(0px)', scaleY: 1 }}
              exit={{
                height: 0,
                opacity: 0,
                filter: 'blur(4px)',
                scaleY: 0.995,
                transition: MOBILE_COLLAPSE_TRANSITION,
              }}
              transition={MAC_REVEAL_TRANSITION}
              style={{
                overflow: 'hidden',
                transformOrigin: 'top',
                backgroundColor: '#101010',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="h-72">
                <AgentTerminal
                  logs={logs.map((l) => l.message)}
                  status={terminalStatus}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* ── Section 3: Evaluated Candidates (collapsible) ── */}
      <motion.section layout transition={MAC_LAYOUT_SPRING} className="shrink-0">
        <AccordionTab
          id="mobile-candidates-tab"
          label="Evaluated Candidates"
          icon={Users}
          badge={results.length > 0 ? results.length : undefined}
          open={candidatesOpen}
          onToggle={() => setCandidatesOpen((o) => !o)}
        />
        <AnimatePresence initial={false}>
          {candidatesOpen && (
            <motion.div
              layout
              key="candidates-body"
              initial={{ height: 0, opacity: 0, filter: 'blur(10px)', scaleY: 0.98 }}
              animate={{ height: 'auto', opacity: 1, filter: 'blur(0px)', scaleY: 1 }}
              exit={{ height: 0, opacity: 0, filter: 'blur(10px)', scaleY: 0.98 }}
              transition={MAC_REVEAL_TRANSITION}
              style={{ overflow: 'hidden', transformOrigin: 'top' }}
            >
              <div className="p-4 space-y-3" style={{ backgroundColor: '#050507' }}>
                {results.length === 0 && (
                  <p
                    className="text-[13px] text-center py-6"
                    style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
                  >
                    No results yet. Launch Scout to begin.
                  </p>
                )}
                {results.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{
                      y: { ...MAC_LAYOUT_SPRING, delay: i * 0.04 },
                      opacity: { duration: 0.2, ease: MAC_EASE, delay: i * 0.04 },
                      filter: { duration: 0.22, ease: MAC_EASE, delay: i * 0.04 },
                    }}
                  >
                    <CandidateCard candidate={c} rank={i + 1} />
                  </motion.div>
                ))}
                {isScouting && results.length > 0 && (
                  <div
                    className="rounded-lg p-3 flex items-center gap-2"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full pulse-emerald" style={{ backgroundColor: '#00d992' }} />
                    <span
                      className="text-[12px]"
                      style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
                    >
                      Evaluating next candidate...
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

    </div>
  );
}
