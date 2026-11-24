import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { Graph, GraphStep } from '../../dsa/graphs';
import { MazeStep, NQueensStep, solveNQueensTrace, solveRatInMazeTrace } from '../../dsa/backtracking';
import { rabinKarpTrace, SuffixArray, SuffixTree, Trie } from '../../dsa/strings';
import { LabMetaUpdate } from './SearchSortHashLab';
import { TreeSvgRenderer } from './TreesAndAdvancedLab';

interface Props {
  mode: 'graphs' | 'backtracking' | 'strings';
  onMetaChange: (meta: LabMetaUpdate) => void;
}

type GraphAlgo = 'bfs' | 'dfs' | 'dijkstra' | 'bellman_ford' | 'floyd_warshall' | 'prim' | 'kruskal';

const DEFAULT_VERTICES = [
  { id: 0, label: 'IN', x: 70, y: 120 },
  { id: 1, label: 'A', x: 180, y: 50 },
  { id: 2, label: 'B', x: 180, y: 190 },
  { id: 3, label: 'C', x: 310, y: 55 },
  { id: 4, label: 'D', x: 310, y: 185 },
  { id: 5, label: 'BASE', x: 430, y: 120 },
];

const DEFAULT_EDGES = [
  { u: 0, v: 1, weight: 4 },
  { u: 0, v: 2, weight: 2 },
  { u: 1, v: 2, weight: 1 },
  { u: 1, v: 3, weight: 5 },
  { u: 2, v: 4, weight: 8 },
  { u: 2, v: 3, weight: 10 },
  { u: 3, v: 4, weight: 2 },
  { u: 3, v: 5, weight: 6 },
  { u: 4, v: 5, weight: 3 },
];

