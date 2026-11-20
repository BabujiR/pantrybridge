import React, { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiX, FiUser, FiPrinter, FiSend, FiCalendar, FiEdit2 } from 'react-icons/fi';
import { useDB, update, log, toast, nextId, getSession } from '../lib/store';
import { useRoute, query, go } from '../lib/router';
import { Button, Card, PageHead, Field, Modal, StatusBadge, TypeTag, Empty, Tabs } from '../components/ui';
import { Calendar, CalToolbar, CalView } from '../components/Calendar';
import { SERIES } from '../components/charts';
import { today, fmt, fmtTime, monthKey, monthLong, addDays } from '../lib/dates';
import { clientName, touchService } from '../lib/actions';
import { ClientPicker } from './Pantry';
import { ReferralModal } from './Clients';
import type { ProgramAppt, Client } from '../lib/types';

export function Appointments() {
  const db = useDB();
  const q = query(useRoute());
  const [view, setView] = useState<CalView>('week');
  const [date, setDate] = useState(today());
  const [program, setProgram] = useState('all');
  const [sel, setSel] = useState<string | null>(q.sel || null);
  const [form, setForm] = useState<ProgramAppt | 'new' | null>(q.book ? 'new' : null);
  const [ref, setRef] = useState<string | null>(null);
  const [mode, setMode] = useState('calendar');
  useEffect(() => { if (q.sel) { const a = db.appts.find(x => x.id === q.sel); if (a) { setDate(a.date); setSel(a.id); } } }, [q.sel]);
  useEffect(() => { if (q.book) setForm('new'); }, [q.book]);
  const filtered = db.appts.filter(a => program === 'all' || a.program === program);
  const items = useMemo(() => filtered.map(a => ({ id: a.id, date: a.date, time: a.time, title: clientName(db, a.clientId), sub: a.program, status: a.status, tone: 'program' })), [db, program]);
  const a = db.appts.find(x => x.id === sel);
  const T = today();
  const todayList = filtered.filter(x => x.date === T).sort((x, y) => x.time.localeCompare(y.time));
  const monthList = filtered.filter(x => monthKey(x.date) === monthKey(date)).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const setStatus = (ap: ProgramAppt, status: ProgramAppt['status']) => {
    update(d => {
      const x = d.appts.find(y => y.id === ap.id)!;
      log(d, `Marked program appointment ${status.toLowerCase()}`, ap.id, `Status: ${x.status}`, `Status: ${status}`);
      x.status = status;
      if (status === 'Completed' && !d.visits.some(v => v.type === 'program' && v.clientId === ap.clientId && v.date === ap.date && v.program === ap.program)) {
        const c = d.clients.find(y => y.id === ap.clientId)!; const h = d.households.find(y => y.id === c.householdId)!;
        d.visits.push({ id: nextId(d, 'misc', 'V-', 6), type: 'program', program: ap.program, clientId: c.id, householdId: h.id, date: ap.date, time: ap.time, householdSize: 1 + h.members.length, categories: [], firstTime: false, by: getSession()?.name || '' });
        touchService(d, h.id, ap.date);
      }
    });
    toast(`Marked ${status.toLowerCase()}.`, 'info');
  };
  const progFilter = (
    <select className="select-sm" value={program} onChange={e => setProgram(e.target.value)} aria-label="Filter by program">
      <option value="all">All programs</option>{db.programs.filter(p => p.active).map(p => <option key={p.id}>{p.name}</option>)}
    </select>
  );
  const ListTable = ({ list }: { list: ProgramAppt[] }) => list.length === 0 ? <Empty title="No appointments" /> : (
    <div className="table-wrap"><table className="table table-click"><thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Program</th><th>Status</th><th>Follow-up</th><th className="hide-sm">Notes</th></tr></thead>
      <tbody>{list.map(x => <tr key={x.id} onClick={() => { setSel(x.id); setMode('calendar'); setDate(x.date); }}><td className="nowrap">{fmt(x.date)}</td><td>{fmtTime(x.time)}</td><td><b>{clientName(db, x.clientId)}</b></td><td><TypeTag type="program" label={x.program} /></td><td><StatusBadge status={x.status} /></td><td>{x.followUp ? fmt(x.followUp) : '—'}</td><td className="muted hide-sm">{x.notes}</td></tr>)}</tbody></table></div>
  );
  return (
    <div>
      <PageHead title="Program Appointments" sub="Nonclinical appointments for community programs. No medical information is stored."
        actions={<><Button variant="secondary" icon={<FiPrinter />} onClick={() => window.print()}>Print</Button><Button icon={<FiPlus />} onClick={() => setForm('new')}>New Appointment</Button></>} />
      <Tabs value={mode} onChange={setMode} tabs={[{ key: 'calendar', label: 'Calendar' }, { key: 'today', label: `Today (${todayList.length})` }, { key: 'month', label: `This month (${monthList.length})` }]} />
      {mode === 'calendar' && (
        <div className="split">
          <Card pad={false} className="split-main">
            <div className="card-body"><CalToolbar view={view} setView={setView} date={date} setDate={setDate} extra={progFilter} /></div>
            <Calendar view={view} date={date} items={items} selected={sel} onSelect={setSel} color={SERIES.program} />
          </Card>
          <aside className="split-side">
            {!a ? <Card><Empty title="Select an appointment" text="Click an appointment to update its status, add a follow-up, or create a referral." /></Card> : (
              <Card title={<><TypeTag type="program" label={a.program} /></>} actions={<button className="icon-btn" aria-label="Close" onClick={() => setSel(null)}><FiX /></button>}>
                <div className="stack">
                  <div><h3 className="side-name"><FiUser /> <a href={'#/clients/' + a.clientId}>{clientName(db, a.clientId)}</a></h3><p className="muted small">{fmt(a.date)} at {fmtTime(a.time)}</p></div>
                  <Field label="Status"><select value={a.status} onChange={e => setStatus(a, e.target.value as any)}>{['Scheduled', 'Completed', 'Canceled', 'No-show'].map(s => <option key={s}>{s}</option>)}</select></Field>
                  <div><span className="field-label">Administrative notes</span><p className="note">{a.notes || '—'}</p></div>
                  <p className="small"><FiCalendar /> Follow-up: <b>{a.followUp ? fmt(a.followUp) : 'None'}</b></p>
                  <div className="row gap wrap">
                    <Button variant="secondary" size="sm" icon={<FiEdit2 />} onClick={() => setForm(a)}>Edit</Button>
                    <Button variant="secondary" size="sm" icon={<FiSend />} onClick={() => setRef(a.clientId)}>Add Referral</Button>
                  </div>
                </div>
              </Card>
            )}
          </aside>
        </div>
      )}
      {mode === 'today' && <Card title={`Today · ${fmt(T)}`} pad={false} actions={progFilter}><ListTable list={todayList} /></Card>}
      {mode === 'month' && <Card title={monthLong(monthKey(date))} pad={false} actions={progFilter}><ListTable list={monthList} /></Card>}
      <ApptForm value={form} onClose={() => { setForm(null); if (q.book) go('/appointments'); }} presetClient={q.client} onSaved={(id, d) => { setSel(id); setDate(d); setMode('calendar'); }} />
      <ReferralModal open={!!ref} onClose={() => setRef(null)} clientId={ref || ''} />
    </div>
  );
}

