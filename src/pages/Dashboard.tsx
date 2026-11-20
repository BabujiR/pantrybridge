import React, { useState } from 'react';
import { FiUserPlus, FiCalendar, FiCheckSquare, FiMapPin, FiClock, FiArrowRight, FiTable, FiBarChart2 } from 'react-icons/fi';
import { useDB, useSession } from '../lib/store';
import { kpis, monthlyTrend, byZip, visitsIn } from '../lib/metrics';
import { today, startOfMonth, endOfMonth, fmtDay, fmtTime, fmt, monthLong } from '../lib/dates';
import { Card, Kpi, PageHead, Button, Empty, StatusBadge, TypeTag, Badge, Skeleton, useLoading } from '../components/ui';
import { LineChart, BarChart, SERIES } from '../components/charts';
import { clientName, currentEvent } from '../lib/actions';
import { go } from '../lib/router';
import { startTour } from '../components/Shell';

export function Dashboard() {
  const db = useDB();
  const T = today();
  const from = startOfMonth(T), to = endOfMonth(T);
  const k = kpis(db, from, to);
  const trend = monthlyTrend(db);
  const zips = byZip(db, visitsIn(db, from, to));
  const ev = currentEvent(db);
  const evCount = db.visits.filter(v => v.eventId === ev.id).length;
  const [table, setTable] = useState(false);
  const loading = useLoading(400);
  const s = useSession()!;
  return (
    <div>
      <PageHead title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${s.name.split(' ')[0]}`} sub={`Organization overview for ${monthLong(T.slice(0, 7))}`}
        actions={<><Button variant="secondary" onClick={() => startTour()}>Take the tour</Button><Button onClick={() => go('/reports')} icon={<FiBarChart2 />}>Open reports</Button></>} />
      <div className="kpis" data-tour="kpis">
        {loading ? Array.from({ length: 6 }, (_, i) => <div key={i} className="kpi"><Skeleton rows={2} /></div>) : <>
          <Kpi label="Total registered clients" value={k.clients} sub="All time" />
          <Kpi label="Total households" value={k.households} sub="All time" />
          <Kpi label="Households served" value={k.served} sub="This month" tone="green" />
          <Kpi label="Distribution attendance" value={k.distribution} sub="Check-ins this month" />
          <Kpi label="Pantry visits" value={k.pantry} sub="Completed this month" />
          <Kpi label="New registrations" value={k.newRegs} sub="This month" tone="orange" />
        </>}
      </div>
      <p className="muted small calc-note">✓ Calculated live from records</p>

      <div className="grid-dash">
        <Card title="Monthly service trends" className="span-2" data-tour="trend"
          actions={<button className="link" onClick={() => setTable(!table)}>{table ? <><FiBarChart2 /> Chart</> : <><FiTable /> Table</>}</button>}>
          {loading ? <Skeleton rows={6} /> : table ? (
            <div className="table-wrap"><table className="table"><thead><tr><th>Month</th><th>Distribution</th><th>Pantry</th><th>Programs</th></tr></thead>
              <tbody>{trend.map(r => <tr key={r.key}><td>{r.label}</td><td>{r.distribution}</td><td>{r.pantry}</td><td>{r.program}</td></tr>)}</tbody></table></div>
          ) : <div className="chart-scroll"><LineChart data={trend} series={[{ key: 'distribution', label: 'Distribution', color: SERIES.distribution }, { key: 'pantry', label: 'Pantry', color: SERIES.pantry }, { key: 'program', label: 'Programs', color: SERIES.program }]} /></div>}
        </Card>
        <Card title="Upcoming event" data-tour="event">
          <div className="event-card">
            <p className="eyebrow"><FiCalendar /> {ev.date === today() ? 'Today' : fmtDay(ev.date)}</p>
            <h3>{ev.name}</h3>
            <p className="muted"><FiMapPin /> {ev.location}</p>
            <div className="event-stats"><div><b>{evCount}</b><span>checked in</span></div><div><b>{ev.expected}</b><span>expected</span></div></div>
            <div className="progress"><span style={{ width: `${Math.min(100, (evCount / ev.expected) * 100)}%` }} /></div>
            <Button block icon={<FiCheckSquare />} onClick={() => go('/checkin/' + ev.id)}>Open check-in</Button>
          </div>
        </Card>
        <Card title={`Households served by ZIP · ${monthLong(T.slice(0, 7))}`} data-tour="zip">
          {loading ? <Skeleton /> : zips.length ? <BarChart data={zips.slice(0, 8).map(z => ({ label: z.zip, value: z.households }))} /> : <Empty title="No households served yet this month" />}
        </Card>
        <Card title="Recent activity" className="span-2" data-tour="activity" actions={<button className="link" onClick={() => go('/settings/activity')}>View audit log <FiArrowRight /></button>}>
          <ul className="feed">
            {db.log.slice(0, 7).map(l => (
              <li key={l.id}><span className={`dot role-dot-${l.role}`} /><div><b>{l.user}</b> · {l.action} <span className="mono">{l.record}</span><small>{l.ts}</small></div></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function StaffHome() {
  const db = useDB();
  const s = useSession()!;
  const T = today();
  const pantry = db.pantry.filter(p => p.date === T).sort((a, b) => a.time.localeCompare(b.time));
  const progs = db.appts.filter(a => a.date === T).sort((a, b) => a.time.localeCompare(b.time));
  const ev = currentEvent(db);
  const evCount = db.visits.filter(v => v.eventId === ev.id).length;
  return (
    <div>
      <PageHead title={`Welcome, ${s.name.split(' ')[0]}`} sub={fmtDay(T)} actions={<Button variant="secondary" onClick={() => startTour()}>Take the tour</Button>} />
      <div className="quick-actions" data-tour="quick">
        <button onClick={() => go('/clients/new')}><FiUserPlus /><b>Register Client</b><span>3-step form with duplicate check</span></button>
        <button onClick={() => go('/pantry?book=1')}><FiCalendar /><b>Book Appointment</b><span>Pantry or program</span></button>
        <button onClick={() => go('/checkin/' + ev.id)}><FiCheckSquare /><b>Start Check-In</b><span>{ev.date === T ? 'Event is today' : fmtDay(ev.date)}</span></button>
      </div>
      <div className="grid-dash">
        <Card title={<>Today's pantry appointments <Badge tone="blue">{pantry.length}</Badge></>} data-tour="today-pantry" actions={<button className="link" onClick={() => go('/pantry')}>Open pantry <FiArrowRight /></button>} pad={false}>
          {pantry.length === 0 ? <Empty title="No pantry appointments today" /> : <ul className="appt-list">{pantry.map(p => (
            <li key={p.id} onClick={() => go('/pantry?sel=' + p.id)}><span className="appt-time"><FiClock /> {fmtTime(p.time)}</span><span className="appt-name">{clientName(db, p.clientId)}</span><TypeTag type="pantry" /><StatusBadge status={p.status} /></li>
          ))}</ul>}
        </Card>
        <Card title={<>Today's program appointments <Badge tone="neutral">{progs.length}</Badge></>} data-tour="today-programs" actions={<button className="link" onClick={() => go('/appointments')}>Open calendar <FiArrowRight /></button>} pad={false}>
          {progs.length === 0 ? <Empty title="No program appointments today" /> : <ul className="appt-list">{progs.map(a => (
            <li key={a.id} onClick={() => go('/appointments?sel=' + a.id)}><span className="appt-time"><FiClock /> {fmtTime(a.time)}</span><span className="appt-name">{clientName(db, a.clientId)}</span><TypeTag type="program" label={a.program} /><StatusBadge status={a.status} /></li>
          ))}</ul>}
        </Card>
        <Card title="Next distribution event" data-tour="next-event">
          <div className="event-card">
            <p className="eyebrow"><FiCalendar /> {ev.date === T ? 'Today' : fmt(ev.date)}</p>
            <h3>{ev.name}</h3>
            <p className="muted"><FiMapPin /> {ev.location}</p>
            <div className="event-stats"><div><b>{evCount}</b><span>checked in</span></div><div><b>{ev.expected}</b><span>expected</span></div></div>
            <Button block icon={<FiCheckSquare />} onClick={() => go('/checkin/' + ev.id)}>Open check-in</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
