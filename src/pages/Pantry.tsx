import React, { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiCheck, FiX, FiSlash, FiClock, FiUser, FiSearch, FiPrinter } from 'react-icons/fi';
import { useDB, update, log, toast, nextId, getSession } from '../lib/store';
import { useRoute, query, go } from '../lib/router';
import { Button, Card, PageHead, Field, Modal, Sheet, Chips, StatusBadge, TypeTag, Empty } from '../components/ui';
import { Calendar, CalToolbar, CalView } from '../components/Calendar';
import { SERIES } from '../components/charts';
import { today, fmt, fmtTime, weekday } from '../lib/dates';
import { clientName, searchClients, touchService, householdOf, sizeOf } from '../lib/actions';
import type { PantryAppt, Client } from '../lib/types';

export const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'];

export function Pantry() {
  const db = useDB();
  const route = useRoute();
  const q = query(route);
  const [view, setView] = useState<CalView>('day');
  const [date, setDate] = useState(today());
  const [sel, setSel] = useState<string | null>(q.sel || null);
  const [book, setBook] = useState(!!q.book);
  const [complete, setComplete] = useState<PantryAppt | null>(null);
  useEffect(() => { if (q.sel) { const p = db.pantry.find(x => x.id === q.sel); if (p) { setDate(p.date); setSel(p.id); } } }, [q.sel]);
  useEffect(() => { if (q.book) setBook(true); }, [q.book]);
  const items = useMemo(() => db.pantry.map(p => ({ id: p.id, date: p.date, time: p.time, title: clientName(db, p.clientId), sub: p.notes || undefined, status: p.status, tone: 'pantry' })), [db]);
  const appt = db.pantry.find(p => p.id === sel);
  const setStatus = (p: PantryAppt, status: PantryAppt['status']) => {
    update(d => { const x = d.pantry.find(y => y.id === p.id)!; log(d, `Marked pantry appointment ${status.toLowerCase()}`, p.id, `Status: ${x.status}`, `Status: ${status}`); x.status = status; });
    toast(`Appointment marked ${status.toLowerCase()}.`, status === 'Missed' ? 'warn' : 'info');
  };
  const todayCount = db.pantry.filter(p => p.date === date);
  return (
    <div>
      <PageHead title="Weekday Food Pantry" sub="By appointment, Monday–Friday. Pantry visits are tracked separately from distribution events."
        actions={<><Button variant="secondary" icon={<FiPrinter />} onClick={() => window.print()}>Print</Button><Button icon={<FiPlus />} onClick={() => setBook(true)}>Book Pantry Appointment</Button></>} />
      <div className="split">
        <Card pad={false} className="split-main">
          <div className="card-body"><CalToolbar view={view} setView={setView} date={date} setDate={setDate} extra={<span className="muted small hide-sm">{todayCount.length} on {fmt(date)}</span>} /></div>
          <Calendar view={view} date={date} items={items} selected={sel} onSelect={setSel} color={SERIES.pantry} />
        </Card>
        <aside className="split-side">
          {!appt ? <Card><Empty title="Select an appointment" text="Click any appointment to update its status and see the client's previous pantry visits." /></Card> : (
            <Card title={<><TypeTag type="pantry" /> {fmtTime(appt.time)} · {fmt(appt.date)}</>} actions={<button className="icon-btn" aria-label="Close" onClick={() => setSel(null)}><FiX /></button>}>
              <div className="stack">
                <div><h3 className="side-name"><FiUser /> <a href={'#/clients/' + appt.clientId}>{clientName(db, appt.clientId)}</a></h3><p className="muted small mono">{appt.clientId}</p></div>
                <div className="row gap">Status: <StatusBadge status={appt.status} /></div>
                {appt.notes && <p className="note">{appt.notes}</p>}
                {appt.status === 'Completed' && <p className="small">Food provided: <b>{appt.categories.join(', ') || '—'}</b>{appt.lbs ? ` · ~${appt.lbs} lbs` : ''}</p>}
                <div className="status-btns">
                  <Button icon={<FiCheck />} onClick={() => setComplete(appt)} disabled={appt.status === 'Completed'}>Completed</Button>
                  <Button variant="secondary" icon={<FiSlash />} onClick={() => setStatus(appt, 'Canceled')} disabled={appt.status === 'Canceled' || appt.status === 'Completed'}>Canceled</Button>
                  <Button variant="danger" icon={<FiX />} onClick={() => setStatus(appt, 'Missed')} disabled={appt.status === 'Missed' || appt.status === 'Completed'}>Missed</Button>
                </div>
                <h4>Previous pantry visits</h4>
                <ul className="mini-list">
                  {db.pantry.filter(p => p.clientId === appt.clientId && p.id !== appt.id && p.date <= today()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(p => (
                    <li key={p.id}><span>{fmt(p.date)}</span><StatusBadge status={p.status} />{p.lbs ? <span className="muted small">{p.lbs} lbs</span> : null}</li>
                  ))}
                  {!db.pantry.some(p => p.clientId === appt.clientId && p.id !== appt.id && p.date <= today()) && <li className="muted">First pantry visit</li>}
                </ul>
              </div>
            </Card>
          )}
        </aside>
      </div>
      <BookPantry open={book} onClose={() => { setBook(false); if (q.book) go('/pantry'); }} presetClient={q.client} defaultDate={date} onBooked={(id, d) => { setDate(d); setSel(id); }} />
      <CompleteSheet appt={complete} onClose={() => setComplete(null)} />
    </div>
  );
}

function CompleteSheet({ appt, onClose }: { appt: PantryAppt | null; onClose: () => void }) {
  const db = useDB();
  const [cats, setCats] = useState<string[]>([]);
  const [lbs, setLbs] = useState(25);
  useEffect(() => { if (appt) { setCats(['Produce', 'Dry Goods', 'Protein']); setLbs(25); } }, [appt]);
  if (!appt) return null;
  const save = () => {
    update(d => {
      const x = d.pantry.find(y => y.id === appt.id)!;
      log(d, 'Completed pantry appointment', appt.id, `Status: ${x.status}`, 'Status: Completed');
      x.status = 'Completed'; x.categories = cats; x.lbs = lbs;
      const c = d.clients.find(y => y.id === appt.clientId)!;
      const h = d.households.find(y => y.id === c.householdId)!;
      const prior = d.visits.some(v => v.type === 'pantry' && v.householdId === h.id && v.date < appt.date);
      d.visits.push({ id: nextId(d, 'misc', 'V-', 6), type: 'pantry', clientId: c.id, householdId: h.id, date: appt.date, time: appt.time, householdSize: 1 + h.members.length, categories: cats, lbs, firstTime: !prior, by: getSession()?.name || '' });
      touchService(d, h.id, appt.date);
    });
    toast('Pantry visit recorded.'); onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Complete visit · ${clientName(db, appt.clientId)}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={<FiCheck />} onClick={save}>Save visit</Button></>}>
      <div className="stack">
        <Field label="Food assistance provided"><Chips options={db.categories.filter(c => c.active).map(c => c.name)} value={cats} onChange={setCats} /></Field>
        <Field label="Approximate weight (lbs)"><input type="number" min={0} value={lbs} onChange={e => setLbs(Number(e.target.value))} /></Field>
      </div>
    </Sheet>
  );
}

