'use client';

import { useState } from 'react';
import { X, Sparkles, MapPin, DollarSign, ChevronRight } from 'lucide-react';
import type { EvaluatedCandidate } from '@/lib/agent/state';

export type { EvaluatedCandidate } from '@/lib/agent/state';

interface CandidateCardProps {
  candidate: EvaluatedCandidate;
  rank: number;
}

function ScorePill({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const normalised = max === 1 ? Math.round(value * 100) : Math.round(value);
  const color =
    normalised >= 80 ? '#00d992' : normalised >= 60 ? '#2fd6a1' : '#8b949e';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-[18px] font-[600] tabular-nums"
        style={{ fontFamily: 'var(--font-geist-mono)', color }}
      >
        {normalised}
      </span>
      <span
        className="text-[10px] uppercase tracking-[0.1em]"
        style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
      >
        {label}
      </span>
    </div>
  );
}

function TranscriptDrawer({
  candidate,
  onClose,
}: {
  candidate: EvaluatedCandidate;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 w-full max-w-lg flex flex-col border-l"
        style={{
          backgroundColor: '#0f1011',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.12em] mb-1"
              style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}
            >
              AI Reasoning Transcript
            </p>
            <h3 className="text-[16px] font-[600] text-[#f7f8f8]">{candidate.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors hover:bg-white/5"
            aria-label="Close transcript"
          >
            <X className="w-4 h-4 text-[#8b949e]" />
          </button>
        </div>

        {/* Score summary row */}
        <div
          className="flex items-center justify-around px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <ScorePill label="Match" value={candidate.match_score} max={1} />
          <div className="w-px h-8" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <ScorePill label="Interest" value={candidate.interest_score} />
          <div className="w-px h-8" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <ScorePill label="Final" value={candidate.final_score} />
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {candidate.chat_transcript.map((turn, i) => (
            <div key={i} className={`flex gap-3 ${turn.role === 'recruiter' ? '' : 'flex-row-reverse'}`}>
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-[600] mt-0.5"
                style={{
                  backgroundColor:
                    turn.role === 'recruiter'
                      ? 'rgba(0,217,146,0.15)'
                      : 'rgba(255,255,255,0.05)',
                  color: turn.role === 'recruiter' ? '#00d992' : '#f7f8f8',
                  border: `1px solid ${turn.role === 'recruiter' ? 'rgba(0,217,146,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {turn.role === 'recruiter' ? 'R' : 'C'}
              </div>

              {/* Bubble */}
              <div
                className="flex-1 px-3 py-2.5 rounded-lg text-[13px] leading-6"
                style={{
                  backgroundColor:
                    turn.role === 'recruiter'
                      ? 'rgba(0,217,146,0.06)'
                      : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${turn.role === 'recruiter' ? 'rgba(0,217,146,0.12)' : 'rgba(255,255,255,0.06)'}`,
                  color: '#f7f8f8',
                  maxWidth: '90%',
                }}
              >
                <p
                  className="text-[10px] uppercase tracking-[0.08em] mb-1.5"
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    color: turn.role === 'recruiter' ? '#00d992' : '#8b949e',
                  }}
                >
                  {turn.role}
                </p>
                {turn.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function CandidateCard({ candidate, rank }: CandidateCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const finalNorm = Math.round(candidate.final_score);
  const isHighRanked = finalNorm >= 80;

  return (
    <>
      {/* DESIGN.md: rgba(255,255,255,0.02) bg, 1px solid rgba(255,255,255,0.08) border, 8px radius */}
      {/* Emerald glow for high-ranked candidates */}
      <div
        className={`relative rounded-lg p-4 transition-all duration-200 hover:bg-white/[0.04] group ${isHighRanked ? 'emerald-glow' : ''}`}
        style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: `1px solid ${isHighRanked ? 'rgba(0,217,146,0.2)' : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        {/* Rank badge */}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="text-[11px] font-[500] w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{
                fontFamily: 'var(--font-geist-mono)',
                backgroundColor: isHighRanked ? 'rgba(0,217,146,0.12)' : 'rgba(255,255,255,0.05)',
                color: isHighRanked ? '#00d992' : '#8b949e',
              }}
            >
              {rank}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-[600] text-[#f7f8f8]">{candidate.name}</h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex min-w-0 items-center gap-1 text-[12px] text-[#8b949e]">
                  <MapPin className="w-3 h-3" />
                  {candidate.location}
                </span>
                <span className="flex min-w-0 items-center gap-1 text-[12px] text-[#8b949e]">
                  <DollarSign className="w-3 h-3" />
                  {candidate.salary_expectation}
                </span>
              </div>
            </div>
          </div>

          {/* Scores — DESIGN.md: Geist Mono data pills */}
          <div className="flex items-center justify-between gap-3 self-stretch sm:w-auto sm:justify-start sm:self-auto sm:shrink-0">
            <ScorePill label="Match" value={candidate.match_score} max={1} />
            <div className="w-px h-7" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <ScorePill label="Interest" value={candidate.interest_score} />
            <div className="w-px h-7" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <ScorePill label="Final" value={candidate.final_score} />
          </div>
        </div>

        {/* Skills chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {candidate.skills.slice(0, 6).map((skill) => (
            <span
              key={skill}
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{
                fontFamily: 'var(--font-geist-mono)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#8b949e',
              }}
            >
              {skill}
            </span>
          ))}
          {candidate.skills.length > 6 && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{
                fontFamily: 'var(--font-geist-mono)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#8b949e',
              }}
            >
              +{candidate.skills.length - 6} more
            </span>
          )}
        </div>

        {/* View AI Reasoning CTA */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 text-[12px] transition-colors group-hover:text-[#00d992]"
          style={{ color: '#8b949e' }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          View AI Reasoning
          <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Transcript Drawer */}
      {drawerOpen && (
        <TranscriptDrawer candidate={candidate} onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}
