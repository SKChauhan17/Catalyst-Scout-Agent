'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { useScoutStore } from '@/lib/store/useScoutStore';
import CandidateCard from '@/components/CandidateCard';

export default function ResultsFeed() {
  const { results, isScouting } = useScoutStore();

  return (
    <main id="results-feed" className="flex-1 flex flex-col overflow-hidden bg-[#050507] min-h-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <h1
          className="text-[22px] font-[700] tracking-[-0.04em] leading-none"
          style={{ fontFamily: 'var(--font-geist-sans)', color: '#f7f8f8' }}
        >
          Evaluated Candidates
        </h1>

        {results.length > 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[11px] px-2 py-1 rounded-full uppercase tracking-[0.08em]"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              backgroundColor: 'rgba(0,217,146,0.08)',
              border: '1px solid rgba(0,217,146,0.15)',
              color: '#00d992',
            }}
          >
            {results.length} results
          </motion.span>
        )}
      </div>

      {/* Scrollable feed */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Empty idle state */}
        {results.length === 0 && !isScouting && (
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
                Paste a job description and click{' '}
                <span style={{ color: '#2fd6a1' }}>Scout Candidates</span> to start the AI
                pipeline. Results stream in as each candidate is evaluated.
              </p>
            </div>
          </div>
        )}

        {/* Skeleton loaders while running with no results yet */}
        {results.length === 0 && isScouting && (
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
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-36 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                    <div className="h-2.5 w-24 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }} />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {[60, 48, 52].map((w) => (
                    <div key={w} className="h-5 rounded-full" style={{ width: `${w}px`, backgroundColor: 'rgba(255,255,255,0.04)' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Animated candidate cards */}
        <AnimatePresence>
          {results.map((c, i) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: 'easeOut' }}
              className="mb-3"
            >
              <CandidateCard candidate={c} rank={i + 1} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Evaluating shimmer while more candidates are incoming */}
        {results.length > 0 && isScouting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg p-4"
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full pulse-emerald" style={{ backgroundColor: '#00d992' }} />
              <span
                className="text-[12px]"
                style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
              >
                Evaluating next candidate...
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