export function ClientPicker({ value, onChange }: { value: Client | null; onChange: (c: Client | null) => void }) {
  const db = useDB();
  const [q, setQ] = useState('');
  const res = q.trim().length > 1 ? searchClients(db, q, 6) : [];
  if (value) return <div className="picked"><FiUser /> <b>{value.firstName} {value.lastName}</b> <span className="mono muted">{value.id}</span> · household of {sizeOf(householdOf(db, value))}<button className="link" onClick={() => onChange(null)}>Change</button></div>;
  return (
    <div className="stack-sm">
      <div className="search"><FiSearch /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone, or Client ID" /></div>
      {res.map(c => <button key={c.id} type="button" className="pick" onClick={() => onChange(c)}><b>{c.firstName} {c.lastName}</b> · <span className="mono">{c.id}</span> · {c.phone}</button>)}
    </div>
  );
}

function BookPantry({ open, onClose, presetClient, defaultDate, onBooked }: { open: boolean; onClose: () => void; presetClient?: string; defaultDate: string; onBooked: (id: string, date: string) => void }) {
  const db = useDB();
  const [client, setClient] = useState<Client | null>(null);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<'pantry' | 'program'>('pantry');
  useEffect(() => { if (open) { setClient(presetClient ? db.clients.find(c => c.id === presetClient) || null : null); setDate(defaultDate < today() ? today() : defaultDate); setTime(''); setNotes(''); setKind('pantry'); } }, [open]);
  const taken = new Set(db.pantry.filter(p => p.date === date && p.status === 'Scheduled').map(p => p.time));
  const wd = weekday(date);
  const save = () => {
    if (kind === 'program') { onClose(); go('/appointments?book=1' + (client ? '&client=' + client.id : '')); return; }
    if (!client || !time) { toast('Choose a client and a time slot.', 'error'); return; }
    let id = '';
    update(d => { id = nextId(d, 'misc', 'PA-', 5); d.pantry.push({ id, clientId: client.id, date, time, status: 'Scheduled', notes, categories: [] }); log(d, 'Booked pantry appointment', `${id} for ${client.id}`); });
    toast(`Pantry appointment booked for ${fmt(date)} at ${fmtTime(time)}.`);
    onBooked(id, date); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Book appointment" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{kind === 'pantry' ? 'Book pantry appointment' : 'Continue to program booking'}</Button></>}>
      <div className="stack">
        <Field label="Appointment type"><div className="seg"><button type="button" className={kind === 'pantry' ? 'on' : ''} onClick={() => setKind('pantry')}>Food pantry</button><button type="button" className={kind === 'program' ? 'on' : ''} onClick={() => setKind('program')}>Program (nonclinical)</button></div></Field>
        <Field label="Client" required><ClientPicker value={client} onChange={setClient} /></Field>
        {kind === 'pantry' && <>
          <Field label="Date" required hint={wd === 0 || wd === 6 ? 'The pantry is closed on weekends.' : undefined}><input type="date" value={date} min={today()} onChange={e => { setDate(e.target.value); setTime(''); }} /></Field>
          <Field label="Time slot" required>
            <div className="slots">{SLOTS.map(s => <button key={s} type="button" disabled={taken.has(s) || wd === 0 || wd === 6} className={`slot-btn ${time === s ? 'on' : ''}`} onClick={() => setTime(s)}>{fmtTime(s)}{taken.has(s) && <small>Booked</small>}</button>)}</div>
          </Field>
          <Field label="Notes" hint="Administrative notes only. Do not enter medical information."><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        </>}
      </div>
    </Modal>
  );
}
