import React, { useEffect, useState } from 'react';
import {
  AVLTree,
  BPlusTree,
  BTree,
  BinaryHeap,
  BinarySearchTree,
  BinaryTree,
  KaryTree,
  PriorityQueue,
  RedBlackTree,
  ThreadedBinaryTree,
  TreeVisualNode,
} from '../../dsa/trees';
import { IntervalTree, KDTree, QuadTree, RangeTree2D, SegmentTree } from '../../dsa/advancedTrees';
import { LabMetaUpdate } from './SearchSortHashLab';

interface Props {
  mode: 'trees' | 'advanced_trees';
  onMetaChange: (meta: LabMetaUpdate) => void;
}

type TreeKind = 'avl' | 'bst' | 'rbt' | 'btree' | 'bplus' | 'threaded' | 'heap' | 'pq' | 'binary' | 'kary';
type AdvTreeKind = 'segment' | 'interval' | 'range2d' | 'kdtree' | 'quadtree';

interface PositionedNode {
  node: TreeVisualNode;
  x: number;
  y: number;
  parentX?: number;
  parentY?: number;
}

function layoutTree(root: TreeVisualNode | null): { nodes: PositionedNode[]; width: number; height: number } {
  if (!root) return { nodes: [], width: 640, height: 220 };
  const positioned: PositionedNode[] = [];
  let leafX = 45;

  const assign = (
    node: TreeVisualNode,
    depth: number,
    parentPos?: { x: number; y: number }
  ): { x: number; y: number } => {
    const y = 36 + depth * 66;
    if (node.children.length === 0) {
      const x = leafX;
      leafX += 78;
      const pos = { x, y };
      positioned.push({ node, x, y, parentX: parentPos?.x, parentY: parentPos?.y });
      return pos;
    }
    const childCoords = node.children.map((ch) => assign(ch, depth + 1));
    const x = (childCoords[0].x + childCoords[childCoords.length - 1].x) / 2;
    positioned.push({ node, x, y, parentX: parentPos?.x, parentY: parentPos?.y });
    // Update child parent lines
    for (const ch of node.children) {
      const found = positioned.find((p) => p.node.id === ch.id);
      if (found) {
        found.parentX = x;
        found.parentY = y;
      }
    }
    return { x, y };
  };

  assign(root, 0);
  const maxX = Math.max(640, ...positioned.map((p) => p.x + 50));
  const maxY = Math.max(220, ...positioned.map((p) => p.y + 45));
  return { nodes: positioned, width: maxX, height: maxY };
}

