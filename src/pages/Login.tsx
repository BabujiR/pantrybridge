import React, { useEffect, useRef, useState } from 'react';
import { FiShield, FiUserCheck, FiUsers, FiCheckSquare, FiBookOpen, FiGlobe } from 'react-icons/fi';
import { Logo } from '../components/Logo';
import { Button, Field, Alert } from '../components/ui';
import { signInAs, DEMO_USERS } from '../components/Shell';
import { useSession, setSession, update, log, toast } from '../lib/store';
import { go, homeFor } from '../lib/router';
import { t, useLang, setLang } from '../lib/i18n';
import type { Role } from '../lib/types';

export function Login() {
  const lang = useLang();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const map: Record<string, Role> = { 'maria.lopez@sunrise-demo.org': 'admin', 'james.carter@sunrise-demo.org': 'staff', 'ana.pierre@sunrise-demo.org': 'volunteer' };
    const role = map[email.trim().toLowerCase()];
    if (!role || !pw) { setErr('Use one of the demo buttons below, or a demo email (e.g. maria.lopez@sunrise-demo.org) with any password.'); return; }
    signInAs(role, role === 'admin');
  };
  const roles: { role: Role; icon: React.ReactNode; desc: string }[] = [
    { role: 'admin', icon: <FiShield />, desc: 'Dashboard, reports, users, settings, data import' },
    { role: 'staff', icon: <FiUsers />, desc: 'Register clients, pantry & program appointments' },
    { role: 'volunteer', icon: <FiCheckSquare />, desc: 'Fast event check-in with limited client info' },
  ];
  return (
    <div className="login">
      <div className="login-art" aria-hidden="true">
        <div className="login-art-inner">
          <Logo size={52} light />
          <h2>{t('Bridging families to food and services.')}</h2>
          <ul>
            <li>Monthly food distribution check-in</li>
            <li>Weekday pantry appointments</li>
            <li>Community program scheduling</li>
            <li>Live reports for every funder question</li>
          </ul>
          <p className="small">Sunrise Community Alliance · Metro Atlanta, Georgia</p>
        </div>
      </div>
      <div className="login-panel">
        <div className="login-top">
          <span className="show-sm"><Logo size={36} /></span>
          <span style={{ flex: 1 }} />
          <button className="top-btn" onClick={() => setLang(lang === 'en' ? 'es' : 'en')}><FiGlobe /> {lang === 'en' ? 'EN' : 'ES'}</button>
        </div>
        <div className="login-box">
          <h1>{t('Sign in')}</h1>
          <p className="muted">PantryBridge client management</p>
          <form onSubmit={submit} className="stack">
            <Field label={t('Email')}><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" placeholder="name@sunrise-demo.org" /></Field>
            <Field label={t('Password')}><input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" placeholder="••••••••" /></Field>
            {err && <Alert tone="warn">{err}</Alert>}
            <Button type="submit" size="lg" block>{t('Sign in')}</Button>
          </form>
          <div className="divider"><span>{t('Demo: Sign in as…')}</span></div>
          <div className="role-buttons">
            {roles.map(r => (
              <button key={r.role} className={`role-btn role-btn-${r.role}`} onClick={() => signInAs(r.role, r.role === 'admin')}>
                <span className="role-btn-icon">{r.icon}</span>
                <span className="role-btn-text"><b>{DEMO_USERS[r.role].label}</b><span>{DEMO_USERS[r.role].name} · {r.desc}</span></span>
              </button>
            ))}
          </div>
          <a className="script-link" href="#/script"><FiBookOpen /> Open the 10-minute Demo Script</a>
        </div>
      </div>
    </div>
  );
}

export function Mfa() {
  const s = useSession();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  if (!s) { go('/login'); return null; }
  const done = code.every(c => c);
  const verify = () => {
    setSession({ ...s, mfaPending: false });
    update(d => log(d, 'Signed in (MFA)', s.name));
    toast('Verified. Welcome back, ' + s.name.split(' ')[0] + '!');
    go(homeFor(s.role));
  };
  const set = (i: number, v: string) => {
    const digits = v.replace(/\D/g, '');
    const next = [...code];
    if (digits.length > 1) { digits.slice(0, 6).split('').forEach((ch, k) => { if (i + k < 6) next[i + k] = ch; }); setCode(next); refs.current[Math.min(5, i + digits.length)]?.focus(); return; }
    next[i] = digits; setCode(next);
    if (digits && i < 5) refs.current[i + 1]?.focus();
  };
  return (
    <div className="center-page">
      <div className="mfa card">
        <div className="card-body stack">
          <Logo size={40} />
          <h1><FiUserCheck /> Two-step verification</h1>
          <p className="muted">Administrator accounts require multifactor authentication. Enter the 6-digit code from your authenticator app.</p>
          <div className="otp" onPaste={e => { e.preventDefault(); set(0, e.clipboardData.getData('text')); }}>
            {code.map((c, i) => (
              <input key={i} ref={el => { refs.current[i] = el; }} inputMode="numeric" maxLength={6} aria-label={`Digit ${i + 1}`} value={c}
                onChange={e => set(i, e.target.value)}
                onKeyDown={e => { if (e.key === 'Backspace' && !c && i > 0) refs.current[i - 1]?.focus(); if (e.key === 'Enter' && done) verify(); }} />
            ))}
          </div>
          <Alert tone="info">Demo: any 6 digits work. <button className="link" onClick={() => setCode(['1', '2', '3', '4', '5', '6'])}>Fill 123456</button></Alert>
          <Button size="lg" block disabled={!done} onClick={verify}>Verify and continue</Button>
          <button className="link" onClick={() => { setSession(null); go('/login'); }}>Cancel and go back</button>
        </div>
      </div>
    </div>
  );
}
