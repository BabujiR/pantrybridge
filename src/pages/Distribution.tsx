import React, { useState } from 'react';
import { FiPlus, FiCheckSquare, FiArrowLeft, FiDownload, FiPrinter, FiMapPin, FiCalendar } from 'react-icons/fi';
import { useDB, update, log, toast, useSession } from '../lib/store';
import { go, parts, useRoute } from '../lib/router';
import { Button, Card, PageHead, Field, Kpi, Badge, Modal, Empty } from '../components/ui';
import { BarChart, SERIES } from '../components/charts';
import { fmt, fmtTime, today, fmtDay } from '../lib/dates';
import { clientName } from '../lib/actions';
import { exportCSV } from '../lib/files';

export function DistributionRouter() {
  const p = parts(useRoute());
  return p[1] ? <EventSummary id={p[1]} /> : <Events />;
}

function Events() {
  const db = useDB();
  const T = today();
  const [create, setCreate] = useState(false);
  const upcoming = db.events.filter(e => e.date >= T).sort((a, b) => a.date.localeCompare(b.date));
  const past = db.events.filter(e => e.date < T).sort((a, b) => b.date.localeCompare(a.date));
  const Row = ({ e }: { e: typeof db.events[number] }) => {
    const vs = db.visits.filter(v => v.eventId === e.id);
    const people = vs.reduce((n, v) => n + v.householdSize, 0);
    return (
      <tr onClick={() => go('/distribution/' + e.id)} className="clickable">
        <td className="nowrap"><b>{fmt(e.date)}</b>{e.date === T && <> <Badge tone="green">Today</Badge></>}</td>
        <td>{e.name}<div className="muted small"><FiMapPin /> {e.location}</div></td>
        <td>{vs.length}</td><td>{people}</td>
        <td className="nowrap">{e.date >= T ? <Button size="sm" icon={<FiCheckSquare />} onClick={ev => { ev.stopPropagation(); go('/checkin/' + e.id); }}>Check-in</Button> : <Button size="sm" variant="secondary" onClick={ev => { ev.stopPropagation(); go('/distribution/' + e.id); }}>Summary</Button>}</td>
      </tr>
    );
  };
  const head = <thead><tr><th>Date</th><th>Event</th><th>Households</th><th>People served</th><th /></tr></thead>;
  return (
    <div>
      <PageHead title="Food Distribution Events" sub="Monthly live distribution events and their check-in results." actions={<Button icon={<FiPlus />} onClick={() => setCreate(true)}>Create Event</Button>} />
      <Card title="Upcoming" pad={false}><div className="table-wrap"><table className="table table-click">{head}<tbody>{upcoming.map(e => <Row key={e.id} e={e} />)}</tbody></table></div></Card>
      <Card title="Past events" pad={false}><div className="table-wrap"><table className="table table-click">{head}<tbody>{past.map(e => <Row key={e.id} e={e} />)}</tbody></table></div></Card>
      <CreateEvent open={create} onClose={() => setCreate(false)} />
    </div>
  );
}

function CreateEvent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: '', date: '', location: '', expected: 40 });
  React.useEffect(() => { if (open) setF({ name: '', date: '', location: 'West End Community Center, Atlanta', expected: 40 }); }, [open]);
  const save = () => {
    if (!f.date || !f.name.trim()) { toast('Enter an event name and date.', 'error'); return; }
    update(d => { const id = 'EV-' + f.date.replace(/-/g, ''); d.events.push({ id, name: f.name, date: f.date, location: f.location, expected: f.expected }); log(d, 'Created event', `${id} (${f.name})`); });
    toast('Event created.'); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Create distribution event" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Create event</Button></>}>
      <div className="stack">
        <Field label="Event name" required><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Holiday Food Distribution" autoFocus /></Field>
        <div className="grid-2">
          <Field label="Date" required><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Expected households"><input type="number" min={1} value={f.expected} onChange={e => setF({ ...f, expected: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Location"><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function EventSummary({ id }: { id: string }) {
  const db = useDB();
  const s = useSession()!;
  const ev = db.events.find(e => e.id === id);
  if (!ev) return <Empty title="Event not found" />;
  const vs = db.visits.filter(v => v.eventId === id).sort((a, b) => a.time.localeCompare(b.time));
  const people = vs.reduce((n, v) => n + v.householdSize, 0);
  const first = vs.filter(v => v.firstTime).length;
  const cats = db.categories.map(c => ({ label: c.name, value: vs.filter(v => v.categories.includes(c.name)).length }));
  const zipMap: Record<string, number> = {};
  vs.forEach(v => { const z = db.households.find(h => h.id === v.householdId)?.zip || '—'; zipMap[z] = (zipMap[z] || 0) + 1; });
  const zips = Object.entries(zipMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const rows = vs.map(v => ({ Time: fmtTime(v.time), 'Client ID': v.clientId, Client: clientName(db, v.clientId), 'Household ID': v.householdId, 'Household size': v.householdSize, 'First time': v.firstTime ? 'Yes' : 'No', Categories: v.categories.join('; '), 'Checked in by': v.by }));
  return (
    <div>
      <button className="back" onClick={() => go('/distribution')}><FiArrowLeft /> Events</button>
      <PageHead title={ev.name} sub={<><FiCalendar /> {fmtDay(ev.date)} · <FiMapPin /> {ev.location}</>}
        actions={<>{ev.date >= today() && <Button icon={<FiCheckSquare />} onClick={() => go('/checkin/' + id)}>Open check-in</Button>}
          <Button variant="secondary" icon={<FiPrinter />} onClick={() => window.print()}>Print</Button>
          {s.role === 'admin' && <Button variant="secondary" icon={<FiDownload />} onClick={() => { exportCSV(rows, `pantrybridge-event-${ev.date}.csv`); update(d => log(d, 'Exported report', `Event summary ${id} (CSV)`)); toast('CSV downloaded.'); }}>Export CSV</Button>}</>} />
      <div className="kpis">
        <Kpi label="Households served" value={vs.length} sub={`of ${ev.expected} expected`} tone="green" />
        <Kpi label="People served" value={people} sub="Household members represented" />
        <Kpi label="First-time households" value={first} tone="orange" />
        <Kpi label="Returning households" value={vs.length - first} />
      </div>
      <div className="grid-2 gap-lg">
        <Card title="Food categories distributed (households)"><BarChart data={cats} color={SERIES.distribution} /></Card>
        <Card title="Households by ZIP"><BarChart data={zips} color={SERIES.distribution} /></Card>
      </div>
      <Card title={`Check-ins (${vs.length})`} pad={false}>
        {vs.length === 0 ? <Empty title="No check-ins for this event yet" /> : (
          <div className="table-wrap"><table className="table"><thead><tr>{Object.keys(rows[0]).map(k => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} className={j === 1 || j === 3 ? 'mono' : ''}>{v}</td>)}</tr>)}</tbody></table></div>
        )}
      </Card>
    </div>
  );
}
