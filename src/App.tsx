import React, { useEffect } from 'react';
import { useRoute, parts, ACCESS, go, homeFor } from './lib/router';
import { useSession } from './lib/store';
import { useLang } from './lib/i18n';
import { Shell } from './components/Shell';
import { Toasts } from './components/ui';
import { Login, Mfa } from './pages/Login';
import { CheckIn, VolunteerSearch } from './pages/CheckIn';
import { Dashboard, StaffHome } from './pages/Dashboard';
import { ClientsRouter } from './pages/Clients';
import { DistributionRouter } from './pages/Distribution';
import { Pantry } from './pages/Pantry';
import { Appointments } from './pages/Appointments';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { DemoScript, Help, NoAccess } from './pages/Misc';

export function App() {
  const route = useRoute();
  const s = useSession();
  useLang();
  const section = parts(route)[0] || '';

  useEffect(() => {
    document.title = 'PantryBridge – Client Management Demo';
    if (section === 'script') return;
    if (!s && section !== 'login') go('/login');
    else if (s && s.mfaPending && section !== 'mfa') go('/mfa');
    else if (s && !s.mfaPending && (section === 'login' || section === 'mfa' || section === '')) go(homeFor(s.role));
  }, [route, s?.role, s?.mfaPending, !!s]);

  let page: React.ReactNode;
  if (section === 'script') page = s && !s.mfaPending ? <Shell><DemoScript /></Shell> : <DemoScript />;
  else if (!s || section === 'login') page = <Login />;
  else if (s.mfaPending || section === 'mfa') page = <Mfa />;
  else {
    const allowed = ACCESS[section];
    let body: React.ReactNode;
    if (!allowed) body = <NoAccess />;
    else if (!allowed.includes(s.role)) body = <NoAccess />;
    else switch (section) {
      case 'dashboard': body = <Dashboard />; break;
      case 'home': body = <StaffHome />; break;
      case 'checkin': body = <CheckIn key={route} />; break;
      case 'search': body = <VolunteerSearch />; break;
      case 'help': body = <Help />; break;
      case 'clients': body = <ClientsRouter />; break;
      case 'distribution': body = <DistributionRouter />; break;
      case 'pantry': body = <Pantry />; break;
      case 'appointments': body = <Appointments />; break;
      case 'reports': body = <Reports />; break;
      case 'settings': body = <Settings />; break;
    }
    page = <Shell>{body}</Shell>;
  }
  return <>{page}<Toasts /></>;
}
