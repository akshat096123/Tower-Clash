import React, { useMemo, useState } from 'react';
import { Activity, Cpu, Play, RotateCcw } from 'lucide-react';
import { BenchmarkMetricRow, BenchmarkResponse } from '../types/game';
import { ChartSeries, LineComparisonChart, getSeriesColor } from '../components/Charts';
import { SORT_LABELS, runSortTrace } from '../dsa/sorting';
import { binarySearchTrace, linearSearchTrace, medianSearchTrace } from '../dsa/searching';

type BenchmarkCategory = 'sorting' | 'searching' | 'trees' | 'graphs';
type BenchmarkPattern = 'random' | 'sorted' | 'reversed' | 'best' | 'average' | 'worst';

const ALGO_DISPLAY_NAMES: Record<string, string> = {
  bubble: 'Bubble Sort',
  selection: 'Selection Sort',
  insertion: 'Insertion Sort',
  merge: 'Merge Sort',
  quick: 'Quick Sort',
  radix: 'Radix Sort',
  bucket: 'Bucket Sort',
  counting: 'Counting Sort',
  linear: 'Linear Search',
  binary: 'Binary Search',
  median: 'Median Search',
  bst: 'Binary Search Tree',
  avl: 'AVL Tree',
  redblack: 'Red-Black Tree',
  btree: 'B-Tree (t=3)',
  heap: 'Binary Heap',
  bfs: 'BFS',
  dfs: 'DFS',
  dijkstra: 'Dijkstra',
  bellman_ford: 'Bellman-Ford',
  floyd_warshall: 'Floyd-Warshall',
  prim: 'Prim MST',
  kruskal: 'Kruskal MST',
};

function formatAlgoName(raw: string): string {
  return ALGO_DISPLAY_NAMES[raw] ?? raw;
}

const THEORETICAL_COMPLEXITY: Record<string, { time: string; space: string; role: string }> = {
  'Bubble Sort': { time: 'O(n^2) avg / O(n) best', space: 'O(1)', role: 'Baseline educational sort' },
  'Selection Sort': { time: 'O(n^2)', space: 'O(1)', role: 'Minimal swap count' },
  'Insertion Sort': { time: 'O(n^2) avg / O(n) best', space: 'O(1)', role: 'Fast on nearly sorted targets' },
  'Merge Sort': { time: 'O(n log n)', space: 'O(n)', role: 'Stable wave & leaderboard sorting' },
  'Quick Sort': { time: 'O(n log n) avg / O(n^2) worst', space: 'O(log n)', role: 'Default tower targeting sort' },
  'Radix Sort': { time: 'O(d(n + k))', space: 'O(n + k)', role: 'Integer ID & threat keys' },
  'Bucket Sort': { time: 'O(n + k) avg', space: 'O(n + k)', role: 'Uniform distance buckets' },
  'Counting Sort': { time: 'O(n + k)', space: 'O(k)', role: 'Bounded wave priority keys' },
  'Linear Search': { time: 'O(n)', space: 'O(1)', role: 'Unsorted entity scan' },
  'Binary Search': { time: 'O(log n)', space: 'O(1)', role: 'Sorted ID / score lookup' },
  'Median Search': { time: 'O(n) worst (BFPRT)', space: 'O(n)', role: 'Median enemy HP / damage pivot' },
  'Binary Search Tree': { time: 'O(h) / O(n) worst', space: 'O(n)', role: 'Ordered ID tree' },
  'AVL Tree': { time: 'O(log n)', space: 'O(n)', role: 'Strict height-balanced lookups' },
  'Red-Black Tree': { time: 'O(log n)', space: 'O(n)', role: 'Balanced dynamic sets' },
  'Binary Heap': { time: 'O(n log n) build/pop', space: 'O(n)', role: 'Priority threat targeting' },
  'B-Tree (t=3)': { time: 'O(t log_t n)', space: 'O(n)', role: 'Block-indexed score records' },
  'BFS': { time: 'O(V + E)', space: 'O(V)', role: 'Unweighted shortest hop count' },
  'DFS': { time: 'O(V + E)', space: 'O(V)', role: 'Connectedness & cycle check' },
  'Dijkstra': { time: 'O((V + E) log V)', space: 'O(V)', role: 'Weighted tower pathfinding' },
  'Bellman-Ford': { time: 'O(V * E)', space: 'O(V)', role: 'Negative-weight / buff edges' },
  'Floyd-Warshall': { time: 'O(V^3)', space: 'O(V^2)', role: 'All-pairs distance matrix' },
  'Prim MST': { time: 'O(V^2) / O(E log V)', space: 'O(V)', role: 'Minimum cost defense relay' },
  'Kruskal MST': { time: 'O(E log E)', space: 'O(V)', role: 'Union-Find network backbone' },
};

