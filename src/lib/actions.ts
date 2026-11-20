import type { DB, Client, Household, Member, Visit } from './types';
import { update, getDB, nextId, log, getSession } from './store';
import { today, nowTime } from './dates';
import { ZIPS } from '../data/seed';

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
export const digits = (s: string) => s.replace(/\D/g, '');

export function searchClients(db: DB, q: string, limit = 25): Client[] {
  const s = q.trim();
  if (!s) return [];
  const n = norm(s), d = digits(s);
  return db.clients.filter(c => {
    if (c.id.toLowerCase().includes(s.toLowerCase())) return true;
    if (d.length >= 3 && digits(c.phone).includes(d)) return true;
    const full = norm(c.firstName + c.lastName), rev = norm(c.lastName + c.firstName);
    return n.length >= 2 && (full.includes(n) || rev.includes(n) || norm(c.firstName).startsWith(n) || norm(c.lastName).startsWith(n));
  }).slice(0, limit);
}

/** Possible duplicates: same name + DOB, same phone, or very similar name in same ZIP. */
export function findDuplicates(db: DB, p: { firstName: string; lastName: string; dob?: string | null; phone?: string; zip?: string }, excludeId?: string): { client: Client; reason: string }[] {
  const out: { client: Client; reason: string }[] = [];
  const fn = norm(p.firstName || ''), ln = norm(p.lastName || ''), ph = digits(p.phone || '');
  if (!fn && !ln && ph.length < 7) return out;
  for (const c of db.clients) {
    if (c.id === excludeId) continue;
    const sameName = fn && ln && norm(c.firstName) === fn && norm(c.lastName) === ln;
    const similar = fn.length >= 2 && ln.length >= 2 && norm(c.lastName).startsWith(ln.slice(0, 4)) && norm(c.firstName).startsWith(fn.slice(0, 2));
    if (ph.length >= 10 && digits(c.phone) === ph) out.push({ client: c, reason: 'Same phone number' });
    else if (sameName && p.dob && c.dob === p.dob) out.push({ client: c, reason: 'Same name and date of birth' });
    else if (sameName) out.push({ client: c, reason: 'Same first and last name' });
    else if (similar && (!p.zip || p.zip === c.zip)) out.push({ client: c, reason: 'Similar name' + (p.zip ? ' in same ZIP' : '') });
  }
  return out.slice(0, 5);
}

export function householdOf(db: DB, c: Client) { return db.households.find(h => h.id === c.householdId)!; }
export function sizeOf(h: Household) { return 1 + h.members.length; }
export function clientName(db: DB, id: string) { const c = db.clients.find(x => x.id === id); return c ? `${c.firstName} ${c.lastName}` : id; }

export function touchService(d: DB, householdId: string, date: string) {
  d.clients.filter(c => c.householdId === householdId).forEach(c => { if (!c.lastServiceDate || c.lastServiceDate < date) c.lastServiceDate = date; });
}

export interface NewClientInput {
  firstName: string; lastName: string; dob: string | null; ageCategory: string; gender: string; phone: string; email: string; language: string;
  street: string; city: string; state: string; zip: string;
  householdMode: 'new' | 'link'; linkHouseholdId?: string; members: Member[];
  consent: boolean; eligibility: string[]; heardFrom: string;
}

export function registerClient(input: NewClientInput, action = 'Registered client'): Client {
  let created!: Client;
  update(d => {
    const id = nextId(d, 'client', 'PB-', 6);
    let hid = input.linkHouseholdId || '';
    const T = today();
    if (input.householdMode === 'new' || !hid) {
      hid = nextId(d, 'household', 'HH-', 5);
      d.households.push({ id: hid, headClientId: id, members: input.members, zip: input.zip, createdDate: T });
    }
    created = {
      id, firstName: input.firstName.trim(), lastName: input.lastName.trim(), dob: input.dob || null, ageCategory: input.ageCategory,
      gender: input.gender, phone: input.phone, email: input.email, street: input.street, city: input.city || ZIPS[input.zip] || '', state: input.state || 'GA', zip: input.zip,
      householdId: hid, registrationDate: T, lastServiceDate: null, consent: input.consent, consentDate: input.consent ? T : null,
      eligibility: input.eligibility, heardFrom: input.heardFrom, language: input.language, source: 'PantryBridge',
    };
    d.clients.push(created);
    log(d, action, `${id} (${created.firstName} ${created.lastName})`);
  });
  return created;
}

export function checkIn(eventId: string, clientId: string, householdSize: number, categories: string[]): Visit {
  let v!: Visit;
  update(d => {
    const c = d.clients.find(x => x.id === clientId)!;
    const ev = d.events.find(e => e.id === eventId)!;
    const prior = d.visits.some(x => x.type === 'distribution' && x.householdId === c.householdId && x.date < ev.date);
    v = {
      id: nextId(d, 'misc', 'V-', 6), type: 'distribution', clientId, householdId: c.householdId, date: ev.date, time: nowTime(), eventId,
      householdSize, categories, firstTime: !prior, by: getSession()?.name || 'Volunteer',
    };
    (v as any).createdAt = Date.now();
    d.visits.push(v);
    touchService(d, c.householdId, ev.date);
    log(d, 'Checked in household', `${c.householdId} at ${ev.name}`);
  });
  return v;
}

export function undoCheckIn(visitId: string) {
  update(d => {
    const v = d.visits.find(x => x.id === visitId);
    if (!v) return;
    d.visits = d.visits.filter(x => x.id !== visitId);
    d.clients.filter(c => c.householdId === v.householdId).forEach(c => {
      const vs = d.visits.filter(x => x.householdId === v.householdId).map(x => x.date).sort();
      c.lastServiceDate = vs.length ? vs[vs.length - 1] : null;
    });
    log(d, 'Undid check-in', v.householdId);
  });
}

export function currentEvent(db: DB) {
  const T = today();
  return db.events.find(e => e.date === T) || db.events.filter(e => e.date >= T).sort((a, b) => a.date.localeCompare(b.date))[0] || db.events[db.events.length - 1];
}
export function cityFor(zip: string) { return ZIPS[zip] || ''; }
export { getDB };
