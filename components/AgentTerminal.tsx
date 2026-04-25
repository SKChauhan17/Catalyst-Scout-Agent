'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScoutStore } from '@/lib/store/useScoutStore';

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentTerminalProps {
  logs: string[];
  status: AgentStatus;
}

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

export default function AgentTerminal({ logs, status }: AgentTerminalProps) {
  const { isScouting, abortScout, clearSession, toggleTerminalSize, isTerminalExpanded } =
    useScoutStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 🔴 Red: abort if scouting, else clear logs
  function handleRed() {
    if (isScouting) {
      abortScout();
    } else {
      clearSession();
    }
  }

  // 🟡 Yellow: copy all logs to clipboard
  function handleYellow() {
    const text = logs.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1800);
    });
  }

  // 🟢 Green: toggle expanded / normal
  function handleGreen() {
    toggleTerminalSize();
  }

  const terminalContent = (
    <motion.div
      layout
      layoutId="terminal"
      className="flex flex-col h-full"
      style={{
        backgroundColor: isTerminalExpanded ? 'rgba(5,5,7,0.97)' : undefined,
        borderRadius: isTerminalExpanded ? '12px' : undefined,
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0"
        style={{ backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.05)' }}
      >
        {/* Mac traffic lights */}
        <button
          onClick={handleRed}
          title={isScouting ? 'Abort scout' : 'Clear logs'}
          className="w-2.5 h-2.5 rounded-full transition-opacity hover:opacity-70 focus:outline-none"
          style={{ backgroundColor: '#ff5f56' }}
        />
        <button
          onClick={handleYellow}
          title="Copy logs to clipboard"
          className="w-2.5 h-2.5 rounded-full transition-opacity hover:opacity-70 focus:outline-none"
          style={{ backgroundColor: '#ffbd2e' }}
        />
        <button
          onClick={handleGreen}
          title={isTerminalExpanded ? 'Restore terminal' : 'Expand terminal'}
          className="w-2.5 h-2.5 rounded-full transition-opacity hover:opacity-70 focus:outline-none"
          style={{ backgroundColor: '#27c93f' }}
        />

        <span
          className="ml-2 text-[11px] uppercase tracking-[0.12em] font-[500]"
          style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
        >
          Agent Execution Log
        </span>

        {/* Copy flash */}
        <AnimatePresence>
          {copyState === 'copied' && (
            <motion.span
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

        {/* Live status */}
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
        </div>
      </div>

      {/* Log body */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-1.5 inset-panel"
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
                  color: log.includes('✓') ? '#00d992' : log.includes('❌') ? '#f87171' : '#f7f8f8',
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
  );

  // Expanded full-screen modal
  if (isTerminalExpanded) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ backdropFilter: 'blur(20px)', backgroundColor: 'rgba(5,5,7,0.85)' }}
        >
          <motion.div
            layout
            layoutId="terminal"
            className="w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden rounded-xl border"
            style={{ borderColor: 'rgba(0,217,146,0.2)', boxShadow: '0 0 60px rgba(0,217,146,0.06)' }}
          >
            {terminalContent}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return <div className="flex flex-col h-full min-h-0">{terminalContent}</div>;
}