function generateInputArray(size: number, pattern: BenchmarkPattern): number[] {
  const arr: number[] = [];
  for (let i = 0; i < size; i++) {
    if (pattern === 'sorted' || pattern === 'best') {
      arr.push(i + 1);
    } else if (pattern === 'reversed' || pattern === 'worst') {
      arr.push(size - i);
    } else {
      arr.push(((i * 7919 + 104729) % (size * 4)) + 1);
    }
  }
  return arr;
}

function runTsClientBenchmark(category: BenchmarkCategory, size: number, pattern: BenchmarkPattern): BenchmarkResponse {
  const clamped = Math.min(size, 2500);
  const input = generateInputArray(clamped, pattern);
  const results: BenchmarkMetricRow[] = [];

  if (category === 'sorting') {
    const algos = Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>;
    for (const algo of algos) {
      const res = runSortTrace(input, algo);
      results.push({
        algorithm: SORT_LABELS[algo],
        inputSize: clamped,
        durationMs: Number(res.metrics.durationMs.toFixed(4)),
        comparisons: res.metrics.comparisons,
        swaps: res.metrics.swaps,
        recursiveCalls: res.metrics.recursiveCalls,
        operations: res.metrics.operations,
        memoryBytes: res.metrics.memoryBytes,
      });
    }
  } else if (category === 'searching') {
    const sorted = [...input].sort((a, b) => a - b);
    const target =
      pattern === 'best'
        ? sorted[0]
        : pattern === 'worst'
        ? -999999
        : sorted[Math.floor(sorted.length * 0.7)];

    const lin = linearSearchTrace(input, target);
    results.push({
      algorithm: 'Linear Search',
      inputSize: clamped,
      durationMs: Number(lin.durationMs.toFixed(4)),
      comparisons: lin.comparisons,
      swaps: 0,
      recursiveCalls: 0,
      operations: lin.operations,
      memoryBytes: clamped * 8,
    });

    const bin = binarySearchTrace(sorted, target);
    results.push({
      algorithm: 'Binary Search',
      inputSize: clamped,
      durationMs: Number(bin.durationMs.toFixed(4)),
      comparisons: bin.comparisons,
      swaps: 0,
      recursiveCalls: 0,
      operations: bin.operations,
      memoryBytes: clamped * 8,
    });

    const med = medianSearchTrace(input, target, true);
    results.push({
      algorithm: 'Median Search',
      inputSize: clamped,
      durationMs: Number(med.durationMs.toFixed(4)),
      comparisons: med.comparisons,
      swaps: 0,
      recursiveCalls: Math.ceil(clamped / 5),
      operations: med.operations,
      memoryBytes: clamped * 16,
    });
  }

  return {
    engine: 'TypeScript (Browser)',
    category,
    pattern,
    results,
  };
}

