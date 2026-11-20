import { useSyncExternalStore } from 'react';
import type { Role } from './types';

function current() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return h.startsWith('/') ? h : '/' + h;
}
export function useRoute(): string {
  return useSyncExternalStore(f => { window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, current);
}
export function go(path: string) {
  if (current() === path) return;
  window.location.hash = path;
  window.scrollTo(0, 0);
}
export function parts(route: string) { return route.split('?')[0].split('/').filter(Boolean); }
export function query(route: string): Record<string, string> {
  const q = route.split('?')[1] || '';
  const out: Record<string, string> = {};
  q.split('&').filter(Boolean).forEach(p => { const [k, v] = p.split('='); out[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  return out;
}

// Which top-level sections each role may open. Enforced on every route change.
export const ACCESS: Record<string, Role[]> = {
  dashboard: ['admin'],
  home: ['staff'],
  checkin: ['admin', 'staff', 'volunteer'],
  search: ['volunteer'],
  help: ['admin', 'staff', 'volunteer'],
  clients: ['admin', 'staff'],
  distribution: ['admin', 'staff'],
  pantry: ['admin', 'staff'],
  appointments: ['admin', 'staff'],
  reports: ['admin', 'staff'],
  settings: ['admin'],
};
export function homeFor(role: Role) { return role === 'admin' ? '/dashboard' : role === 'staff' ? '/home' : '/checkin'; }
