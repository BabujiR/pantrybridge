export const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function today(): string { return iso(new Date()); }
export function parse(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number): string {
  const d = parse(s); d.setDate(d.getDate() + n); return iso(d);
}
export function addMonths(s: string, n: number): string {
  const d = parse(s); d.setMonth(d.getMonth() + n); return iso(d);
}
export function monthKey(s: string): string { return s.slice(0, 7); }
export function startOfMonth(s: string): string { return s.slice(0, 7) + '-01'; }
export function endOfMonth(s: string): string {
  const d = parse(startOfMonth(s)); d.setMonth(d.getMonth() + 1); d.setDate(0); return iso(d);
}
export function startOfWeek(s: string): string {
  const d = parse(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return iso(d);
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function fmt(s: string | null | undefined): string {
  if (!s) return '—';
  const d = parse(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
export function fmtShort(s: string): string { const d = parse(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; }
export function fmtDay(s: string): string { const d = parse(s); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; }
export function monthLabel(key: string): string { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${String(y).slice(2)}`; }
export function monthLong(key: string): string { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; }
export function weekday(s: string): number { return parse(s).getDay(); }
export function nowTime(): string { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`;
}
export function nowStamp(): string { const d = new Date(); return `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function age(dob: string | null): number | null {
  if (!dob) return null;
  const d = parse(dob); const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
}
export function inRange(s: string, from: string, to: string) { const d = s.slice(0, 10); return d >= from && d <= to; }
