import React, { useState } from 'react';
import { FiDownload, FiPrinter, FiFileText, FiInfo, FiArrowLeft, FiLock, FiGrid } from 'react-icons/fi';
import { useDB, useSession, update, log, toast } from '../lib/store';
import { REPORTS, ReportDef } from '../lib/metrics';
import { go, parts, useRoute, query } from '../lib/router';
import { Button, Card, PageHead, Empty, Alert, Kpi } from '../components/ui';
import { ColumnChart, BarChart, SERIES } from '../components/charts';
import { today, startOfMonth, endOfMonth, addMonths, fmt, addDays } from '../lib/dates';
import { exportCSV, exportXLSX, buildXLSX, downloadBlob } from '../lib/files';

type Preset = 'this-month' | 'last-month' | 'this-quarter' | 'this-year' | 'last-12' | 'custom';
function rangeFor(p: Preset): [string, string] {
  const T = today();
  if (p === 'this-month') return [startOfMonth(T), endOfMonth(T)];
  if (p === 'last-month') { const l = addMonths(startOfMonth(T), -1); return [l, endOfMonth(l)]; }
  if (p === 'this-quarter') { const m = Number(T.slice(5, 7)); const qs = Math.floor((m - 1) / 3) * 3 + 1; const s = `${T.slice(0, 4)}-${String(qs).padStart(2, '0')}-01`; return [s, endOfMonth(addMonths(s, 2))]; }
  if (p === 'this-year') return [`${T.slice(0, 4)}-01-01`, `${T.slice(0, 4)}-12-31`];
  return [addDays(addMonths(T, -12), 1), T];
}

// Report filters live at module level so they survive navigating into a report and back.
let saved = { preset: 'this-month' as Preset, from: rangeFor('this-month')[0], to: rangeFor('this-month')[1], program: 'all' };

