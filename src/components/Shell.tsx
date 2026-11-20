import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FiGrid, FiHome, FiCheckSquare, FiSearch, FiHelpCircle, FiUsers, FiTruck, FiShoppingBag, FiCalendar, FiBarChart2, FiSettings, FiLogOut, FiRefreshCw, FiCompass, FiChevronDown, FiMoreHorizontal, FiBookOpen, FiGlobe } from 'react-icons/fi';
import { Logo, LogoMark } from './Logo';
import { useSession, setSession, resetDemo, toast, useDB, update, log } from '../lib/store';
import { go, homeFor, parts, useRoute } from '../lib/router';
import { t, useLang, setLang } from '../lib/i18n';
import type { Role } from '../lib/types';
import { Button, Modal, Sheet } from './ui';
import { Tour, TOURS } from './Tour';

export const DEMO_USERS: Record<Role, { id: string; name: string; label: string }> = {
  admin: { id: 'U1', name: 'Maria Lopez', label: 'Administrator' },
  staff: { id: 'U2', name: 'James Carter', label: 'Staff Member' },
  volunteer: { id: 'U3', name: 'Ana Pierre', label: 'Volunteer' },
};

export function signInAs(role: Role, withMfa = false, to?: string) {
  const u = DEMO_USERS[role];
  setSession({ userId: u.id, name: u.name, role, mfaPending: withMfa });
  update(d => { const usr = d.users.find(x => x.id === u.id); if (usr) usr.lastLogin = new Date().toISOString().slice(0, 16).replace('T', ' '); if (!withMfa) log(d, 'Signed in', u.name); });
  go(withMfa ? '/mfa' : to || homeFor(role));
}

type NavItem = { path: string; label: string; icon: React.ReactNode };
export function navFor(role: Role): NavItem[] {
  if (role === 'volunteer') return [
    { path: '/checkin', label: 'Check-In', icon: <FiCheckSquare /> },
    { path: '/search', label: 'Client Search', icon: <FiSearch /> },
    { path: '/help', label: 'Help', icon: <FiHelpCircle /> },
  ];
  const common: NavItem[] = [
    { path: '/clients', label: 'Clients', icon: <FiUsers /> },
    { path: '/distribution', label: 'Distribution', icon: <FiTruck /> },
    { path: '/pantry', label: 'Pantry', icon: <FiShoppingBag /> },
    { path: '/appointments', label: 'Appointments', icon: <FiCalendar /> },
    { path: '/reports', label: 'Reports', icon: <FiBarChart2 /> },
  ];
  if (role === 'staff') return [{ path: '/home', label: 'Home', icon: <FiHome /> }, ...common];
  return [{ path: '/dashboard', label: 'Dashboard', icon: <FiGrid /> }, ...common, { path: '/settings', label: 'Settings', icon: <FiSettings /> }];
}

// Shared "preview timeout" trigger used by the Security settings page.
let previewTimeout = 0; const pts = new Set<() => void>();
export function triggerTimeoutPreview() { previewTimeout++; pts.forEach(f => f()); }
function usePreviewTimeout() { return useSyncExternalStore(f => { pts.add(f); return () => pts.delete(f); }, () => previewTimeout); }

// Shared tour trigger so pages can start it too.
let tourOn = 0; const tsubs = new Set<() => void>();
export function startTour() { tourOn++; tsubs.forEach(f => f()); }
function useTourTrigger() { return useSyncExternalStore(f => { tsubs.add(f); return () => tsubs.delete(f); }, () => tourOn); }

