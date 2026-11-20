import type { DB, Client, Household, Visit, PantryAppt, ProgramAppt, DistEvent, LogEntry, Member } from '../lib/types';
import { today, addDays, addMonths, iso, parse, pad, weekday } from '../lib/dates';

// Deterministic random generator so every reset looks the same.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ZIPS: Record<string, string> = {
  '30310': 'Atlanta', '30315': 'Atlanta', '30032': 'Decatur', '30344': 'East Point',
  '30297': 'Forest Park', '30093': 'Norcross', '30060': 'Marietta', '30087': 'Stone Mountain',
};
export const PROGRAMS = ['Health & Wellness', 'Nutrition Education', 'Youth Program', 'Benefits Assistance'];
export const FOOD_CATS = ['Produce', 'Dry Goods', 'Protein', 'Dairy', 'Baby Items'];
export const AGE_CATS = ['Child (0–17)', 'Adult (18–59)', 'Senior (60+)'];
export const ELIGIBILITY = ['Income self-attested', 'SNAP', 'WIC', 'Medicaid', 'SSI / Disability', 'Veteran'];
export const HEARD_FROM = ['Friend or family', 'Church / faith group', 'School', 'Social media', 'Flyer', '211 / hotline', 'Partner agency'];
export const LANGUAGES = ['English', 'Spanish', 'Vietnamese', 'Korean', 'Amharic', 'Haitian Creole'];

const FIRST_F = ['Rosa', 'Marie', 'Yolanda', 'Carmen', 'Nadine', 'Keisha', 'Lucia', 'Fabiola', 'Ana', 'Gloria', 'Tamika', 'Esther', 'Daniela', 'Mirlande', 'Patricia', 'Sofia', 'Juana', 'Brenda', 'Claudette', 'Isabel', 'Latoya', 'Guerda', 'Teresa', 'Monique'];
const FIRST_M = ['Jose', 'Jean', 'Marcus', 'Luis', 'Wilner', 'Andre', 'Carlos', 'Darnell', 'Pierre', 'Miguel', 'Ricardo', 'Samuel', 'Fritz', 'Hector', 'Terrence', 'Emmanuel', 'Raul', 'Kevin', 'Joseph', 'Alberto', 'Reginald', 'Oscar', 'Jacques', 'Victor'];
const LAST = ['Martinez', 'Joseph', 'Williams', 'Rodriguez', 'Pierre-Louis', 'Nguyen', 'Johnson', 'Hernandez', 'Jean-Baptiste', 'Perez', 'Brown', 'Gonzalez', 'Charles', 'Lopez', 'Davis', 'Ramirez', 'Tesfaye', 'Torres', 'Jackson', 'Morales', 'Francois', 'Rivera', 'Thomas', 'Castillo', 'Kim', 'Flores', 'Robinson', 'Sanchez', 'Louis', 'Diaz', 'Washington', 'Moore', 'Reyes', 'Baptiste', 'Cruz', 'Harris', 'Vargas', 'Tran', 'Mendoza', 'Simon'];
const STREETS = ['Ralph David Abernathy Blvd', 'Martin Luther King Jr Dr', 'Campbellton Rd', 'Candler Rd', 'Memorial Dr', 'Buford Hwy', 'Jimmy Carter Blvd', 'Old National Hwy', 'Jonesboro Rd', 'Moreland Ave', 'Glenwood Ave', 'Cobb Pkwy', 'Main St', 'Stone Mountain Hwy', 'Cleveland Ave', 'Metropolitan Pkwy'];
const LOCATIONS = ['West End Community Center, Atlanta', 'Decatur Recreation Pavilion, Decatur', 'Norcross Civic Plaza, Norcross', 'East Point Family Center, East Point'];

