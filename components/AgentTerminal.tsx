'use client';

import { useEffect, useRef } from 'react';

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentTerminalProps {
  logs: string[];
  status: AgentStatus;
}

// Maps node names found in log messages to pill badge labels
const NODE_PILLS: Record<string, string> = {
  parseJD: 'JD Parser',
  retrieveMatch: 'Vector Search',
  simulateChat: 'Simulation',
  rankCandidates: 'Ranking',
};

function getNodePill(log: string): string | null {
  for (const [key, label] of Object.entries(NODE_PILLS)) {
    if (log.toLowerCase().includes(key.toLowerCase()) || log.toLowerCase().includes(label.toLowerCase())) {
      return label;
    }
  }
  return null;
}

export default function AgentTerminal({ logs, status }: AgentTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest log line
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    /* DESIGN.md: Carbon Surface (#101010), Geist Mono 13px */
    <div className="flex flex-col h-full min-h-0">
      {/* Terminal header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0"
        style={{
          backgroundColor: '#0a0a0a',
          borderColor: 'rgba(255,255,255,0.05)',
        }}
      >
        {/* Traffic lights */}
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />

        <span
          className="ml-2 text-[11px] uppercase tracking-[0.12em] font-[500]"
          style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
        >
          Agent Execution Log
        </span>

        {/* Live status indicator — DESIGN.md: pulsing emerald pill */}
        <div className="ml-auto flex items-center gap-1.5">
          {status === 'running' && (
            <>
              <span
                className="w-1.5 h-1.5 rounded-full pulse-emerald"
                style={{ backgroundColor: '#00d992' }}
              />
              <span
                className="text-[11px] uppercase tracking-[0.1em]"
                style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}
              >
                Live
              </span>
            </>
          )}
          {status === 'done' && (
            <span
              className="text-[11px] uppercase tracking-[0.1em]"
              style={{ fontFamily: 'var(--font-geist-mono)', color: '#3ecf8e' }}
            >
              ✓ Complete
            </span>
          )}
          {status === 'error' && (
            <span
              className="text-[11px] uppercase tracking-[0.1em] text-red-400"
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              ✗ Error
            </span>
          )}
          {status === 'idle' && (
            <span
              className="text-[11px] uppercase tracking-[0.1em]"
              style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
            >
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
          <p
            className="text-[13px]"
            style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
          >
            <span className="text-[#00d992]">$</span> Awaiting job description...
            <span className="cursor-blink ml-0.5">▌</span>
          </p>
        )}

        {logs.map((log, i) => {
          const pill = getNodePill(log);
          return (
            <div key={i} className="flex items-start gap-2">
              {/* Line number */}
              <span
                className="text-[11px] shrink-0 w-5 text-right select-none mt-px"
                style={{ fontFamily: 'var(--font-geist-mono)', color: 'rgba(255,255,255,0.2)' }}
              >
                {i + 1}
              </span>

              {/* Optional node pill — DESIGN.md: 9999px radius with tinted bg */}
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

              {/* Log text */}
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

        {/* Blinking cursor while running */}
        {status === 'running' && (
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] w-5 text-right select-none"
              style={{ fontFamily: 'var(--font-geist-mono)', color: 'rgba(255,255,255,0.2)' }}
            >
              {logs.length + 1}
            </span>
            <span
              className="text-[13px]"
              style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}
            >
              <span className="cursor-blink">▌</span>
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
