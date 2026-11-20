import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Button } from './ui';

export interface TourStep { sel: string; title: string; text: string }

export const TOURS: Record<string, TourStep[]> = {
  dashboard: [
    { sel: '[data-tour="kpis"]', title: 'Live KPIs', text: 'These numbers are calculated directly from client and visit records. Nobody types totals in by hand.' },
    { sel: '[data-tour="trend"]', title: '12-month trend', text: 'Monthly service visits split by distribution, pantry, and programs. Hover the chart to see exact values.' },
    { sel: '[data-tour="zip"]', title: 'Where families live', text: 'Unique households served this month by ZIP code. Useful for funders and outreach planning.' },
    { sel: '[data-tour="activity"]', title: 'Recent activity', text: 'Every significant change is written to the audit log with who did it and when.' },
    { sel: '[data-tour="nav"]', title: 'Admin menu', text: 'Admins see every module, including Settings for users, forms, programs, imports and security.' },
  ],
  home: [
    { sel: '[data-tour="quick"]', title: 'Quick actions', text: 'Register a client, book an appointment, or start event check-in in one tap.' },
    { sel: '[data-tour="today-pantry"]', title: "Today's pantry", text: 'Pantry appointments for today. Mark them completed, canceled or missed right from the Pantry page.' },
    { sel: '[data-tour="today-programs"]', title: 'Program appointments', text: 'Nonclinical program appointments scheduled for today.' },
    { sel: '[data-tour="next-event"]', title: 'Next distribution', text: 'The next monthly food distribution and how many households are expected.' },
  ],
  checkin: [
    { sel: '[data-tour="counter"]', title: 'Live counter', text: 'Households checked in and total people served at this event, updated instantly.' },
    { sel: '[data-tour="search"]', title: 'Fast search', text: 'Search by name, phone or Client ID. Volunteers only see what they need: name, ID, household size, and last visit.' },
    { sel: '[data-tour="quick-register"]', title: 'Not registered yet?', text: 'Quick Register captures the minimum details and checks the household in immediately.' },
    { sel: '[data-tour="recent"]', title: 'Recent check-ins', text: 'Mistakes happen: a check-in can be undone for 2 minutes. Staff and admins can undo any time.' },
  ],
  clients: [
    { sel: '[data-tour="client-search"]', title: 'Find anyone', text: 'Search by name, phone or Client ID, and filter by status, ZIP, household size or last service date.' },
    { sel: '[data-tour="register"]', title: 'Register a client', text: 'A 3-step form with live duplicate warnings.' },
  ],
  reports: [
    { sel: '[data-tour="range"]', title: 'Pick a date range', text: 'Use presets or a custom range, and filter by program.' },
    { sel: '[data-tour="report-grid"]', title: 'Reports', text: 'Each card opens a table and chart with export buttons. Hover the ⓘ to see exactly what is counted.' },
  ],
};

export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];
  useLayoutEffect(() => {
    const el = document.querySelector(step.sel) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const upd = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(upd, 280); upd();
    window.addEventListener('resize', upd); window.addEventListener('scroll', upd, true);
    return () => { clearTimeout(t); window.removeEventListener('resize', upd); window.removeEventListener('scroll', upd, true); };
  }, [i, step.sel]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') setI(v => Math.min(steps.length - 1, v + 1)); if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1)); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [steps.length, onClose]);
  const pad = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  const boxW = Math.min(340, vw - 24);
  let top = rect ? rect.bottom + 14 : vh / 2 - 80;
  if (rect && top + 190 > vh) top = Math.max(12, rect.top - 190);
  let left = rect ? Math.min(Math.max(12, rect.left), vw - boxW - 12) : vw / 2 - boxW / 2;
  return (
    <div className="tour">
      {rect && <div className="tour-hole" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />}
      {!rect && <div className="tour-dim" />}
      <div className="tour-box" style={{ top, left, width: boxW }} role="dialog" aria-label="Guided tour">
        <span className="tour-count">Step {i + 1} of {steps.length}</span>
        <h4>{step.title}</h4>
        <p>{step.text}</p>
        <div className="tour-actions">
          <Button variant="ghost" size="sm" onClick={onClose}>Skip tour</Button>
          <span style={{ flex: 1 }} />
          {i > 0 && <Button variant="secondary" size="sm" onClick={() => setI(i - 1)}>Back</Button>}
          {i < steps.length - 1 ? <Button size="sm" onClick={() => setI(i + 1)}>Next</Button> : <Button size="sm" onClick={onClose}>Done</Button>}
        </div>
      </div>
    </div>
  );
}