export const PerformanceAnalysis: React.FC<{ defaultEngine?: 'cpp' | 'ts' }> = ({ defaultEngine = 'cpp' }) => {
  const [category, setCategory] = useState<BenchmarkCategory>('sorting');
  const [pattern, setPattern] = useState<BenchmarkPattern>('random');
  const [engineMode, setEngineMode] = useState<'cpp' | 'ts'>(defaultEngine);
  const [singleSize, setSingleSize] = useState<number>(1000);
  const [trials, setTrials] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sweepData, setSweepData] = useState<BenchmarkResponse[]>([]);

  const sizeList = useMemo(() => {
    if (category === 'graphs') return [50, 100, 200, 350, 500];
    if (engineMode === 'ts') return [100, 250, 500, 1000, 2000];
    return [100, 500, 1000, 5000, 10000];
  }, [category, engineMode]);

  const runSingleBenchmark = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (engineMode === 'ts' && (category === 'sorting' || category === 'searching')) {
        setSweepData([runTsClientBenchmark(category, singleSize, pattern)]);
      } else {
        const res = await fetch(
          `/api/benchmarks/run?category=${category}&size=${singleSize}&pattern=${pattern}&trials=${trials}`
        );
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as BenchmarkResponse;
        setSweepData([json]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const runMultiSizeSweep = async () => {
    setLoading(true);
    setErrorMsg(null);
    const collected: BenchmarkResponse[] = [];
    try {
      for (const sz of sizeList) {
        if (engineMode === 'ts' && (category === 'sorting' || category === 'searching')) {
          collected.push(runTsClientBenchmark(category, sz, pattern));
        } else {
          const res = await fetch(
            `/api/benchmarks/run?category=${category}&size=${sz}&pattern=${pattern}&trials=${trials}`
          );
          if (!res.ok) throw new Error(await res.text());
          const json = (await res.json()) as BenchmarkResponse;
          collected.push(json);
        }
      }
      setSweepData(collected);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const { timeSeries, opsSeries, memSeries, latestRows } = useMemo(() => {
    if (sweepData.length === 0) {
      return { timeSeries: [] as ChartSeries[], opsSeries: [] as ChartSeries[], memSeries: [] as ChartSeries[], latestRows: [] as BenchmarkMetricRow[] };
    }
    const algoNames = Array.from(
      new Set(sweepData.flatMap((batch) => batch.results.map((r) => formatAlgoName(r.algorithm))))
    );

    const buildSeries = (selector: (row: BenchmarkMetricRow) => number): ChartSeries[] =>
      algoNames.map((name, idx) => ({
        name,
        color: getSeriesColor(idx),
        points: sweepData
          .map((batch) => {
            const match = batch.results.find((r) => formatAlgoName(r.algorithm) === name);
            return match ? { x: match.inputSize, y: selector(match) } : null;
          })
          .filter((p): p is { x: number; y: number } => p !== null),
      }));

    const latest = sweepData[sweepData.length - 1]?.results ?? [];
    return {
      timeSeries: buildSeries((r) => r.durationMs),
      opsSeries: buildSeries((r) => r.operations),
      memSeries: buildSeries((r) => Math.round(r.memoryBytes / 1024)),
      latestRows: latest,
    };
  }, [sweepData]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Performance Analysis Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Measured C++17 &amp; TypeScript algorithm execution times, comparison counts, swaps, and memory footprints across input sizes.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200">
          <Cpu className="h-4 w-4 text-emerald-400" />
          Engine: <span className="font-semibold">{sweepData[0]?.engine ?? (engineMode === 'cpp' ? 'C++17 Native Binary' : 'TypeScript Browser')}</span>
        </div>
      </div>

      {/* Benchmark Controls */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="perf-category" className="block text-xs font-medium text-slate-300">
              Algorithm Category
            </label>
            <select
              id="perf-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as BenchmarkCategory)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="sorting">Sorting (All 8 Algorithms)</option>
              <option value="searching">Searching (Linear, Binary, Median)</option>
              <option value="trees">Trees &amp; Heaps (BST, AVL, RBT, Heap, B-Tree)</option>
              <option value="graphs">Graphs (BFS, DFS, Dijkstra, BF, FW, MST)</option>
            </select>
          </div>

          <div>
            <label htmlFor="perf-pattern" className="block text-xs font-medium text-slate-300">
              Input Case / Distribution
            </label>
            <select
              id="perf-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value as BenchmarkPattern)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="random">Random / Average Case</option>
              <option value="sorted">Sorted Input</option>
              <option value="reversed">Reverse Sorted (Worst for Quick/Ins)</option>
              <option value="best">Best Case Target / Input</option>
              <option value="average">Average Case Target</option>
              <option value="worst">Worst Case Target / Input</option>
            </select>
          </div>

          <div>
            <label htmlFor="perf-size" className="block text-xs font-medium text-slate-300">
              Single Run Input Size (N)
            </label>
            <select
              id="perf-size"
              value={singleSize}
              onChange={(e) => setSingleSize(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {sizeList.map((s) => (
                <option key={s} value={s}>
                  N = {s.toLocaleString()} {category === 'graphs' ? 'vertices' : 'elements'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="perf-engine" className="block text-xs font-medium text-slate-300">
              Execution Engine
            </label>
            <select
              id="perf-engine"
              value={engineMode}
              onChange={(e) => setEngineMode(e.target.value as 'cpp' | 'ts')}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="cpp">C++17 Native Engine (Recommended)</option>
              <option value="ts">TypeScript In-Browser (Sort/Search)</option>
            </select>
          </div>

          <div>
            <label htmlFor="perf-trials" className="block text-xs font-medium text-slate-300">
              Averaged Trials
            </label>
            <input
              id="perf-trials"
              type="number"
              min={1}
              max={5}
              value={trials}
              onChange={(e) => setTrials(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={runMultiSizeSweep}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            <Activity className="h-4 w-4" />
            {loading ? 'Running Measured Sweep...' : `Run Multi-Size Sweep (${sizeList.join(', ')})`}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={runSingleBenchmark}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Run Single Size (N={singleSize})
          </button>

          {sweepData.length > 0 && (
            <button
              type="button"
              onClick={() => setSweepData([])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear Results
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            Benchmark error: {errorMsg}
          </div>
        )}
      </div>

      {/* Empty prompt */}
      {sweepData.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
          <p className="text-sm text-slate-300">
            Click <span className="font-semibold text-cyan-300">Run Multi-Size Sweep</span> to execute real benchmarks via the compiled C++17 DSA engine and plot actual scaling curves.
          </p>
        </div>
      )}

      {/* Charts */}
      {sweepData.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LineComparisonChart
              title="Measured Execution Time vs Input Size"
              yLabel="Time (ms)"
              xLabel={category === 'graphs' ? 'Vertices (V)' : 'Input Elements (N)'}
              series={timeSeries}
            />
            <LineComparisonChart
              title="Total Measured Operations vs Input Size"
              yLabel="Operations"
              xLabel={category === 'graphs' ? 'Vertices (V)' : 'Input Elements (N)'}
              series={opsSeries}
            />
          </div>

          <LineComparisonChart
            title="Estimated Heap / Auxiliary Memory Usage vs Input Size"
            yLabel="Memory (KB)"
            xLabel={category === 'graphs' ? 'Vertices (V)' : 'Input Elements (N)'}
            series={memSeries}
          />

          {/* Measured Table + Theoretical Comparison */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 overflow-x-auto">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-100">
                Measured Execution &amp; Theoretical Complexity Matrix (N = {latestRows[0]?.inputSize?.toLocaleString() ?? singleSize})
              </h2>
              <span className="text-xs text-slate-400">Pattern: {pattern} | Saved automatically to SQLite</span>
            </div>

            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2 pr-3">Algorithm</th>
                  <th className="py-2 pr-3">Time (ms)</th>
                  <th className="py-2 pr-3">Comparisons</th>
                  <th className="py-2 pr-3">Swaps / Writes</th>
                  <th className="py-2 pr-3">Rec. Calls</th>
                  <th className="py-2 pr-3">Total Ops</th>
                  <th className="py-2 pr-3">Memory (B)</th>
                  <th className="py-2 pr-3">Theoretical Time / Space</th>
                  <th className="py-2">Game Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {latestRows.map((row) => {
                  const displayName = formatAlgoName(row.algorithm);
                  const theo = THEORETICAL_COMPLEXITY[displayName];
                  return (
                    <tr key={row.algorithm} className="hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3 font-semibold text-cyan-200">{displayName}</td>
                      <td className="py-2.5 pr-3 font-mono text-emerald-300">{row.durationMs.toFixed(4)}</td>
                      <td className="py-2.5 pr-3 font-mono">{row.comparisons.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 font-mono">{row.swaps.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 font-mono">{row.recursiveCalls.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 font-mono text-amber-300">{row.operations.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 font-mono">{row.memoryBytes.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 font-mono text-violet-300">
                        {theo ? `${theo.time} | ${theo.space}` : '—'}
                      </td>
                      <td className="py-2.5 text-slate-400">{theo?.role ?? 'Core engine routine'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};