import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { SortAlgorithmType } from '../../types/game';
import { runSortTrace, SortStep } from '../../dsa/sorting';
import { binarySearchTrace, linearSearchTrace, medianSearchTrace, SearchStep } from '../../dsa/searching';
import { CollisionStrategy, HashTable } from '../../dsa/hashing';

export interface LabMetaUpdate {
  name: string;
  explanation: string;
  application: string;
  bestCase: string;
  avgCase: string;
  worstCase: string;
  space: string;
  currentOp: string;
  comparisons: number;
  swaps: number;
}

interface Props {
  mode: 'searching' | 'sorting' | 'hashing';
  onMetaChange: (meta: LabMetaUpdate) => void;
}

const SORT_INFO: Record<SortAlgorithmType, { label: string; best: string; avg: string; worst: string; space: string; desc: string }> = {
  bubble: { label: 'Bubble Sort', best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', desc: 'Repeatedly swaps adjacent out-of-order elements until sorted.' },
  selection: { label: 'Selection Sort', best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', desc: 'Selects minimum element from unsorted suffix and places it at front.' },
  insertion: { label: 'Insertion Sort', best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', desc: 'Builds sorted prefix one element at a time by shifting larger items.' },
  merge: { label: 'Merge Sort', best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', desc: 'Divide-and-conquer recursive split and linear two-pointer merge.' },
  quick: { label: 'Quick Sort', best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', desc: 'Partitions around pivot so smaller elements precede larger ones.' },
  radix: { label: 'Radix Sort', best: 'O(d(n+k))', avg: 'O(d(n+k))', worst: 'O(d(n+k))', space: 'O(n+k)', desc: 'Non-comparative digit-by-digit stable counting pass.' },
  bucket: { label: 'Bucket Sort', best: 'O(n+k)', avg: 'O(n+k)', worst: 'O(n²)', space: 'O(n+k)', desc: 'Distributes values into uniform buckets and sorts each bucket.' },
  counting: { label: 'Counting Sort', best: 'O(n+k)', avg: 'O(n+k)', worst: 'O(n+k)', space: 'O(k)', desc: 'Counts integer frequencies to place elements directly in sorted order.' },
};

export const SearchSortHashLab: React.FC<Props> = ({ mode, onMetaChange }) => {
  const [inputText, setInputText] = useState('42, 15, 78, 9, 53, 27, 64, 19, 85, 31');
  const [targetVal, setTargetVal] = useState('53');
  const [searchAlgo, setSearchAlgo] = useState<'linear' | 'binary' | 'median'>('binary');
  const [sortAlgo, setSortAlgo] = useState<SortAlgorithmType>('merge');
  const [compareResults, setCompareResults] = useState<Array<{ algo: string; comps: number; swaps: number; ms: string }>>([]);

  // Step player state
  const [sortSteps, setSortSteps] = useState<SortStep[]>([]);
  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(280);

  // Hashing state
  const [hashStrategy, setHashStrategy] = useState<CollisionStrategy>('linear');
  const [hashKey, setHashKey] = useState('Tower_Railgun');
  const [hashVal, setHashVal] = useState('120');
  const [hashTable, setHashTable] = useState<HashTable<string>>(() => {
    const ht = new HashTable<string>('linear', 11);
    ht.insert('Pulse', '70g');
    ht.insert('Railgun', '120g');
    ht.insert('Gatling', '95g');
    ht.insert('Mortar', '135g');
    return ht;
  });
  const [probeLog, setProbeLog] = useState<string[]>(['Initialized HashTable (capacity 11, Linear Probing).']);

  const parseArray = () =>
    inputText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n))
      .slice(0, 28);

  const executeAlgorithm = () => {
    setPlaying(false);
    setStepIdx(0);
    const nums = parseArray();
    if (nums.length === 0) return;

    if (mode === 'sorting') {
      const res = runSortTrace(nums, sortAlgo);
      setSortSteps(res.steps);
      setSearchSteps([]);
      const info = SORT_INFO[sortAlgo];
      onMetaChange({
        name: info.label,
        explanation: info.desc,
        application: 'Ranking enemies by HP, distance, or speed inside tower targeting.',
        bestCase: info.best,
        avgCase: info.avg,
        worstCase: info.worst,
        space: info.space,
        currentOp: res.steps[0]?.description ?? 'Ready',
        comparisons: res.metrics.comparisons,
        swaps: res.metrics.swaps,
      });
    } else if (mode === 'searching') {
      const t = Number(targetVal) || 0;
      const input = searchAlgo === 'binary' ? [...nums].sort((a, b) => a - b) : nums;
      const res =
        searchAlgo === 'linear'
          ? linearSearchTrace(input, t)
          : searchAlgo === 'binary'
          ? binarySearchTrace(input, t)
          : medianSearchTrace(input, t, false);
      setSearchSteps(res.steps);
      setSortSteps([]);
      onMetaChange({
        name:
          searchAlgo === 'linear'
            ? 'Linear Search'
            : searchAlgo === 'binary'
            ? 'Binary Search'
            : 'Median-of-Medians Search',
        explanation:
          searchAlgo === 'median'
            ? 'Deterministically finds exact median pivot via groups of 5 (O(n) worst-case) without pre-sorting!'
            : searchAlgo === 'binary'
            ? 'Halves a sorted array each step by comparing against middle index.'
            : 'Scans elements sequentially from index 0 until target is matched.',
        application: 'Finding enemy by ID, searching sorted tower stats, or median HP selection.',
        bestCase: 'O(1)',
        avgCase: searchAlgo === 'linear' ? 'O(n)' : searchAlgo === 'binary' ? 'O(log n)' : 'O(n)',
        worstCase: searchAlgo === 'binary' ? 'O(log n)' : 'O(n)',
        space: searchAlgo === 'median' ? 'O(n)' : 'O(1)',
        currentOp: res.steps[0]?.description ?? 'Ready',
        comparisons: res.comparisons,
        swaps: 0,
      });
    }
  };

  useEffect(() => {
    if (mode === 'sorting' || mode === 'searching') {
      executeAlgorithm();
    } else {
      onMetaChange({
        name: `Hash Table (${hashStrategy})`,
        explanation: 'Maps string keys via FNV-1a primary hash and resolves bucket collisions.',
        application: 'O(1) enemy/tower ID lookup & resource inventory management.',
        bestCase: 'O(1)',
        avgCase: 'O(1)',
        worstCase: 'O(n)',
        space: 'O(n)',
        currentOp: probeLog[0] ?? 'Ready',
        comparisons: hashTable.inspectState().collisions,
        swaps: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sortAlgo, searchAlgo]);

  const totalSteps = mode === 'sorting' ? sortSteps.length : searchSteps.length;

  useEffect(() => {
    if (!playing || totalSteps === 0) return;
    const timer = setInterval(() => {
      setStepIdx((prev) => {
        if (prev + 1 >= totalSteps) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speedMs);
    return () => clearInterval(timer);
  }, [playing, speedMs, totalSteps]);

  // Sync current op text
  useEffect(() => {
    if (mode === 'sorting' && sortSteps[stepIdx]) {
      const s = sortSteps[stepIdx];
      const info = SORT_INFO[sortAlgo];
      onMetaChange({
        name: info.label,
        explanation: info.desc,
        application: 'Ranking enemies by HP, distance, or speed inside tower targeting.',
        bestCase: info.best,
        avgCase: info.avg,
        worstCase: info.worst,
        space: info.space,
        currentOp: s.description,
        comparisons: s.comparisons,
        swaps: s.swaps,
      });
    } else if (mode === 'searching' && searchSteps[stepIdx]) {
      const s = searchSteps[stepIdx];
      onMetaChange({
        name: searchAlgo === 'linear' ? 'Linear Search' : searchAlgo === 'binary' ? 'Binary Search' : 'Median-of-Medians Search',
        explanation: 'Step-by-step live execution trace.',
        application: 'Finding enemy/tower IDs and median wave health.',
        bestCase: 'O(1)',
        avgCase: searchAlgo === 'binary' ? 'O(log n)' : 'O(n)',
        worstCase: searchAlgo === 'binary' ? 'O(log n)' : 'O(n)',
        space: searchAlgo === 'median' ? 'O(n)' : 'O(1)',
        currentOp: s.description,
        comparisons: s.comparisons,
        swaps: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  if (mode === 'hashing') {
    const state = hashTable.inspectState();
    const rebuildWithStrategy = (strat: CollisionStrategy) => {
      const next = new HashTable<string>(strat, 11);
      for (const [k, v] of hashTable.entries()) next.insert(k, v);
      setHashStrategy(strat);
      setHashTable(next);
      setProbeLog([`Rebuilt table using ${strat} collision resolution.`]);
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label htmlFor="hash-strat" className="block text-xs text-slate-400 mb-1">Collision Strategy</label>
            <select
              id="hash-strat"
              value={hashStrategy}
              onChange={(e) => rebuildWithStrategy(e.target.value as CollisionStrategy)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white"
            >
              <option value="chaining">Separate Chaining</option>
              <option value="linear">Linear Probing</option>
              <option value="quadratic">Quadratic Probing</option>
              <option value="double">Double Hashing</option>
            </select>
          </div>
          <div>
            <label htmlFor="hash-key" className="block text-xs text-slate-400 mb-1">Key</label>
            <input
              id="hash-key"
              value={hashKey}
              onChange={(e) => setHashKey(e.target.value)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white w-36"
            />
          </div>
          <div>
            <label htmlFor="hash-val" className="block text-xs text-slate-400 mb-1">Value</label>
            <input
              id="hash-val"
              value={hashVal}
              onChange={(e) => setHashVal(e.target.value)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white w-24"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!hashKey.trim()) return;
              const steps = hashTable.insert(hashKey.trim(), hashVal.trim());
              setProbeLog(steps.map((s) => `[idx ${s.index}] ${s.detail}`));
              onMetaChange({
                name: `Hash Table (${hashStrategy})`,
                explanation: 'Maps string keys via FNV-1a primary hash and resolves collisions.',
                application: 'O(1) enemy/tower ID lookup & resource inventory management.',
                bestCase: 'O(1)',
                avgCase: 'O(1)',
                worstCase: 'O(n)',
                space: 'O(n)',
                currentOp: steps[steps.length - 1]?.detail ?? 'Inserted',
                comparisons: hashTable.inspectState().collisions,
                swaps: 0,
              });
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
          >
            Insert Key
          </button>
          <button
            type="button"
            onClick={() => {
              const ok = hashTable.remove(hashKey.trim());
              setProbeLog([ok ? `Deleted key "${hashKey.trim()}".` : `Key "${hashKey.trim()}" not found.`]);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30"
          >
            Delete Key
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-slate-900 p-2.5">Capacity: <strong className="text-cyan-300">{state.capacity}</strong></div>
          <div className="rounded-lg bg-slate-900 p-2.5">Load Factor: <strong className="text-emerald-300">{state.loadFactor}</strong></div>
          <div className="rounded-lg bg-slate-900 p-2.5">Collisions: <strong className="text-amber-300">{state.collisions}</strong></div>
        </div>

        {hashStrategy === 'chaining' ? (
          <div className="space-y-1.5">
            {state.chains.map((bucket, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="w-10 text-center font-mono py-1 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                  [{idx}]
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {bucket.length === 0 ? (
                    <span className="text-slate-600 italic">null</span>
                  ) : (
                    bucket.map((item) => (
                      <span
                        key={item.key}
                        className="px-2.5 py-1 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 font-mono"
                      >
                        {item.key}: {item.value}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {state.slots.map((slot, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-2.5 border text-xs font-mono ${
                  slot.state === 'occupied'
                    ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
                    : slot.state === 'deleted'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-slate-900/70 border-slate-800 text-slate-500'
                }`}
              >
                <p className="text-[10px] text-slate-400">Slot {idx}</p>
                <p className="truncate font-semibold">
                  {slot.state === 'occupied' ? `${slot.key}=${slot.value}` : slot.state.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg bg-[#070c17] border border-slate-800 p-3 text-xs font-mono text-cyan-300 space-y-1">
          {probeLog.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    );
  }

  const currentSortStep = sortSteps[stepIdx];
  const currentSearchStep = searchSteps[stepIdx];
  const displayArr = mode === 'sorting' ? currentSortStep?.array ?? parseArray() : currentSearchStep?.array ?? parseArray();
  const maxVal = Math.max(1, ...displayArr);

  return (
    <div className="space-y-4">
      {/* Algorithm selector & Input Editor */}
      <div className="flex flex-wrap gap-3 items-end">
        {mode === 'sorting' ? (
          <div>
            <label htmlFor="lab-sort-algo" className="block text-xs text-slate-400 mb-1">Sorting Algorithm</label>
            <select
              id="lab-sort-algo"
              value={sortAlgo}
              onChange={(e) => setSortAlgo(e.target.value as SortAlgorithmType)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white"
            >
              {(Object.keys(SORT_INFO) as SortAlgorithmType[]).map((k) => (
                <option key={k} value={k}>{SORT_INFO[k].label}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="lab-search-algo" className="block text-xs text-slate-400 mb-1">Search Algorithm</label>
              <select
                id="lab-search-algo"
                value={searchAlgo}
                onChange={(e) => setSearchAlgo(e.target.value as 'linear' | 'binary' | 'median')}
                className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white"
              >
                <option value="linear">Linear Search</option>
                <option value="binary">Binary Search (Sorted)</option>
                <option value="median">Median-of-Medians Search</option>
              </select>
            </div>
            <div>
              <label htmlFor="lab-search-target" className="block text-xs text-slate-400 mb-1">Target Value</label>
              <input
                id="lab-search-target"
                value={targetVal}
                onChange={(e) => setTargetVal(e.target.value)}
                className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white w-24"
              />
            </div>
          </>
        )}

        <div className="flex-1 min-w-[200px]">
          <label htmlFor="lab-array-input" className="block text-xs text-slate-400 mb-1">
            Input Array (comma-separated)
          </label>
          <input
            id="lab-array-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white font-mono"
          />
        </div>

        <button
          type="button"
          onClick={executeAlgorithm}
          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
        >
          Execute
        </button>

        {mode === 'sorting' && (
          <button
            type="button"
            onClick={() => {
              const nums = parseArray();
              const rows = (Object.keys(SORT_INFO) as SortAlgorithmType[]).map((a) => {
                const r = runSortTrace(nums, a);
                return {
                  algo: SORT_INFO[a].label,
                  comps: r.metrics.comparisons,
                  swaps: r.metrics.swaps,
                  ms: r.metrics.durationMs.toFixed(3),
                };
              });
              setCompareResults(rows);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/35"
          >
            Compare All 8
          </button>
        )}
      </div>

      {/* Bar / Element Visualization */}
      <div className="rounded-xl border border-slate-800 bg-[#060b16] p-4 min-h-[240px] flex flex-col justify-end">
        <div className="flex items-end justify-center gap-1.5 h-44">
          {displayArr.map((val, idx) => {
            const pct = Math.max(12, Math.round((Math.abs(val) / maxVal) * 100));
            let barColor = '#334155';
            if (mode === 'sorting' && currentSortStep) {
              if (currentSortStep.swapping.includes(idx)) barColor = '#f43f5e';
              else if (currentSortStep.comparing.includes(idx)) barColor = '#facc15';
              else if (currentSortStep.sortedIndices.includes(idx)) barColor = '#10b981';
              else barColor = '#0284c7';
            } else if (mode === 'searching' && currentSearchStep) {
              if (currentSearchStep.foundIndex === idx) barColor = '#10b981';
              else if (currentSearchStep.activeIndices.includes(idx)) barColor = '#facc15';
              else if (
                currentSearchStep.range &&
                idx >= currentSearchStep.range[0] &&
                idx <= currentSearchStep.range[1]
              ) {
                barColor = '#0284c7';
              }
            }
            return (
              <div key={idx} className="flex-1 max-w-[44px] flex flex-col items-center gap-1">
                <span className="text-[10px] font-mono text-slate-300">{val}</span>
                <div
                  className="w-full rounded-t-md transition-all duration-150"
                  style={{ height: `${pct}%`, backgroundColor: barColor }}
                />
                <span className="text-[9px] font-mono text-slate-500">{idx}</span>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs font-mono text-cyan-300 text-center">
          {mode === 'sorting'
            ? currentSortStep?.description ?? 'Press Execute'
            : currentSearchStep?.description ?? 'Press Execute'}
        </p>
      </div>

      {/* Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#070d1b] p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={totalSteps === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950"
          >
            {playing ? <Pause className="w-3.5 h-3.5" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setStepIdx((i) => Math.min(totalSteps - 1, i + 1));
            }}
            disabled={stepIdx >= totalSteps - 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 disabled:opacity-40"
          >
            <StepForward className="w-3.5 h-3.5" aria-hidden="true" />
            Step
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setStepIdx(0);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            Step <strong className="text-white">{totalSteps ? stepIdx + 1 : 0}</strong> / {totalSteps}
          </span>
          <label htmlFor="lab-speed" className="text-slate-400">Speed:</label>
          <input
            id="lab-speed"
            type="range"
            min={50}
            max={800}
            step={50}
            value={850 - speedMs}
            onChange={(e) => setSpeedMs(850 - Number(e.target.value))}
          />
        </div>
      </div>

      {mode === 'sorting' && compareResults.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-[#070d1b] p-3 overflow-x-auto">
          <h3 className="text-xs font-bold text-purple-300 mb-2">Same-Input Comparison Across All 8 Sorting Algorithms</h3>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th scope="col" className="py-1.5">Algorithm</th>
                <th scope="col" className="py-1.5">Comparisons</th>
                <th scope="col" className="py-1.5">Swaps/Writes</th>
                <th scope="col" className="py-1.5">Time (ms)</th>
              </tr>
            </thead>
            <tbody>
              {compareResults.map((r) => (
                <tr key={r.algo} className="border-b border-slate-800/60 text-slate-200">
                  <td className="py-1.5 font-semibold">{r.algo}</td>
                  <td className="py-1.5 font-mono text-cyan-300">{r.comps}</td>
                  <td className="py-1.5 font-mono text-amber-300">{r.swaps}</td>
                  <td className="py-1.5 font-mono text-emerald-300">{r.ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