export const TreeSvgRenderer: React.FC<{ root: TreeVisualNode | null }> = ({ root }) => {
  const { nodes, width, height } = layoutTree(root);
  if (!root) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-slate-500">
        Tree is empty. Insert keys to visualize nodes and balancing operations.
      </div>
    );
  }
  const byId = new Map(nodes.map((p) => [p.node.id, p]));

  const colorFill = (c?: TreeVisualNode['color']) =>
    c === 'red' ? '#dc2626' : c === 'black' ? '#1e293b' : c === 'emerald' ? '#059669' : c === 'amber' ? '#d97706' : '#0284c7';

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[520px] h-auto max-h-[340px]">
        {nodes.map((p) =>
          p.parentX !== undefined && p.parentY !== undefined ? (
            <line
              key={`edge-${p.node.id}`}
              x1={p.parentX}
              y1={p.parentY}
              x2={p.x}
              y2={p.y}
              stroke="#475569"
              strokeWidth="1.8"
            />
          ) : null
        )}
        {nodes.map((p) => {
          if (!p.node.threadToId) return null;
          const target = byId.get(p.node.threadToId);
          if (!target) return null;
          return (
            <path
              key={`thread-${p.node.id}`}
              d={`M ${p.x + 14} ${p.y} Q ${(p.x + target.x) / 2} ${p.y - 36} ${target.x - 14} ${target.y}`}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.4"
              strokeDasharray="4,3"
            />
          );
        })}
        {nodes.map((p) => {
          const isWide = p.node.label.length > 5;
          return (
            <g key={p.node.id} transform={`translate(${p.x},${p.y})`}>
              {isWide ? (
                <rect
                  x={-Math.max(26, p.node.label.length * 4.2)}
                  y={-15}
                  width={Math.max(52, p.node.label.length * 8.4)}
                  height={30}
                  rx="8"
                  fill={colorFill(p.node.color)}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
              ) : (
                <circle r="18" fill={colorFill(p.node.color)} stroke="#e2e8f0" strokeWidth="1.5" />
              )}
              <text textAnchor="middle" y="4" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace">
                {p.node.label}
              </text>
              {p.node.meta && (
                <text textAnchor="middle" y="30" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                  {p.node.meta}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const TreesAndAdvancedLab: React.FC<Props> = ({ mode, onMetaChange }) => {
  const [treeKind, setTreeKind] = useState<TreeKind>('avl');
  const [advKind, setAdvKind] = useState<AdvTreeKind>('segment');
  const [keyInput, setKeyInput] = useState('35');
  const [traceLog, setTraceLog] = useState<string[]>(['Tree seeded with initial dataset.']);
  const [traversalOut, setTraversalOut] = useState<string>('');
  const [tick, setTick] = useState(0);

  // Tree instances
  const [bst, setBst] = useState(() => {
    const t = new BinarySearchTree();
    [30, 15, 50, 10, 22, 40, 65].forEach((k) => t.insert(k));
    return t;
  });
  const [avl, setAvl] = useState(() => {
    const t = new AVLTree();
    [30, 20, 40, 10, 25, 50, 5].forEach((k) => t.insert(k));
    return t;
  });
  const [rbt, setRbt] = useState(() => {
    const t = new RedBlackTree();
    [20, 10, 30, 5, 15, 25, 35].forEach((k) => t.insert(k));
    return t;
  });
  const [btree, setBtree] = useState(() => {
    const t = new BTree(2);
    [10, 20, 5, 6, 12, 30, 7, 17].forEach((k) => t.insert(k));
    return t;
  });
  const [bplus, setBplus] = useState(() => {
    const t = new BPlusTree(3);
    [10, 20, 30, 40, 50, 25, 35].forEach((k) => t.insert(k));
    return t;
  });
  const [threaded, setThreaded] = useState(() => {
    const t = new ThreadedBinaryTree();
    [40, 20, 60, 10, 30, 50].forEach((k) => t.insert(k));
    return t;
  });
  const [heap, setHeap] = useState(() => {
    const h = new BinaryHeap<number>((a, b) => b - a);
    [45, 20, 75, 10, 35, 90].forEach((k) => h.push(k));
    return h;
  });
  const [pq, setPq] = useState(() => {
    const p = new PriorityQueue<{ name: string; threat: number }>(true);
    p.enqueue({ name: 'Runner', threat: 35 }, 35);
    p.enqueue({ name: 'Bastion', threat: 72 }, 72);
    p.enqueue({ name: 'Overlord', threat: 180 }, 180);
    return p;
  });
  const [binTree, setBinTree] = useState(() => {
    const b = new BinaryTree<number>();
    [1, 2, 3, 4, 5, 6, 7].forEach((k) => b.insert(k));
    return b;
  });
  const [karyTree, setKaryTree] = useState(() => {
    const k = new KaryTree<string>(3);
    ['Root', 'W1', 'W2', 'W3', 'W1.1', 'W1.2'].forEach((s) => k.insertLevelOrder(s));
    return k;
  });

  // Advanced Trees states
  const [segArr, setSegArr] = useState<number[]>([120, 45, 80, 25, 160, 60, 95, 40]);
  const [segL, setSegL] = useState(1);
  const [segR, setSegR] = useState(5);
  const [intervalLow, setIntervalLow] = useState('12');
  const [intervalHigh, setIntervalHigh] = useState('22');
  const [intervals] = useState(() => {
    const it = new IntervalTree();
    it.insert({ id: 'Tower-1', low: 5, high: 15 });
    it.insert({ id: 'Tower-2', low: 14, high: 25 });
    it.insert({ id: 'Tower-3', low: 28, high: 40 });
    return {
      tree: it,
      list: [
        { id: 'Tower-1', low: 5, high: 15 },
        { id: 'Tower-2', low: 14, high: 25 },
        { id: 'Tower-3', low: 28, high: 40 },
      ],
    };
  });

  const [spatialPts, setSpatialPts] = useState<Array<{ id: number; x: number; y: number }>>([
    { id: 1, x: 70, y: 60 },
    { id: 2, x: 180, y: 90 },
    { id: 3, x: 260, y: 45 },
    { id: 4, x: 120, y: 170 },
    { id: 5, x: 290, y: 165 },
    { id: 6, x: 210, y: 130 },
  ]);
  const [queryPt, setQueryPt] = useState<{ x: number; y: number; r: number }>({ x: 170, y: 110, r: 85 });

  useEffect(() => {
    if (mode === 'trees') {
      onMetaChange({
        name: `Tree Structure: ${treeKind.toUpperCase()}`,
        explanation: 'Interactive hierarchical structure supporting insert, delete, search, rotations, and traversals.',
        application: 'Wave progression trees, balanced game records, and priority enemy targeting.',
        bestCase: 'O(1) – O(log n)',
        avgCase: 'O(log n)',
        worstCase: treeKind === 'bst' ? 'O(n) skewed' : 'O(log n)',
        space: 'O(n)',
        currentOp: traceLog[0] ?? 'Ready',
        comparisons: tick,
        swaps: 0,
      });
    } else {
      onMetaChange({
        name: `Advanced Spatial/Range Tree: ${advKind.toUpperCase()}`,
        explanation: 'Multi-dimensional & range query tree accelerating spatial filtering & HP range stats.',
        application: 'QuadTree/KD-Tree tower radius filtering and Segment Tree enemy min/max HP.',
        bestCase: 'O(log n)',
        avgCase: 'O(log n + k)',
        worstCase: 'O(n)',
        space: 'O(n)',
        currentOp: `Active mode: ${advKind}`,
        comparisons: tick,
        swaps: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, treeKind, advKind, traceLog, tick]);

  if (mode === 'trees') {
    const getVisual = (): TreeVisualNode | null => {
      switch (treeKind) {
        case 'avl': return avl.toVisual();
        case 'bst': return bst.toVisual();
        case 'rbt': return rbt.toVisual();
        case 'btree': return btree.toVisual();
        case 'bplus': return bplus.toVisual();
        case 'threaded': return threaded.toVisual();
        case 'heap': return heap.toVisual();
        case 'pq': return pq['heap'].toVisual((item) => `${item.item.name}:${item.priority}`);
        case 'binary': return binTree.toVisual();
        case 'kary': return karyTree.toVisual();
      }
    };

    const handleInsert = () => {
      const k = Number(keyInput) || 0;
      let tr: string[] = [];
      if (treeKind === 'avl') tr = avl.insert(k);
      else if (treeKind === 'bst') tr = bst.insert(k);
      else if (treeKind === 'rbt') tr = rbt.insert(k);
      else if (treeKind === 'btree') tr = btree.insert(k);
      else if (treeKind === 'bplus') tr = bplus.insert(k);
      else if (treeKind === 'threaded') tr = threaded.insert(k);
      else if (treeKind === 'heap') { heap.push(k); tr = [`Pushed ${k} into Max-Heap`]; }
      else if (treeKind === 'pq') { pq.enqueue({ name: `Unit-${k}`, threat: k }, k); tr = [`Enqueued Unit-${k} with threat ${k}`]; }
      else if (treeKind === 'binary') { binTree.insert(k); tr = [`Inserted ${k} into Binary Tree`]; }
      else { karyTree.insertLevelOrder(`N${k}`); tr = [`Inserted N${k} into 3-ary Tree`]; }
      setTraceLog(tr.length ? tr : [`Inserted ${k}`]);
      setTick((x) => x + 1);
    };

    const handleDelete = () => {
      const k = Number(keyInput) || 0;
      if (treeKind === 'avl') setTraceLog(avl.delete(k));
      else if (treeKind === 'bst') {
        const ok = bst.delete(k);
        setTraceLog([ok ? `Deleted ${k} from BST` : `${k} not in BST`]);
      } else if (treeKind === 'heap') {
        const top = heap.pop();
        setTraceLog([top !== undefined ? `Popped Max-Heap root ${top}` : 'Heap empty']);
      } else if (treeKind === 'pq') {
        const top = pq.dequeue();
        setTraceLog([top ? `Dequeued highest threat: ${top.name} (${top.threat})` : 'PQ empty']);
      } else {
        setTraceLog(['Delete demo supported on BST, AVL, Binary Heap, and Priority Queue.']);
      }
      setTick((x) => x + 1);
    };

    const handleSearch = () => {
      const k = Number(keyInput) || 0;
      if (treeKind === 'avl') {
        const r = avl.search(k);
        setTraceLog(r.trace.length ? r.trace : [`${k} not found`]);
      } else if (treeKind === 'bst') {
        const r = bst.search(k);
        setTraceLog(r.trace);
      } else if (treeKind === 'rbt') {
        setTraceLog([rbt.search(k) ? `Found ${k} in Red-Black Tree` : `${k} not found`]);
      } else if (treeKind === 'btree') {
        setTraceLog([btree.search(k) ? `Found ${k} in B-Tree` : `${k} not found`]);
      } else if (treeKind === 'bplus') {
        const rng = bplus.rangeQuery(k - 10, k + 10);
        setTraceLog([`B+ Leaf Range [${k - 10}..${k + 10}]: [${rng.join(', ')}]`]);
      } else {
        setTraceLog([`Inorder / Peek: ${treeKind === 'threaded' ? threaded.inorderThreaded().join(', ') : 'Done'}`]);
      }
    };

    const resetTrees = () => {
      setBst(new BinarySearchTree());
      setAvl(new AVLTree());
      setRbt(new RedBlackTree());
      setBtree(new BTree(2));
      setBplus(new BPlusTree(3));
      setThreaded(new ThreadedBinaryTree());
      setHeap(new BinaryHeap((a, b) => b - a));
      setPq(new PriorityQueue(true));
      setBinTree(new BinaryTree());
      setKaryTree(new KaryTree(3));
      setTraceLog(['Cleared tree. Insert keys to build from scratch.']);
      setTraversalOut('');
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {([
            ['avl', 'AVL Tree'],
            ['bst', 'BST'],
            ['rbt', 'Red-Black Tree'],
            ['btree', 'B-Tree'],
            ['bplus', 'B+ Tree'],
            ['threaded', 'Threaded Binary'],
            ['heap', 'Binary Heap'],
            ['pq', 'Priority Queue'],
            ['binary', 'Binary Tree'],
            ['kary', 'K-ary Tree (k=3)'],
          ] as Array<[TreeKind, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTreeKind(id); setTraversalOut(''); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                treeKind === id
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900 text-slate-300 border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-end text-xs">
          <div>
            <label htmlFor="tree-key" className="block text-slate-400 mb-1">Key / Priority</label>
            <input
              id="tree-key"
              type="number"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-24 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white"
            />
          </div>
          <button type="button" onClick={handleInsert} className="px-3.5 py-1.5 rounded-lg font-bold bg-emerald-500 text-slate-950">
            Insert
          </button>
          <button type="button" onClick={handleDelete} className="px-3 py-1.5 rounded-lg font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/35">
            {treeKind === 'heap' || treeKind === 'pq' ? 'Extract Top' : 'Delete'}
          </button>
          <button type="button" onClick={handleSearch} className="px-3 py-1.5 rounded-lg font-semibold bg-cyan-500/20 text-cyan-200 border border-cyan-500/35">
            {treeKind === 'bplus' ? 'Range Query (±10)' : 'Search'}
          </button>
          <button type="button" onClick={resetTrees} className="px-3 py-1.5 rounded-lg font-semibold bg-slate-800 text-slate-300">
            Clear
          </button>
        </div>

        {/* Traversals */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(['inorder', 'preorder', 'postorder', 'levelorder'] as const).map((ord) => (
            <button
              key={ord}
              type="button"
              onClick={() => {
                let res: Array<number | string> = [];
                if (treeKind === 'bst') res = bst.traverse(ord);
                else if (treeKind === 'binary') {
                  res = ord === 'inorder' ? binTree.inorder() : ord === 'preorder' ? binTree.preorder() : ord === 'postorder' ? binTree.postorder() : binTree.levelOrder();
                } else if (treeKind === 'threaded') res = threaded.inorderThreaded();
                else if (treeKind === 'avl') res = avl.inorder();
                else if (treeKind === 'kary') res = karyTree.levelOrder();
                else if (treeKind === 'heap') res = heap.toArray();
                setTraversalOut(`${ord.toUpperCase()}: [${res.join(', ')}]`);
              }}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
            >
              {ord}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#060b16] p-3">
          <TreeSvgRenderer root={getVisual()} />
        </div>

        {traversalOut && (
          <p className="text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            {traversalOut}
          </p>
        )}

        <div className="rounded-lg bg-[#070c17] border border-slate-800 p-3 text-xs font-mono text-amber-300 space-y-1">
          {traceLog.map((line, i) => (
            <p key={i}>• {line}</p>
          ))}
        </div>
      </div>
    );
  }

  // Advanced Trees (Segment, Interval, Range2D, KDTree, QuadTree)
  const segTree = new SegmentTree(segArr);
  const overlaps = intervals.tree.queryOverlapping(Number(intervalLow) || 0, Number(intervalHigh) || 0);
  const rangeTree = new RangeTree2D(spatialPts.map((p) => ({ x: p.x, y: p.y, payload: p.id })));
  const rangeHits = rangeTree.query(60, 240, 40, 150);

  const kd = new KDTree<number>();
  const qt = new QuadTree<number>({ x: 0, y: 0, w: 360, h: 220 }, 2);
  for (const p of spatialPts) {
    kd.insert({ id: p.id, x: p.x, y: p.y, data: p.id });
    qt.insert({ id: p.id, x: p.x, y: p.y, data: p.id });
  }
  const kdLines = kd.collectSplitLines({ x: 0, y: 0, w: 360, h: 220 });
  const qtBoxes = qt.collectBoxes();
  const spatialMatches =
    advKind === 'kdtree'
      ? kd.queryRadius(queryPt.x, queryPt.y, queryPt.r)
      : qt.queryRadius(queryPt.x, queryPt.y, queryPt.r);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ['segment', 'Segment Tree (HP Range)'],
          ['interval', 'Interval Tree (Attack Windows)'],
          ['range2d', '2D Range Tree'],
          ['kdtree', 'KD-Tree (Spatial Split)'],
          ['quadtree', 'QuadTree (4-Region)'],
        ] as Array<[AdvTreeKind, string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAdvKind(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              advKind === id
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-slate-900 text-slate-300 border-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {advKind === 'segment' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end text-xs">
            <div>
              <label htmlFor="seg-l" className="block text-slate-400 mb-1">Left Index L</label>
              <input id="seg-l" type="number" min={0} max={segArr.length - 1} value={segL} onChange={(e) => setSegL(Number(e.target.value))} className="w-20 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-white" />
            </div>
            <div>
              <label htmlFor="seg-r" className="block text-slate-400 mb-1">Right Index R</label>
              <input id="seg-r" type="number" min={0} max={segArr.length - 1} value={segR} onChange={(e) => setSegR(Number(e.target.value))} className="w-20 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-white" />
            </div>
            <button
              type="button"
              onClick={() => {
                const next = [...segArr];
                const idx = Math.max(0, Math.min(next.length - 1, segL));
                next[idx] = Math.round(20 + Math.random() * 180);
                setSegArr(next);
                setTick((t) => t + 1);
              }}
              className="px-3 py-1.5 rounded-lg font-bold bg-amber-500 text-slate-950"
            >
              Update Enemy [{segL}] HP
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {segArr.map((hp, i) => (
              <div
                key={i}
                className={`px-3 py-2 rounded-lg border font-mono text-xs ${
                  i >= Math.min(segL, segR) && i <= Math.max(segL, segR)
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                [{i}] {hp} HP
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-slate-900 p-3">Range Min: <strong className="text-emerald-300">{segTree.queryMin(Math.min(segL, segR), Math.max(segL, segR))}</strong></div>
            <div className="rounded-lg bg-slate-900 p-3">Range Max: <strong className="text-rose-300">{segTree.queryMax(Math.min(segL, segR), Math.max(segL, segR))}</strong></div>
            <div className="rounded-lg bg-slate-900 p-3">Range Sum: <strong className="text-cyan-300">{segTree.querySum(Math.min(segL, segR), Math.max(segL, segR))}</strong></div>
          </div>
        </div>
      )}

      {advKind === 'interval' && (
        <div className="space-y-3 text-xs">
          <div className="flex gap-2 items-end">
            <div>
              <label htmlFor="int-lo" className="block text-slate-400 mb-1">Query Start</label>
              <input id="int-lo" type="number" value={intervalLow} onChange={(e) => setIntervalLow(e.target.value)} className="w-20 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-white" />
            </div>
            <div>
              <label htmlFor="int-hi" className="block text-slate-400 mb-1">Query End</label>
              <input id="int-hi" type="number" value={intervalHigh} onChange={(e) => setIntervalHigh(e.target.value)} className="w-20 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-white" />
            </div>
          </div>
          <div className="space-y-1.5">
            {intervals.list.map((it) => {
              const hit = overlaps.some((o) => o.id === it.id);
              return (
                <div key={it.id} className={`p-2.5 rounded-lg border flex justify-between ${hit ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                  <span>{it.id}: [{it.low}s .. {it.high}s]</span>
                  <span>{hit ? 'OVERLAPS' : 'Disjoint'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(advKind === 'kdtree' || advKind === 'quadtree' || advKind === 'range2d') && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-300">Click anywhere inside the 2D battlefield box to add an enemy point, or move query center:</span>
            <button
              type="button"
              onClick={() => {
                setSpatialPts((pts) => [
                  ...pts,
                  { id: pts.length + 1, x: Math.round(30 + Math.random() * 300), y: Math.round(25 + Math.random() * 170) },
                ]);
                setTick((t) => t + 1);
              }}
              className="px-3 py-1 rounded bg-emerald-500 text-slate-950 font-bold"
            >
              + Random Enemy
            </button>
          </div>
          <svg
            viewBox="0 0 360 220"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.round(((e.clientX - rect.left) / rect.width) * 360);
              const y = Math.round(((e.clientY - rect.top) / rect.height) * 220);
              setQueryPt((q) => ({ ...q, x, y }));
              setTick((t) => t + 1);
            }}
            className="w-full max-w-xl h-auto rounded-xl border border-slate-800 bg-[#060b16] cursor-crosshair"
          >
            {advKind === 'quadtree' &&
              qtBoxes.map((b, idx) => (
                <rect key={idx} x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="1" />
              ))}
            {advKind === 'kdtree' &&
              kdLines.map((ln, idx) => (
                <line
                  key={idx}
                  x1={ln.x1}
                  y1={ln.y1}
                  x2={ln.x2}
                  y2={ln.y2}
                  stroke={ln.axis === 'x' ? '#f472b6' : '#38bdf8'}
                  strokeWidth="1.2"
                  strokeDasharray="3,2"
                />
              ))}
            {advKind === 'range2d' ? (
              <rect x={60} y={40} width={180} height={110} fill="rgba(52,211,153,0.12)" stroke="#34d399" strokeWidth="1.5" />
            ) : (
              <circle cx={queryPt.x} cy={queryPt.y} r={queryPt.r} fill="rgba(56,189,248,0.1)" stroke="#38bdf8" strokeDasharray="4,3" />
            )}
            {spatialPts.map((p) => {
              const isHit =
                advKind === 'range2d'
                  ? rangeHits.some((h) => h.payload === p.id)
                  : spatialMatches.some((m) => m.id === p.id);
              return (
                <g key={p.id}>
                  <circle cx={p.x} cy={p.y} r="5.5" fill={isHit ? '#34d399' : '#f43f5e'} />
                  <text x={p.x + 8} y={p.y + 3} fill="#cbd5e1" fontSize="9" fontFamily="monospace">E{p.id}</text>
                </g>
              );
            })}
          </svg>
          <p className="text-xs font-mono text-cyan-300">
            {advKind === 'range2d'
              ? `2D Range [60..240] x [40..150] matched ${rangeHits.length} enemies.`
              : `Query (${queryPt.x}, ${queryPt.y}) radius ${queryPt.r}px found ${spatialMatches.length} candidates.`}
          </p>
        </div>
      )}
    </div>
  );
};

