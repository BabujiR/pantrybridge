import React, { useRef, useState } from 'react';

export const SERIES = { distribution: '#1F7A50', pantry: '#3B82F6', program: '#B45309' };

function niceMax(v: number) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function LineChart({ data, series, height = 240 }: {
  data: { label: string; [k: string]: any }[];
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = height, L = 36, R = 92, Tp = 12, B = 28;
  const max = niceMax(Math.max(1, ...data.flatMap(d => series.map(s => d[s.key] as number))));
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, data.length - 1);
  const y = (v: number) => Tp + (H - Tp - B) * (1 - v / max);
  const n = max % 4 === 0 ? 4 : 5; const ticks = Array.from({ length: n + 1 }, (_, i) => (max * i) / n);
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  // Direct labels at line ends, nudged apart if they collide.
  const ends = series.map(s => ({ s, y: y(data[data.length - 1]?.[s.key] || 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  return (
    <div className="chart" ref={ref}>
      <div className="legend">{series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Line chart: ${series.map(s => s.label).join(', ')}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 6} y={y(t) + 4} className="axis" textAnchor="end">{Math.round(t)}</text></g>)}
        {data.map((d, i) => (i % Math.ceil(data.length / 12) === 0 || i === data.length - 1) && <text key={i} x={x(i)} y={H - 8} className="axis" textAnchor="middle">{d.label}</text>)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={Tp} y2={H - B} className="crosshair" />}
        {series.map(s => (
          <g key={s.key}>
            <path d={data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[s.key])}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hover != null && <circle cx={x(hover)} cy={y(data[hover][s.key])} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />}
          </g>
        ))}
        {ends.map(({ s, y: yy }) => <text key={s.key} x={W - R + 8} y={yy + 4} className="end-label">{s.label}</text>)}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{data[hover].label}</b>
          {series.map(s => <div key={s.key}><i style={{ background: s.color }} />{s.label}<span>{data[hover][s.key]}</span></div>)}
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, color = '#1F7A50', unit = '', max: maxRows = 12 }: { data: { label: string; value: number }[]; color?: string; unit?: string; max?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = data.slice(0, maxRows);
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return <p className="muted small">No data for this period.</p>;
  return (
    <div className="hbars" role="img" aria-label="Bar chart">
      {rows.map((r, i) => (
        <div key={r.label} className={`hbar ${hover === i ? 'hbar-hover' : ''}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} title={`${r.label}: ${r.value}${unit}`}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(r.value / max) * 100}%`, background: color }} /></span>
          <span className="hbar-value">{r.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}

export function ColumnChart({ data, color = '#1F7A50' }: { data: { label: string; value: number }[]; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 220, L = 36, B = 28, Tp = 14;
  const max = niceMax(Math.max(1, ...data.map(d => d.value)));
  const bw = (W - L - 8) / Math.max(1, data.length);
  const y = (v: number) => Tp + (H - Tp - B) * (1 - v / max);
  if (!data.length) return <p className="muted small">No data for this period.</p>;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Column chart">
        {[0, max / 2, max].map(t => <g key={t}><line x1={L} x2={W - 8} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 6} y={y(t) + 4} className="axis" textAnchor="end">{Math.round(t)}</text></g>)}
        {data.map((d, i) => {
          const h = Math.max(0, H - B - y(d.value));
          const xx = L + i * bw + 2, w = Math.max(4, bw - 4);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={L + i * bw} y={Tp} width={bw} height={H - Tp - B} fill="transparent" />
              <path d={`M${xx},${H - B} V${H - B - h + Math.min(4, h)} Q${xx},${H - B - h} ${xx + Math.min(4, w / 2)},${H - B - h} H${xx + w - Math.min(4, w / 2)} Q${xx + w},${H - B - h} ${xx + w},${H - B - h + Math.min(4, h)} V${H - B} Z`} fill={color} opacity={hover == null || hover === i ? 1 : 0.55} />
              {(data.length <= 14 || i % 2 === 0) && <text x={xx + w / 2} y={H - 8} className="axis" textAnchor="middle">{d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}</text>}
              {hover === i && <text x={xx + w / 2} y={H - B - h - 5} className="end-label" textAnchor="middle">{d.value}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
