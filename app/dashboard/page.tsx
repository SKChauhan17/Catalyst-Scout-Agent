'use client';

import { useState, useCallback } from 'react';
import { Search, Zap } from 'lucide-react';
import AgentTerminal, { type AgentStatus } from '@/components/AgentTerminal';
import CandidateCard, { type EvaluatedCandidate } from '@/components/CandidateCard';

const PLACEHOLDER_JD = `We are looking for a Senior Fullstack Engineer to join our core product team.

Requirements:
- 5+ years of experience with React and TypeScript
- Strong proficiency in Node.js and REST API design
- Hands-on experience with Supabase or PostgreSQL
- Experience with vector databases or AI/ML pipelines is a bonus
- Remote-friendly, competitive salary up to $160k`;

export default function DashboardPage() {
  const [rawJD, setRawJD] = useState('');
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<EvaluatedCandidate[]>([]);

  const addLog = (message: string) =>
    setLogs((prev) => [...prev, message]);

  const handleScout = useCallback(async () => {
    if (!rawJD.trim() || status === 'running') return;

    setStatus('running');
    setLogs([]);
    setCandidates([]);

    try {
      const response = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawJD }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`API error: ${response.status}`);
      }

      // Read the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
          }

          if (!dataStr) continue;
          const data = JSON.parse(dataStr);

          if (eventType === 'log') addLog(data.message);
          if (eventType === 'candidate') {
            setCandidates((prev) =>
              // Sort highest final_score first
              [...prev, data as EvaluatedCandidate].sort(
                (a, b) => b.final_score - a.final_score
              )
            );
          }
          if (eventType === 'done') setStatus('done');
          if (eventType === 'error') {
            addLog(`❌ ${data.message}`);
            setStatus('error');
          }
        }
      }

      setStatus('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`❌ ${msg}`);
      setStatus('error');
    }
  }, [rawJD, status]);

  return (
    /* DESIGN.md: bg-[#050507] main viewport, full viewport height */
    <div className="flex flex-col h-screen overflow-hidden bg-[#050507]">
      {/* ── Top Navigation Bar ── */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0 border-b"
        style={{
          backgroundColor: 'rgba(255,255,255,0.01)',
          borderColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,217,146,0.15)', border: '1px solid rgba(0,217,146,0.3)' }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: '#00d992' }} />
          </div>
          {/* DESIGN.md: Geist Sans, aggressive negative letter-spacing */}
          <span
            className="text-[15px] font-[600] tracking-[-0.03em]"
            style={{ fontFamily: 'var(--font-geist-sans)', color: '#f7f8f8' }}
          >
            Catalyst Scout
          </span>
          <span
            className="text-[11px] px-1.5 py-0.5 rounded-full uppercase tracking-[0.08em]"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              backgroundColor: 'rgba(0,217,146,0.1)',
              border: '1px solid rgba(0,217,146,0.2)',
              color: '#00d992',
            }}
          >
            v0.3.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-[12px]"
            style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
          >
            AI Talent Scouting Agent
          </span>
        </div>
      </header>

      {/* ── Main Two-Column Layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Input + Terminal (DESIGN.md: Panel Dark #0f1011, 40%) ── */}
        <aside
          className="w-[420px] shrink-0 flex flex-col border-r overflow-hidden"
          style={{
            backgroundColor: '#0f1011',
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          {/* JD Input Section */}
          <div
            className="p-5 border-b shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <label
              htmlFor="jd-input"
              className="block text-[11px] uppercase tracking-[0.12em] mb-2"
              style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
            >
              Job Description
            </label>

            <textarea
              id="jd-input"
              value={rawJD}
              onChange={(e) => setRawJD(e.target.value)}
              placeholder={PLACEHOLDER_JD}
              rows={10}
              disabled={status === 'running'}
              className="w-full resize-none text-[13px] leading-6 outline-none transition-colors rounded-lg p-3 placeholder:text-[#8b949e]/50 disabled:opacity-60"
              style={{
                fontFamily: 'var(--font-inter)',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#f7f8f8',
              }}
            />

            {/* DESIGN.md: Scout CTA — pill shape, #0f0f0f bg, VoltAgent Mint text, white border */}
            <button
              id="scout-button"
              onClick={handleScout}
              disabled={!rawJD.trim() || status === 'running'}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-[13px] font-[500] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98]"
              style={{
                backgroundColor: '#0f0f0f',
                border: '1px solid #fafafa',
                color: '#2fd6a1',
                fontFamily: 'var(--font-geist-sans)',
              }}
            >
              {status === 'running' ? (
                <>
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: '#2fd6a1', borderTopColor: 'transparent' }}
                  />
                  Scouting...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  Scout Candidates
                </>
              )}
            </button>
          </div>

          {/* Agentic Telemetry Terminal */}
          <div className="flex-1 min-h-0">
            <AgentTerminal logs={logs} status={status} />
          </div>
        </aside>

        {/* ── Right Panel: Results Feed (Abyss Black #050507) ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#050507]">
          {/* Results header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.05)' }}
          >
            {/* DESIGN.md: display heading, Geist Sans, -0.04em tracking */}
            <h1
              className="text-[22px] font-[700] tracking-[-0.04em] leading-none"
              style={{ fontFamily: 'var(--font-geist-sans)', color: '#f7f8f8' }}
            >
              Evaluated Candidates
            </h1>

            {candidates.length > 0 && (
              <span
                className="text-[11px] px-2 py-1 rounded-full uppercase tracking-[0.08em]"
                style={{
                  fontFamily: 'var(--font-geist-mono)',
                  backgroundColor: 'rgba(0,217,146,0.08)',
                  border: '1px solid rgba(0,217,146,0.15)',
                  color: '#00d992',
                }}
              >
                {candidates.length} results
              </span>
            )}
          </div>

          {/* Scrollable candidate feed */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {candidates.length === 0 && status === 'idle' && (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 pb-20">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(0,217,146,0.06)',
                    border: '1px solid rgba(0,217,146,0.15)',
                  }}
                >
                  <Search className="w-7 h-7" style={{ color: '#00d992' }} />
                </div>
                <div>
                  <h2
                    className="text-[18px] font-[600] tracking-[-0.03em] mb-2"
                    style={{ fontFamily: 'var(--font-geist-sans)', color: '#f7f8f8' }}
                  >
                    Ready to Scout
                  </h2>
                  <p className="text-[13px] max-w-sm leading-6" style={{ color: '#8b949e' }}>
                    Paste a job description in the left panel and click{' '}
                    <span style={{ color: '#2fd6a1' }}>Scout Candidates</span> to start the
                    AI pipeline.
                  </p>
                </div>
              </div>
            )}

            {/* Loading skeletons while running but no results yet */}
            {candidates.length === 0 && status === 'running' && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg p-4 animate-pulse"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                      />
                      <div className="space-y-1.5">
                        <div
                          className="h-3.5 w-36 rounded"
                          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                        />
                        <div
                          className="h-2.5 w-24 rounded"
                          style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {[60, 48, 52].map((w) => (
                        <div
                          key={w}
                          className="h-5 rounded-full"
                          style={{
                            width: `${w}px`,
                            backgroundColor: 'rgba(255,255,255,0.04)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Candidate cards — sorted by final_score descending */}
            {candidates.length > 0 && (
              <div className="space-y-3">
                {candidates.map((c, i) => (
                  <CandidateCard key={c.id} candidate={c} rank={i + 1} />
                ))}

                {/* Shimmer for remaining candidates if still running */}
                {status === 'running' && (
                  <div
                    className="rounded-lg p-4 animate-pulse"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full pulse-emerald"
                        style={{ backgroundColor: '#00d992' }}
                      />
                      <span
                        className="text-[12px]"
                        style={{
                          fontFamily: 'var(--font-geist-mono)',
                          color: '#8b949e',
                        }}
                      >
                        Evaluating next candidate...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
