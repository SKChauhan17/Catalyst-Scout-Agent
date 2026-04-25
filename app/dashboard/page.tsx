import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import ResultsFeed from '@/components/dashboard/ResultsFeed';
import ProductTour from '@/components/ProductTour';
import { Zap } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen overflow-x-hidden bg-[#050507]">
      {/* Top Navigation */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0 border-b"
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
            v0.4.0
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-[12px]"
            style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
          >
            Mission Control
          </span>
          {/* Product tour trigger (client component) */}
          <ProductTour />
        </div>
      </header>

      {/* Responsive layout: stacked on mobile, two-column on desktop */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <DashboardSidebar />
        <ResultsFeed />
      </div>
    </div>
  );
}
