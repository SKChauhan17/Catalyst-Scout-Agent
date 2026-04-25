'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, RotateCcw } from 'lucide-react';
import { useScoutStore } from '@/lib/store/useScoutStore';
import AgentTerminal from '@/components/AgentTerminal';
import BYODController from '@/components/dashboard/BYODController';
import { streamScout } from '@/lib/scout/streamScout';

const MAC_LAYOUT_SPRING = {
  type: 'spring',
  stiffness: 280,
  damping: 30,
  mass: 0.95,
} as const;

// ── AI Enhancer: typing-effect JD expansion ───────────────────
const ENHANCED_TEMPLATE = (input: string) => `We are looking for a ${input}.

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

// ─────────────────────────────────────────────────────────────
export default function DashboardSidebar() {
  const { rawJD, setJD, logs, customCandidates, isScouting, startScout, abortScout, finishScout, addLog, addResult, clearSession } =
    useScoutStore();
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // ── Scout handler ──────────────────────────────────────────
  async function handleScout() {
    if (!rawJD.trim() || isScouting) return;
    setTerminalCollapsed(false);

    const controller = startScout();
    abortRef.current = controller;

    try {
      await streamScout({
        rawJD,
        customCandidates,
        signal: controller.signal,
        onLog: addLog,
        onCandidate: addResult,
        onDone: finishScout,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        addLog(`❌ ${err.message}`);
      }
    } finally {
      finishScout();
    }
  }

  // ── AI Enhancer ────────────────────────────────────────────
  async function handleEnhance() {
    if (isEnhancing || isScouting) return;
    setIsEnhancing(true);
    setJD('');
    await runEnhancer(
      rawJD,
      (char) => setJD(useScoutStore.getState().rawJD + char),
      () => setIsEnhancing(false)
    );
  }

  return (
    <motion.aside
      layout
      className="w-full lg:w-[420px] shrink-0 min-h-0 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r"
      style={{ backgroundColor: '#0f1011', borderColor: 'rgba(255,255,255,0.05)' }}
      transition={MAC_LAYOUT_SPRING}
    >
      {/* JD Input Section */}
      <motion.div
        layout
        transition={MAC_LAYOUT_SPRING}
        className={`overflow-y-auto border-b p-5 ${terminalCollapsed ? 'min-h-0 flex-1' : 'shrink-0'}`}
        style={{
          borderColor: 'rgba(255,255,255,0.05)',
          height: terminalCollapsed ? undefined : 'min(34rem, 58vh)',
          willChange: 'height',
        }}
      >
        {/* Label row */}
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="desktop-jd-input"
            className="text-[11px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
          >
            Job Description
          </label>

          {/* ✨ Enhance button */}
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
          id="desktop-jd-input"
          value={rawJD}
          onChange={(e) => setJD(e.target.value)}
          placeholder="Paste a job description, or type a role and click ✨ Enhance..."
          rows={10}
          disabled={isScouting || isEnhancing}
          className="w-full resize-none text-[13px] leading-6 outline-none transition-colors rounded-lg p-3 placeholder:text-[#8b949e]/40 disabled:opacity-60"
          style={{
            fontFamily: 'var(--font-inter)',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#f7f8f8',
          }}
        />

        <BYODController context="desktop" />

        {/* Scout CTA */}
        <button
          id="desktop-scout-button"
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
      </motion.div>

      {/* Agent Terminal */}
      <motion.div
        layout
        transition={MAC_LAYOUT_SPRING}
        className={`overflow-hidden ${terminalCollapsed ? 'shrink-0' : 'min-h-0 flex-1'}`}
      >
        <AgentTerminal
          headerId="desktop-terminal-toggle"
          collapsible
          collapsed={terminalCollapsed}
          onToggleCollapsed={() => setTerminalCollapsed((current) => !current)}
          logs={logs.map((l) => l.message)}
          status={
            isScouting ? 'running' : logs.length > 0 ? 'done' : 'idle'
          }
        />
      </motion.div>
    </motion.aside>
  );
}