export function Reports() {
  const db = useDB();
  const s = useSession()!;
  const route = useRoute();
  const key = parts(route)[1];
  const [st, setSt] = useState(saved);
  const set = (p: Partial<typeof st>) => { const n = { ...st, ...p }; saved = n; setSt(n); };
  const isAdmin = s.role === 'admin';
  const allowed = REPORTS.filter(r => isAdmin || r.staff);
  const choose = (p: Preset) => { if (p === 'custom') set({ preset: p }); else { const [f, t] = rangeFor(p); set({ preset: p, from: f, to: t }); } };
  const audit = (what: string) => update(d => log(d, 'Exported report', what));

  const exportAll = async () => {
    const blob = await buildXLSX(allowed.map(r => ({ name: `${r.num} ${r.title}`.slice(0, 31), rows: r.run(db, st.from, st.to, st.program).rows })));
    downloadBlob(blob, `pantrybridge-all-reports-${st.from}_to_${st.to}.xlsx`);
    audit(`All reports ${st.from} to ${st.to} (Excel)`); toast('Excel workbook downloaded (one sheet per report).');
  };

  const controls = (
    <div className="range-bar" data-tour="range">
      <div className="seg seg-wrap">{([['this-month', 'This month'], ['last-month', 'Last month'], ['this-quarter', 'This quarter'], ['this-year', 'This year'], ['last-12', 'Last 12 months'], ['custom', 'Custom']] as [Preset, string][]).map(([k, l]) => <button key={k} className={st.preset === k ? 'on' : ''} onClick={() => choose(k)}>{l}</button>)}</div>
      <div className="row gap wrap">
        <label className="inline-field">From <input type="date" value={st.from} onChange={e => set({ preset: 'custom', from: e.target.value })} /></label>
        <label className="inline-field">To <input type="date" value={st.to} onChange={e => set({ preset: 'custom', to: e.target.value })} /></label>
        <label className="inline-field">Program <select value={st.program} onChange={e => set({ program: e.target.value })}><option value="all">All services</option><option value="distribution">Food Distribution</option><option value="pantry">Food Pantry</option>{db.programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></label>
      </div>
    </div>
  );

  if (key) {
    const r = REPORTS.find(x => x.key === key);
    if (!r) return <Empty title="Report not found" />;
    if (!isAdmin && !r.staff) return <NoAccessInline />;
    return <ReportDetail r={r} from={st.from} to={st.to} program={st.program} controls={controls} isAdmin={isAdmin} audit={audit} />;
  }
  return (
    <div>
      <PageHead title="Reports" sub={isAdmin ? 'All 11 reports with CSV, Excel, PDF and print.' : 'Operational reports. Printing is available; exports are limited to administrators.'}
        actions={isAdmin && <Button variant="secondary" icon={<FiGrid />} onClick={exportAll}>Export all (Excel)</Button>} />
      {controls}
      <p className="muted small">Showing {fmt(st.from)} – {fmt(st.to)}{st.program !== 'all' ? ` · ${st.program}` : ''}</p>
      {!isAdmin && <Alert tone="info"><FiLock /> Staff accounts see operational reports 5–9. Registration, demographic and geographic reports are available to administrators.</Alert>}
      <div className="report-grid" data-tour="report-grid">
        {allowed.map(r => {
          const res = r.run(db, st.from, st.to, st.program);
          return (
            <button key={r.key} className="report-card" onClick={() => go('/reports/' + r.key)}>
              <span className="report-num">{r.num}</span>
              <span className="report-title">{r.title} <span className="info" tabIndex={0} title={r.definition} aria-label={r.definition} onClick={e => e.stopPropagation()}><FiInfo /><span className="info-tip">{r.definition}</span></span></span>
              <strong className="report-value">{res.value}{res.unit && <small> {res.unit}</small>}</strong>
              <span className="report-open">Open report →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReportDetail({ r, from, to, program, controls, isAdmin, audit }: { r: ReportDef; from: string; to: string; program: string; controls: React.ReactNode; isAdmin: boolean; audit: (w: string) => void }) {
  const db = useDB();
  const res = r.run(db, from, to, program);
  const name = `pantrybridge-${r.key}-report-${from}_to_${to}`;
  const timeChart = res.chart && res.chart.every(c => /^[A-Z][a-z]{2} \d{2}$/.test(c.label));
  return (
    <div className="report-detail">
      <button className="back no-print" onClick={() => go('/reports')}><FiArrowLeft /> All reports</button>
      <PageHead title={<>{r.num}. {r.title}</>} sub={`${fmt(from)} – ${fmt(to)}${program !== 'all' ? ' · ' + program : ''} · Sunrise Community Alliance`}
        actions={<div className="row gap wrap no-print">
          {isAdmin && <>
            <Button variant="secondary" icon={<FiDownload />} onClick={() => { exportCSV(res.rows, name + '.csv'); audit(`${r.title} (CSV)`); toast('CSV downloaded.'); }}>CSV</Button>
            <Button variant="secondary" icon={<FiDownload />} onClick={async () => { await exportXLSX(res.rows, name + '.xlsx', r.title.slice(0, 31)); audit(`${r.title} (Excel)`); toast('Excel file downloaded.'); }}>Excel</Button>
            <Button variant="secondary" icon={<FiFileText />} onClick={() => { audit(`${r.title} (PDF)`); toast('In the print dialog, choose "Save as PDF".', 'info'); setTimeout(() => window.print(), 300); }}>PDF</Button>
          </>}
          <Button icon={<FiPrinter />} onClick={() => window.print()}>Print</Button>
        </div>} />
      <div className="no-print">{controls}</div>
      <Alert tone="info"><b>What's counted:</b> {r.definition}</Alert>
      <div className="grid-dash">
        <Kpi label={r.title} value={<>{res.value}{res.unit && <small className="kpi-unit"> {res.unit}</small>}</>} sub={`${fmt(from)} – ${fmt(to)}`} tone="green" />
        {res.chart && res.chart.length > 0 && (
          <Card title="Chart" className="span-2">
            {timeChart ? <ColumnChart data={res.chart} color={r.key === 'pantry' ? SERIES.pantry : SERIES.distribution} /> : <BarChart data={[...res.chart].sort((a, b) => b.value - a.value)} color={r.key === 'pantry' ? SERIES.pantry : SERIES.distribution} max={15} />}
          </Card>
        )}
      </div>
      <Card title={`Details (${res.rows.length} rows)`} pad={false}>
        {res.rows.length === 0 ? <Empty title="No records in this period" text="Try a wider date range." /> : (
          <div className="table-wrap"><table className="table"><thead><tr>{Object.keys(res.rows[0]).map(k => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>{res.rows.slice(0, 300).map((row, i) => <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{v as any}</td>)}</tr>)}</tbody></table></div>
        )}
        {res.rows.length > 300 && <p className="muted small card-body">Showing first 300 rows. Exports include all {res.rows.length}.</p>}
      </Card>
      <p className="print-only small">Generated {fmt(today())} from PantryBridge (demo data).</p>
    </div>
  );
}

function NoAccessInline() {
  return <Empty title="You don't have access to this report" text="Ask an administrator for this report." action={<Button onClick={() => go('/reports')}>Back to reports</Button>} />;
}
