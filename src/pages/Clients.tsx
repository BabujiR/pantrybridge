import React, { useMemo, useState } from 'react';
import { FiSearch, FiUserPlus, FiFilter, FiEdit2, FiPlus, FiTrash2, FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCheck, FiPhone, FiMail, FiMapPin, FiChevronUp, FiChevronDown, FiSend } from 'react-icons/fi';
import { useDB, useSession, update, log, toast, nextId } from '../lib/store';
import { go, parts, useRoute } from '../lib/router';
import { searchClients, findDuplicates, registerClient, householdOf, sizeOf, cityFor, clientName } from '../lib/actions';
import { Button, Card, PageHead, Field, Badge, Empty, Tabs, TypeTag, Modal, Alert, StatusBadge, Chips, useLoading, Skeleton } from '../components/ui';
import { fmt, fmtTime, today, addDays, age } from '../lib/dates';
import { AGE_CATS, ELIGIBILITY, HEARD_FROM, LANGUAGES, ZIPS } from '../data/seed';
import type { Client, Member, Referral } from '../lib/types';
import { formatPhone } from './CheckIn';

export function ClientsRouter() {
  const route = useRoute();
  const p = parts(route);
  if (p[1] === 'new') return <RegisterClient />;
  if (p[1]) return <ClientProfile id={p[1]} />;
  return <ClientList />;
}

