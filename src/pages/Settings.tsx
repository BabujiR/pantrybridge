import React, { useMemo, useState } from 'react';
import { FiUsers, FiSliders, FiTag, FiUpload, FiDownload, FiList, FiShield, FiUserPlus, FiKey, FiUserX, FiUserCheck, FiPlus, FiCheck, FiAlertTriangle, FiFileText, FiArrowRight, FiArrowLeft, FiSearch, FiClock, FiDatabase, FiLock, FiEye } from 'react-icons/fi';
import { useDB, update, log, toast, nextId, useSession } from '../lib/store';
import { go, parts, useRoute } from '../lib/router';
import { Button, Card, PageHead, Field, Modal, Badge, StatusBadge, Empty, Alert, Kpi } from '../components/ui';
import { triggerTimeoutPreview, DEMO_USERS } from '../components/Shell';
import { fmt, today, nowStamp } from '../lib/dates';
import { buildXLSX, downloadBlob, exportCSV, parseCSV, parseXLSX, Row } from '../lib/files';
import { findDuplicates, norm, digits, cityFor } from '../lib/actions';
import { formatPhone } from './CheckIn';
import type { Role, Client } from '../lib/types';

const SECTIONS = [
  { key: 'users', label: 'Users', icon: <FiUsers /> },
  { key: 'forms', label: 'Form Settings', icon: <FiSliders /> },
  { key: 'programs', label: 'Programs & Categories', icon: <FiTag /> },
  { key: 'import', label: 'Data Import', icon: <FiUpload /> },
  { key: 'export', label: 'Data Export', icon: <FiDownload /> },
  { key: 'activity', label: 'Activity Log', icon: <FiList /> },
  { key: 'security', label: 'Security', icon: <FiShield /> },
];