function ApptForm({ value, onClose, presetClient, onSaved }: { value: ProgramAppt | 'new' | null; onClose: () => void; presetClient?: string; onSaved: (id: string, date: string) => void }) {
  const db = useDB();
  const editing = value && value !== 'new' ? value : null;
  const [client, setClient] = useState<Client | null>(null);
  const [f, setF] = useState({ program: '', date: '', time: '10:00', status: 'Scheduled', notes: '', followUp: '' });
  useEffect(() => {
    if (!value) return;
    if (editing) { setClient(db.clients.find(c => c.id === editing.clientId) || null); setF({ program: editing.program, date: editing.date, time: editing.time, status: editing.status, notes: editing.notes, followUp: editing.followUp || '' }); }
    else { setClient(presetClient ? db.clients.find(c => c.id === presetClient) || null : null); setF({ program: db.programs[0].name, date: today(), time: '10:00', status: 'Scheduled', notes: '', followUp: '' }); }
  }, [value]);
  const medical = /(diagnos|medicat|prescri|blood|insulin|lab result|symptom|treatment)/i.test(f.notes);
  const save = () => {
    if (!client || !f.date || !f.program) { toast('Client, program and date are required.', 'error'); return; }
    let id = editing?.id || '';
    update(d => {
      if (editing) {
        const x = d.appts.find(y => y.id === editing.id)!;
        Object.assign(x, { clientId: client.id, program: f.program, date: f.date, time: f.time, status: f.status, notes: f.notes, followUp: f.followUp || null });
        log(d, 'Updated appointment', id);
      } else {
        id = nextId(d, 'misc', 'AP-', 5);
        d.appts.push({ id, clientId: client.id, program: f.program, date: f.date, time: f.time, status: f.status as any, notes: f.notes, followUp: f.followUp || null });
        log(d, 'Booked appointment', `${id} (${f.program}) for ${client.id}`);
      }
    });
    toast(editing ? 'Appointment updated.' : `Appointment booked${f.followUp ? ' with follow-up on ' + fmt(f.followUp) : ''}.`);
    onSaved(id, f.date); onClose();
  };
  return (
    <Modal open={!!value} onClose={onClose} title={editing ? 'Edit appointment' : 'New program appointment'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{editing ? 'Save changes' : 'Book appointment'}</Button></>}>
      <div className="stack">
        <Field label="Client" required><ClientPicker value={client} onChange={setClient} /></Field>
        <div className="grid-2">
          <Field label="Program / service category" required><select value={f.program} onChange={e => setF({ ...f, program: e.target.value })}>{db.programs.filter(p => p.active).map(p => <option key={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Status"><select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{['Scheduled', 'Completed', 'Canceled', 'No-show'].map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Date" required><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Time" required><input type="time" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} /></Field>
          <Field label="Follow-up date" hint="Optional"><input type="date" value={f.followUp} min={f.date} onChange={e => setF({ ...f, followUp: e.target.value })} /></Field>
          <Field label="Quick follow-up"><div className="row gap">{[14, 30].map(n => <Button key={n} type="button" size="sm" variant="secondary" onClick={() => setF({ ...f, followUp: addDays(f.date || today(), n) })}>+{n} days</Button>)}</div></Field>
        </div>
        <Field label="Administrative notes" hint="Administrative notes only. Do not enter medical information." error={medical ? 'This looks like medical information. Please remove it. PantryBridge does not store clinical data.' : undefined}>
          <textarea rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="e.g. Bring proof of address" />
        </Field>
      </div>
    </Modal>
  );
}