type SortKey = 'id' | 'name' | 'zip' | 'household' | 'last';
function ClientList() {
  const db = useDB();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [zip, setZip] = useState('all');
  const [size, setSize] = useState('all');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'last', dir: -1 });
  const [showFilters, setShowFilters] = useState(false);
  const loading = useLoading(300);
  const T = today();
  const isNew = (c: Client) => c.registrationDate >= addDays(T, -30);
  const list = useMemo(() => {
    let cs = q.trim() ? searchClients(db, q, 100000) : db.clients.slice();
    cs = cs.filter(c => {
      const h = householdOf(db, c); const n = sizeOf(h);
      if (status === 'new' && !isNew(c)) return false;
      if (status === 'returning' && isNew(c)) return false;
      if (zip !== 'all' && c.zip !== zip) return false;
      if (size === '1' && n !== 1) return false;
      if (size === '2-3' && (n < 2 || n > 3)) return false;
      if (size === '4-5' && (n < 4 || n > 5)) return false;
      if (size === '6+' && n < 6) return false;
      if (since && (!c.lastServiceDate || c.lastServiceDate < since)) return false;
      if (until && (!c.lastServiceDate || c.lastServiceDate > until)) return false;
      return true;
    });
    const val = (c: Client): string | number => sort.k === 'id' ? c.id : sort.k === 'name' ? c.lastName + c.firstName : sort.k === 'zip' ? c.zip : sort.k === 'household' ? sizeOf(householdOf(db, c)) : c.lastServiceDate || '';
    return cs.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [db, q, status, zip, size, since, until, sort]);
  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th><button className="th-sort" onClick={() => setSort({ k, dir: sort.k === k ? (sort.dir === 1 ? -1 : 1) : 1 })} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>{children}{sort.k === k && (sort.dir === 1 ? <FiChevronUp /> : <FiChevronDown />)}</button></th>
  );
  const active = [status, zip, size].filter(x => x !== 'all').length + (since ? 1 : 0) + (until ? 1 : 0);
  return (
    <div>
      <PageHead title="Clients" sub={`${db.clients.length} registered clients in ${db.households.length} households`} actions={<Button icon={<FiUserPlus />} onClick={() => go('/clients/new')} data-tour="register">Register Client</Button>} />
      <div className="toolbar" data-tour="client-search">
        <div className="search"><FiSearch /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, phone, or Client ID" aria-label="Search clients" /></div>
        <Button variant="secondary" icon={<FiFilter />} onClick={() => setShowFilters(!showFilters)}>Filters{active ? ` (${active})` : ''}</Button>
      </div>
      {showFilters && (
        <div className="filters">
          <Field label="Status"><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All</option><option value="new">New (last 30 days)</option><option value="returning">Returning</option></select></Field>
          <Field label="ZIP"><select value={zip} onChange={e => setZip(e.target.value)}><option value="all">All ZIPs</option>{Object.keys(ZIPS).map(z => <option key={z} value={z}>{z} · {ZIPS[z]}</option>)}</select></Field>
          <Field label="Household size"><select value={size} onChange={e => setSize(e.target.value)}><option value="all">Any</option><option value="1">1</option><option value="2-3">2–3</option><option value="4-5">4–5</option><option value="6+">6+</option></select></Field>
          <Field label="Last service from"><input type="date" value={since} onChange={e => setSince(e.target.value)} /></Field>
          <Field label="Last service to"><input type="date" value={until} onChange={e => setUntil(e.target.value)} /></Field>
          <Button variant="ghost" onClick={() => { setStatus('all'); setZip('all'); setSize('all'); setSince(''); setUntil(''); }}>Clear</Button>
        </div>
      )}
      <Card pad={false}>
        {loading ? <div className="card-body"><Skeleton rows={8} /></div> : list.length === 0 ? <Empty title="No clients match" text="Try a different search or clear the filters." /> : (
          <div className="table-wrap">
            <table className="table table-click">
              <thead><tr><Th k="id">Client ID</Th><Th k="name">Name</Th><th className="hide-sm">Phone</th><Th k="zip">ZIP</Th><Th k="household">Household</Th><Th k="last">Last service</Th><th>Status</th></tr></thead>
              <tbody>
                {list.map(c => (
                  <tr key={c.id} onClick={() => go('/clients/' + c.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') go('/clients/' + c.id); }}>
                    <td className="mono">{c.id}</td>
                    <td><b>{c.firstName} {c.lastName}</b></td>
                    <td className="hide-sm">{c.phone}</td>
                    <td>{c.zip}</td>
                    <td>{c.householdId} <span className="muted">({sizeOf(householdOf(db, c))})</span></td>
                    <td>{fmt(c.lastServiceDate)}</td>
                    <td>{isNew(c) ? <Badge tone="orange">New</Badge> : <Badge tone="green">Returning</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="muted small">{list.length} shown</p>
    </div>
  );
}

const empty = {
  firstName: '', lastName: '', dobMode: 'dob' as 'dob' | 'cat', dob: '', ageCategory: '', gender: '', phone: '', email: '', language: 'English',
  street: '', city: '', state: 'GA', zip: '', householdMode: 'new' as 'new' | 'link', linkHouseholdId: '', hhSearch: '', members: [] as Member[],
  consent: false, eligibility: [] as string[], heardFrom: '',
};

function RegisterClient() {
  const db = useDB();
  const [step, setStep] = useState(1);
  const [f, setF] = useState(empty);
  const [err, setErr] = useState<Record<string, string>>({});
  const [ignoreDup, setIgnoreDup] = useState(false);
  const fields = Object.fromEntries(db.settings.fields.map(x => [x.key, x]));
  const show = (k: string) => fields[k]?.show !== false;
  const req = (k: string) => !!fields[k]?.show && !!fields[k]?.required;
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const dups = findDuplicates(db, { firstName: f.firstName, lastName: f.lastName, dob: f.dobMode === 'dob' ? f.dob : null, phone: f.phone, zip: f.zip });
  const linkResults = f.hhSearch.trim().length > 1 ? searchClients(db, f.hhSearch).slice(0, 5) : [];
  const linked = db.households.find(h => h.id === f.linkHouseholdId);

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!f.firstName.trim()) e.firstName = 'First name is required';
      if (!f.lastName.trim()) e.lastName = 'Last name is required';
      if (req('dob') && !(f.dobMode === 'dob' ? f.dob : f.ageCategory)) e.dob = 'Enter a date of birth or choose an age category';
      if (req('gender') && !f.gender) e.gender = 'Required';
      if (req('phone') && f.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a 10-digit phone number';
      if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email';
      else if (req('email') && !f.email) e.email = 'Required';
      if (req('language') && !f.language) e.language = 'Required';
    }
    if (s === 2) {
      if (req('street') && !f.street.trim()) e.street = 'Street address is required';
      if (req('city') && !f.city.trim()) e.city = 'City is required';
      if (!/^\d{5}$/.test(f.zip)) e.zip = 'Enter a 5-digit ZIP';
      if (f.householdMode === 'link' && !f.linkHouseholdId) e.household = 'Choose a household to link to';
      f.members.forEach((m, i) => { if (!m.name.trim()) e['m' + i] = 'Name required'; });
    }
    if (s === 3) {
      if (!f.consent) e.consent = 'Consent is required to create a record';
      if (req('eligibility') && !f.eligibility.length) e.eligibility = 'Select at least one';
      if (req('heardFrom') && !f.heardFrom) e.heardFrom = 'Required';
    }
    setErr(e);
    return Object.keys(e).length === 0;
  };
  const next = () => { if (validate(step)) setStep(step + 1); };
  const save = () => {
    if (!validate(3)) return;
    const c = registerClient({
      firstName: f.firstName, lastName: f.lastName, dob: f.dobMode === 'dob' ? f.dob || null : null,
      ageCategory: f.dobMode === 'cat' ? f.ageCategory : (f.dob ? ((age(f.dob) || 0) >= 60 ? AGE_CATS[2] : (age(f.dob) || 0) >= 18 ? AGE_CATS[1] : AGE_CATS[0]) : ''),
      gender: f.gender, phone: formatPhone(f.phone), email: f.email, language: f.language, street: f.street, city: f.city || cityFor(f.zip), state: f.state, zip: f.zip,
      householdMode: f.householdMode, linkHouseholdId: f.linkHouseholdId, members: f.members, consent: f.consent, eligibility: f.eligibility, heardFrom: f.heardFrom,
    });
    toast(`Client registered · ID ${c.id}`);
    go('/clients/' + c.id);
  };
  const size = f.householdMode === 'link' && linked ? sizeOf(linked) : 1 + f.members.length;

  return (
    <div className="narrow">
      <button className="back" onClick={() => go('/clients')}><FiArrowLeft /> Clients</button>
      <PageHead title="Register a new client" sub="Fields marked * are required. Admins can change required fields in Settings → Form Settings." />
      <ol className="progress-steps" aria-label="Progress">
        {['Personal', 'Address & Household', 'Consent & Eligibility'].map((l, i) => (
          <li key={l} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}><span>{step > i + 1 ? <FiCheck /> : i + 1}</span>{l}</li>
        ))}
      </ol>
      {dups.length > 0 && !ignoreDup && (
        <div className="dup-banner" role="alert">
          <FiAlertTriangle />
          <div>
            <b>Possible duplicate{dups.length > 1 ? 's' : ''} found</b>
            <ul>{dups.map(d => <li key={d.client.id}><span className="mono">{d.client.id}</span> {d.client.firstName} {d.client.lastName} · {d.client.phone} · ZIP {d.client.zip} <em>({d.reason})</em> <button className="link" onClick={() => go('/clients/' + d.client.id)}>Open existing record</button></li>)}</ul>
            <Button size="sm" variant="secondary" onClick={() => setIgnoreDup(true)}>Continue anyway</Button>
          </div>
        </div>
      )}
      <Card>
        {step === 1 && (
          <div className="grid-2">
            <Field label="First name" required error={err.firstName}><input value={f.firstName} onChange={e => set({ firstName: e.target.value })} autoFocus /></Field>
            <Field label="Last name" required error={err.lastName}><input value={f.lastName} onChange={e => set({ lastName: e.target.value })} /></Field>
            {show('dob') && <Field label="Date of birth or age category" required={req('dob')} error={err.dob} className="span-2">
              <div className="seg"><button type="button" className={f.dobMode === 'dob' ? 'on' : ''} onClick={() => set({ dobMode: 'dob' })}>Date of birth</button><button type="button" className={f.dobMode === 'cat' ? 'on' : ''} onClick={() => set({ dobMode: 'cat' })}>Age category</button></div>
              {f.dobMode === 'dob' ? <input type="date" value={f.dob} max={today()} onChange={e => set({ dob: e.target.value })} /> : <select value={f.ageCategory} onChange={e => set({ ageCategory: e.target.value })}><option value="">Choose…</option>{AGE_CATS.map(a => <option key={a}>{a}</option>)}</select>}
            </Field>}
            {show('gender') && <Field label="Gender" required={req('gender')} error={err.gender}><select value={f.gender} onChange={e => set({ gender: e.target.value })}><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Non-binary</option></select></Field>}
            {show('language') && <Field label="Preferred language" required={req('language')} error={err.language}><select value={f.language} onChange={e => set({ language: e.target.value })}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></Field>}
            {show('phone') && <Field label="Phone" required={req('phone')} error={err.phone}><input inputMode="tel" value={f.phone} onChange={e => set({ phone: e.target.value })} placeholder="(404) 555-0123" /></Field>}
            {show('email') && <Field label="Email" required={req('email')} error={err.email}><input type="email" value={f.email} onChange={e => set({ email: e.target.value })} placeholder="optional" /></Field>}
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <div className="grid-2">
              {show('street') && <Field label="Street address" required={req('street')} error={err.street} className="span-2"><input value={f.street} onChange={e => set({ street: e.target.value })} placeholder="1234 Memorial Dr, Apt 2" /></Field>}
              <Field label="ZIP code" required error={err.zip}><input inputMode="numeric" maxLength={5} value={f.zip} onChange={e => { const z = e.target.value.replace(/\D/g, ''); set({ zip: z, city: f.city || cityFor(z) }); }} placeholder="30310" /></Field>
              {show('city') && <Field label="City" required={req('city')} error={err.city}><input value={f.city} onChange={e => set({ city: e.target.value })} /></Field>}
              <Field label="State"><input value={f.state} onChange={e => set({ state: e.target.value.toUpperCase().slice(0, 2) })} /></Field>
            </div>
            <Field label="Household" error={err.household}>
              <div className="seg"><button type="button" className={f.householdMode === 'new' ? 'on' : ''} onClick={() => set({ householdMode: 'new' })}>Create new household</button><button type="button" className={f.householdMode === 'link' ? 'on' : ''} onClick={() => set({ householdMode: 'link' })}>Link to existing household</button></div>
            </Field>
            {f.householdMode === 'link' ? (
              <div className="stack">
                <div className="search"><FiSearch /><input value={f.hhSearch} onChange={e => set({ hhSearch: e.target.value })} placeholder="Search a family member by name, phone or ID" /></div>
                {linkResults.map(c => (
                  <button key={c.id} type="button" className={`pick ${f.linkHouseholdId === c.householdId ? 'pick-on' : ''}`} onClick={() => set({ linkHouseholdId: c.householdId })}>
                    <b>{c.householdId}</b> · {c.firstName} {c.lastName} · {sizeOf(householdOf(db, c))} people · {c.street}, {c.zip}
                  </button>
                ))}
                {linked && <Alert tone="success">Linking to <b>{linked.id}</b> ({sizeOf(linked)} people). The client won't need to re-register household members.</Alert>}
              </div>
            ) : (
              <div className="stack">
                <div className="members-head"><b>Household members</b><span className="muted">(besides this client)</span></div>
                {f.members.map((m, i) => (
                  <div key={i} className="member-row">
                    <Field label="Name" error={err['m' + i]}><input value={m.name} onChange={e => { const ms = [...f.members]; ms[i] = { ...m, name: e.target.value }; set({ members: ms }); }} /></Field>
                    <Field label="Relationship"><select value={m.relationship} onChange={e => { const ms = [...f.members]; ms[i] = { ...m, relationship: e.target.value }; set({ members: ms }); }}>{['Spouse', 'Partner', 'Child', 'Grandchild', 'Parent', 'Sibling', 'Other relative', 'Household member'].map(r => <option key={r}>{r}</option>)}</select></Field>
                    <Field label="Age category"><select value={m.ageCategory} onChange={e => { const ms = [...f.members]; ms[i] = { ...m, ageCategory: e.target.value }; set({ members: ms }); }}>{AGE_CATS.map(a => <option key={a}>{a}</option>)}</select></Field>
                    <button type="button" className="icon-btn danger" aria-label="Remove member" onClick={() => set({ members: f.members.filter((_, k) => k !== i) })}><FiTrash2 /></button>
                  </div>
                ))}
                <Button variant="secondary" icon={<FiPlus />} onClick={() => set({ members: [...f.members, { name: f.lastName ? ` ${f.lastName}` : '', relationship: 'Child', ageCategory: AGE_CATS[0] }] })}>Add household member</Button>
              </div>
            )}
            <div className="hh-size">Household size: <b>{size}</b> <span className="muted small">(calculated automatically)</span></div>
          </div>
        )}
        {step === 3 && (
          <div className="stack">
            <Field label="Consent to data collection" required error={err.consent}>
              <label className="check"><input type="checkbox" checked={f.consent} onChange={e => set({ consent: e.target.checked })} /> The client agrees that Sunrise Community Alliance may store this information to provide services. Consent date: <b>{fmt(today())}</b></label>
            </Field>
            {show('eligibility') && <Field label="Eligibility" required={req('eligibility')} error={err.eligibility}><Chips options={ELIGIBILITY} value={f.eligibility} onChange={v => set({ eligibility: v })} /></Field>}
            {show('heardFrom') && <Field label="How did they hear about us?" required={req('heardFrom')} error={err.heardFrom}><select value={f.heardFrom} onChange={e => set({ heardFrom: e.target.value })}><option value="">Choose…</option>{HEARD_FROM.map(h => <option key={h}>{h}</option>)}</select></Field>}
            <Alert tone="info">Do not record medical diagnoses, treatment, or other clinical information in PantryBridge.</Alert>
          </div>
        )}
        <div className="form-foot">
          {step > 1 ? <Button variant="secondary" icon={<FiArrowLeft />} onClick={() => setStep(step - 1)}>Back</Button> : <Button variant="ghost" onClick={() => go('/clients')}>Cancel</Button>}
          {step < 3 ? <Button onClick={next}>Next <FiArrowRight /></Button> : <Button icon={<FiCheck />} onClick={save}>Save client</Button>}
        </div>
      </Card>
    </div>
  );
}

function ClientProfile({ id }: { id: string }) {
  const db = useDB();
  const s = useSession()!;
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(false);
  const [ref, setRef] = useState(false);
  const c = db.clients.find(x => x.id === id);
  if (!c) return <Empty title="Client not found" action={<Button onClick={() => go('/clients')}>Back to clients</Button>} />;
  const h = householdOf(db, c);
  const hhClients = db.clients.filter(x => x.householdId === h.id);
  const visits = db.visits.filter(v => v.householdId === h.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const appts = [...db.pantry.filter(p => p.clientId === id).map(p => ({ ...p, kind: 'pantry' as const, program: 'Pantry' })), ...db.appts.filter(a => a.clientId === id).map(a => ({ ...a, kind: 'program' as const }))].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const refs = db.referrals.filter(r => r.clientId === id);
  const logs = db.log.filter(l => l.record.includes(id) || l.record.includes(h.id));
  const isNew = c.registrationDate >= addDays(today(), -30);
  const tabs = [
    { key: 'overview', label: 'Overview' }, { key: 'household', label: `Household (${sizeOf(h)})` }, { key: 'history', label: `Service History (${visits.length})` },
    { key: 'appointments', label: `Appointments (${appts.length})` }, { key: 'referrals', label: `Referrals (${refs.length})` },
    ...(s.role === 'admin' ? [{ key: 'log', label: 'Activity Log' }] : []),
  ];
  return (
    <div>
      <button className="back" onClick={() => go('/clients')}><FiArrowLeft /> Clients</button>
      <div className="profile-head card">
        <div className="avatar-lg">{c.firstName[0]}{c.lastName[0]}</div>
        <div className="profile-main">
          <h1>{c.firstName} {c.lastName} {isNew ? <Badge tone="orange">New</Badge> : <Badge tone="green">Returning</Badge>} {!c.consent && <Badge tone="red">Consent missing</Badge>}</h1>
          <p className="muted"><span className="mono">{c.id}</span> · Household <span className="mono">{h.id}</span> · Registered {fmt(c.registrationDate)} · Last service {fmt(c.lastServiceDate)}</p>
          <p className="contact"><span><FiPhone /> {c.phone}</span>{c.email && <span><FiMail /> {c.email}</span>}<span><FiMapPin /> {c.street ? `${c.street}, ` : ''}{c.city} {c.state} {c.zip}</span></p>
        </div>
        <div className="profile-actions"><Button variant="secondary" icon={<FiEdit2 />} onClick={() => setEdit(true)}>Edit</Button><Button variant="secondary" icon={<FiSend />} onClick={() => setRef(true)}>Add referral</Button><Button onClick={() => go('/pantry?book=1&client=' + c.id)}>Book appointment</Button></div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'overview' && (
        <div className="grid-2 gap-lg">
          <Card title="Personal">
            <dl className="dl">
              <dt>Date of birth</dt><dd>{c.dob ? `${fmt(c.dob)} (age ${age(c.dob)})` : c.ageCategory || '—'}</dd>
              <dt>Gender</dt><dd>{c.gender || '—'}</dd>
              <dt>Preferred language</dt><dd>{c.language || '—'}</dd>
              <dt>Data source</dt><dd>{c.source}</dd>
            </dl>
          </Card>
          <Card title="Consent & eligibility">
            <dl className="dl">
              <dt>Consent</dt><dd>{c.consent ? `Given ${fmt(c.consentDate)}` : 'Not recorded'}</dd>
              <dt>Eligibility</dt><dd>{c.eligibility.length ? c.eligibility.join(', ') : '—'}</dd>
              <dt>Heard about us</dt><dd>{c.heardFrom || '—'}</dd>
            </dl>
          </Card>
          <Card title="Service summary" className="span-2">
            <div className="mini-stats">
              <div><b>{visits.filter(v => v.type === 'distribution').length}</b><TypeTag type="distribution" /></div>
              <div><b>{visits.filter(v => v.type === 'pantry').length}</b><TypeTag type="pantry" /></div>
              <div><b>{visits.filter(v => v.type === 'program').length}</b><TypeTag type="program" /></div>
            </div>
          </Card>
        </div>
      )}
      {tab === 'household' && <HouseholdTab hid={h.id} />}
      {tab === 'history' && (
        <Card pad={false}>{visits.length === 0 ? <Empty title="No services yet" /> : (
          <ul className="timeline">{visits.map(v => (
            <li key={v.id} className={`tl-${v.type}`}>
              <span className="tl-date">{fmt(v.date)}<small>{fmtTime(v.time)}</small></span>
              <div><TypeTag type={v.type} label={v.type === 'program' ? v.program : undefined} /> {v.type === 'distribution' && db.events.find(e => e.id === v.eventId)?.name}{v.type === 'pantry' && `Pantry visit${v.lbs ? ` · ${v.lbs} lbs` : ''}`}
                <p className="muted small">{clientName(db, v.clientId)} · Household size {v.householdSize}{v.categories.length ? ` · ${v.categories.join(', ')}` : ''}{v.firstTime ? ' · First time' : ''} · by {v.by}</p></div>
            </li>
          ))}</ul>
        )}</Card>
      )}
      {tab === 'appointments' && (
        <Card pad={false}>{appts.length === 0 ? <Empty title="No appointments" /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>{appts.slice(0, 40).map(a => <tr key={a.id}><td>{fmt(a.date)}</td><td>{fmtTime(a.time)}</td><td><TypeTag type={a.kind} label={a.kind === 'program' ? (a as any).program : 'Pantry'} /></td><td><StatusBadge status={a.status} /></td><td className="muted">{a.notes || '—'}</td></tr>)}</tbody></table></div>
        )}</Card>
      )}
      {tab === 'referrals' && (
        <Card pad={false} actions={<Button size="sm" icon={<FiPlus />} onClick={() => setRef(true)}>Add referral</Button>} title="Referrals">
          {refs.length === 0 ? <Empty title="No referrals" /> : <div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Referred to</th><th>Type</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>{refs.map(r => <tr key={r.id}><td>{fmt(r.date)}</td><td><b>{r.to}</b></td><td>{r.kind}</td><td>
              <select className="inline-select" value={r.status} onChange={e => update(d => { const x = d.referrals.find(y => y.id === r.id)!; log(d, 'Updated referral', r.id, 'Status: ' + x.status, 'Status: ' + e.target.value); x.status = e.target.value as any; })}>{['Sent', 'Accepted', 'Completed'].map(o => <option key={o}>{o}</option>)}</select>
            </td><td className="muted">{r.note}</td></tr>)}</tbody></table></div>}
        </Card>
      )}
      {tab === 'log' && (
        <Card pad={false}>{logs.length === 0 ? <Empty title="No logged changes for this client yet" /> : <div className="table-wrap"><table className="table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Change</th></tr></thead>
          <tbody>{logs.map(l => <tr key={l.id}><td className="nowrap">{l.ts}</td><td>{l.user}</td><td>{l.action}</td><td>{l.before ? <><s>{l.before}</s> → {l.after}</> : l.record}</td></tr>)}</tbody></table></div>}</Card>
      )}
      {hhClients.length > 1 && tab === 'overview' && <p className="muted small">Other registered clients in this household: {hhClients.filter(x => x.id !== c.id).map(x => <a key={x.id} href={'#/clients/' + x.id}>{x.firstName} {x.lastName} ({x.id}) </a>)}</p>}
      <EditClient open={edit} onClose={() => setEdit(false)} client={c} />
      <ReferralModal open={ref} onClose={() => setRef(false)} clientId={c.id} />
    </div>
  );
}

function HouseholdTab({ hid }: { hid: string }) {
  const db = useDB();
  const h = db.households.find(x => x.id === hid)!;
  const [adding, setAdding] = useState<Member | null>(null);
  const head = db.clients.find(c => c.id === h.headClientId)!;
  const regd = db.clients.filter(c => c.householdId === hid);
  return (
    <Card title={`Household ${h.id} · ${sizeOf(h)} people`} actions={<Button size="sm" icon={<FiPlus />} onClick={() => setAdding({ name: '', relationship: 'Child', ageCategory: AGE_CATS[0] })}>Add member</Button>} pad={false}>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Name</th><th>Relationship</th><th>Age category</th><th>Registered client</th><th /></tr></thead>
        <tbody>
          <tr><td><b>{head.firstName} {head.lastName}</b></td><td>Head of household</td><td>{head.ageCategory || '—'}</td><td><a href={'#/clients/' + head.id} className="mono">{head.id}</a></td><td /></tr>
          {h.members.map((m, i) => {
            const rc = regd.find(c => `${c.firstName} ${c.lastName}` === m.name);
            return (
              <tr key={i}><td>{m.name}</td><td>{m.relationship}</td><td>{m.ageCategory}</td><td>{rc ? <a href={'#/clients/' + rc.id} className="mono">{rc.id}</a> : <span className="muted">—</span>}</td>
                <td><button className="icon-btn danger" aria-label={`Remove ${m.name}`} onClick={() => { update(d => { const hh = d.households.find(x => x.id === hid)!; hh.members.splice(i, 1); log(d, 'Updated household', hid, `Size: ${sizeOf(h)}`, `Size: ${sizeOf(h) - 1}`); }); toast('Member removed. Household size updated.'); }}><FiTrash2 /></button></td></tr>
            );
          })}
        </tbody>
      </table></div>
      <Modal open={!!adding} onClose={() => setAdding(null)} title="Add household member" size="sm"
        footer={<><Button variant="secondary" onClick={() => setAdding(null)}>Cancel</Button><Button onClick={() => { if (!adding?.name.trim()) return; update(d => { d.households.find(x => x.id === hid)!.members.push(adding!); log(d, 'Updated household', hid, `Size: ${sizeOf(h)}`, `Size: ${sizeOf(h) + 1}`); }); setAdding(null); toast('Member added.'); }}>Add</Button></>}>
        {adding && <div className="stack">
          <Field label="Name" required><input autoFocus value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} /></Field>
          <Field label="Relationship"><select value={adding.relationship} onChange={e => setAdding({ ...adding, relationship: e.target.value })}>{['Spouse', 'Partner', 'Child', 'Grandchild', 'Parent', 'Sibling', 'Other relative'].map(r => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Age category"><select value={adding.ageCategory} onChange={e => setAdding({ ...adding, ageCategory: e.target.value })}>{AGE_CATS.map(a => <option key={a}>{a}</option>)}</select></Field>
        </div>}
      </Modal>
    </Card>
  );
}

function EditClient({ open, onClose, client }: { open: boolean; onClose: () => void; client: Client }) {
  const [f, setF] = useState(client);
  React.useEffect(() => { if (open) setF(client); }, [open]);
  const save = () => {
    const changes: string[] = [];
    (['firstName', 'lastName', 'phone', 'email', 'street', 'city', 'zip', 'language'] as const).forEach(k => { if (f[k] !== client[k]) changes.push(k); });
    update(d => {
      const i = d.clients.findIndex(x => x.id === client.id);
      d.clients[i] = { ...f };
      changes.forEach(k => log(d, 'Updated client', client.id, `${k}: ${(client as any)[k] || '—'}`, `${k}: ${(f as any)[k] || '—'}`));
    });
    toast(changes.length ? 'Client updated.' : 'No changes to save.', changes.length ? 'success' : 'info');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={`Edit ${client.firstName} ${client.lastName}`} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save changes</Button></>}>
      <div className="grid-2">
        <Field label="First name" required><input value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></Field>
        <Field label="Last name" required><input value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></Field>
        <Field label="Phone"><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email"><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Street" className="span-2"><input value={f.street} onChange={e => setF({ ...f, street: e.target.value })} /></Field>
        <Field label="City"><input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="ZIP"><input value={f.zip} maxLength={5} onChange={e => setF({ ...f, zip: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Preferred language"><select value={f.language} onChange={e => setF({ ...f, language: e.target.value })}>{['', ...LANGUAGES].map(l => <option key={l} value={l}>{l || '—'}</option>)}</select></Field>
        <Field label="Consent"><label className="check"><input type="checkbox" checked={f.consent} onChange={e => setF({ ...f, consent: e.target.checked, consentDate: e.target.checked ? (f.consentDate || today()) : null })} /> Consent given</label></Field>
      </div>
      <p className="muted small">Every change is recorded in the audit log with the old and new value.</p>
    </Modal>
  );
}

export function ReferralModal({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId: string }) {
  const db = useDB();
  const [f, setF] = useState({ kind: 'Partner agency' as Referral['kind'], to: '', note: '' });
  React.useEffect(() => { if (open) setF({ kind: 'Partner agency', to: '', note: '' }); }, [open]);
  const save = () => {
    if (!f.to.trim()) { toast('Choose where the referral is going.', 'error'); return; }
    update(d => { const id = nextId(d, 'misc', 'RF-', 4); d.referrals.push({ id, clientId, to: f.to, kind: f.kind, status: 'Sent', date: today(), note: f.note }); log(d, 'Added referral', `${id} for ${clientId}`); });
    toast('Referral added.'); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add referral" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save referral</Button></>}>
      <div className="stack">
        <p className="muted">For {clientName(db, clientId)}</p>
        <Field label="Referral type"><div className="seg"><button type="button" className={f.kind === 'Partner agency' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'Partner agency', to: '' })}>Partner agency</button><button type="button" className={f.kind === 'Internal program' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'Internal program', to: '' })}>Internal program</button></div></Field>
        <Field label="Referred to" required>{f.kind === 'Internal program'
          ? <select value={f.to} onChange={e => setF({ ...f, to: e.target.value })}><option value="">Choose…</option>{db.programs.filter(p => p.active).map(p => <option key={p.id}>{p.name}</option>)}</select>
          : <input list="agencies" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} placeholder="Agency name" />}
          <datalist id="agencies">{['Metro Atlanta Legal Aid Clinic', 'Gwinnett Workforce Center', 'DeKalb Community Health Clinic', 'United Way 211', 'Georgia Division of Family & Children Services (DFCS)'].map(a => <option key={a} value={a} />)}</datalist>
        </Field>
        <Field label="Note" hint="Administrative notes only. Do not enter medical information."><textarea rows={3} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