export function Settings() {
  const sec = parts(useRoute())[1] || 'users';
  return (
    <div>
      <PageHead title="Settings" sub="Administrator tools. Changes here are recorded in the activity log." />
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings">
          {SECTIONS.map(s => <a key={s.key} href={'#/settings/' + s.key} className={sec === s.key ? 'on' : ''}>{s.icon}<span>{s.label}</span></a>)}
        </nav>
        <div className="settings-body">
          {sec === 'users' && <UsersPage />}
          {sec === 'forms' && <FormSettings />}
          {sec === 'programs' && <ProgramsPage />}
          {sec === 'import' && <ImportWizard />}
          {sec === 'export' && <ExportPage />}
          {sec === 'activity' && <ActivityLog />}
          {sec === 'security' && <SecurityPage />}
        </div>
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', staff: 'Staff Member', volunteer: 'Volunteer' };

function UsersPage() {
  const db = useDB();
  const me = useSession()!;
  const [invite, setInvite] = useState(false);
  const [deact, setDeact] = useState<string | null>(null);
  const [roleChange, setRoleChange] = useState<{ id: string; role: Role } | null>(null);
  const [f, setF] = useState({ name: '', email: '', role: 'volunteer' as Role });
  const u = (id: string) => db.users.find(x => x.id === id)!;
  const send = () => {
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) { toast('Enter a name and valid email.', 'error'); return; }
    update(d => { const id = nextId(d, 'misc', 'U', 1); d.users.push({ id, name: f.name, email: f.email, role: f.role, active: true, mfa: false, lastLogin: null }); log(d, 'Invited user', `${f.name} (${ROLE_LABEL[f.role]})`); });
    toast(`Invitation sent to ${f.email}.`); setInvite(false); setF({ name: '', email: '', role: 'volunteer' });
  };
  return (
    <Card title={`Users (${db.users.length})`} actions={<Button size="sm" icon={<FiUserPlus />} onClick={() => setInvite(true)}>Invite user</Button>} pad={false}>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>MFA</th><th className="hide-sm">Last login</th><th>Actions</th></tr></thead>
        <tbody>{db.users.map(x => (
          <tr key={x.id} className={x.active ? '' : 'row-muted'}>
            <td><b>{x.name}</b><div className="muted small">{x.email}</div></td>
            <td><select className="inline-select" value={x.role} disabled={x.id === me.userId || !x.active} onChange={e => setRoleChange({ id: x.id, role: e.target.value as Role })} aria-label={`Role for ${x.name}`}>
              {(['admin', 'staff', 'volunteer'] as Role[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
            <td><StatusBadge status={x.active ? 'Active' : 'Inactive'} /></td>
            <td>{x.mfa ? <Badge tone="green">On</Badge> : <Badge tone={x.role === 'admin' ? 'red' : 'amber'}>Not set up</Badge>}</td>
            <td className="hide-sm nowrap">{x.lastLogin || 'Never'}</td>
            <td className="nowrap">
              <button className="icon-btn" title="Reset password" aria-label={`Reset password for ${x.name}`} onClick={() => { update(d => log(d, 'Sent password reset', x.name)); toast(`Password reset link sent to ${x.email}.`, 'info'); }}><FiKey /></button>
              {x.id !== me.userId && (x.active
                ? <button className="icon-btn danger" title="Deactivate" aria-label={`Deactivate ${x.name}`} onClick={() => setDeact(x.id)}><FiUserX /></button>
                : <button className="icon-btn" title="Reactivate" aria-label={`Reactivate ${x.name}`} onClick={() => { update(d => { d.users.find(y => y.id === x.id)!.active = true; log(d, 'Reactivated user', x.name, 'Status: Inactive', 'Status: Active'); }); toast(`${x.name} reactivated.`); }}><FiUserCheck /></button>)}
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      <Modal open={invite} onClose={() => setInvite(false)} title="Invite user" size="sm" footer={<><Button variant="secondary" onClick={() => setInvite(false)}>Cancel</Button><Button onClick={send}>Send invitation</Button></>}>
        <div className="stack">
          <Field label="Full name" required><input autoFocus value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email" required><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Role"><select value={f.role} onChange={e => setF({ ...f, role: e.target.value as Role })}>{(['admin', 'staff', 'volunteer'] as Role[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
          {f.role === 'admin' && <Alert tone="info">Administrators must set up multifactor authentication at first sign-in.</Alert>}
        </div>
      </Modal>
      <Modal open={!!deact} onClose={() => setDeact(null)} title="Deactivate user?" size="sm" tone="danger"
        footer={<><Button variant="secondary" onClick={() => setDeact(null)}>Cancel</Button><Button variant="danger" onClick={() => { const x = u(deact!); update(d => { d.users.find(y => y.id === x.id)!.active = false; log(d, 'Deactivated user', x.name, 'Status: Active', 'Status: Inactive'); }); toast(`${x.name} deactivated. Access removed immediately.`); setDeact(null); }}>Deactivate</Button></>}>
        {deact && <p><b>{u(deact).name}</b> will lose access immediately and any open sessions will end. Their past activity stays in the audit log.</p>}
      </Modal>
      <Modal open={!!roleChange} onClose={() => setRoleChange(null)} title="Change role?" size="sm"
        footer={<><Button variant="secondary" onClick={() => setRoleChange(null)}>Cancel</Button><Button onClick={() => { const x = u(roleChange!.id); update(d => { d.users.find(y => y.id === x.id)!.role = roleChange!.role; log(d, 'Changed role', x.name, 'Role: ' + ROLE_LABEL[x.role], 'Role: ' + ROLE_LABEL[roleChange!.role]); }); toast('Role updated.'); setRoleChange(null); }}>Change role</Button></>}>
        {roleChange && <p>Change <b>{u(roleChange.id).name}</b> from {ROLE_LABEL[u(roleChange.id).role]} to <b>{ROLE_LABEL[roleChange.role]}</b>? Their permissions change on their next action.</p>}
      </Modal>
    </Card>
  );
}

function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`toggle ${on ? 'toggle-on' : ''}`} onClick={() => onChange(!on)}><span /></button>;
}

function FormSettings() {
  const db = useDB();
  const setField = (key: string, patch: { show?: boolean; required?: boolean }) => update(d => {
    const fld = d.settings.fields.find(x => x.key === key)!;
    const before = `Show: ${fld.show ? 'Yes' : 'No'}, Required: ${fld.required ? 'Yes' : 'No'}`;
    Object.assign(fld, patch);
    if (patch.show === false) fld.required = false;
    log(d, 'Updated form settings', fld.label, before, `Show: ${fld.show ? 'Yes' : 'No'}, Required: ${fld.required ? 'Yes' : 'No'}`);
  });
  return (
    <Card title="Registration form fields" actions={<Button size="sm" variant="secondary" icon={<FiEye />} onClick={() => go('/clients/new')}>Preview form</Button>} pad={false}>
      <div className="card-body"><p className="muted">Choose which fields appear on the client registration form and which are required. Changes apply immediately, with no developer needed. Locked fields are needed for duplicate checks and reporting.</p></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Field</th><th>Form step</th><th>Show</th><th>Required</th></tr></thead>
        <tbody>{db.settings.fields.map(fl => (
          <tr key={fl.key}>
            <td><b>{fl.label}</b>{fl.locked && <span className="muted small"> <FiLock /> locked</span>}</td>
            <td>{['', 'Personal', 'Address & Household', 'Consent & Eligibility'][fl.step]}</td>
            <td><Toggle label={`Show ${fl.label}`} on={fl.show} disabled={fl.locked} onChange={v => { setField(fl.key, { show: v }); toast(`${fl.label} ${v ? 'shown' : 'hidden'} on the form.`, 'info'); }} /></td>
            <td><Toggle label={`Require ${fl.label}`} on={fl.required} disabled={fl.locked || !fl.show} onChange={v => { setField(fl.key, { required: v }); toast(`${fl.label} is now ${v ? 'required' : 'optional'}.`, 'info'); }} /></td>
          </tr>
        ))}</tbody>
      </table></div>
    </Card>
  );
}

function ProgramsPage() {
  const db = useDB();
  const [newProg, setNewProg] = useState('');
  const [newCat, setNewCat] = useState('');
  const COLORS = ['#B45309', '#0E7490', '#7C3AED', '#BE185D', '#4D7C0F', '#1D4ED8'];
  return (
    <div className="stack">
      <Card title="Programs" pad={false}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Color</th><th>Name</th><th>Appointments</th><th>Active</th></tr></thead>
          <tbody>{db.programs.map(p => (
            <tr key={p.id} className={p.active ? '' : 'row-muted'}>
              <td><div className="swatches">{COLORS.map(c => <button key={c} aria-label={`Color ${c}`} className={`swatch ${p.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => update(d => { d.programs.find(x => x.id === p.id)!.color = c; log(d, 'Recolored program', p.name); })} />)}</div></td>
              <td><input className="inline-input" defaultValue={p.name} aria-label="Program name" onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.name) { update(d => { d.programs.find(x => x.id === p.id)!.name = v; d.appts.forEach(a => { if (a.program === p.name) a.program = v; }); d.visits.forEach(a => { if (a.program === p.name) a.program = v; }); log(d, 'Renamed program', p.id, p.name, v); }); toast('Program renamed.'); } }} /></td>
              <td>{db.appts.filter(a => a.program === p.name).length}</td>
              <td><Toggle label={`${p.name} active`} on={p.active} onChange={v => { update(d => { d.programs.find(x => x.id === p.id)!.active = v; log(d, v ? 'Activated program' : 'Deactivated program', p.name); }); toast(`${p.name} ${v ? 'activated' : 'deactivated'}.`, 'info'); }} /></td>
            </tr>
          ))}</tbody>
        </table></div>
        <div className="card-body row gap"><input value={newProg} onChange={e => setNewProg(e.target.value)} placeholder="New program name" aria-label="New program name" /><Button icon={<FiPlus />} onClick={() => { if (!newProg.trim()) return; update(d => { d.programs.push({ id: nextId(d, 'misc', 'PG-', 1), name: newProg.trim(), color: COLORS[d.programs.length % COLORS.length], active: true }); log(d, 'Added program', newProg.trim()); }); setNewProg(''); toast('Program added.'); }}>Add program</Button></div>
      </Card>
      <Card title="Food assistance categories" pad={false}>
        <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Active</th></tr></thead>
          <tbody>{db.categories.map(c => (
            <tr key={c.id} className={c.active ? '' : 'row-muted'}>
              <td><input className="inline-input" defaultValue={c.name} aria-label="Category name" onBlur={e => { const v = e.target.value.trim(); if (v && v !== c.name) { update(d => { d.categories.find(x => x.id === c.id)!.name = v; log(d, 'Renamed food category', c.id, c.name, v); }); toast('Category renamed.'); } }} /></td>
              <td><Toggle label={`${c.name} active`} on={c.active} onChange={v => { update(d => { d.categories.find(x => x.id === c.id)!.active = v; log(d, v ? 'Activated food category' : 'Deactivated food category', c.name); }); }} /></td>
            </tr>
          ))}</tbody></table></div>
        <div className="card-body row gap"><input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category (e.g. Hygiene Kits)" aria-label="New category" /><Button icon={<FiPlus />} onClick={() => { if (!newCat.trim()) return; update(d => { d.categories.push({ id: nextId(d, 'misc', 'FC-', 1), name: newCat.trim(), active: true }); log(d, 'Added food category', newCat.trim()); }); setNewCat(''); toast('Category added.'); }}>Add category</Button></div>
      </Card>
    </div>
  );
}

// ---------------- Data import ----------------
const TARGETS: { key: string; label: string }[] = [
  { key: '', label: '— Ignore this column —' }, { key: 'fullName', label: 'Full name (split into first/last)' }, { key: 'firstName', label: 'First name' }, { key: 'lastName', label: 'Last name' },
  { key: 'dob', label: 'Date of birth' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'street', label: 'Street address' }, { key: 'city', label: 'City' },
  { key: 'zip', label: 'ZIP code' }, { key: 'householdSize', label: 'Household size' }, { key: 'registrationDate', label: 'Registration date' },
];
function guess(col: string): string {
  const c = norm(col);
  if (/^(clientname|name|fullname|client)$/.test(c)) return 'fullName';
  if (c.includes('first')) return 'firstName';
  if (c.includes('last') || c.includes('surname')) return 'lastName';
  if (c.includes('dob') || c.includes('birth')) return 'dob';
  if (c.includes('phone') || c.includes('mobile') || c.includes('cell')) return 'phone';
  if (c.includes('email')) return 'email';
  if (c.includes('zip') || c.includes('postal')) return 'zip';
  if (c.includes('city')) return 'city';
  if (c.includes('address') || c.includes('street')) return 'street';
  if (c.includes('household') || c.includes('hhsize') || c.includes('members')) return 'householdSize';
  if (c.includes('registered') || c.includes('created') || c.includes('signup')) return 'registrationDate';
  return '';
}
function normDate(v: string): string {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? (Number(m[3]) > 30 ? '19' : '20') + m[3] : m[3]; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  if (/^\d{5}$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000); return d.toISOString().slice(0, 10); }
  return '';
}

function sampleRows(src: 'A' | 'B', db: ReturnType<typeof useDB>): Row[] {
  const ex = db.clients;
  if (src === 'A') return [
    { 'First Name': 'Yesenia', 'Last Name': 'Batista', DOB: '04/12/1986', 'Phone Number': '(404) 555-7781', Email: 'ybatista@example.com', Address: '2210 Campbellton Rd', City: 'Atlanta', Zip: '30310', 'HH Size': 4 },
    { 'First Name': ex[0].firstName, 'Last Name': ex[0].lastName, DOB: ex[0].dob ? ex[0].dob.slice(5, 7) + '/' + ex[0].dob.slice(8) + '/' + ex[0].dob.slice(0, 4) : '', 'Phone Number': ex[0].phone, Email: 'rosa.new@example.com', Address: ex[0].street, City: ex[0].city, Zip: ex[0].zip, 'HH Size': 3 },
    { 'First Name': 'Marc-Andre', 'Last Name': 'Toussaint', DOB: '11/02/1959', 'Phone Number': '(678) 555-2290', Email: '', Address: '871 Candler Rd', City: 'Decatur', Zip: '30032', 'HH Size': 2 },
    { 'First Name': '', 'Last Name': 'Unknown', DOB: '', 'Phone Number': '555-12', Email: '', Address: '', City: '', Zip: '331', 'HH Size': '' },
    { 'First Name': 'Lourdes', 'Last Name': 'Ferrer', DOB: '07/30/1972', 'Phone Number': '(770) 555-4410', Email: 'lferrer@example.com', Address: '640 Buford Hwy', City: 'Norcross', Zip: '30093', 'HH Size': 5 },
    { 'First Name': 'Tyrone', 'Last Name': 'Wallace', DOB: '01/15/1990', 'Phone Number': '(470) 555-3302', Email: '', Address: '1500 Jonesboro Rd', City: 'Forest Park', Zip: '30297', 'HH Size': 1 },
  ];
  return [
    { client_name: `${ex[1].firstName} ${ex[1].lastName}`, mobile: ex[1].phone, street: ex[1].street, zip_code: ex[1].zip, household_members: 2, date_registered: '2023-06-14' },
    { client_name: 'Altagrace Jeanty', mobile: '(404) 555-6619', street: '95 Moreland Ave', zip_code: '30315', household_members: 6, date_registered: '2024-02-03' },
    { client_name: 'Hector Salgado', mobile: '(770) 555-8812', street: '3300 Jimmy Carter Blvd', zip_code: '30093', household_members: 3, date_registered: '2024-08-21' },
    { client_name: `${ex[5].firstName} ${ex[5].lastName}`, mobile: '(678) 555-0000', street: ex[5].street, zip_code: ex[5].zip, household_members: 4, date_registered: '2023-11-30' },
    { client_name: 'Brianna Coleman', mobile: '(678) 555-7120', street: '412 Cobb Pkwy', zip_code: '30060', household_members: 3, date_registered: '2025-01-09' },
    { client_name: 'No Zip Person', mobile: '(470) 555-9090', street: '', zip_code: '', household_members: 2, date_registered: '' },
  ];
}

type Parsed = { firstName: string; lastName: string; dob: string; phone: string; email: string; street: string; city: string; zip: string; householdSize: number; registrationDate: string };
type Decision = 'merge' | 'both' | 'skip';

function ImportWizard() {
  const db = useDB();
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<'Source System A' | 'Source System B'>('Source System A');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [result, setResult] = useState<{ added: number; merged: number; skipped: number; errors: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const header = rows[0] || [];
  const body = rows.slice(1);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const isX = /\.xlsx$/i.test(file.name);
      const data = isX ? await parseXLSX(await file.arrayBuffer()) : parseCSV(await file.text());
      if (data.length < 2) throw new Error('The file has no data rows.');
      setRows(data); setFileName(file.name); setMap(data[0].map(guess)); setDecisions({}); setStep(2);
    } catch (e: any) { toast('Could not read file: ' + (e?.message || 'unknown error'), 'error'); }
    setBusy(false);
  };
  const sample = async (src: 'A' | 'B') => {
    const blob = await buildXLSX([{ name: `Source System ${src}`, rows: sampleRows(src, db) }]);
    downloadBlob(blob, `sample-source-system-${src.toLowerCase()}.xlsx`);
  };
  const useSample = (src: 'A' | 'B') => {
    const r = sampleRows(src, db); const cols = Object.keys(r[0]);
    const data = [cols, ...r.map(x => cols.map(c => String(x[c] ?? '')))];
    setSource(src === 'A' ? 'Source System A' : 'Source System B'); setRows(data); setFileName(`sample-source-system-${src.toLowerCase()}.xlsx`); setMap(cols.map(guess)); setDecisions({}); setStep(2);
  };

  const parsed = useMemo(() => body.map(r => {
    const p: Parsed = { firstName: '', lastName: '', dob: '', phone: '', email: '', street: '', city: '', zip: '', householdSize: 1, registrationDate: '' };
    map.forEach((t, i) => {
      const v = (r[i] || '').trim(); if (!t || !v) return;
      if (t === 'fullName') { const parts = v.split(/\s+/); p.firstName = parts[0]; p.lastName = parts.slice(1).join(' '); }
      else if (t === 'householdSize') p.householdSize = Math.max(1, parseInt(v, 10) || 1);
      else if (t === 'dob' || t === 'registrationDate') (p as any)[t] = normDate(v);
      else (p as any)[t] = v;
    });
    const errors: string[] = [];
    if (!p.firstName || !p.lastName) errors.push('Missing first or last name');
    if (!/^\d{5}$/.test(p.zip)) errors.push('Missing or invalid ZIP');
    if (p.phone && digits(p.phone).length < 10) errors.push('Invalid phone');
    const dups = errors.length ? [] : findDuplicates(db, { firstName: p.firstName, lastName: p.lastName, dob: p.dob, phone: p.phone, zip: p.zip }).filter(d => d.reason !== 'Similar name in same ZIP' || norm(d.client.lastName) === norm(p.lastName));
    return { p, errors, dup: dups[0] };
  }), [rows, map, db]);
  const counts = { new: parsed.filter(x => !x.errors.length && !x.dup).length, dup: parsed.filter(x => x.dup).length, err: parsed.filter(x => x.errors.length).length };
  const mappedOk = map.includes('zip') && (map.includes('fullName') || (map.includes('firstName') && map.includes('lastName')));

  const finish = () => {
    let added = 0, merged = 0, skipped = 0;
    update(d => {
      parsed.forEach((x, i) => {
        if (x.errors.length) return;
        const dec = x.dup ? decisions[i] || 'merge' : 'both';
        if (dec === 'skip') { skipped++; return; }
        if (dec === 'merge' && x.dup) {
          const c = d.clients.find(y => y.id === x.dup!.client.id)!;
          (['phone', 'email', 'street', 'city', 'dob'] as const).forEach(k => { const v = (x.p as any)[k]; if (v && !c[k]) (c as any)[k] = k === 'phone' ? formatPhone(v) : v; });
          if (x.p.email && x.p.email !== c.email) c.email = x.p.email;
          merged++; return;
        }
        const id = nextId(d, 'client', 'PB-', 6); const hid = nextId(d, 'household', 'HH-', 5);
        const reg = x.p.registrationDate || today();
        d.households.push({ id: hid, headClientId: id, zip: x.p.zip, createdDate: reg, members: Array.from({ length: x.p.householdSize - 1 }, (_, k) => ({ name: `Household member ${k + 2}`, relationship: 'Household member', ageCategory: 'Not recorded' })) });
        d.clients.push({ id, firstName: x.p.firstName, lastName: x.p.lastName, dob: x.p.dob || null, ageCategory: '', gender: '', phone: x.p.phone ? formatPhone(x.p.phone) : '', email: x.p.email, street: x.p.street, city: x.p.city || cityFor(x.p.zip), state: 'GA', zip: x.p.zip, householdId: hid, registrationDate: reg, lastServiceDate: null, consent: true, consentDate: reg, eligibility: [], heardFrom: '', language: '', source });
        added++;
      });
      log(d, 'Imported data', `${source}: ${fileName} (${added} added, ${merged} merged, ${skipped} skipped, ${counts.err} errors)`);
    });
    setResult({ added, merged, skipped, errors: counts.err }); setStep(4);
    toast('Import complete.');
  };
  const reset = () => { setStep(1); setRows([]); setMap([]); setResult(null); setFileName(''); };

  return (
    <Card title="Import clients from Excel or CSV">
      <ol className="progress-steps">{['Upload', 'Map columns', 'Review', 'Summary'].map((l, i) => <li key={l} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}><span>{step > i + 1 ? <FiCheck /> : i + 1}</span>{l}</li>)}</ol>
      {step === 1 && (
        <div className="stack">
          <Field label="Which system is this export from?"><div className="seg">{(['Source System A', 'Source System B'] as const).map(s => <button key={s} className={source === s ? 'on' : ''} onClick={() => setSource(s)}>{s}</button>)}</div></Field>
          <label className="dropzone">
            <FiUpload size={28} /><b>{busy ? 'Reading file…' : 'Choose an .xlsx or .csv file'}</b><span className="muted">Files are read in your browser. Nothing is uploaded to a server.</span>
            <input type="file" accept=".xlsx,.csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <div className="sample-box">
            <p><b>No file handy?</b> Download a sample export, or load it straight into the wizard.</p>
            <div className="row gap wrap">
              <Button variant="secondary" size="sm" icon={<FiDownload />} onClick={() => sample('A')}>Sample: Source System A</Button>
              <Button variant="secondary" size="sm" icon={<FiDownload />} onClick={() => sample('B')}>Sample: Source System B</Button>
              <Button size="sm" onClick={() => useSample('A')}>Use sample A</Button>
              <Button size="sm" onClick={() => useSample('B')}>Use sample B</Button>
            </div>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="stack">
          <p><FiFileText /> <b>{fileName}</b> · {body.length} rows · {source}</p>
          <div className="map-grid">
            <span className="map-h">Column in file</span><span className="map-h">PantryBridge field</span><span className="map-h hide-sm">Example</span>
            {header.map((h, i) => (
              <React.Fragment key={i}>
                <span className="map-col">{h}</span>
                <select value={map[i] || ''} onChange={e => { const m = [...map]; m[i] = e.target.value; setMap(m); }} aria-label={`Map ${h}`}>{TARGETS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
                <span className="muted small hide-sm">{body[0]?.[i] || '—'}</span>
              </React.Fragment>
            ))}
          </div>
          {!mappedOk && <Alert tone="warn">Map a name (full name, or first + last) and a ZIP code to continue.</Alert>}
          <h4>Preview (first 10 rows)</h4>
          <div className="table-wrap"><table className="table table-sm"><thead><tr>{header.map((h, i) => <th key={i}>{h}<div className="muted small">{TARGETS.find(t => t.key === map[i])?.label.replace('— Ignore this column —', 'ignored')}</div></th>)}</tr></thead>
            <tbody>{body.slice(0, 10).map((r, i) => <tr key={i}>{header.map((_, j) => <td key={j}>{r[j]}</td>)}</tr>)}</tbody></table></div>
          <div className="form-foot"><Button variant="secondary" icon={<FiArrowLeft />} onClick={reset}>Back</Button><Button disabled={!mappedOk} onClick={() => setStep(3)}>Review <FiArrowRight /></Button></div>
        </div>
      )}
      {step === 3 && (
        <div className="stack">
          <div className="kpis kpis-3"><Kpi label="New records" value={counts.new} tone="green" /><Kpi label="Possible duplicates" value={counts.dup} tone="orange" /><Kpi label="Errors (will be skipped)" value={counts.err} /></div>
          {counts.dup > 0 && <h4>Possible duplicates: choose what to do with each</h4>}
          {parsed.map((x, i) => x.dup && (
            <div key={i} className="merge">
              <div className="merge-col"><span className="eyebrow">In file (row {i + 2})</span><b>{x.p.firstName} {x.p.lastName}</b><span>{x.p.phone || '—'}</span><span>{x.p.street || '—'}, {x.p.zip}</span><span>{x.p.email || '—'}</span></div>
              <div className="merge-col"><span className="eyebrow">Existing {x.dup.client.id}</span><b>{x.dup.client.firstName} {x.dup.client.lastName}</b><span>{x.dup.client.phone}</span><span>{x.dup.client.street}, {x.dup.client.zip}</span><span>{x.dup.client.email || '—'}</span></div>
              <div className="merge-act"><Badge tone="amber">{x.dup.reason}</Badge>
                <div className="seg seg-sm">{(['merge', 'both', 'skip'] as Decision[]).map(dd => <button key={dd} className={(decisions[i] || 'merge') === dd ? 'on' : ''} onClick={() => setDecisions({ ...decisions, [i]: dd })}>{dd === 'merge' ? 'Merge' : dd === 'both' ? 'Keep both' : 'Skip'}</button>)}</div></div>
            </div>
          ))}
          {counts.err > 0 && <>
            <h4>Rows with errors</h4>
            <ul className="err-list">{parsed.map((x, i) => x.errors.length ? <li key={i}><FiAlertTriangle /> Row {i + 2}: {[x.p.firstName, x.p.lastName].filter(Boolean).join(' ') || '(no name)'}: {x.errors.join(', ')}</li> : null)}</ul>
          </>}
          <div className="form-foot"><Button variant="secondary" icon={<FiArrowLeft />} onClick={() => setStep(2)}>Back</Button><Button icon={<FiCheck />} onClick={finish}>Import {counts.new + counts.dup} records</Button></div>
        </div>
      )}
      {step === 4 && result && (
        <div className="stack">
          <Alert tone="success">Import from <b>{source}</b> finished.</Alert>
          <div className="kpis"><Kpi label="Added" value={result.added} tone="green" /><Kpi label="Merged into existing" value={result.merged} /><Kpi label="Skipped duplicates" value={result.skipped} /><Kpi label="Errors" value={result.errors} /></div>
          <div className="row gap"><Button onClick={() => go('/clients')}>View clients</Button><Button variant="secondary" onClick={reset}>Import another file</Button></div>
        </div>
      )}
    </Card>
  );
}

function ExportPage() {
  const db = useDB();
  const [fmtSel, setFmt] = useState<'csv' | 'xlsx'>('xlsx');
  const [confirm, setConfirm] = useState(false);
  const run = async () => {
    const clients = db.clients.map(c => ({ 'Client ID': c.id, 'First name': c.firstName, 'Last name': c.lastName, DOB: c.dob || '', 'Age category': c.ageCategory, Phone: c.phone, Email: c.email, Street: c.street, City: c.city, State: c.state, ZIP: c.zip, 'Household ID': c.householdId, Registered: c.registrationDate, 'Last service': c.lastServiceDate || '', Consent: c.consent ? 'Yes' : 'No', Eligibility: c.eligibility.join('; '), Language: c.language, Source: c.source }));
    const stamp = today();
    if (fmtSel === 'csv') exportCSV(clients, `pantrybridge-all-clients-${stamp}.csv`);
    else {
      const households = db.households.map(h => ({ 'Household ID': h.id, 'Head client ID': h.headClientId, Size: 1 + h.members.length, ZIP: h.zip, Created: h.createdDate, Members: h.members.map(m => `${m.name} (${m.relationship}, ${m.ageCategory})`).join('; ') }));
      const visits = db.visits.map(v => ({ 'Visit ID': v.id, Type: v.type, Date: v.date, Time: v.time, 'Client ID': v.clientId, 'Household ID': v.householdId, 'Household size': v.householdSize, Program: v.program || '', Event: v.eventId || '', Categories: v.categories.join('; '), Lbs: v.lbs ?? '' }));
      downloadBlob(await buildXLSX([{ name: 'Clients', rows: clients }, { name: 'Households', rows: households }, { name: 'Visits', rows: visits }]), `pantrybridge-all-records-${stamp}.xlsx`);
    }
    update(d => log(d, 'Exported all client records', fmtSel === 'csv' ? 'CSV' : 'Excel'));
    toast('Export downloaded.'); setConfirm(false);
  };
  return (
    <Card title="Export all client records">
      <div className="stack">
        <p>Download every client record so the organization is never dependent on a vendor for its own data.</p>
        <Field label="Format"><div className="seg"><button className={fmtSel === 'xlsx' ? 'on' : ''} onClick={() => setFmt('xlsx')}>Excel (clients, households, visits)</button><button className={fmtSel === 'csv' ? 'on' : ''} onClick={() => setFmt('csv')}>CSV (clients)</button></div></Field>
        <p className="muted small">{db.clients.length} clients · {db.households.length} households · {db.visits.length} visits</p>
        <div><Button icon={<FiDownload />} onClick={() => setConfirm(true)}>Export all records</Button></div>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Export confidential client data?" size="sm" tone="warn"
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button onClick={run}>I understand, export</Button></>}>
        <p>This file contains personal information about vulnerable families. Store it securely, never email it unencrypted, and delete it when no longer needed. This export will be recorded in the audit log.</p>
      </Modal>
    </Card>
  );
}

function ActivityLog() {
  const db = useDB();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [user, setUser] = useState('all');
  const users = [...new Set(db.log.map(l => l.user))].sort();
  const list = db.log.filter(l => (role === 'all' || l.role === role) && (user === 'all' || l.user === user) && (!q || (l.action + l.record + (l.before || '') + (l.after || '')).toLowerCase().includes(q.toLowerCase())));
  return (
    <Card title={`Activity log (${list.length})`} actions={<Button size="sm" variant="secondary" icon={<FiDownload />} onClick={() => exportCSV(list.map(l => ({ Time: l.ts, User: l.user, Role: l.role, Action: l.action, Record: l.record, Before: l.before || '', After: l.after || '' })), `pantrybridge-audit-log-${today()}.csv`)}>CSV</Button>} pad={false}>
      <div className="card-body toolbar">
        <div className="search"><FiSearch /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search actions and records" aria-label="Search log" /></div>
        <select value={user} onChange={e => setUser(e.target.value)} aria-label="User"><option value="all">All users</option>{users.map(u => <option key={u}>{u}</option>)}</select>
        <select value={role} onChange={e => setRole(e.target.value)} aria-label="Role"><option value="all">All roles</option><option value="admin">Admin</option><option value="staff">Staff</option><option value="volunteer">Volunteer</option></select>
      </div>
      {list.length === 0 ? <Empty title="No matching activity" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Record</th><th>Before → After</th></tr></thead>
          <tbody>{list.slice(0, 200).map(l => <tr key={l.id}><td className="nowrap mono small">{l.ts}</td><td>{l.user}</td><td><span className={`dot role-dot-${l.role}`} /> {l.role}</td><td>{l.action}</td><td className="mono small">{l.record}</td><td>{l.before ? <><s className="muted">{l.before}</s> → <b>{l.after}</b></> : '—'}</td></tr>)}</tbody>
        </table></div>
      )}
    </Card>
  );
}

function SecurityPage() {
  const db = useDB();
  const [restore, setRestore] = useState(false);
  const noMfa = db.users.filter(u => u.active && !u.mfa);
  return (
    <div className="stack">
      <div className="grid-2 gap-lg">
        <Card title={<><FiClock /> Session timeout</>}>
          <div className="stack">
            <Field label="Sign users out after inactivity" hint="A warning appears 60 seconds before sign-out.">
              <select value={db.settings.sessionTimeout} onChange={e => { const v = Number(e.target.value); update(d => { log(d, 'Changed session timeout', 'Security', `${d.settings.sessionTimeout} min`, `${v} min`); d.settings.sessionTimeout = v; }); toast(`Session timeout set to ${v} minutes.`); }}>
                {[2, 5, 10, 15, 30].map(n => <option key={n} value={n}>{n} minutes</option>)}
              </select>
            </Field>
            <Button variant="secondary" onClick={triggerTimeoutPreview}>Preview the inactivity warning</Button>
          </div>
        </Card>
        <Card title={<><FiShield /> Multifactor authentication</>}>
          <div className="stack">
            <div className="row gap"><span className="toggle toggle-on toggle-locked" aria-hidden="true"><span /></span><b>Require MFA for administrators</b> <Badge tone="green"><FiLock /> Always on</Badge></div>
            <p className="muted small">Locked on: administrators can export data and manage users.</p>
            {noMfa.length > 0 && <Alert tone="warn">{noMfa.length} active user{noMfa.length > 1 ? 's have' : ' has'} not set up MFA: {noMfa.map(u => u.name).join(', ')}.</Alert>}
          </div>
        </Card>
        <Card title={<><FiDatabase /> Backups</>}>
          <div className="stack">
            <p>Last automatic backup: <b>{db.settings.lastBackup}</b> <Badge tone="green">Successful</Badge></p>
            <p className="muted small">Daily encrypted backups, kept for 35 days, stored in a separate location.</p>
            <div className="row gap"><Button variant="secondary" onClick={() => setRestore(true)}>Restore instructions</Button><Button variant="secondary" onClick={() => { update(d => { d.settings.lastBackup = nowStamp(); log(d, 'Ran manual backup', 'Database'); }); toast('Backup completed.'); }}>Run backup now</Button></div>
          </div>
        </Card>
        <Card title={<><FiLock /> Data protection</>}>
          <ul className="check-list">
            <li><FiCheck /> HTTPS/TLS encryption in transit</li>
            <li><FiCheck /> Client data encrypted at rest</li>
            <li><FiCheck /> Passwords hashed (bcrypt/Argon2)</li>
            <li><FiCheck /> Role permissions enforced on the server</li>
            <li><FiCheck /> Audit log of significant changes</li>
            <li><FiCheck /> No clinical / medical data stored</li>
          </ul>
        </Card>
      </div>
      <Modal open={restore} onClose={() => setRestore(false)} title="Restoring from a backup" footer={<Button onClick={() => setRestore(false)}>Close</Button>}>
        <ol className="steps-list">
          <li>Notify the Executive Director and pause data entry.</li>
          <li>In the hosting console, open <b>Database → Backups</b> and choose the restore point.</li>
          <li>Restore to a <b>new</b> database instance first and verify record counts against the latest report.</li>
          <li>Switch the application to the restored database and confirm sign-in for one user per role.</li>
          <li>Record the restore in the incident log, including the time window of any lost changes.</li>
        </ol>
        <p className="muted small">Demo only: in the real system this links to the documented restoration procedure.</p>
      </Modal>
    </div>
  );
}
