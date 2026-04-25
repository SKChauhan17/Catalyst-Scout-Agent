'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { EvaluatedCandidate } from '@/lib/agent/state';
import { getBrowserSupabaseClient } from '@/lib/supabase/browser';
import { useScoutStore } from '@/lib/store/useScoutStore';

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentTerminalProps {
  logs: string[];
  status: AgentStatus;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  headerId?: string;
}

interface EvaluationInsertRow {
  candidate_snapshot: EvaluatedCandidate | null;
  job_id: string | null;
}

function isEvaluatedCandidatePayload(value: unknown): value is EvaluatedCandidate {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.match_score === 'number'
    && typeof record.interest_score === 'number'
    && typeof record.final_score === 'number'
    && Array.isArray(record.skills)
    && Array.isArray(record.chat_transcript)
  );
}

function removeChannelIfPresent(
  supabase: ReturnType<typeof getBrowserSupabaseClient>,
  topic: string
) {
  const existingChannels = supabase
    .getChannels()
    .filter((channel) => (channel as RealtimeChannel & { topic?: string }).topic === topic);

  for (const channel of existingChannels) {
    void supabase.removeChannel(channel);
  }
}

const MAC_SPRING = {
  type: 'spring',
  stiffness: 280,
  damping: 30,
  mass: 0.95,
} as const;

const MAC_EASE = [0.22, 1, 0.36, 1] as const;

const BODY_REVEAL_TRANSITION = {
  flexGrow: MAC_SPRING,
  opacity: { duration: 0.16, ease: MAC_EASE },
  y: { duration: 0.18, ease: MAC_EASE },
} as const;

const NODE_PILLS: Record<string, string> = {
  parsejd: 'JD Parser',
  retrievematch: 'Vector Search',
  simulatechat: 'Simulation',
  rankcandidates: 'Ranking',
};

function getNodePill(log: string): string | null {
  const lower = log.toLowerCase();
  for (const [key, label] of Object.entries(NODE_PILLS)) {
    if (lower.includes(key) || lower.includes(label.toLowerCase())) return label;
  }
  return null;
}

