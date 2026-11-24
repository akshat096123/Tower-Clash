import React from 'react';

export interface ChartSeries {
  name: string;
  color: string;
  points: Array<{ x: number; y: number }>;
}

interface LineComparisonChartProps {
  title: string;
  yLabel: string;
  xLabel: string;
  series: ChartSeries[];
}

const PALETTE = ['#38bdf8', '#34d399', '#f59e0b', '#f43f5e', '#a855f7', '#fb923c', '#2dd4bf', '#e879f9'];

export function getSeriesColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export const LineComparisonChart: React.FC<LineComparisonChartProps> = ({
  title,
  yLabel,
  xLabel,
  series,
}) => {
  const width = 640;
  const height = 270;
  const padL = 62;
  const padR = 20;
  const padT = 20;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const minX = allX.length ? Math.min(...allX) : 0;
  const maxX = allX.length ? Math.max(...allX) : 100;
  const maxY = allY.length ? Math.max(0.0001, ...allY) * 1.1 : 1;

  const mapX = (x: number) =>
    maxX === minX ? padL + plotW / 2 : padL + ((x - minX) / (maxX - minX)) * plotW;
  const mapY = (y: number) => padT + plotH - (y / maxY) * plotH;

  const uniqueXs = [...new Set(allX)].sort((a, b) => a - b);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0b1324] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <span className="text-[11px] text-slate-400">Y: {yLabel}</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} comparing ${series.map((s) => s.name).join(', ')}`}
        className="w-full h-auto"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + plotH * (1 - t);
          const val = maxY * t;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#1e293b" strokeDasharray="3,3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val >= 10 ? val.toFixed(0) : val.toFixed(3)}
              </text>
            </g>
          );
        })}

        {uniqueXs.map((xv) => {
          const x = mapX(xv);
          return (
            <g key={xv}>
              <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="#172033" />
              <text x={x} y={height - 14} textAnchor="middle" fill="#94a3b8" fontSize="10">
                {xv}
              </text>
            </g>
          );
        })}

        <text x={padL + plotW / 2} y={height - 2} textAnchor="middle" fill="#64748b" fontSize="10">
          {xLabel}
        </text>

        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => a.x - b.x);
          if (pts.length === 0) return null;
          const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.x)} ${mapY(p.y)}`).join(' ');
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" />
              {pts.map((p) => (
                <circle key={`${s.name}-${p.x}`} cx={mapX(p.x)} cy={mapY(p.y)} r="3.8" fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-slate-300">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

