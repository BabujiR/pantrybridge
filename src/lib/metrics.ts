import type { DB, Visit } from './types';
import { inRange, monthKey, addMonths, today, monthLabel, age } from './dates';
import type { Row } from './files';

export function visitsIn(db: DB, from: string, to: string, program?: string): Visit[] {
  return db.visits.filter(v => inRange(v.date, from, to) && (!program || program === 'all' || (program === 'distribution' ? v.type === 'distribution' : program === 'pantry' ? v.type === 'pantry' : v.program === program)));
}
export function uniqueHouseholds(vs: Visit[]) { return new Set(vs.map(v => v.householdId)); }
export function hhSize(db: DB, hid: string) { const h = db.households.find(x => x.id === hid); return h ? 1 + h.members.length : 1; }

export function kpis(db: DB, from: string, to: string) {
  const vs = visitsIn(db, from, to);
  return {
    clients: db.clients.filter(c => c.registrationDate <= to).length,
    households: db.households.filter(h => h.createdDate <= to).length,
    served: uniqueHouseholds(vs).size,
    distribution: vs.filter(v => v.type === 'distribution').length,
    pantry: vs.filter(v => v.type === 'pantry').length,
    program: vs.filter(v => v.type === 'program').length,
    newRegs: db.clients.filter(c => inRange(c.registrationDate, from, to)).length,
  };
}

export function monthlyTrend(db: DB, months = 12) {
  const T = today();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) keys.push(monthKey(addMonths(T.slice(0, 7) + '-01', -i)));
  return keys.map(k => {
    const vs = db.visits.filter(v => monthKey(v.date) === k);
    return {
      key: k, label: monthLabel(k),
      distribution: vs.filter(v => v.type === 'distribution').length,
      pantry: vs.filter(v => v.type === 'pantry').length,
      program: vs.filter(v => v.type === 'program').length,
    };
  });
}

export function byZip(db: DB, vs: Visit[]) {
  const m = new Map<string, Set<string>>();
  vs.forEach(v => { const h = db.households.find(x => x.id === v.householdId); const z = h?.zip || '—'; if (!m.has(z)) m.set(z, new Set()); m.get(z)!.add(v.householdId); });
  return [...m.entries()].map(([zip, s]) => ({ zip, households: s.size })).sort((a, b) => b.households - a.households);
}

export interface ReportDef {
  key: string; num: number; title: string; definition: string; staff: boolean;
  run: (db: DB, from: string, to: string, program: string) => { value: number; unit?: string; rows: Row[]; chart?: { label: string; value: number }[] };
}

const clientName = (db: DB, id: string) => { const c = db.clients.find(x => x.id === id); return c ? `${c.firstName} ${c.lastName}` : id; };

