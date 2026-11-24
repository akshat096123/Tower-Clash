import React, { useMemo } from 'react';
import { MapPin, Play, Route } from 'lucide-react';
import { GAME_MAPS } from '../engine/maps';
import { PathFinder } from '../engine/PathFinder';

interface MapsPageProps {
  selectedMapId: string;
  onSelectAndPlay: (mapId: string) => void;
}

const TERRAIN_COLORS: Record<string, string> = {
  buildable: '#132038',
  path: '#2563eb',
  entry: '#f43f5e',
  base: '#10b981',
  obstacle: '#475569',
  resource: '#2dd4bf',
  slow_zone: '#0891b2',
};

export const MapsPage: React.FC<MapsPageProps> = ({ selectedMapId, onSelectAndPlay }) => {
  const mapAnalytics = useMemo(() => {
    return GAME_MAPS.map((m) => {
      const start = m.groundPath[0];
      const goal = m.groundPath[m.groundPath.length - 1];
      const dijk = PathFinder.findShortestPath(m, start, goal);
      const buildableCount = m.grid.flat().filter((t) => t === 'buildable').length;
      return {
        map: m,
        dijkstraCost: dijk.cost,
        shortestCells: dijk.path.length,
        reachable: dijk.reachable,
        buildableCount,
      };
    });
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tactical Battlefield Maps</h1>
          <p className="text-sm text-slate-400">
            Each map is modeled as a weighted 2D grid graph verified by Dijkstra&apos;s Shortest-Path algorithm.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
          {Object.entries(TERRAIN_COLORS).map(([label, color]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {label.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mapAnalytics.map(({ map, dijkstraCost, shortestCells, reachable, buildableCount }) => {
          const isSelected = map.id === selectedMapId;
          return (
            <article
              key={map.id}
              className={`rounded-2xl border p-5 bg-[#0b1324] flex flex-col gap-4 ${
                isSelected ? 'border-cyan-400 shadow-lg shadow-cyan-500/10' : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                    {map.name}
                  </h2>
                  <p className="text-xs text-cyan-300 font-medium">{map.subtitle}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-amber-300 border border-slate-700">
                  {map.difficultyRating} • {map.wavesCount} Waves
                </span>
              </div>

              <div
                className="grid gap-0.5 p-2 rounded-xl bg-[#060b16] border border-slate-800"
                style={{ gridTemplateColumns: `repeat(${map.cols}, minmax(0, 1fr))` }}
                aria-label={`${map.name} grid preview`}
              >
                {map.grid.flatMap((row, r) =>
                  row.map((cell, c) => (
                    <div
                      key={`${r}-${c}`}
                      className="aspect-square rounded-[2px]"
                      style={{ backgroundColor: TERRAIN_COLORS[cell] }}
                      title={`(${r},${c}): ${cell}`}
                    />
                  ))
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{map.description}</p>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2">
                  <p className="text-slate-400">Ground Path</p>
                  <p className="font-bold text-cyan-300">{map.groundPath.length} cells</p>
                </div>
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2">
                  <p className="text-slate-400">Dijkstra Min</p>
                  <p className="font-bold text-emerald-300">
                    {reachable ? `${shortestCells} cells (${dijkstraCost})` : 'Blocked'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2">
                  <p className="text-slate-400">Build Slots</p>
                  <p className="font-bold text-purple-300">{buildableCount}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectAndPlay(map.id)}
                className="mt-auto w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                Deploy on {map.name}
                <Route className="w-4 h-4" aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
};

