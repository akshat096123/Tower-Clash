import React, { useEffect, useState } from 'react';
import {
  Binary,
  Boxes,
  Compass,
  GitBranch,
  Hash,
  Layers,
  ListTree,
  Search,
  Share2,
  Type,
} from 'lucide-react';
import { LinearAndLinkedLab } from './lab/LinearAndLinkedLab';
import { LabMetaUpdate, SearchSortHashLab } from './lab/SearchSortHashLab';
import { TreesAndAdvancedLab } from './lab/TreesAndAdvancedLab';
import { GraphsBacktrackStringsLab } from './lab/GraphsBacktrackStringsLab';

export type LabCategory =
  | 'linear'
  | 'searching'
  | 'sorting'
  | 'hashing'
  | 'linked'
  | 'trees'
  | 'graphs'
  | 'backtracking'
  | 'advanced_trees'
  | 'strings';

interface DsaLabProps {
  initialCategory?: LabCategory;
  heading?: string;
}

const CATEGORIES: Array<{
  id: LabCategory;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'linear', label: 'Linear DS', subtitle: 'DynArray, Stack, Queue, CircQueue', icon: Layers },
  { id: 'searching', label: 'Searching', subtitle: 'Linear, Binary, Median-of-Medians', icon: Search },
  { id: 'sorting', label: 'Sorting (8)', subtitle: 'Bubble..Counting + Compare Mode', icon: Binary },
  { id: 'hashing', label: 'Hashing', subtitle: 'Chaining, Linear, Quad, Double', icon: Hash },
  { id: 'linked', label: 'Linked & Sparse', subtitle: 'SLL, DLL, CLL, Multi-Linked Matrix', icon: Share2 },
  { id: 'trees', label: 'Trees & Heaps', subtitle: 'BST, AVL, RBT, B/B+, Threaded, PQ', icon: GitBranch },
  { id: 'graphs', label: 'Graphs', subtitle: 'BFS, DFS, Dijkstra, BF, FW, MST', icon: Compass },
  { id: 'backtracking', label: 'Backtracking', subtitle: 'Rat in a Maze & N-Queens', icon: Boxes },
  { id: 'advanced_trees', label: 'Spatial Trees', subtitle: 'Segment, Interval, 2D, KD, Quad', icon: ListTree },
  { id: 'strings', label: 'Strings & Logs', subtitle: 'Trie, Suffix Tree/Arr, Rabin-Karp', icon: Type },
];

const INITIAL_META: LabMetaUpdate = {
  name: 'DSA Laboratory',
  explanation: 'Select a category and run manual step-by-step operations.',
  application: 'Maps directly to the Tower Clash Engine.',
  bestCase: 'O(1)',
  avgCase: 'O(n)',
  worstCase: 'O(n)',
  space: 'O(n)',
  currentOp: 'Ready',
  comparisons: 0,
  swaps: 0,
};

export const DsaLab: React.FC<DsaLabProps> = ({
  initialCategory = 'sorting',
  heading = 'DSA Algorithm & Data Structure Laboratory',
}) => {
  const [category, setCategory] = useState<LabCategory>(initialCategory);
  const [meta, setMeta] = useState<LabMetaUpdate>(INITIAL_META);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const activeCategory = CATEGORIES.find((c) => c.id === category);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">{heading}</h1>
          <p className="text-sm text-slate-400">
            Interactive manual implementations with step-by-step memory, comparison, and complexity tracking.
          </p>
        </div>
        {activeCategory && (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-1.5 text-xs text-cyan-200">
            Active Module: <span className="font-semibold">{activeCategory.label}</span> — {activeCategory.subtitle}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[230px_minmax(0,1fr)_280px]">
        {/* Left Category Navigation */}
        <nav aria-label="DSA Lab Categories" className="rounded-xl border border-slate-800 bg-slate-900/75 p-2.5">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            10 Syllabus Modules
          </div>
          <ul className="space-y-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    aria-current={isSelected ? 'page' : undefined}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                      isSelected
                        ? 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-100'
                        : 'border border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight">{cat.label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{cat.subtitle}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Central Interactive Visualizer */}
        <section
          aria-label="Interactive Algorithm Workspace"
          className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/75 p-4"
        >
          {(category === 'linear' || category === 'linked') && (
            <LinearAndLinkedLab mode={category} onMetaChange={setMeta} />
          )}
          {(category === 'searching' || category === 'sorting' || category === 'hashing') && (
            <SearchSortHashLab mode={category} onMetaChange={setMeta} />
          )}
          {(category === 'trees' || category === 'advanced_trees') && (
            <TreesAndAdvancedLab mode={category} onMetaChange={setMeta} />
          )}
          {(category === 'graphs' || category === 'backtracking' || category === 'strings') && (
            <GraphsBacktrackStringsLab mode={category} onMetaChange={setMeta} />
          )}
        </section>

        {/* Right Telemetry & Complexity Panel */}
        <aside aria-label="Complexity and Operation Telemetry" className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100">{meta.name}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{meta.explanation}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Battlefield Engine Link
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{meta.application}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <div className="text-[10px] uppercase text-slate-400">Best Time</div>
                <div className="mt-0.5 font-mono font-semibold text-emerald-300">{meta.bestCase}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <div className="text-[10px] uppercase text-slate-400">Average Time</div>
                <div className="mt-0.5 font-mono font-semibold text-cyan-300">{meta.avgCase}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <div className="text-[10px] uppercase text-slate-400">Worst Time</div>
                <div className="mt-0.5 font-mono font-semibold text-rose-300">{meta.worstCase}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <div className="text-[10px] uppercase text-slate-400">Aux Space</div>
                <div className="mt-0.5 font-mono font-semibold text-violet-300">{meta.space}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Live Execution Telemetry
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Comparisons:</span>{' '}
                  <span className="font-mono font-bold text-cyan-300">{meta.comparisons}</span>
                </div>
                <div>
                  <span className="text-slate-400">Swaps/Writes:</span>{' '}
                  <span className="font-mono font-bold text-amber-300">{meta.swaps}</span>
                </div>
              </div>
              <div className="rounded bg-slate-900 px-2.5 py-2 font-mono text-[11px] text-slate-200">
                {meta.currentOp || 'Idle'}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