export const REPORTS: ReportDef[] = [
  {
    key: 'clients', num: 1, title: 'Total registered clients', staff: false,
    definition: 'Every client record registered on or before the end of the selected period. Household members who are not registered clients are not counted here.',
    run: (db, _f, to) => {
      const cs = db.clients.filter(c => c.registrationDate <= to);
      return { value: cs.length, rows: cs.map(c => ({ 'Client ID': c.id, Name: `${c.firstName} ${c.lastName}`, ZIP: c.zip, 'Household ID': c.householdId, Registered: c.registrationDate })),
        chart: groupCount(cs.map(c => c.zip)) };
    },
  },
  {
    key: 'households', num: 2, title: 'Total registered households', staff: false,
    definition: 'Every household created on or before the end of the period. One household can include several registered clients and members.',
    run: (db, _f, to) => {
      const hs = db.households.filter(h => h.createdDate <= to);
      return { value: hs.length, rows: hs.map(h => ({ 'Household ID': h.id, 'Head of household': clientName(db, h.headClientId), Size: 1 + h.members.length, ZIP: h.zip, Created: h.createdDate })),
        chart: groupCount(hs.map(h => sizeBand(1 + h.members.length))) };
    },
  },
  {
    key: 'new', num: 3, title: 'New clients', staff: false,
    definition: 'Clients whose registration date falls inside the selected period.',
    run: (db, f, to) => {
      const cs = db.clients.filter(c => inRange(c.registrationDate, f, to));
      return { value: cs.length, rows: cs.map(c => ({ 'Client ID': c.id, Name: `${c.firstName} ${c.lastName}`, Registered: c.registrationDate, ZIP: c.zip, Source: c.source })),
        chart: groupCount(cs.map(c => monthLabel(c.registrationDate.slice(0, 7)))) };
    },
  },
  {
    key: 'returning', num: 4, title: 'Returning clients', staff: false,
    definition: 'Clients served in the period whose household had also been served at least once before the period started.',
    run: (db, f, to, p) => {
      const vs = visitsIn(db, f, to, p);
      const before = new Set(db.visits.filter(v => v.date < f).map(v => v.householdId));
      const ids = [...new Set(vs.filter(v => before.has(v.householdId)).map(v => v.clientId))];
      return { value: ids.length, rows: ids.map(id => { const c = db.clients.find(x => x.id === id)!; return { 'Client ID': id, Name: `${c.firstName} ${c.lastName}`, 'Last service': c.lastServiceDate || '', ZIP: c.zip }; }) };
    },
  },
  {
    key: 'unique', num: 5, title: 'Unique households served', staff: true,
    definition: 'Each household counted once in the period, even if it was served several times (distribution, pantry, or programs).',
    run: (db, f, to, p) => {
      const vs = visitsIn(db, f, to, p);
      const ids = [...uniqueHouseholds(vs)];
      return { value: ids.length, rows: ids.map(id => { const h = db.households.find(x => x.id === id)!; const n = vs.filter(v => v.householdId === id).length; return { 'Household ID': id, 'Head of household': clientName(db, h.headClientId), Size: 1 + h.members.length, ZIP: h.zip, 'Visits in period': n }; }),
        chart: groupCount(vs.map(v => monthLabel(v.date.slice(0, 7))), true, vs.map(v => v.householdId)) };
    },
  },
  {
    key: 'distribution', num: 6, title: 'Food distribution visits', staff: true,
    definition: 'Number of household check-ins at monthly distribution events. A household checked in at three events counts three times.',
    run: (db, f, to) => {
      const vs = visitsIn(db, f, to).filter(v => v.type === 'distribution');
      return { value: vs.length, rows: vs.map(v => ({ Date: v.date, Event: db.events.find(e => e.id === v.eventId)?.name || '', 'Household ID': v.householdId, 'Household size': v.householdSize, 'First time': v.firstTime ? 'Yes' : 'No', Categories: v.categories.join('; ') })),
        chart: groupCount(vs.map(v => monthLabel(v.date.slice(0, 7)))) };
    },
  },
  {
    key: 'pantry', num: 7, title: 'Pantry visits', staff: true,
    definition: 'Completed weekday pantry appointments. Canceled and missed appointments are not counted.',
    run: (db, f, to) => {
      const vs = visitsIn(db, f, to).filter(v => v.type === 'pantry');
      return { value: vs.length, rows: vs.map(v => ({ Date: v.date, Time: v.time, 'Client ID': v.clientId, Client: clientName(db, v.clientId), 'Household size': v.householdSize, 'Food (lbs)': v.lbs || '', Categories: v.categories.join('; ') })),
        chart: groupCount(vs.map(v => monthLabel(v.date.slice(0, 7)))) };
    },
  },
  {
    key: 'members', num: 8, title: 'Household members represented', staff: true,
    definition: 'Total people living in the unique households served in the period (each household counted once, using its current size).',
    run: (db, f, to, p) => {
      const ids = [...uniqueHouseholds(visitsIn(db, f, to, p))];
      const rows = ids.map(id => { const h = db.households.find(x => x.id === id)!; return { 'Household ID': id, Adults: 1 + h.members.filter(m => !m.ageCategory.startsWith('Child')).length, Children: h.members.filter(m => m.ageCategory.startsWith('Child')).length, 'Total members': 1 + h.members.length }; });
      const total = rows.reduce((s, r) => s + (r['Total members'] as number), 0);
      const adults = rows.reduce((s, r) => s + (r.Adults as number), 0);
      return { value: total, unit: 'people', rows, chart: [{ label: 'Adults', value: adults }, { label: 'Children', value: total - adults }] };
    },
  },
  {
    key: 'programs', num: 9, title: 'Services provided by program', staff: true,
    definition: 'All service visits in the period grouped by program: distribution events, pantry, and each community program.',
    run: (db, f, to) => {
      const vs = visitsIn(db, f, to);
      const groups: Record<string, number> = { 'Food Distribution': 0, 'Food Pantry': 0 };
      db.programs.forEach(p => (groups[p.name] = 0));
      vs.forEach(v => { const k = v.type === 'distribution' ? 'Food Distribution' : v.type === 'pantry' ? 'Food Pantry' : v.program || 'Other'; groups[k] = (groups[k] || 0) + 1; });
      const rows = Object.entries(groups).map(([k, n]) => ({ Program: k, Visits: n, 'Unique households': new Set(vs.filter(v => (v.type === 'distribution' ? 'Food Distribution' : v.type === 'pantry' ? 'Food Pantry' : v.program) === k).map(v => v.householdId)).size }));
      return { value: vs.length, unit: 'visits', rows, chart: rows.map(r => ({ label: r.Program, value: r.Visits })) };
    },
  },
  {
    key: 'zip', num: 10, title: 'Geographic distribution by ZIP', staff: false,
    definition: 'Unique households served in the period, grouped by the ZIP code on the household record.',
    run: (db, f, to, p) => {
      const z = byZip(db, visitsIn(db, f, to, p));
      return { value: z.length, unit: 'ZIP codes', rows: z.map(x => ({ ZIP: x.zip, City: db.households.find(h => h.zip === x.zip) ? (db.clients.find(c => c.zip === x.zip)?.city || '') : '', 'Households served': x.households })),
        chart: z.map(x => ({ label: x.zip, value: x.households })) };
    },
  },
  {
    key: 'demographics', num: 11, title: 'Demographic summary', staff: false,
    definition: 'Age categories of everyone in the households served (registered clients and members), plus household size bands. Uses only data that was collected.',
    run: (db, f, to, p) => {
      const ids = [...uniqueHouseholds(visitsIn(db, f, to, p))];
      const ages: Record<string, number> = { 'Child (0–17)': 0, 'Adult (18–59)': 0, 'Senior (60+)': 0, 'Not recorded': 0 };
      const bands: Record<string, number> = {};
      ids.forEach(id => {
        const h = db.households.find(x => x.id === id)!;
        const head = db.clients.find(c => c.id === h.headClientId)!;
        const a = age(head.dob);
        const cat = a == null ? head.ageCategory || 'Not recorded' : a >= 60 ? 'Senior (60+)' : 'Adult (18–59)';
        ages[cat] = (ages[cat] || 0) + 1;
        h.members.forEach(m => { ages[m.ageCategory] = (ages[m.ageCategory] || 0) + 1; });
        const b = sizeBand(1 + h.members.length); bands[b] = (bands[b] || 0) + 1;
      });
      const rows: Row[] = [
        ...Object.entries(ages).map(([k, n]) => ({ Group: 'Age category', Category: k, People: n })),
        ...Object.entries(bands).sort().map(([k, n]) => ({ Group: 'Household size', Category: k, People: n })),
      ];
      return { value: ids.length, unit: 'households', rows, chart: Object.entries(ages).filter(([, n]) => n > 0).map(([k, n]) => ({ label: k, value: n })) };
    },
  },
];

function sizeBand(n: number) { return n === 1 ? '1 person' : n <= 3 ? '2–3 people' : n <= 5 ? '4–5 people' : '6+ people'; }
function groupCount(keys: string[], unique = false, ids?: string[]) {
  const m = new Map<string, Set<string> | number>();
  keys.forEach((k, i) => {
    if (unique && ids) { if (!m.has(k)) m.set(k, new Set()); (m.get(k) as Set<string>).add(ids[i]); }
    else m.set(k, ((m.get(k) as number) || 0) + 1);
  });
  return [...m.entries()].map(([label, v]) => ({ label, value: typeof v === 'number' ? v : v.size }));
}