export function seed(): DB {
  const r = rng(20261120);
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const T = today();
  const startHistory = addMonths(T, -20);

  const clients: Client[] = [];
  const households: Household[] = [];
  let clientNo = 100, hhNo = 0;
  const usedNames = new Set<string>();

  const newName = (female: boolean) => {
    for (;;) {
      const f = female ? pick(FIRST_F) : pick(FIRST_M);
      const l = pick(LAST);
      if (!usedNames.has(f + l)) { usedNames.add(f + l); return [f, l]; }
    }
  };
  const phone = () => `(${pick(['404', '470', '678', '770'])}) 555-${pad(between(100, 9999), 4)}`;

  const zips = Object.keys(ZIPS);
  const HH = 40;
  for (let i = 0; i < HH; i++) {
    hhNo++;
    const hid = `HH-${pad(hhNo, 5)}`;
    const female = i === 0 ? true : i === 1 ? false : r() < 0.62;
    let [first, last] = newName(female);
    if (i === 0) { first = 'Rosa'; last = 'Martinez'; usedNames.add('RosaMartinez'); }
    if (i === 1) { first = 'Jean'; last = 'Pierre-Louis'; usedNames.add('JeanPierre-Louis'); }
    const zip = zips[i % zips.length];
    // Registration date: 6 households new this month, rest spread across the last 20 months.
    const regDate = i >= HH - 6
      ? addDays(T, -between(0, Math.max(0, parse(T).getDate() - 1)))
      : addDays(startHistory, Math.floor((i / (HH - 6)) * 560) + between(0, 15));
    const age = between(22, 78);
    const dob = r() < 0.85 ? iso(new Date(parse(T).getFullYear() - age, between(0, 11), between(1, 28))) : null;
    const ageCategory = age >= 60 ? AGE_CATS[2] : AGE_CATS[1];
    clientNo++;
    const cid = `PB-${pad(clientNo, 6)}`;
    const lang = zip === '30093' || zip === '30297' ? (r() < 0.6 ? 'Spanish' : r() < 0.5 ? 'Vietnamese' : 'English') : zip === '30032' || zip === '30087' ? (r() < 0.25 ? 'Amharic' : 'English') : r() < 0.8 ? 'English' : pick(LANGUAGES);
    clients.push({
      id: cid, firstName: first, lastName: last, dob, ageCategory, gender: female ? 'Female' : 'Male',
      phone: phone(), email: r() < 0.7 ? `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}${between(1, 99)}@example.com` : '',
      street: `${between(100, 9800)} ${pick(STREETS)}`, city: ZIPS[zip], state: 'GA', zip,
      householdId: hid, registrationDate: regDate, lastServiceDate: null,
      consent: i < 3 || r() < 0.93, consentDate: regDate,
      eligibility: [pick(ELIGIBILITY), ...(r() < 0.4 ? [pick(ELIGIBILITY)] : [])].filter((v, k, a) => a.indexOf(v) === k),
      heardFrom: pick(HEARD_FROM), language: lang, source: i < 22 ? 'Source System A' : i < 34 ? 'Source System B' : 'PantryBridge',
    });
    const size = pick([1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7]);
    const members: Member[] = [];
    for (let m = 1; m < size; m++) {
      const child = m >= 2 || r() < 0.4;
      const [mf] = newName(r() < 0.5);
      members.push({
        name: `${mf} ${last}`,
        relationship: child ? pick(['Child', 'Child', 'Grandchild']) : pick(['Spouse', 'Partner', 'Parent', 'Sibling']),
        ageCategory: child ? AGE_CATS[0] : pick([AGE_CATS[1], AGE_CATS[2]]),
      });
    }
    households.push({ id: hid, headClientId: cid, members, zip, createdDate: regDate });
  }

  // A few households have a second registered adult (linked, not re-registered).
  for (let k = 0; k < 8; k++) {
    const h = households[3 + k * 4];
    const head = clients.find(c => c.id === h.headClientId)!;
    const spouse = h.members.find(m => m.relationship === 'Spouse' || m.relationship === 'Partner');
    const [f] = spouse ? spouse.name.split(' ') : newName(head.gender === 'Male');
    clientNo++;
    clients.push({
      ...head, id: `PB-${pad(clientNo, 6)}`, firstName: f, gender: head.gender === 'Male' ? 'Female' : 'Male',
      phone: phone(), email: '', dob: null, ageCategory: AGE_CATS[1],
      registrationDate: addDays(head.registrationDate, between(10, 90)) > T ? head.registrationDate : addDays(head.registrationDate, between(10, 90)),
    });
    if (!spouse) h.members.push({ name: `${f} ${head.lastName}`, relationship: 'Spouse', ageCategory: AGE_CATS[1] });
  }

  const hhSize = (h: Household) => 1 + h.members.length;
  const visits: Visit[] = [];
  let vNo = 0;
  const vid = () => `V-${pad(++vNo, 6)}`;
  const servedOnce = new Set<string>();
  const staff = ['James Carter', 'Ana Pierre', 'Luis Fernandez', 'Maria Lopez'];

  // Distribution events: one per month, 11 past + today + 2 upcoming.
  const events: DistEvent[] = [];
  for (let k = -11; k <= 2; k++) {
    const date = k === 0 ? T : (() => { const d = parse(addMonths(T, k)); return iso(d); })();
    events.push({
      id: `EV-${date.slice(0, 7).replace('-', '')}`,
      name: `${parse(date).toLocaleString('en-US', { month: 'long' })} Community Food Distribution`,
      date, location: LOCATIONS[(k + 12) % LOCATIONS.length], expected: 34 + ((k + 12) % 5),
    });
  }

  // Build a timeline of all past service dates so "first time" flags are correct.
  type Plan = { date: string; time: string; type: 'distribution' | 'pantry' | 'program'; h: Household; extra?: any };
  const plans: Plan[] = [];
  for (const ev of events) {
    if (ev.date > T) continue;
    const isToday = ev.date === T;
    const eligible = households.filter(h => h.createdDate <= ev.date);
    const take = isToday ? eligible.filter(h => h.id !== 'HH-00001' && h.id !== 'HH-00002').sort(() => r() - 0.5).slice(0, 14) : eligible.filter(() => r() < 0.72);
    take.forEach((h, idx) => plans.push({ date: ev.date, time: `${pad(8 + Math.floor(idx / 12))}:${pad((idx * 5) % 60)}`, type: 'distribution', h, extra: ev.id }));
  }
  // Pantry history (past 12 months, weekdays).
  for (let d = addMonths(T, -12); d < T; d = addDays(d, 1)) {
    const wd = weekday(d);
    if (wd === 0 || wd === 6) continue;
    const n = r() < 0.55 ? between(0, 2) : 0;
    for (let j = 0; j < n; j++) {
      const eligible = households.filter(h => h.createdDate <= d);
      if (!eligible.length) continue;
      plans.push({ date: d, time: pick(['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30']), type: 'pantry', h: pick(eligible) });
    }
  }
  // Program participation history.
  for (let d = addMonths(T, -12); d < T; d = addDays(d, 1)) {
    const wd = weekday(d);
    if (wd === 0 || wd === 6 || r() > 0.28) continue;
    const eligible = households.filter(h => h.createdDate <= d);
    if (!eligible.length) continue;
    plans.push({ date: d, time: pick(['10:00', '11:00', '14:00', '15:00', '16:00']), type: 'program', h: pick(eligible), extra: pick(PROGRAMS) });
  }
  plans.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const pantry: PantryAppt[] = [];
  const appts: ProgramAppt[] = [];
  let pNo = 0, aNo = 0;
  for (const p of plans) {
    const key = p.type + p.h.id;
    const householdClients = clients.filter(c => c.householdId === p.h.id && c.registrationDate <= p.date);
    const client = householdClients[0] || clients.find(c => c.id === p.h.headClientId)!;
    const cats = FOOD_CATS.filter((c, i) => i < 3 ? r() < 0.85 : (c === 'Baby Items' ? p.h.members.some(m => m.relationship === 'Child') && r() < 0.4 : r() < 0.5));
    const first = !servedOnce.has(key);
    servedOnce.add(key);
    const v: Visit = {
      id: vid(), type: p.type, clientId: client.id, householdId: p.h.id, date: p.date, time: p.time,
      householdSize: hhSize(p.h), categories: p.type === 'program' ? [] : cats, firstTime: first, by: pick(staff),
    };
    if (p.type === 'distribution') v.eventId = p.extra;
    if (p.type === 'pantry') {
      v.lbs = between(18, 55);
      pantry.push({ id: `PA-${pad(++pNo, 5)}`, clientId: client.id, date: p.date, time: p.time, status: 'Completed', notes: '', categories: cats, lbs: v.lbs });
    }
    if (p.type === 'program') {
      v.program = p.extra;
      appts.push({ id: `AP-${pad(++aNo,5)}`, clientId: client.id, program: p.extra, date: p.date, time: p.time, status: 'Completed', notes: 'Attended session.', followUp: null });
    }
    visits.push(v);
  }
  // Sprinkle canceled / missed into recent pantry history.
  pantry.filter(p => p.date >= addDays(T, -21)).forEach((p, i) => {
    if (i % 5 === 1) { p.status = 'Missed'; const vi = visits.findIndex(v => v.type === 'pantry' && v.clientId === p.clientId && v.date === p.date); if (vi >= 0) visits.splice(vi, 1); }
    if (i % 7 === 3) { p.status = 'Canceled'; const vi = visits.findIndex(v => v.type === 'pantry' && v.clientId === p.clientId && v.date === p.date); if (vi >= 0) visits.splice(vi, 1); }
  });

  // Upcoming pantry appointments (next 2 weeks + today).
  const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
  for (let d = T, n = 0; n < 30; d = addDays(d, 1)) {
    const wd = weekday(d);
    if (wd === 0 || wd === 6) continue;
    const count = d === T ? 5 : between(2, 4);
    const used = new Set<string>();
    for (let j = 0; j < count && n < 30; j++) {
      let t = pick(slots); while (used.has(t)) t = pick(slots); used.add(t);
      const c = pick(clients.filter(x => x.registrationDate <= T));
      pantry.push({ id: `PA-${pad(++pNo, 5)}`, clientId: c.id, date: d, time: t, status: 'Scheduled', notes: j === 0 && n % 3 === 0 ? 'Prefers Spanish-speaking volunteer.' : '', categories: [] });
      n++;
    }
  }
  // Upcoming / recent program appointments (~15).
  const notes = ['Intake for benefits screening.', 'Follow-up on SNAP application paperwork.', 'Class: budgeting healthy meals.', 'After-school program registration.', 'Walking club check-in.', 'Bring proof of address.'];
  for (let k = 0; k < 15; k++) {
    const d = addDays(T, k < 4 ? 0 : between(-3, 14));
    if (weekday(d) === 0 || weekday(d) === 6) { k--; continue; }
    const c = pick(clients.filter(x => x.registrationDate <= T));
    const past = d < T;
    appts.push({
      id: `AP-${pad(++aNo, 5)}`, clientId: c.id, program: PROGRAMS[k % 4], date: d, time: pick(['10:00', '11:00', '13:00', '14:00', '15:30']),
      status: past ? pick(['Completed', 'No-show', 'Canceled'] as const) : 'Scheduled', notes: pick(notes),
      followUp: r() < 0.5 ? addDays(d, between(14, 30)) : null,
    });
  }

  // Last service date from visits.
  for (const c of clients) {
    const vs = visits.filter(v => v.householdId === c.householdId);
    c.lastServiceDate = vs.length ? vs[vs.length - 1].date : null;
  }

  const referrals = [
    { id: 'RF-0001', clientId: clients[0].id, to: 'Metro Atlanta Legal Aid Clinic', kind: 'Partner agency' as const, status: 'Accepted' as const, date: addDays(T, -12), note: 'Housing paperwork help.' },
    { id: 'RF-0002', clientId: clients[4].id, to: 'Benefits Assistance', kind: 'Internal program' as const, status: 'Completed' as const, date: addDays(T, -30), note: 'SNAP application.' },
    { id: 'RF-0003', clientId: clients[7].id, to: 'Gwinnett Workforce Center', kind: 'Partner agency' as const, status: 'Sent' as const, date: addDays(T, -3), note: 'Job readiness program.' },
    { id: 'RF-0004', clientId: clients[11].id, to: 'Nutrition Education', kind: 'Internal program' as const, status: 'Accepted' as const, date: addDays(T, -8), note: 'Diabetes-friendly cooking class.' },
    { id: 'RF-0005', clientId: clients[1].id, to: 'DeKalb Community Health Clinic', kind: 'Partner agency' as const, status: 'Sent' as const, date: addDays(T, -1), note: 'Referred for primary care (no clinical details recorded here).' },
  ];

  const users = [
    { id: 'U1', name: 'Maria Lopez', email: 'maria.lopez@sunrise-demo.org', role: 'admin' as const, active: true, mfa: true, lastLogin: addDays(T, -1) + ' 17:42' },
    { id: 'U2', name: 'James Carter', email: 'james.carter@sunrise-demo.org', role: 'staff' as const, active: true, mfa: true, lastLogin: addDays(T, -1) + ' 16:05' },
    { id: 'U3', name: 'Ana Pierre', email: 'ana.pierre@sunrise-demo.org', role: 'volunteer' as const, active: true, mfa: false, lastLogin: addDays(T, -28) + ' 08:10' },
    { id: 'U4', name: 'Robert Chen', email: 'robert.chen@sunrise-demo.org', role: 'admin' as const, active: true, mfa: true, lastLogin: addDays(T, -6) + ' 11:20' },
    { id: 'U5', name: 'Luis Fernandez', email: 'luis.fernandez@sunrise-demo.org', role: 'staff' as const, active: true, mfa: false, lastLogin: addDays(T, -2) + ' 09:14' },
    { id: 'U6', name: 'Keisha Brown', email: 'keisha.brown@sunrise-demo.org', role: 'volunteer' as const, active: true, mfa: false, lastLogin: addDays(T, -28) + ' 07:55' },
    { id: 'U7', name: 'Daniel Ortiz', email: 'daniel.ortiz@sunrise-demo.org', role: 'volunteer' as const, active: false, mfa: false, lastLogin: addDays(T, -95) + ' 08:02' },
  ];

  const logActions: [string, string, string, string, string?, string?][] = [
    ['Maria Lopez', 'admin', 'Exported report', 'Unique households served (CSV)'],
    ['James Carter', 'staff', 'Updated client', clients[2].id, 'Phone: (404) 555-0101', `Phone: ${clients[2].phone}`],
    ['Ana Pierre', 'volunteer', 'Checked in household', households[5].id],
    ['James Carter', 'staff', 'Registered client', clients[clients.length - 9].id],
    ['Luis Fernandez', 'staff', 'Completed pantry appointment', 'PA-00012'],
    ['Maria Lopez', 'admin', 'Changed role', 'Keisha Brown', 'Role: Staff', 'Role: Volunteer'],
    ['Robert Chen', 'admin', 'Imported data', 'Source System A (412 rows)'],
    ['James Carter', 'staff', 'Booked appointment', 'AP-00031'],
    ['Maria Lopez', 'admin', 'Deactivated user', 'Daniel Ortiz', 'Status: Active', 'Status: Inactive'],
    ['Ana Pierre', 'volunteer', 'Checked in household', households[9].id],
    ['Luis Fernandez', 'staff', 'Marked appointment missed', 'PA-00019', 'Status: Scheduled', 'Status: Missed'],
    ['Maria Lopez', 'admin', 'Updated form settings', 'Email', 'Required: Yes', 'Required: No'],
    ['James Carter', 'staff', 'Added referral', 'RF-0003'],
    ['Robert Chen', 'admin', 'Merged duplicate clients', 'PB-000099 → PB-000112'],
    ['Keisha Brown', 'volunteer', 'Checked in household', households[12].id],
    ['James Carter', 'staff', 'Updated household', households[3].id, 'Size: 3', 'Size: 4'],
    ['Maria Lopez', 'admin', 'Signed in (MFA)', 'Maria Lopez'],
    ['Luis Fernandez', 'staff', 'Registered client', clients[clients.length - 10].id],
    ['Maria Lopez', 'admin', 'Created event', events[13].id],
    ['James Carter', 'staff', 'Completed program appointment', 'AP-00040'],
    ['Robert Chen', 'admin', 'Exported all client records', 'Excel'],
    ['Ana Pierre', 'volunteer', 'Quick-registered client', clients[clients.length - 11].id],
    ['Maria Lopez', 'admin', 'Added food category', 'Baby Items'],
    ['James Carter', 'staff', 'Undid check-in', households[14].id],
    ['Luis Fernandez', 'staff', 'Booked pantry appointment', 'PA-00080'],
  ];
  const log: LogEntry[] = logActions.map((a, i) => ({
    id: `L-${pad(i + 1, 5)}`, ts: `${addDays(T, -(1 + Math.floor(i / 3)))} ${pad(16 - (i % 3) * 3)}:${pad((i * 17) % 60)}`,
    user: a[0], role: a[1] as any, action: a[2], record: a[3], before: a[4], after: a[5],
  }));

  const settings = {
    sessionTimeout: 15, adminMfa: true, lastBackup: `${T} 02:00`,
    fields: [
      { key: 'firstName', label: 'First name', step: 1 as const, show: true, required: true, locked: true },
      { key: 'lastName', label: 'Last name', step: 1 as const, show: true, required: true, locked: true },
      { key: 'dob', label: 'Date of birth / age category', step: 1 as const, show: true, required: true },
      { key: 'gender', label: 'Gender', step: 1 as const, show: true, required: false },
      { key: 'phone', label: 'Phone', step: 1 as const, show: true, required: true },
      { key: 'email', label: 'Email', step: 1 as const, show: true, required: false },
      { key: 'language', label: 'Preferred language', step: 1 as const, show: true, required: false },
      { key: 'street', label: 'Street address', step: 2 as const, show: true, required: true },
      { key: 'city', label: 'City', step: 2 as const, show: true, required: true },
      { key: 'zip', label: 'ZIP code', step: 2 as const, show: true, required: true, locked: true },
      { key: 'consent', label: 'Consent to data collection', step: 3 as const, show: true, required: true, locked: true },
      { key: 'eligibility', label: 'Eligibility', step: 3 as const, show: true, required: false },
      { key: 'heardFrom', label: 'How did you hear about us?', step: 3 as const, show: true, required: false },
    ],
  };

  return {
    version: 4, seededAt: T, clients, households, events, visits, pantry, appts, referrals, users,
    programs: PROGRAMS.map((name, i) => ({ id: `PG-${i + 1}`, name, color: ['#B45309', '#0E7490', '#7C3AED', '#BE185D'][i], active: true })),
    categories: FOOD_CATS.map((name, i) => ({ id: `FC-${i + 1}`, name, active: true })),
    log, settings, counters: { client: clientNo, household: hhNo, misc: 1000 },
  };
}
