'use client';

import { useEffect } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Info } from 'lucide-react';

type PopoverSide = NonNullable<DriveStep['popover']>['side'];
type PopoverAlign = NonNullable<DriveStep['popover']>['align'];

export default function ProductTour() {
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .driver-popover {
        background: #0f1011 !important;
        border: 1px solid rgba(0,217,146,0.25) !important;
        border-radius: 10px !important;
        color: #f7f8f8 !important;
        box-shadow: 0 0 24px rgba(0,217,146,0.08) !important;
        font-family: var(--font-inter), system-ui, sans-serif !important;
      }
      .driver-popover-title {
        color: #00d992 !important;
        font-family: var(--font-geist-mono), monospace !important;
        font-size: 12px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.1em !important;
        margin-bottom: 6px !important;
      }
      .driver-popover-description {
        color: #8b949e !important;
        font-size: 13px !important;
        line-height: 1.6 !important;
      }
      .driver-popover-next-btn, .driver-popover-done-btn {
        background: #0f0f0f !important;
        border: 1px solid #fafafa !important;
        color: #2fd6a1 !important;
        border-radius: 9999px !important;
        font-size: 12px !important;
        padding: 4px 14px !important;
      }
      .driver-popover-prev-btn {
        background: transparent !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        color: #8b949e !important;
        border-radius: 9999px !important;
        font-size: 12px !important;
      }
      .driver-popover-arrow-side-left.driver-popover-arrow  { border-right-color:  rgba(0,217,146,0.2) !important; }
      .driver-popover-arrow-side-right.driver-popover-arrow { border-left-color:   rgba(0,217,146,0.2) !important; }
      .driver-popover-arrow-side-top.driver-popover-arrow   { border-bottom-color: rgba(0,217,146,0.2) !important; }
      .driver-popover-arrow-side-bottom.driver-popover-arrow{ border-top-color:    rgba(0,217,146,0.2) !important; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  function startTour() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const controlSide: PopoverSide = isMobile ? 'bottom' : 'right';
    const resultsSide: PopoverSide = isMobile ? 'top' : 'left';
    const startAlign: PopoverAlign = 'start';
    const selectors = isMobile
      ? {
          jd: '#jd-input-mobile',
          upload: '#mobile-byod-upload',
          manual: '#mobile-byod-manual',
          scout: '#mobile-scout-button',
          terminal: '#mobile-terminal-tab',
          results: '#mobile-candidates-tab',
        }
      : {
          jd: '#desktop-jd-input',
          upload: '#desktop-byod-upload',
          manual: '#desktop-byod-manual',
          scout: '#desktop-scout-button',
          terminal: '#desktop-terminal-toggle',
          results: '#results-feed',
        };

    // On mobile the layout is stacked (sidebar on top, results below).
    // Adjust popover sides so they point at correct positions.
    const steps: DriveStep[] = [
      {
        element: selectors.jd,
        popover: {
          title: '01 / Job Description',
          description:
            'Paste any raw job description here. The AI will parse mandatory skills, location, and budget automatically. Use ✨ Enhance to expand a one-liner into a full JD.',
          side: controlSide,
          align: startAlign,
        },
      },
      {
        element: selectors.upload,
        popover: {
          title: '02 / BYOD Upload',
          description:
            'Upload a CSV or JSON candidate list to bypass Supabase retrieval. Use the schema preview if you need a format check before importing.',
          side: controlSide,
          align: startAlign,
        },
      },
      {
        element: selectors.manual,
        popover: {
          title: '03 / Manual Entry',
          description:
            'Add one candidate at a time with the slide-over form. This is the quickest way to test a hand-picked shortlist without preparing a file.',
          side: controlSide,
          align: startAlign,
        },
      },
      {
        element: selectors.scout,
        popover: {
          title: '04 / Launch Scout',
          description:
            'Fires the full LangGraph pipeline: JD parsing → retrieval or BYOD filtering → 3-turn interview simulation → scoring matrix. Results stream in as each candidate is evaluated.',
          side: controlSide,
          align: startAlign,
        },
      },
      {
        element: selectors.terminal,
        popover: {
          title: '05 / Agentic Terminal',
          description:
            '🔴 Export session as JSON. 🟡 Copy all logs. 🟢 Expand to full-screen focus mode. Use the chevron on desktop or the accordion on mobile to fold the log away.',
          side: controlSide,
          align: startAlign,
        },
      },
      {
        element: selectors.results,
        popover: {
          title: '06 / Candidate Feed',
          description:
            'Candidates appear sorted by Final Score as they are evaluated. Cards glowing emerald scored ≥ 80. Click "View AI Reasoning" to read the full simulated interview transcript.',
          side: resultsSide,
          align: startAlign,
        },
      },
    ].filter((step) => {
      if (!step.element || typeof step.element !== 'string') {
        return true;
      }
      return Boolean(document.querySelector(step.element));
    });

    driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(5,5,7,0.85)',
      steps,
    }).drive();
  }

  return (
    <button
      onClick={startTour}
      id="product-tour-btn"
      aria-label="Start product tour"
      className="group p-1.5 rounded-md transition-all hover:bg-white/5 active:scale-[0.98]"
      title="Take a tour"
    >
      <Info className="w-4 h-4 text-[#8b949e] transition-colors group-hover:text-[#00d992]" />
    </button>
  );
}
