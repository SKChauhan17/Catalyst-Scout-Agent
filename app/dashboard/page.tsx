import Link from 'next/link';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import ResultsFeed from '@/components/dashboard/ResultsFeed';
import MobileView from '@/components/dashboard/MobileView';
import ProductTour from '@/components/ProductTour';
import { Zap, ChevronLeft } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen overflow-x-hidden bg-[#050507]">

      {/* ── Top Navigation (always visible) ── */}
      <header
        className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0 border-b"
        style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,217,146,0.15)', border: '1px solid rgba(0,217,146,0.3)' }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: '#00d992' }} />
          </div>
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
            v0.6.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-md transition-colors hover:bg-white/5"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              color: '#8b949e',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <ChevronLeft className="w-3 h-3" />
            Home
          </Link>
          <span
            className="text-[12px] hidden sm:block"
            style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
          >
            Mission Control
          </span>
          <ProductTour />
        </div>
      </header>

      {/* ── Mobile layout: accordion stack (< lg) ── */}
      <div className="flex flex-1 overflow-hidden lg:hidden">
        <MobileView />
      </div>

      {/* ── Desktop layout: two-column (lg+) ── */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <DashboardSidebar />
        <ResultsFeed />
      </div>

    </div>
  );
}
