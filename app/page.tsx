import Link from 'next/link';
import { Zap, ArrowRight, Cpu, Search, BarChart3, Shield } from 'lucide-react';

const FEATURES = [
  {
    icon: Search,
    title: 'Semantic Vector Search',
    desc: 'pgvector cosine similarity retrieves the top candidates from your talent pool in milliseconds.',
  },
  {
    icon: Cpu,
    title: 'Simulated Interviews',
    desc: 'Groq-powered 3-turn conversation simulates a real recruiter/candidate interaction at sub-second latency.',
  },
  {
    icon: BarChart3,
    title: 'Dual Scoring Matrix',
    desc: 'Match Score + Interest Score combined into a final ranking: (match × 0.6) + (interest × 0.4).',
  },
  {
    icon: Shield,
    title: '5-Tier LLM Fallback',
    desc: 'SambaNova → OpenRouter → Groq → Cerebras → Gemini. Zero intelligence downtime on rate limits.',
  },
];

export default function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#050507', color: '#f7f8f8' }}
    >
      {/* ── Nav ── */}
      <nav
        className="flex items-center justify-between px-8 py-4 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(0,217,146,0.15)',
              border: '1px solid rgba(0,217,146,0.3)',
            }}
          >
            <Zap className="w-4 h-4" style={{ color: '#00d992' }} />
          </div>
          <span
            className="text-[16px] font-[700] tracking-[-0.04em]"
            style={{ fontFamily: 'var(--font-geist-sans)' }}
          >
            Catalyst Scout
          </span>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-[13px] px-4 py-1.5 rounded-full transition-all hover:brightness-110"
          style={{
            backgroundColor: '#0f0f0f',
            border: '1px solid #fafafa',
            color: '#2fd6a1',
            fontFamily: 'var(--font-geist-sans)',
          }}
        >
          Dashboard <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-8 text-[11px] uppercase tracking-[0.12em]"
          style={{
            fontFamily: 'var(--font-geist-mono)',
            backgroundColor: 'rgba(0,217,146,0.08)',
            border: '1px solid rgba(0,217,146,0.2)',
            color: '#00d992',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full pulse-emerald" style={{ backgroundColor: '#00d992' }} />
          Powered by LangGraph + Groq + Supabase pgvector
        </div>

        {/* Hero heading — DESIGN.md: Geist Sans, aggressive negative tracking */}
        <h1
          className="text-[56px] md:text-[72px] font-[700] leading-none mb-6 max-w-4xl"
          style={{
            fontFamily: 'var(--font-geist-sans)',
            letterSpacing: '-2.88px',
            color: '#f7f8f8',
          }}
        >
          Find your next{' '}
          <span
            style={{
              color: '#00d992',
              textShadow: '0 0 40px rgba(0,217,146,0.35)',
            }}
          >
            10x engineer
          </span>
          <br />
          in seconds, not weeks.
        </h1>

        <p
          className="text-[16px] leading-7 max-w-xl mb-10"
          style={{ color: '#8b949e', fontFamily: 'var(--font-inter)' }}
        >
          Paste a job description. Our AI agent parses requirements, runs hybrid
          vector search over your candidate pool, simulates real interviews, and
          delivers a ranked shortlist — all in under 30 seconds.
        </p>

        {/* Primary CTA — DESIGN.md: pill, Abyss bg, white border, VoltAgent Mint text */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-8 py-3.5 rounded-full text-[15px] font-[500] transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              backgroundColor: '#0f0f0f',
              border: '1px solid #fafafa',
              color: '#2fd6a1',
              fontFamily: 'var(--font-geist-sans)',
              boxShadow: '0 0 30px rgba(0,217,146,0.15)',
            }}
          >
            <Zap className="w-4 h-4" />
            Enter Mission Control
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="https://github.com/SKChauhan17/Catalyst-Scout-Agent"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3.5 rounded-full text-[13px] transition-all hover:bg-white/5"
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#8b949e',
              fontFamily: 'var(--font-geist-sans)',
            }}
          >
            View Source
          </a>
        </div>

        {/* Social proof metrics */}
        <div
          className="flex items-center gap-8 mt-16 pt-8 border-t w-full max-w-lg"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {[
            { value: '100', label: 'Candidate profiles seeded' },
            { value: '5-tier', label: 'LLM fallback chain' },
            { value: '<30s', label: 'End-to-end evaluation' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 flex-1">
              <span
                className="text-[22px] font-[700] tracking-[-0.04em]"
                style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}
              >
                {stat.value}
              </span>
              <span
                className="text-[11px] text-center"
                style={{ color: '#8b949e', fontFamily: 'var(--font-inter)' }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section
        className="px-8 py-16 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="max-w-5xl mx-auto">
          <p
            className="text-[11px] uppercase tracking-[0.15em] text-center mb-10"
            style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
          >
            How it works
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-5 rounded-lg transition-all hover:bg-white/[0.03]"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: 'rgba(0,217,146,0.1)',
                    border: '1px solid rgba(0,217,146,0.2)',
                  }}
                >
                  <f.icon className="w-4 h-4" style={{ color: '#00d992' }} />
                </div>
                <h3
                  className="text-[13px] font-[600] mb-2"
                  style={{ fontFamily: 'var(--font-geist-sans)', color: '#f7f8f8' }}
                >
                  {f.title}
                </h3>
                <p
                  className="text-[12px] leading-5"
                  style={{ color: '#8b949e', fontFamily: 'var(--font-inter)' }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="px-8 py-5 border-t flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <span
          className="text-[12px]"
          style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
        >
          Catalyst Scout · Built for Deccan AI Hackathon 2026
        </span>
        <span
          className="text-[12px]"
          style={{ fontFamily: 'var(--font-geist-mono)', color: 'rgba(255,255,255,0.2)' }}
        >
          v0.4.0
        </span>
      </footer>
    </div>
  );
}