/** Serialise session to JSON and trigger a browser download */
function exportSession(
  rawJD: string,
  logs: { message: string; timestamp: number }[],
  results: {
    name: string;
    final_score: number;
    match_score: number;
    interest_score: number;
    chat_transcript: Array<{ role: string; content: string }>;
  }[]
) {
  const payload = {
    exportedAt: new Date().toISOString(),
    jobDescription: rawJD,
    terminalLogs: logs.map((l) => `[${new Date(l.timestamp).toISOString()}] ${l.message}`),
    rankedCandidates: results.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      finalScore: r.final_score,
      matchScore: Math.round(r.match_score * 100),
      interestScore: r.interest_score,
      aiTranscript: r.chat_transcript.map(
        (t) => `${t.role.toUpperCase()}: ${t.content}`
      ),
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `catalyst-scout-session-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgentTerminal({
  logs,
  status,
  collapsible = false,
  collapsed = false,
  onToggleCollapsed,
  headerId,
}: AgentTerminalProps) {
  const {
    rawJD,
    logs: storeLogs,
    results,
    currentJobId,
    addLog,
    addResult,
    finishScout,
    toggleTerminalSize,
    isTerminalExpanded,
  } = useScoutStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [exportFlash, setExportFlash] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!currentJobId) {
      return;
    }

    const supabase = getBrowserSupabaseClient();
    const logsTopic = `realtime:agent-logs:${currentJobId}`;
    const evaluationsTopic = `realtime:evaluations:${currentJobId}`;

    // 1. Initial log recovery (historical logs)
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('logs')
        .select('message')
        .eq('session_id', currentJobId)
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        // Clear existing local logs and replace with history to avoid duplicates
        // In a real app, we'd be more careful with deduplication
        (data as any[]).forEach((row) => addLog(row.message));
      }
    };

    void fetchHistory();

    removeChannelIfPresent(supabase, logsTopic);
    removeChannelIfPresent(supabase, evaluationsTopic);

    const logsChannel = supabase
      .channel(`agent-logs:${currentJobId}`)
      .on('broadcast', { event: 'log' }, ({ payload }) => {
        const message = typeof payload?.message === 'string' ? payload.message : null;
        if (message) {
          addLog(message);
        }
      })
      .on('broadcast', { event: 'result' }, ({ payload }) => {
        if (isEvaluatedCandidatePayload(payload?.candidate)) {
          addResult(payload.candidate);
        }
      })
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        const state = typeof payload?.state === 'string' ? payload.state : '';
        const message = typeof payload?.message === 'string' ? payload.message : undefined;

        if (state === 'error' && message) {
          addLog(`❌ ${message}`);
        }

        if (state === 'done' || state === 'error') {
          finishScout(currentJobId);
        }
      })
      .subscribe();

    const evaluationsChannel = supabase
      .channel(`evaluations:${currentJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'evaluations',
          filter: `job_id=eq.${currentJobId}`,
        },
        (payload: RealtimePostgresInsertPayload<EvaluationInsertRow>) => {
          if (payload.new.candidate_snapshot) {
            addResult(payload.new.candidate_snapshot);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(logsChannel);
      void supabase.removeChannel(evaluationsChannel);
    };
  }, [addLog, addResult, currentJobId, finishScout]);

  // 🔴 Export Session
  function handleRed() {
    exportSession(rawJD, storeLogs, results);
    setExportFlash(true);
    setTimeout(() => setExportFlash(false), 1800);
  }

  // 🟡 Copy all logs to clipboard
  function handleYellow() {
    navigator.clipboard.writeText(logs.join('\n')).then(() => {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1800);
    });
  }

  const canCollapseInline = collapsible && !isTerminalExpanded;
  const isCollapsed = canCollapseInline && collapsed;
  const canToggleFromHeader = canCollapseInline && typeof onToggleCollapsed === 'function';

  // 🟢 Toggle expanded / normal
  function handleGreen() {
    if (canCollapseInline && collapsed && onToggleCollapsed) {
      onToggleCollapsed();
    }
    toggleTerminalSize();
  }

  function handleHeaderClick() {
    if (canToggleFromHeader) onToggleCollapsed?.();
  }

  function handleHeaderKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!canToggleFromHeader || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onToggleCollapsed?.();
  }

  // The actual terminal pane — shared between sidebar and modal
  const terminalPane = (
    <motion.div
      layout
      initial={false}
      transition={MAC_SPRING}
      className={`flex min-h-0 flex-col ${isCollapsed ? '' : 'h-full'}`}
    >
      {/* Header bar */}
      <div
        id={headerId}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
        tabIndex={canToggleFromHeader ? 0 : undefined}
        aria-expanded={canToggleFromHeader ? !collapsed : undefined}
        className={`flex items-center gap-2 px-4 py-2.5 border-b shrink-0 ${canToggleFromHeader ? 'cursor-pointer' : ''}`}
        style={{ backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.05)' }}
      >
        {/* Mac traffic lights — always rendered */}
        <button
          onClick={(event) => {
            event.stopPropagation();
            handleRed();
          }}
          title="Export session as JSON"
          className="w-2.5 h-2.5 rounded-full transition-opacity hover:opacity-70 focus:outline-none"
          style={{ backgroundColor: exportFlash ? '#00d992' : '#ff5f56' }}
        />
        <button
          onClick={(event) => {
            event.stopPropagation();
            handleYellow();
          }}
          title="Copy logs to clipboard"
          className="w-2.5 h-2.5 rounded-full transition-opacity hover:opacity-70 focus:outline-none"
          style={{ backgroundColor: '#ffbd2e' }}
        />
        <button
          onClick={(event) => {
            event.stopPropagation();
            handleGreen();
          }}
          title={isTerminalExpanded ? 'Restore terminal' : 'Expand to full screen'}
          className="w-2.5 h-2.5 rounded-full transition-opacity hover:opacity-70 focus:outline-none"
          style={{ backgroundColor: '#27c93f' }}
        />

        <span
          className="ml-2 text-[11px] uppercase tracking-[0.12em] font-[500]"
          style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
        >
          Agent Execution Log
        </span>

        {/* Status flashes */}
        <AnimatePresence mode="wait">
          {exportFlash && (
            <motion.span
              key="export"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-[10px] ml-1"
              style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}
            >
              Exported!
            </motion.span>
          )}
          {copyState === 'copied' && !exportFlash && (
            <motion.span
              key="copy"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-[10px] ml-1"
              style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}
            >
              Copied!
            </motion.span>
          )}
        </AnimatePresence>

        {/* Live status indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          {status === 'running' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full pulse-emerald" style={{ backgroundColor: '#00d992' }} />
              <span className="text-[11px] uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}>
                Live
              </span>
            </>
          )}
          {status === 'done' && (
            <span className="text-[11px] uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-geist-mono)', color: '#3ecf8e' }}>
              ✓ Complete
            </span>
          )}
          {status === 'error' && (
            <span className="text-[11px] uppercase tracking-[0.1em] text-red-400" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              ✗ Error
            </span>
          )}
          {status === 'idle' && (
            <span className="text-[11px] uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}>
              Standby
            </span>
          )}

          {canToggleFromHeader && (
            <motion.button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapsed();
              }}
              title={collapsed ? 'Show execution log' : 'Collapse execution log'}
              className="ml-1 rounded-md p-1 transition-colors hover:bg-white/5"
              aria-label={collapsed ? 'Show execution log' : 'Collapse execution log'}
              whileTap={{ scale: 0.92 }}
            >
              <motion.div
                animate={{ rotate: collapsed ? 180 : 0 }}
                transition={MAC_SPRING}
              >
                <ChevronDown className="h-3.5 w-3.5" style={{ color: '#8b949e' }} />
              </motion.div>
            </motion.button>
          )}
        </div>
      </div>

      {/* Log body */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="terminal-log-body"
            initial={{ flexGrow: 0, flexBasis: 0, opacity: 0, y: -6 }}
            animate={{ flexGrow: 1, flexBasis: 0, opacity: 1, y: 0 }}
            exit={{ flexGrow: 0, flexBasis: 0, opacity: 0, y: -6 }}
            transition={BODY_REVEAL_TRANSITION}
            className="min-h-0 overflow-hidden"
            style={{ transformOrigin: 'top', willChange: 'opacity, transform' }}
          >
            <div
              className="h-full overflow-y-auto p-4 space-y-1.5 inset-panel"
              style={{ backgroundColor: '#101010' }}
            >
              {logs.length === 0 && status === 'idle' && (
                <p className="text-[13px]" style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}>
                  <span style={{ color: '#00d992' }}>$</span> Awaiting job description...
                  <span className="cursor-blink ml-0.5">▌</span>
                </p>
              )}

              {logs.map((log, i) => {
                const pill = getNodePill(log);
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className="text-[11px] shrink-0 w-5 text-right select-none mt-px"
                      style={{ fontFamily: 'var(--font-geist-mono)', color: 'rgba(255,255,255,0.2)' }}
                    >
                      {i + 1}
                    </span>
                    {pill && (
                      <span
                        className="shrink-0 text-[10px] font-[500] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full mt-px"
                        style={{
                          fontFamily: 'var(--font-geist-mono)',
                          backgroundColor: 'rgba(0,217,146,0.1)',
                          color: '#00d992',
                          border: '1px solid rgba(0,217,146,0.2)',
                        }}
                      >
                        {pill}
                      </span>
                    )}
                    <span
                      className="text-[13px] leading-5 break-all"
                      style={{
                        fontFamily: 'var(--font-geist-mono)',
                        color: log.includes('✓') ? '#00d992' : log.includes('❌') || log.includes('[FALLBACK]') ? '#f87171' : '#f7f8f8',
                      }}
                    >
                      {log}
                    </span>
                  </div>
                );
              })}

              {status === 'running' && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] w-5 text-right select-none" style={{ fontFamily: 'var(--font-geist-mono)', color: 'rgba(255,255,255,0.2)' }}>
                    {logs.length + 1}
                  </span>
                  <span className="text-[13px]" style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}>
                    <span className="cursor-blink">▌</span>
                  </span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  // Expanded full-screen modal with click-outside-to-close backdrop
  if (isTerminalExpanded) {
    const expandedTerminal = (
      <AnimatePresence>
        <motion.div
          key="terminal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 md:p-12"
          style={{ backdropFilter: 'blur(20px)', backgroundColor: 'rgba(5,5,7,0.85)' }}
          // Click on backdrop → minimize
          onClick={toggleTerminalSize}
        >
          <motion.div
            key="terminal-panel"
            layout
            layoutId="terminal"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{
              layout: MAC_SPRING,
              scale: MAC_SPRING,
              opacity: { duration: 0.22, ease: MAC_EASE },
            }}
            className="w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden rounded-xl border"
            style={{ borderColor: 'rgba(0,217,146,0.2)', boxShadow: '0 0 60px rgba(0,217,146,0.06)' }}
            // Stop click propagation so clicking inside the panel doesn't close it
            onClick={(e) => e.stopPropagation()}
          >
            {terminalPane}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );

    return typeof document === 'undefined'
      ? null
      : createPortal(expandedTerminal, document.body);
  }

  return (
    <div
      id="agent-terminal"
      className={`flex flex-col ${isCollapsed ? '' : 'h-full min-h-0'}`}
    >
      {terminalPane}
    </div>
  );
}
