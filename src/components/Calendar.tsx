import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { addDays, fmtDay, startOfWeek, today, fmtTime, fmt, parse } from '../lib/dates';
import { Button } from './ui';

export type CalView = 'day' | 'week' | 'list';
export interface CalItem { id: string; date: string; time: string; title: string; sub?: string; status: string; tone: string }

export function CalToolbar({ view, setView, date, setDate, extra }: { view: CalView; setView: (v: CalView) => void; date: string; setDate: (d: string) => void; extra?: React.ReactNode }) {
  const step = view === 'week' ? 7 : 1;
  const label = view === 'week' ? `Week of ${fmt(startOfWeek(date))}` : view === 'day' ? fmtDay(date) : `From ${fmt(date)}`;
  return (
    <div className="cal-toolbar">
      <div className="row gap">
        <Button variant="secondary" size="sm" aria-label="Previous" icon={<FiChevronLeft />} onClick={() => setDate(addDays(date, -step))} />
        <Button variant="secondary" size="sm" onClick={() => setDate(today())}>Today</Button>
        <Button variant="secondary" size="sm" aria-label="Next" icon={<FiChevronRight />} onClick={() => setDate(addDays(date, step))} />
        <input type="date" className="date-input" value={date} onChange={e => e.target.value && setDate(e.target.value)} aria-label="Jump to date" />
        <b className="cal-label">{label}</b>
      </div>
      <div className="row gap">
        {extra}
        <div className="seg seg-sm" role="tablist">
          {(['day', 'week', 'list'] as CalView[]).map(v => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
        </div>
      </div>
    </div>
  );
}

export function Calendar({ view, date, items, selected, onSelect, color }: { view: CalView; date: string; items: CalItem[]; selected?: string | null; onSelect: (id: string) => void; color: string }) {
  const Card = ({ it }: { it: CalItem }) => (
    <button className={`cal-item cal-${it.tone} ${selected === it.id ? 'cal-sel' : ''}`} style={{ borderLeftColor: color }} onClick={() => onSelect(it.id)}>
      <span className="cal-time">{fmtTime(it.time)}</span>
      <span className="cal-title">{it.title}</span>
      {it.sub && <span className="cal-sub">{it.sub}</span>}
      <span className={`cal-status st-${it.status.toLowerCase().replace(/[^a-z]/g, '')}`}>{it.status}</span>
    </button>
  );
  if (view === 'week') {
    const start = startOfWeek(date);
    const days = Array.from({ length: 5 }, (_, i) => addDays(start, i));
    return (
      <div className="week">
        {days.map(d => {
          const its = items.filter(i => i.date === d).sort((a, b) => a.time.localeCompare(b.time));
          return (
            <div key={d} className={`week-col ${d === today() ? 'week-today' : ''}`}>
              <div className="week-head">{fmtDay(d)}</div>
              {its.length === 0 ? <p className="muted small center">—</p> : its.map(i => <Card key={i.id} it={i} />)}
            </div>
          );
        })}
      </div>
    );
  }
  if (view === 'day') {
    const its = items.filter(i => i.date === date).sort((a, b) => a.time.localeCompare(b.time));
    const slots = Array.from({ length: 17 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
    const wd = parse(date).getDay();
    return (
      <div className="day">
        {(wd === 0 || wd === 6) && <p className="muted center">Weekend: the pantry is closed.</p>}
        {slots.map(s => {
          const here = its.filter(i => i.time.slice(0, 2) === s.slice(0, 2) && (Number(i.time.slice(3)) >= 30) === (s.slice(3) === '30'));
          return <div key={s} className="slot"><span className="slot-time">{fmtTime(s)}</span><div className="slot-items">{here.map(i => <Card key={i.id} it={i} />)}</div></div>;
        })}
      </div>
    );
  }
  const its = items.filter(i => i.date >= date && i.date <= addDays(date, 13)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  let last = '';
  return (
    <div className="list-view">
      {its.length === 0 && <p className="muted center">No appointments in the next 14 days.</p>}
      {its.map(i => { const h = i.date !== last; last = i.date; return <React.Fragment key={i.id}>{h && <h4 className="list-day">{fmtDay(i.date)}</h4>}<Card it={i} /></React.Fragment>; })}
    </div>
  );
}