export const GraphsBacktrackStringsLab: React.FC<Props> = ({ mode, onMetaChange }) => {
  // Graph state
  const [directed, setDirected] = useState(false);
  const [graphAlgo, setGraphAlgo] = useState<GraphAlgo>('dijkstra');
  const [vertices, setVertices] = useState(DEFAULT_VERTICES);
  const [edges, setEdges] = useState(DEFAULT_EDGES);
  const [edgeU, setEdgeU] = useState(0);
  const [edgeV, setEdgeV] = useState(5);
  const [edgeW, setEdgeW] = useState(7);
  const [graphSteps, setGraphSteps] = useState<GraphStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Backtracking state
  const [btMode, setBtMode] = useState<'maze' | 'nqueens'>('maze');
  const [mazeGrid, setMazeGrid] = useState<number[][]>([
    [0, 0, 1, 0, 0, 0],
    [1, 0, 1, 0, 1, 0],
    [0, 0, 0, 0, 1, 0],
    [0, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 0],
    [1, 1, 0, 0, 0, 0],
  ]);
  const [mazeSteps, setMazeSteps] = useState<MazeStep[]>([]);
  const [nQueensSize, setNQueensSize] = useState(5);
  const [queensSteps, setQueensSteps] = useState<NQueensStep[]>([]);
  const [queensTotal, setQueensTotal] = useState(0);

  // Strings state
  const [strMode, setStrMode] = useState<'trie' | 'suffix_tree' | 'suffix_array' | 'rabin_karp'>('trie');
  const [strText, setStrText] = useState('wave_boss_spawn_wave_boss');
  const [strPattern, setStrPattern] = useState('boss');
  const [triePrefix, setTriePrefix] = useState('sp');

  const runGraph = () => {
    setPlaying(false);
    setStepIdx(0);
    const g = new Graph(directed, true);
    for (const v of vertices) g.addVertex(v.label, v.x, v.y);
    for (const e of edges) g.addEdge(e.u, e.v, e.weight);

    let steps: GraphStep[] = [];
    if (graphAlgo === 'bfs') steps = g.bfsTrace(0).steps;
    else if (graphAlgo === 'dfs') steps = g.dfsTrace(0).steps;
    else if (graphAlgo === 'dijkstra') steps = g.dijkstraTrace(0).steps;
    else if (graphAlgo === 'bellman_ford') steps = g.bellmanFordTrace(0).steps;
    else if (graphAlgo === 'floyd_warshall') steps = g.floydWarshallTrace().steps;
    else if (graphAlgo === 'prim') steps = g.primMSTTrace(0).steps;
    else steps = g.kruskalMSTTrace().steps;

    setGraphSteps(steps);
    onMetaChange({
      name: `Graph: ${graphAlgo.replace('_', ' ').toUpperCase()}`,
      explanation: 'Executes traversal, shortest-path, or MST on the battlefield vertex/edge graph.',
      application: 'Enemy route shortest path (Dijkstra/BFS) & resource network MST (Prim/Kruskal).',
      bestCase: 'O(V + E)',
      avgCase: graphAlgo === 'bellman_ford' ? 'O(VE)' : graphAlgo === 'floyd_warshall' ? 'O(V³)' : 'O((V+E) log V)',
      worstCase: graphAlgo === 'floyd_warshall' ? 'O(V³)' : 'O(VE)',
      space: graphAlgo === 'floyd_warshall' ? 'O(V²)' : 'O(V + E)',
      currentOp: steps[0]?.description ?? 'Ready',
      comparisons: steps.length,
      swaps: 0,
    });
  };

  const runBacktrack = () => {
    setPlaying(false);
    setStepIdx(0);
    if (btMode === 'maze') {
      const res = solveRatInMazeTrace(mazeGrid);
      setMazeSteps(res.steps);
      onMetaChange({
        name: 'Rat in a Maze (Backtracking)',
        explanation: 'Explores 4-directional grid paths recursively and backtracks from dead ends.',
        application: 'Path feasibility & obstacle navigation verification.',
        bestCase: 'O(N)',
        avgCase: 'O(2^(N²))',
        worstCase: 'O(4^(N²))',
        space: 'O(N²)',
        currentOp: res.solved ? `Path found in ${res.steps.length} steps` : 'No path to goal!',
        comparisons: res.steps.length,
        swaps: 0,
      });
    } else {
      const res = solveNQueensTrace(nQueensSize);
      setQueensSteps(res.steps);
      setQueensTotal(res.totalSolutions);
      onMetaChange({
        name: `N-Queens (N=${nQueensSize})`,
        explanation: 'Places N queens row by row, pruning column and diagonal conflicts.',
        application: 'Non-overlapping tower placement & constraint satisfaction.',
        bestCase: 'O(N!)',
        avgCase: 'O(N!)',
        worstCase: 'O(N!)',
        space: 'O(N)',
        currentOp: `${res.totalSolutions} valid solution(s) discovered`,
        comparisons: res.steps.length,
        swaps: 0,
      });
    }
  };

  useEffect(() => {
    if (mode === 'graphs') runGraph();
    else if (mode === 'backtracking') runBacktrack();
    else {
      onMetaChange({
        name: `String DS: ${strMode.replace('_', ' ').toUpperCase()}`,
        explanation: 'Prefix trees, suffix indexing, and rolling polynomial hashing for pattern matching.',
        application: 'Tower name autocomplete & game event log substring search.',
        bestCase: 'O(m)',
        avgCase: 'O(n + m)',
        worstCase: 'O(nm)',
        space: 'O(n)',
        currentOp: `Pattern "${strPattern}" checked against "${strText}"`,
        comparisons: strText.length,
        swaps: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, graphAlgo, directed, btMode, nQueensSize, strMode, strText, strPattern]);

  const totalSteps =
    mode === 'graphs'
      ? graphSteps.length
      : mode === 'backtracking'
      ? btMode === 'maze'
        ? mazeSteps.length
        : queensSteps.length
      : 0;

  useEffect(() => {
    if (!playing || totalSteps === 0) return;
    const t = setInterval(() => {
      setStepIdx((p) => {
        if (p + 1 >= totalSteps) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, 320);
    return () => clearInterval(t);
  }, [playing, totalSteps]);

  if (mode === 'strings') {
    const trie = new Trie();
    ['pulse', 'railgun', 'gatling', 'mortar', 'cryo', 'prism', 'sniper', 'splash', 'slow'].forEach((w) =>
      trie.insert(w)
    );
    const ac = trie.autocomplete(triePrefix);
    const suffixTree = new SuffixTree(strText.slice(0, 14));
    const suffixArr = new SuffixArray(strText);
    const rk = rabinKarpTrace(strText, strPattern);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {([
            ['trie', 'Trie (Autocomplete)'],
            ['suffix_tree', 'Suffix Tree'],
            ['suffix_array', 'Suffix Array'],
            ['rabin_karp', 'String Hashing (Rabin-Karp)'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStrMode(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                strMode === id
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900 text-slate-300 border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {strMode === 'trie' ? (
          <div className="space-y-3">
            <div className="flex items-end gap-2 text-xs">
              <div>
                <label htmlFor="trie-pref" className="block text-slate-400 mb-1">Autocomplete Prefix</label>
                <input
                  id="trie-pref"
                  value={triePrefix}
                  onChange={(e) => setTriePrefix(e.target.value)}
                  className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white"
                />
              </div>
              <p className="text-emerald-300 font-mono pb-1.5">
                Matches: [{ac.join(', ') || 'none'}]
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#060b16] p-3">
              <TreeSvgRenderer root={trie.toVisual()} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="str-text" className="block text-slate-400 mb-1">Log / Text</label>
                <input id="str-text" value={strText} onChange={(e) => setStrText(e.target.value)} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white font-mono" />
              </div>
              <div>
                <label htmlFor="str-pat" className="block text-slate-400 mb-1">Search Pattern</label>
                <input id="str-pat" value={strPattern} onChange={(e) => setStrPattern(e.target.value)} className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white font-mono" />
              </div>
            </div>

            {strMode === 'suffix_tree' && (
              <div className="space-y-2">
                <p className="text-xs text-cyan-300 font-mono">
                  Suffix Tree over &quot;{strText.slice(0, 14)}$&quot; — Pattern matches at index: [{suffixTree.searchPattern(strPattern).join(', ') || 'none'}]
                </p>
                <div className="rounded-xl border border-slate-800 bg-[#060b16] p-3">
                  <TreeSvgRenderer root={suffixTree.toVisual()} />
                </div>
              </div>
            )}

            {strMode === 'suffix_array' && (
              <div className="space-y-2">
                <p className="text-xs text-emerald-300 font-mono">
                  Binary Search Pattern &quot;{strPattern}&quot; -&gt; Match indices: [{suffixArr.searchPattern(strPattern).join(', ') || 'none'}]
                </p>
                <div className="max-h-60 overflow-y-auto app-scroll rounded-xl border border-slate-800 bg-[#060b16] p-3">
                  <table className="w-full text-xs font-mono text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th scope="col" className="py-1">Idx</th>
                        <th scope="col" className="py-1">LCP</th>
                        <th scope="col" className="py-1">Suffix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suffixArr.entries.map((e) => (
                        <tr key={e.index} className="border-b border-slate-800/50 text-slate-200">
                          <td className="py-1 text-cyan-300">{e.index}</td>
                          <td className="py-1 text-amber-300">{e.lcp}</td>
                          <td className="py-1">{e.suffix}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {strMode === 'rabin_karp' && (
              <div className="space-y-2">
                <p className="text-xs font-mono text-cyan-300">
                  Pattern Hash: {rk.patternHash} | Matches at indices: [{rk.matches.join(', ') || 'none'}]
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto app-scroll">
                  {rk.steps.map((s) => (
                    <div
                      key={s.index}
                      className={`p-2 rounded-lg border text-[11px] font-mono ${
                        s.match
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : s.spuriousHit
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <p>@{s.index}: &quot;{s.window}&quot;</p>
                      <p>hash={s.windowHash} {s.spuriousHit ? '(Collision!)' : s.match ? '✓ MATCH' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'backtracking') {
    const curMaze = mazeSteps[stepIdx];
    const curQueens = queensSteps[stepIdx];
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBtMode('maze')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                btMode === 'maze' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 text-slate-300 border-slate-700'
              }`}
            >
              Rat in a Maze
            </button>
            <button
              type="button"
              onClick={() => setBtMode('nqueens')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                btMode === 'nqueens' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 text-slate-300 border-slate-700'
              }`}
            >
              N-Queens
            </button>
          </div>

          {btMode === 'nqueens' && (
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="nq-size" className="text-slate-400">Board N:</label>
              <select
                id="nq-size"
                value={nQueensSize}
                onChange={(e) => setNQueensSize(Number(e.target.value))}
                className="rounded bg-slate-900 border border-slate-700 px-2 py-1 text-white"
              >
                {[4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n}x{n}</option>
                ))}
              </select>
              <span className="text-emerald-300 font-semibold">{queensTotal} total solutions</span>
            </div>
          )}
        </div>

        {btMode === 'maze' ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Click any interior cell to toggle obstacle wall, then click Solve.</p>
            <div className="grid grid-cols-6 gap-1.5 max-w-xs mx-auto">
              {mazeGrid.flatMap((row, r) =>
                row.map((wall, c) => {
                  const st = curMaze?.pathGrid[r]?.[c] ?? 0;
                  const isCur = curMaze?.current[0] === r && curMaze?.current[1] === c;
                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => {
                        if ((r === 0 && c === 0) || (r === 5 && c === 5)) return;
                        const next = mazeGrid.map((rw) => [...rw]);
                        next[r][c] = next[r][c] === 1 ? 0 : 1;
                        setMazeGrid(next);
                      }}
                      className={`aspect-square rounded-lg border text-xs font-bold ${
                        wall === 1
                          ? 'bg-slate-700 border-slate-600 text-slate-400'
                          : isCur
                          ? 'bg-amber-400 border-amber-200 text-slate-950'
                          : st === 1
                          ? 'bg-emerald-500/35 border-emerald-400 text-emerald-200'
                          : st === 2
                          ? 'bg-rose-500/25 border-rose-500/40 text-rose-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {r === 0 && c === 0 ? 'S' : r === 5 && c === 5 ? 'G' : wall === 1 ? '█' : ''}
                    </button>
                  );
                })
              )}
            </div>
            <div className="text-center">
              <button type="button" onClick={runBacktrack} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 text-slate-950">
                Solve Maze
              </button>
            </div>
            <p className="text-xs font-mono text-cyan-300 text-center">{curMaze?.description}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="grid gap-1 max-w-xs mx-auto"
              style={{ gridTemplateColumns: `repeat(${nQueensSize}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: nQueensSize }, (_, r) =>
                Array.from({ length: nQueensSize }, (_, c) => {
                  const hasQueen = curQueens?.board[r] === c;
                  const trying = curQueens?.tryingRow === r && curQueens?.tryingCol === c;
                  const dark = (r + c) % 2 === 1;
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`aspect-square rounded flex items-center justify-center text-sm font-bold border ${
                        trying && curQueens?.conflict
                          ? 'bg-rose-500/45 border-rose-400 text-white'
                          : trying
                          ? 'bg-amber-500/35 border-amber-400 text-white'
                          : hasQueen
                          ? 'bg-emerald-500/35 border-emerald-400 text-emerald-200'
                          : dark
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-slate-800/60 border-slate-700'
                      }`}
                    >
                      {hasQueen ? '♛' : trying && curQueens?.conflict ? '✕' : ''}
                    </div>
                  );
                })
              )}
            </div>
            <p className="text-xs font-mono text-cyan-300 text-center">{curQueens?.description}</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950"
          >
            {playing ? <Pause className="w-3.5 h-3.5" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => { setPlaying(false); setStepIdx((i) => Math.min(totalSteps - 1, i + 1)); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200"
          >
            <StepForward className="w-3.5 h-3.5" aria-hidden="true" />
            Step
          </button>
          <button
            type="button"
            onClick={() => { setPlaying(false); setStepIdx(0); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>
    );
  }

  // Graphs Interactive Editor & Algorithm Visualizer
  const curStep = graphSteps[stepIdx];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end text-xs">
        <div>
          <label htmlFor="graph-algo-sel" className="block text-slate-400 mb-1">Graph Algorithm</label>
          <select
            id="graph-algo-sel"
            value={graphAlgo}
            onChange={(e) => setGraphAlgo(e.target.value as GraphAlgo)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white"
          >
            <option value="bfs">BFS (Breadth-First Search)</option>
            <option value="dfs">DFS (Depth-First Search)</option>
            <option value="dijkstra">Dijkstra Shortest Path</option>
            <option value="bellman_ford">Bellman-Ford Shortest Path</option>
            <option value="floyd_warshall">Floyd-Warshall All-Pairs</option>
            <option value="prim">Prim&apos;s MST</option>
            <option value="kruskal">Kruskal&apos;s MST</option>
          </select>
        </div>

        <label className="flex items-center gap-1.5 text-slate-300 pb-1.5 cursor-pointer">
          <input type="checkbox" checked={directed} onChange={(e) => setDirected(e.target.checked)} />
          Directed
        </label>

        <div className="flex items-end gap-1.5 ml-auto">
          <select value={edgeU} onChange={(e) => setEdgeU(Number(e.target.value))} aria-label="From vertex" className="rounded bg-slate-900 border border-slate-700 px-2 py-1 text-white">
            {vertices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <select value={edgeV} onChange={(e) => setEdgeV(Number(e.target.value))} aria-label="To vertex" className="rounded bg-slate-900 border border-slate-700 px-2 py-1 text-white">
            {vertices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <input type="number" value={edgeW} onChange={(e) => setEdgeW(Number(e.target.value))} aria-label="Edge weight" className="w-14 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-white" />
          <button
            type="button"
            onClick={() => {
              if (edgeU !== edgeV) {
                setEdges((prev) => [...prev, { u: edgeU, v: edgeV, weight: edgeW }]);
              }
            }}
            className="px-2.5 py-1 rounded bg-slate-800 text-cyan-300 border border-slate-700"
          >
            + Edge
          </button>
          <button
            type="button"
            onClick={() => {
              const id = vertices.length;
              if (id < 9) {
                setVertices((prev) => [...prev, { id, label: `N${id}`, x: 100 + (id * 55) % 340, y: 40 + (id * 45) % 160 }]);
              }
            }}
            className="px-2.5 py-1 rounded bg-slate-800 text-emerald-300 border border-slate-700"
          >
            + Vertex
          </button>
          <button type="button" onClick={runGraph} className="px-3 py-1 rounded bg-cyan-500 text-slate-950 font-bold">
            Execute
          </button>
        </div>
      </div>

      <svg viewBox="0 0 500 240" className="w-full max-w-2xl mx-auto h-auto rounded-xl border border-slate-800 bg-[#060b16]">
        {edges.map((e, i) => {
          const a = vertices[e.u];
          const b = vertices[e.v];
          if (!a || !b) return null;
          const isHighlighted = curStep?.highlightedEdges.some(
            ([u, v]) => (u === e.u && v === e.v) || (!directed && u === e.v && v === e.u)
          );
          const isActive =
            curStep?.activeEdge &&
            ((curStep.activeEdge[0] === e.u && curStep.activeEdge[1] === e.v) ||
              (!directed && curStep.activeEdge[0] === e.v && curStep.activeEdge[1] === e.u));
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isActive ? '#facc15' : isHighlighted ? '#10b981' : '#334155'}
                strokeWidth={isActive || isHighlighted ? 3 : 1.6}
              />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 5}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
              >
                {e.weight}
              </text>
            </g>
          );
        })}
        {vertices.map((v) => {
          const visited = curStep?.visited.includes(v.id);
          const frontier = curStep?.frontier.includes(v.id);
          return (
            <g key={v.id} transform={`translate(${v.x},${v.y})`}>
              <circle
                r="18"
                fill={visited ? '#059669' : frontier ? '#d97706' : '#0f172a'}
                stroke={visited ? '#6ee7b7' : frontier ? '#fde047' : '#38bdf8'}
                strokeWidth="2"
              />
              <text textAnchor="middle" y="4" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                {v.label}
              </text>
              {curStep?.distances && (
                <text textAnchor="middle" y="30" fill="#7dd3fc" fontSize="9" fontFamily="monospace">
                  d={curStep.distances[v.id]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className="text-xs font-mono text-cyan-300 text-center">
        {curStep?.description ?? 'Press Execute'}
      </p>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950"
        >
          {playing ? <Pause className="w-3.5 h-3.5" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => { setPlaying(false); setStepIdx((i) => Math.min(totalSteps - 1, i + 1)); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200"
        >
          <StepForward className="w-3.5 h-3.5" aria-hidden="true" />
          Step ({totalSteps ? stepIdx + 1 : 0}/{totalSteps})
        </button>
        <button
          type="button"
          onClick={() => { setPlaying(false); setStepIdx(0); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reset
        </button>
      </div>
    </div>
  );
};

