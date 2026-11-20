import { useSyncExternalStore } from 'react';
import type { DB, Role, LogEntry } from './types';
import { seed } from '../data/seed';
import { nowStamp, pad } from './dates';

const KEY = 'pantrybridge.db.v4';
const SKEY = 'pantrybridge.session.v1';

function safeGet(k: string): string | null { try { return window.localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string) { try { window.localStorage.setItem(k, v); } catch { /* in-memory fallback */ } }
function safeDel(k: string) { try { window.localStorage.removeItem(k); } catch { /* ignore */ } }

function load(): DB {
  const raw = safeGet(KEY);
  if (raw) { try { const d = JSON.parse(raw); if (d && d.version === 4) return d; } catch { /* reseed */ } }
  const d = seed(); safeSet(KEY, JSON.stringify(d)); return d;
}

let db: DB = load();
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export function useDB(): DB {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => db);
}
export function getDB() { return db; }

export function update(fn: (d: DB) => void) {
  const next: DB = JSON.parse(JSON.stringify(db));
  fn(next);
  db = next;
  safeSet(KEY, JSON.stringify(db));
  emit();
}

export function resetDemo() {
  safeDel(KEY);
  db = seed();
  safeSet(KEY, JSON.stringify(db));
  emit();
}

export function nextId(d: DB, kind: 'client' | 'household' | 'misc', prefix: string, width: number) {
  d.counters[kind]++;
  return `${prefix}${pad(d.counters[kind], width)}`;
}

// ---- Session (who is signed in) ----
export interface Session { userId: string; name: string; role: Role; mfaPending?: boolean }
function loadSession(): Session | null {
  const raw = safeGet(SKEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
let session: Session | null = loadSession();
const ssubs = new Set<() => void>();
export function useSession(): Session | null {
  return useSyncExternalStore(f => { ssubs.add(f); return () => ssubs.delete(f); }, () => session);
}
export function getSession() { return session; }
export function setSession(s: Session | null) {
  session = s;
  if (s) safeSet(SKEY, JSON.stringify(s)); else safeDel(SKEY);
  ssubs.forEach(f => f());
}

export function log(d: DB, action: string, record: string, before?: string, after?: string) {
  const s = session;
  const e: LogEntry = {
    id: nextId(d, 'misc', 'L-', 5), ts: nowStamp(), user: s?.name || 'System', role: s?.role || 'admin',
    action, record, before, after,
  };
  d.log.unshift(e);
}

// ---- Toasts ----
export interface Toast { id: number; kind: 'success' | 'error' | 'warn' | 'info'; text: string }
let toasts: Toast[] = [];
const tsubs = new Set<() => void>();
let tid = 0;
export function useToasts() { return useSyncExternalStore(f => { tsubs.add(f); return () => tsubs.delete(f); }, () => toasts); }
export function toast(text: string, kind: Toast['kind'] = 'success') {
  const id = ++tid;
  toasts = [...toasts, { id, kind, text }];
  tsubs.forEach(f => f());
  setTimeout(() => { toasts = toasts.filter(t => t.id !== id); tsubs.forEach(f => f()); }, 4200);
}
