'use client';

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Info } from 'lucide-react';

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
      .driver-popover-arrow-side-left.driver-popover-arrow { border-right-color: rgba(0,217,146,0.2) !important; }
      .driver-popover-arrow-side-right.driver-popover-arrow { border-left-color: rgba(0,217,146,0.2) !important; }
      .driver-popover-arrow-side-top.driver-popover-arrow { border-bottom-color: rgba(0,217,146,0.2) !important; }
      .driver-popover-arrow-side-bottom.driver-popover-arrow { border-top-color: rgba(0,217,146,0.2) !important; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  function startTour() {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(5,5,7,0.85)',
      steps: [
        {
          element: '#jd-input',
          popover: {
            title: '01 / Job Description',
            description:
              'Paste any raw job description here. The AI will parse mandatory skills, location, and budget automatically. Use ✨ Enhance to expand a one-liner into a full JD.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '#scout-button',
          popover: {
            title: '02 / Launch Scout',
            description:
              'Fires the full LangGraph pipeline: JD parsing → vector search → 3-turn interview simulation → scoring matrix. Results stream in as each candidate is evaluated.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '#agent-terminal',
          popover: {
            title: '03 / Agentic Terminal',
            description:
              'Live execution log of every LangGraph node. The 🔴 button aborts a running scout. 🟡 copies all logs. 🟢 expands to full-screen focus mode.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '#results-feed',
          popover: {
            title: '04 / Candidate Feed',
            description:
              'Candidates appear sorted by Final Score as they are evaluated. Cards glowing emerald scored ≥ 80. Click "View AI Reasoning" to read the full simulated interview transcript.',
            side: 'left',
            align: 'start',
          },
        },
      ],
    });
    driverObj.drive();
  }

  return (
    <button
      onClick={startTour}
      id="product-tour-btn"
      aria-label="Start product tour"
      className="p-1.5 rounded-md transition-colors hover:bg-white/5"
      title="Take a tour"
    >
      <Info className="w-4 h-4" style={{ color: '#8b949e' }} />
    </button>
  );
}
