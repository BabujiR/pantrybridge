import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch, FiCheck, FiUserPlus, FiRotateCcw, FiAlertOctagon, FiCalendar, FiMapPin, FiX, FiLock } from 'react-icons/fi';
import { useDB, useSession, toast } from '../lib/store';
import { searchClients, checkIn, undoCheckIn, currentEvent, householdOf, sizeOf, registerClient, cityFor, clientName } from '../lib/actions';
import { Button, Card, Modal, Sheet, Field, Chips, Stepper, Empty, Badge, Alert, PageHead } from '../components/ui';
import { fmt, fmtTime, today, fmtDay } from '../lib/dates';
import { t } from '../lib/i18n';
import { go, parts, useRoute } from '../lib/router';
import type { Client, Visit } from '../lib/types';

const UNDO_MS = 2 * 60 * 1000;

export function CheckIn() {
  const db = useDB();
  const s = useSession()!;
  const route = useRoute();
  const eventId = parts(route)[1];
  const ev = (eventId && db.events.find(e => e.id === eventId)) || currentEvent(db);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Client | null>(null);
  const [size, setSize] = useState(1);
  const [cats, setCats] = useState<string[]>([]);
  const [dup, setDup] = useState<Visit | null>(null);
  const [success, setSuccess] = useState<{ visit: Visit; name: string } | null>(null);
  const [quick, setQuick] = useState(false);
  const [, tick] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const isStaff = s.role !== 'volunteer';
  const evVisits = db.visits.filter(v => v.eventId === ev.id);
  const people = evVisits.reduce((n, v) => n + v.householdSize, 0);
  const results = useMemo(() => searchClients(db, q), [db, q]);
  const activeCats = db.categories.filter(c => c.active).map(c => c.name);
  const isFuture = ev.date > today();

  useEffect(() => { input.current?.focus(); }, [success]);
  useEffect(() => { const iv = setInterval(() => tick(x => x + 1), 5000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    if (!success) return;
    const tm = setTimeout(() => { setSuccess(null); setQ(''); }, 3000);
    return () => clearTimeout(tm);
  }, [success]);

  const start = (c: Client) => {
    const already = evVisits.find(v => v.householdId === c.householdId);
    if (already) { setDup(already); return; }
    const h = householdOf(db, c);
    setSize(sizeOf(h)); setCats(activeCats.filter(x => x !== 'Baby Items')); setSel(c);
  };
  const confirm = () => {
    if (!sel) return;
    const v = checkIn(ev.id, sel.id, size, cats);
    setSuccess({ visit: v, name: `${sel.firstName} ${sel.lastName}` });
    setSel(null);
  };

  if (success) {
    return (
      <div className="checkin-success" onClick={() => { setSuccess(null); setQ(''); }}>
        <div className="big-check"><FiCheck /></div>
        <h1>Checked in!</h1>
        <p className="success-name">{success.name}</p>
        <p>Household {success.visit.householdId} · {success.visit.householdSize} {success.visit.householdSize === 1 ? 'person' : 'people'}</p>
        {success.visit.firstTime ? <Badge tone="orange">★ First-time household</Badge> : <Badge tone="green">Returning household</Badge>}
        <p className="muted small">Returning to search in 3 seconds… (tap to continue now)</p>
      </div>
    );
  }

  const recent = [...evVisits].sort((a, b) => ((b as any).createdAt || 0) - ((a as any).createdAt || 0) || b.time.localeCompare(a.time)).slice(0, 10);

  return (
    <div className="checkin">
      <div className="checkin-head">
        <div>
          <p className="eyebrow"><FiCalendar /> {ev.date === today() ? 'Today' : fmtDay(ev.date)} · <FiMapPin /> {ev.location}</p>
          <h1>{ev.name}</h1>
        </div>
        {isStaff && <div className="row gap"><Button variant="secondary" onClick={() => go('/distribution/' + ev.id)}>Event summary</Button></div>}
      </div>
      {isFuture && <Alert tone="info">This event is on {fmt(ev.date)}. Check-ins here are for demo purposes.</Alert>}

      <div className="counter" data-tour="counter" aria-live="polite">
        <div><strong>{evVisits.length}</strong><span>{t('Households checked in')}</span></div>
        <div><strong>{people}</strong><span>{t('People served')}</span></div>
        <div className="hide-sm"><strong>{evVisits.filter(v => v.firstTime).length}</strong><span>First-time households</span></div>
      </div>

      <div className="big-search" data-tour="search">
        <FiSearch />
        <input ref={input} autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search by name, phone, or Client ID')} aria-label="Search clients" />
        {q && <button className="icon-btn" aria-label="Clear" onClick={() => { setQ(''); input.current?.focus(); }}><FiX /></button>}
      </div>

      {q.trim().length > 0 && (
        <div className="results">
          {results.length === 0 && <Empty title="No matching clients" text="Check the spelling, try a phone number, or register them now." />}
          {results.map(c => {
            const h = householdOf(db, c);
            const done = evVisits.find(v => v.householdId === c.householdId);
            return (
              <div key={c.id} className="result-card">
                <div className="result-info">
                  <h3>{c.firstName} {c.lastName}</h3>
                  <p><span className="mono">{c.id}</span> · Household of {sizeOf(h)} · Last visit {fmt(c.lastServiceDate)}</p>
                  {done && <Badge tone="green">✓ Checked in at {fmtTime(done.time)}</Badge>}
                </div>
                <Button size="xl" variant={done ? 'secondary' : 'primary'} icon={<FiCheck />} onClick={() => start(c)}>{t('Check In')}</Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="quick-reg" data-tour="quick-register">
        <span>{t('Client not found?')}</span>
        <Button variant="accent" size="lg" icon={<FiUserPlus />} onClick={() => setQuick(true)}>{t('Quick Register')}</Button>
      </div>

      <Card title={t('Recent check-ins')} data-tour="recent" pad={false}>
        {recent.length === 0 ? <Empty title="No check-ins yet" text="Search above to check in the first household." /> : (
          <ul className="recent">
            {recent.map(v => {
              const created = (v as any).createdAt as number | undefined;
              const canUndo = isStaff || (created && Date.now() - created < UNDO_MS);
              const left = created ? Math.max(0, Math.ceil((UNDO_MS - (Date.now() - created)) / 1000)) : 0;
              return (
                <li key={v.id}>
                  <span className="recent-time">{fmtTime(v.time)}</span>
                  <span className="recent-name"><b>{clientName(db, v.clientId)}</b><small>{v.householdId} · {v.householdSize} people {v.firstTime && '· First time'}</small></span>
                  {canUndo ? (
                    <Button variant="ghost" size="sm" icon={<FiRotateCcw />} onClick={() => { undoCheckIn(v.id); toast('Check-in undone.', 'info'); }}>
                      Undo{!isStaff && left > 0 ? ` (${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')})` : ''}
                    </Button>
                  ) : <span className="muted small"><FiLock /> Locked</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `Check in ${sel.firstName} ${sel.lastName}` : ''}
        footer={<><Button variant="secondary" size="lg" onClick={() => setSel(null)}>{t('Cancel')}</Button><Button size="lg" icon={<FiCheck />} onClick={confirm}>{t('Confirm Check-In')}</Button></>}>
        {sel && <div className="stack">
          <p className="muted"><span className="mono">{sel.id}</span> · Household {sel.householdId}</p>
          <Field label={t('Household size today')} hint="Adjust if the household size has changed."><Stepper value={size} onChange={setSize} /></Field>
          <Field label={t('Food categories')}><Chips options={activeCats} value={cats} onChange={setCats} /></Field>
        </div>}
      </Sheet>

      <Modal open={!!dup} onClose={() => setDup(null)} title={<><FiAlertOctagon /> Already checked in</>} tone="danger" size="sm"
        footer={<Button size="lg" block onClick={() => { setDup(null); setQ(''); }}>Go back</Button>}>
        {dup && <p className="lead">This household was already checked in at <b>{fmtTime(dup.time)}</b> by <b>{dup.by.split(' ')[0]} {dup.by.split(' ')[1]?.[0]}.</b> Each household can be served once per distribution event.</p>}
      </Modal>

      <QuickRegister open={quick} onClose={() => setQuick(false)} onDone={(c, sz) => {
        setQuick(false);
        const v = checkIn(ev.id, c.id, sz, activeCats.filter(x => x !== 'Baby Items'));
        setSuccess({ visit: v, name: `${c.firstName} ${c.lastName}` });
      }} />
    </div>
  );
}

function QuickRegister({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (c: Client, size: number) => void }) {
  const [f, setF] = useState({ first: '', last: '', phone: '', zip: '', size: 1 });
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setF({ first: '', last: '', phone: '', zip: '', size: 1 }); setErr({}); } }, [open]);
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.first.trim()) e.first = 'Required';
    if (!f.last.trim()) e.last = 'Required';
    if (f.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a 10-digit phone';
    if (!/^\d{5}$/.test(f.zip)) e.zip = '5-digit ZIP';
    setErr(e);
    if (Object.keys(e).length) return;
    const members = Array.from({ length: f.size - 1 }, (_, i) => ({ name: `Household member ${i + 2}`, relationship: 'Household member', ageCategory: 'Not recorded' }));
    const c = registerClient({
      firstName: f.first, lastName: f.last, dob: null, ageCategory: '', gender: '', phone: formatPhone(f.phone), email: '', language: '',
      street: '', city: cityFor(f.zip), state: 'GA', zip: f.zip, householdMode: 'new', members, consent: true, eligibility: [], heardFrom: '',
    }, 'Quick-registered client');
    toast(`Registered ${c.firstName} ${c.lastName} as ${c.id}. Staff can complete the profile later.`);
    onDone(c, f.size);
  };
  return (
    <Sheet open={open} onClose={onClose} title={<><FiUserPlus /> Quick Register</>}
      footer={<><Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button><Button size="lg" icon={<FiCheck />} onClick={save}>Register & Check In</Button></>}>
      <div className="grid-2">
        <Field label="First name" required error={err.first}><input value={f.first} onChange={e => setF({ ...f, first: e.target.value })} autoFocus /></Field>
        <Field label="Last name" required error={err.last}><input value={f.last} onChange={e => setF({ ...f, last: e.target.value })} /></Field>
        <Field label="Phone" required error={err.phone}><input inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="(404) 555-0123" /></Field>
        <Field label="ZIP code" required error={err.zip}><input inputMode="numeric" maxLength={5} value={f.zip} onChange={e => setF({ ...f, zip: e.target.value.replace(/\D/g, '') })} placeholder="30310" /></Field>
      </div>
      <Field label="Household size"><Stepper value={f.size} onChange={n => setF({ ...f, size: n })} /></Field>
      <p className="muted small">Consent is confirmed verbally at check-in. Staff will complete the full profile later.</p>
    </Sheet>
  );
}

export function formatPhone(p: string) {
  const d = p.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

/** Volunteer read-only client search: minimum information only. */
export function VolunteerSearch() {
  const db = useDB();
  const [q, setQ] = useState('');
  const results = useMemo(() => searchClients(db, q), [db, q]);
  return (
    <div>
      <PageHead title={t('Client Search')} sub="Read-only lookup. Volunteers see name, Client ID, household size and last visit only." />
      <div className="big-search"><FiSearch /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search by name, phone, or Client ID')} aria-label="Search clients" /></div>
      <div className="results">
        {!q && <Empty title="Search for a registered client" text="Try “Rosa” or “Pierre”." />}
        {q && results.length === 0 && <Empty title="No matching clients" />}
        {results.map(c => (
          <div key={c.id} className="result-card">
            <div className="result-info">
              <h3>{c.firstName} {c.lastName}</h3>
              <p><span className="mono">{c.id}</span> · Household of {sizeOf(householdOf(db, c))} · Last visit {fmt(c.lastServiceDate)}</p>
            </div>
            <Button variant="secondary" onClick={() => go('/checkin')}>Go to Check-In</Button>
          </div>
        ))}
      </div>
      <Alert tone="info"><FiLock /> Address, date of birth, email, notes and service history are hidden for volunteer accounts.</Alert>
    </div>
  );
}
