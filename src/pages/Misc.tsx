import React from 'react';
import { FiPlay, FiLock, FiHelpCircle, FiCheckSquare, FiSearch, FiUserPlus, FiRotateCcw, FiRefreshCw, FiArrowLeft, FiClock } from 'react-icons/fi';
import { Button, Card, PageHead, Alert, Badge } from '../components/ui';
import { Logo } from '../components/Logo';
import { signInAs, DEMO_USERS } from '../components/Shell';
import { useSession, resetDemo, toast } from '../lib/store';
import { go, homeFor } from '../lib/router';
import type { Role } from '../lib/types';

const STEPS: { role: Role; title: string; how: string; to: string; mins: string }[] = [
  { role: 'volunteer', title: 'Check in a returning household, then try a duplicate check-in', how: 'Search "Rosa", tap Check In, confirm. Then search "Rosa" again and tap Check In to see the duplicate warning.', to: '/checkin', mins: '1.5' },
  { role: 'volunteer', title: 'Quick-register a brand-new household', how: 'Tap "Quick Register", enter a name, phone and ZIP, then Register & Check In.', to: '/checkin', mins: '1' },
  { role: 'staff', title: 'Register a client and see the duplicate warning', how: 'Type first name "Jean", last name "Pierre-Louis". The amber banner appears. Choose "Continue anyway" or open the existing record.', to: '/clients/new', mins: '1.5' },
  { role: 'staff', title: 'Complete a pantry appointment and record food provided', how: 'Click any Scheduled appointment today → Completed → choose categories and pounds → Save visit.', to: '/pantry', mins: '1' },
  { role: 'staff', title: 'Book a Nutrition Education appointment with a follow-up date', how: 'Pick a client, set program to Nutrition Education, click "+14 days" for the follow-up, then Book.', to: '/appointments?book=1', mins: '1' },
  { role: 'admin', title: 'Review the dashboard, then run and export the ZIP code report', how: 'Hover the trend chart, then open Reports → Geographic distribution by ZIP → Excel.', to: '/reports/zip', mins: '1.5' },
  { role: 'admin', title: 'Import a file from Source System B and merge a duplicate', how: 'Click "Use sample B" → check the column mapping → Review → choose Merge / Keep both → Import.', to: '/settings/import', mins: '1.5' },
  { role: 'admin', title: 'Deactivate a volunteer and show the audit log entry', how: 'Deactivate Keisha Brown, then open Activity Log to see the before → after record.', to: '/settings/users', mins: '1' },
];

export function DemoScript() {
  const s = useSession();
  return (
    <div className={s ? '' : 'standalone'}>
      {!s && <div className="standalone-top"><a href="#/login" className="back"><FiArrowLeft /> Sign in</a><Logo size={32} /></div>}
      <PageHead title="10-minute Demo Script" sub="A suggested walkthrough of every role. Each “Go” button switches to the right role and opens the right screen."
        actions={<Button variant="secondary" icon={<FiRefreshCw />} onClick={() => { resetDemo(); toast('Demo data reset. Ready for a fresh run.'); }}>Reset demo data</Button>} />
      <Alert tone="info">Tip: reset the demo data before each presentation so the numbers match this script.</Alert>
      <ol className="script">
        {STEPS.map((st, i) => (
          <li key={i} className="script-step">
            <span className="script-num">{i + 1}</span>
            <div className="script-body">
              <div className="row gap wrap"><Badge tone={st.role === 'admin' ? 'purple' : st.role === 'staff' ? 'blue' : 'green'}>{DEMO_USERS[st.role].label}</Badge><span className="muted small"><FiClock /> ~{st.mins} min</span></div>
              <h3>{st.title}</h3>
              <p className="muted">{st.how}</p>
            </div>
            <Button icon={<FiPlay />} onClick={() => signInAs(st.role, false, st.to)}>Go</Button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Help() {
  const s = useSession()!;
  return (
    <div className="narrow">
      <PageHead title={<><FiHelpCircle /> Volunteer help</>} sub="Everything you need for event check-in." />
      <Card>
        <ol className="steps-list">
          <li><FiSearch /> <b>Search</b> by first or last name, phone number, or Client ID (e.g. PB-000101).</li>
          <li><FiCheckSquare /> Tap <b>Check In</b>, confirm today's household size and the food categories, then <b>Confirm</b>.</li>
          <li><FiUserPlus /> Can't find them? Use <b>Quick Register</b> with name, phone, ZIP and household size.</li>
          <li><FiRotateCcw /> Made a mistake? You can <b>Undo</b> a check-in for 2 minutes. After that, ask a staff member.</li>
          <li><FiLock /> For privacy you can't see addresses, birthdays, notes or service history. That's expected.</li>
        </ol>
      </Card>
      <Alert tone="warn">If a household says they were already served today, don't argue. Ask a staff member to review.</Alert>
      <Button onClick={() => go(homeFor(s.role))}>Back to Check-In</Button>
    </div>
  );
}

export function NoAccess() {
  const s = useSession()!;
  return (
    <div className="center-page">
      <div className="card no-access">
        <div className="card-body stack center">
          <div className="lock-icon"><FiLock /></div>
          <h1>You don't have access to this page</h1>
          <p className="muted">Your role ({DEMO_USERS[s.role].label}) can't open this section. The server checks every request, so hiding menu items isn't the only protection.</p>
          <Button onClick={() => go(homeFor(s.role))}>Go to my home screen</Button>
        </div>
      </div>
    </div>
  );
}
