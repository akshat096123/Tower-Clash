import React, { useEffect, useMemo, useState } from 'react';
import { Award, History, Search, Trophy } from 'lucide-react';
import { GameHistoryRecord, PlayerProfileData } from './HomeDashboard';
import { SuffixArray } from '../dsa/strings';
import { runSortTrace } from '../dsa/sorting';
import { BenchmarkMetricRow } from '../types/game';

interface BenchmarkHistoryRow {
  id: number;
  engine: string;
  category: string;
  pattern: string;
  input_size: number;
  results: BenchmarkMetricRow[];
  created_at: string;
}

interface GameHistoryProps {
  sessions: GameHistoryRecord[];
  profile: PlayerProfileData | null;
  onRefresh: () => void;
}

export const GameHistory: React.FC<GameHistoryProps> = ({ sessions, profile, onRefresh }) => {
  const [tab, setTab] = useState<'matches' | 'benchmarks'>('matches');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'wave' | 'enemies' | 'gold'>('recent');
  const [benchmarks, setBenchmarks] = useState<BenchmarkHistoryRow[]>([]);

  useEffect(() => {
    fetch('/api/benchmarks/history')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBenchmarks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [sessions.length]);

  const { filteredSessions, sortStats } = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const matched = sessions.filter((s) => {
      if (!query) return true;
      // Use manual SuffixArray substring search on serialized match record
      const recordText = `${s.map_name} ${s.difficulty} ${s.targeting_algo} ${s.victory ? 'victory' : 'defeat'} wave${s.wave_reached}`.toLowerCase();
      const sa = new SuffixArray(recordText);
      return sa.searchPattern(query).length > 0;
    });

    if (sortBy === 'recent') {
      return { filteredSessions: matched, sortStats: null };
    }

    // Sort session IDs via manual Merge Sort keyed on chosen score metric
    const keyed = matched.map((s) => ({
      id: s.id,
      key:
        sortBy === 'wave'
          ? s.wave_reached * 10000 + s.id
          : sortBy === 'enemies'
          ? s.enemies_defeated * 10000 + s.id
          : s.gold_earned * 10000 + s.id,
      session: s,
    }));
    const sortedResult = runSortTrace(
      keyed.map((k) => k.key),
      'merge'
    );
    const ordered: GameHistoryRecord[] = [];
    const used = new Set<number>();
    for (let i = sortedResult.sorted.length - 1; i >= 0; i--) {
      const kVal = sortedResult.sorted[i];
      const match = keyed.find((item) => item.key === kVal && !used.has(item.id));
      if (match) {
        used.add(match.id);
        ordered.push(match.session);
      }
    }
    return {
      filteredSessions: ordered,
      sortStats: { comparisons: sortedResult.metrics.comparisons, swaps: sortedResult.metrics.swaps },
    };
  }, [sessions, searchTerm, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Battlefield History &amp; Saved Telemetry
          </h1>
          <p className="text-sm text-slate-400">
            Persistent SQLite match logs indexed with manual Suffix Array pattern search and Merge Sort ranking.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          Refresh Logs
        </button>
      </div>

      {/* Achievements Strip */}
      {profile && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <Trophy className="h-4 w-4" />
              Commander Level {profile.level} ({profile.xp} XP) — {profile.games_won}/{profile.games_played} Victories
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.achievements.length === 0 ? (
                <span className="text-xs text-slate-400">Complete a match to unlock achievements.</span>
              ) : (
                profile.achievements.map((ach) => (
                  <span
                    key={ach}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-200"
                  >
                    <Award className="h-3 w-3" />
                    {ach}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('matches')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'matches'
              ? 'bg-cyan-500 text-slate-950'
              : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          Match Sessions ({sessions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('benchmarks')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            tab === 'benchmarks'
              ? 'bg-cyan-500 text-slate-950'
              : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          Saved C++ Benchmark Runs ({benchmarks.length})
        </button>
      </div>

      {tab === 'matches' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="history-suffix-search" className="block text-xs font-medium text-slate-300">
                Suffix Array Pattern Search (Map, Difficulty, Sort Algo, Outcome)
              </label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="history-suffix-search"
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g. circuit, nightmare, quick, victory..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="history-sort-select" className="block text-xs font-medium text-slate-300">
                Rank Records (Manual Merge Sort)
              </label>
              <select
                id="history-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'wave' | 'enemies' | 'gold')}
                className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="recent">Most Recent</option>
                <option value="wave">Highest Wave Reached</option>
                <option value="enemies">Most Enemies Eliminated</option>
                <option value="gold">Highest Coins Earned</option>
              </select>
            </div>
          </div>

          {sortStats && (
            <div className="text-xs text-cyan-300 font-mono">
              Merge Sort ranking executed: {sortStats.comparisons} comparisons, {sortStats.swaps} array writes.
            </div>
          )}

          {filteredSessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
              <History className="mx-auto mb-2 h-6 w-6 text-slate-500" />
              No recorded matches match your filter yet. Play a battle in Play Game to save telemetry!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2 pr-3">Map</th>
                    <th className="py-2 pr-3">Difficulty</th>
                    <th className="py-2 pr-3">Outcome</th>
                    <th className="py-2 pr-3">Wave</th>
                    <th className="py-2 pr-3">Enemies</th>
                    <th className="py-2 pr-3">Coins</th>
                    <th className="py-2 pr-3">Towers</th>
                    <th className="py-2 pr-3">Sort Algo</th>
                    <th className="py-2">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3 font-semibold text-slate-100">{s.map_name}</td>
                      <td className="py-2.5 pr-3 capitalize">{s.difficulty}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            s.victory ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {s.victory ? 'Victory' : 'Defeat'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{s.wave_reached}/{s.total_waves}</td>
                      <td className="py-2.5 pr-3 font-mono">{s.enemies_defeated}</td>
                      <td className="py-2.5 pr-3 font-mono text-amber-300">{s.gold_earned}</td>
                      <td className="py-2.5 pr-3 font-mono">{s.towers_built}</td>
                      <td className="py-2.5 pr-3 font-mono text-cyan-300">{s.targeting_algo}</td>
                      <td className="py-2.5 font-mono">{Math.round(s.duration_sec)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'benchmarks' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
          {benchmarks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
              No saved benchmark runs yet. Visit Performance Analysis to run the C++17 suite.
            </div>
          ) : (
            benchmarks.map((run) => (
              <div key={run.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-cyan-300 uppercase">
                    {run.category} — N={run.input_size} ({run.pattern})
                  </span>
                  <span className="text-slate-400">{run.engine} • {run.created_at}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {run.results.map((r) => (
                    <span key={r.algorithm} className="rounded border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-slate-200">
                      {r.algorithm}: <span className="text-emerald-300">{r.durationMs.toFixed(3)}ms</span> ({r.operations.toLocaleString()} ops)
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};