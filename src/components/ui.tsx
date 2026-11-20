import React, { useEffect, useState } from 'react';
import { FiX, FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiInfo, FiInbox } from 'react-icons/fi';
import { useToasts } from '../lib/store';
import type { VisitType } from '../lib/types';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'; size?: 'sm' | 'md' | 'lg' | 'xl'; icon?: React.ReactNode; block?: boolean };
export function Button({ variant = 'primary', size = 'md', icon, block, className = '', children, ...rest }: BtnProps) {
  return <button className={`btn btn-${variant} btn-${size} ${block ? 'btn-block' : ''} ${className}`} {...rest}>{icon}{children && <span>{children}</span>}</button>;
}

export function Card({ title, actions, children, className = '', pad = true, ...rest }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={`card ${className}`} {...rest}>
      {(title || actions) && <header className="card-head"><h3>{title}</h3><div className="card-actions">{actions}</div></header>}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

const TYPE_LABEL: Record<VisitType, string> = { distribution: 'Distribution', pantry: 'Pantry', program: 'Program' };
export function TypeTag({ type, label }: { type: VisitType; label?: string }) {
  return <span className={`tag tag-${type}`}><i />{label || TYPE_LABEL[type]}</span>;
}
export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'orange'; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function StatusBadge({ status }: { status: string }) {
  const tone = ({ Scheduled: 'blue', Completed: 'green', Canceled: 'neutral', Missed: 'red', 'No-show': 'red', Sent: 'amber', Accepted: 'blue', Active: 'green', Inactive: 'neutral' } as any)[status] || 'neutral';
  return <Badge tone={tone}>{status}</Badge>;
}

export function Modal({ open, onClose, title, children, footer, tone, size = 'md' }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; tone?: 'danger' | 'warn'; size?: 'sm' | 'md' | 'lg' }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal modal-${size} ${tone ? 'modal-' + tone : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <header className="modal-head"><h3>{title}</h3><button className="icon-btn" aria-label="Close" onClick={onClose}><FiX /></button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay overlay-sheet" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <header className="modal-head"><h3>{title}</h3><button className="icon-btn" aria-label="Close" onClick={onClose}><FiX /></button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, required, hint, error, children, className = '' }: { label: string; required?: boolean; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`field ${error ? 'field-error' : ''} ${className}`}>
      <span className="field-label">{label}{required && <b className="req" aria-label="required"> *</b>}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-err">{error}</span>}
    </label>
  );
}

export function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map(o => {
        const on = value.includes(o);
        return <button type="button" key={o} className={`chip ${on ? 'chip-on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? value.filter(x => x !== o) : [...value, o])}>{on && '✓ '}{o}</button>;
      })}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 15 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Increase" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return <div className="empty"><FiInbox size={34} /><h4>{title}</h4>{text && <p>{text}</p>}{action}</div>;
}

export function Kpi({ label, value, sub, tone, ...rest }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`kpi ${tone ? 'kpi-' + tone : ''}`} {...rest}><span className="kpi-label">{label}</span><strong className="kpi-value">{value}</strong>{sub && <span className="kpi-sub">{sub}</span>}</div>;
}

export function PageHead({ title, sub, actions }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: React.ReactNode }[]; value: string; onChange: (k: string) => void }) {
  return <div className="tabs" role="tablist">{tabs.map(t => <button key={t.key} role="tab" aria-selected={value === t.key} className={value === t.key ? 'tab tab-on' : 'tab'} onClick={() => onChange(t.key)}>{t.label}</button>)}</div>;
}

export function Toasts() {
  const ts = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {ts.map(t => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.kind === 'success' ? <FiCheckCircle /> : t.kind === 'error' ? <FiAlertCircle /> : t.kind === 'warn' ? <FiAlertTriangle /> : <FiInfo />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="skeleton">{Array.from({ length: rows }, (_, i) => <div key={i} className="sk-line" style={{ width: `${90 - i * 12}%` }} />)}</div>;
}
export function useLoading(ms = 350, deps: any[] = []) {
  const [l, setL] = useState(true);
  useEffect(() => { setL(true); const t = setTimeout(() => setL(false), ms); return () => clearTimeout(t); }, deps);
  return l;
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger' | 'success'; children: React.ReactNode }) {
  return <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>{tone === 'warn' ? <FiAlertTriangle /> : tone === 'danger' ? <FiAlertCircle /> : tone === 'success' ? <FiCheckCircle /> : <FiInfo />}<div>{children}</div></div>;
}