export function Shell({ children }: { children: React.ReactNode }) {
  const s = useSession()!;
  const db = useDB();
  const route = useRoute();
  useLang();
  const section = parts(route)[0] || '';
  const nav = navFor(s.role);
  const [menu, setMenu] = useState<'role' | 'user' | null>(null);
  const [more, setMore] = useState(false);
  const [tour, setTour] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const tourKey = section === 'checkin' ? 'checkin' : section;
  const steps = TOURS[tourKey];
  const tt = useTourTrigger();
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setTour(true); }, [tt]);

  // Idle timeout: warn 60s before the configured limit.
  const [warn, setWarn] = useState<number | null>(null);
  const last = useRef(Date.now());
  const pv = usePreviewTimeout();
  const firstPv = useRef(true);
  useEffect(() => { if (firstPv.current) { firstPv.current = false; return; } setWarn(60); }, [pv]);
  useEffect(() => {
    const bump = () => { last.current = Date.now(); };
    const evs = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    evs.forEach(e => window.addEventListener(e, bump, { passive: true }));
    const iv = setInterval(() => {
      setWarn(w => {
        if (w != null) {
          if (w <= 1) { setSession(null); go('/login'); toast('Signed out after inactivity.', 'info'); return null; }
          return w - 1;
        }
        const idle = (Date.now() - last.current) / 1000;
        return idle >= db.settings.sessionTimeout * 60 - 60 ? 60 : null;
      });
    }, 1000);
    return () => { evs.forEach(e => window.removeEventListener(e, bump)); clearInterval(iv); };
  }, [db.settings.sessionTimeout]);

  const isActive = (p: string) => p.slice(1) === section;
  const bottom = nav.length > 5 ? nav.slice(0, 4) : nav;
  const overflow = nav.length > 5 ? nav.slice(4) : [];
  const roleLabel = DEMO_USERS[s.role].label;

  return (
    <div className="app">
      <aside className="sidebar" data-tour="nav">
        <div className="sidebar-logo"><Logo size={34} light /></div>
        <nav aria-label="Main">
          {nav.map(n => (
            <a key={n.path} href={'#' + n.path} className={isActive(n.path) ? 'nav-on' : ''} aria-current={isActive(n.path) ? 'page' : undefined}>{n.icon}<span>{t(n.label)}</span></a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a href="#/script"><FiBookOpen /><span>{t('Demo Script')}</span></a>
          <button onClick={() => setConfirmReset(true)}><FiRefreshCw /><span>{t('Reset demo data')}</span></button>
          <p className="org">Sunrise Community Alliance</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-logo"><LogoMark size={30} /></span>
          <div className="topbar-spacer" />
          {steps && <button className="top-btn hide-sm" onClick={() => setTour(true)}><FiCompass /> {t('Guided Tour')}</button>}
          <button className="top-btn" aria-label="Language" onClick={() => setLang(document.documentElement.lang === 'es' ? 'en' : 'es')}><FiGlobe /> <LangLabel /></button>
          <div className="dropdown">
            <button className={`role-badge role-${s.role}`} onClick={() => setMenu(menu === 'role' ? null : 'role')} aria-haspopup="menu" aria-expanded={menu === 'role'}>
              <span className="hide-sm">{roleLabel}</span><span className="show-sm">{s.role === 'admin' ? 'Admin' : s.role === 'staff' ? 'Staff' : 'Volunteer'}</span><FiChevronDown />
            </button>
            {menu === 'role' && (
              <div className="menu" role="menu" onMouseLeave={() => setMenu(null)}>
                <p className="menu-title">{t('Switch role')}</p>
                {(['admin', 'staff', 'volunteer'] as Role[]).map(r => (
                  <button key={r} role="menuitem" className={r === s.role ? 'menu-on' : ''} onClick={() => { setMenu(null); signInAs(r); toast(`Now viewing as ${DEMO_USERS[r].label} (${DEMO_USERS[r].name})`, 'info'); }}>
                    <span className={`dot role-dot-${r}`} />{DEMO_USERS[r].label}<small>{DEMO_USERS[r].name}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="dropdown">
            <button className="avatar" onClick={() => setMenu(menu === 'user' ? null : 'user')} aria-label="User menu">{s.name.split(' ').map(x => x[0]).join('')}</button>
            {menu === 'user' && (
              <div className="menu menu-right" role="menu" onMouseLeave={() => setMenu(null)}>
                <p className="menu-title">{s.name}</p>
                {steps && <button role="menuitem" className="show-sm-flex" onClick={() => { setMenu(null); setTour(true); }}><FiCompass /> {t('Guided Tour')}</button>}
                <button role="menuitem" onClick={() => { setMenu(null); go('/script'); }}><FiBookOpen /> {t('Demo Script')}</button>
                <button role="menuitem" onClick={() => { setMenu(null); setConfirmReset(true); }}><FiRefreshCw /> {t('Reset demo data')}</button>
                <button role="menuitem" onClick={() => { setMenu(null); setSession(null); go('/login'); }}><FiLogOut /> {t('Sign out')}</button>
              </div>
            )}
          </div>
        </header>
        <main className="content" id="content">{children}</main>
      </div>

      <nav className="bottombar" aria-label="Main">
        {bottom.map(n => <a key={n.path} href={'#' + n.path} className={isActive(n.path) ? 'nav-on' : ''}>{n.icon}<span>{t(n.label)}</span></a>)}
        {overflow.length > 0 && <button className={overflow.some(n => isActive(n.path)) ? 'nav-on' : ''} onClick={() => setMore(true)}><FiMoreHorizontal /><span>More</span></button>}
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <div className="more-list">{overflow.map(n => <a key={n.path} href={'#' + n.path} onClick={() => setMore(false)}>{n.icon}{t(n.label)}</a>)}
          <a href="#/script" onClick={() => setMore(false)}><FiBookOpen />{t('Demo Script')}</a></div>
      </Sheet>

      <div className="demo-ribbon" aria-hidden="true">DEMO DATA</div>

      {tour && steps && <Tour steps={steps} onClose={() => setTour(false)} />}

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset demo data?" size="sm"
        footer={<><Button variant="secondary" onClick={() => setConfirmReset(false)}>Cancel</Button><Button variant="danger" onClick={() => { resetDemo(); setConfirmReset(false); toast('Demo data reset to the original sample.'); go(homeFor(s.role)); }}>Reset</Button></>}>
        <p>All changes made during this demo (new clients, check-ins, appointments, settings) will be cleared and the original sample data restored.</p>
      </Modal>

      <Modal open={warn != null} onClose={() => { last.current = Date.now(); setWarn(null); }} title="Are you still there?" size="sm" tone="warn"
        footer={<><Button variant="secondary" onClick={() => { setWarn(null); setSession(null); go('/login'); }}>Sign out now</Button><Button onClick={() => { last.current = Date.now(); setWarn(null); }}>Stay signed in</Button></>}>
        <p>You've been inactive. For client privacy you'll be signed out in <b className="countdown">{warn}s</b>.</p>
      </Modal>
    </div>
  );
}

function LangLabel() {
  const l = useLang();
  useEffect(() => { document.documentElement.lang = l; }, [l]);
  return <span>{l === 'es' ? 'ES' : 'EN'}</span>;
}
