import { performance } from 'node:perf_hooks';
import { SORT_LABELS, runSortTrace } from '../src/dsa/sorting.ts';
import { linearSearchTrace, binarySearchTrace, medianSearchTrace } from '../src/dsa/searching.ts';
import { AVLTree, BTree, BinarySearchTree, RedBlackTree } from '../src/dsa/trees.ts';
import { Graph } from '../src/dsa/graphs.ts';
import { SortAlgorithmType } from '../src/types/game.ts';

export interface ServerBenchmarkRow {
  algorithm: string;
  inputSize: number;
  durationMs: number;
  comparisons: number;
  swaps: number;
  recursiveCalls: number;
  operations: number;
  memoryBytes: number;
}

function nextRand(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

function generateDataset(n: number, pattern: string, seed = 42): number[] {
  const arr = new Array<number>(n);
  if (pattern === 'sorted' || pattern === 'best') {
    for (let i = 0; i < n; i++) arr[i] = i + 1;
    return arr;
  }
  if (pattern === 'reversed' || pattern === 'worst') {
    for (let i = 0; i < n; i++) arr[i] = n - i;
    return arr;
  }
  let state = seed >>> 0;
  const mod = n * 10 + 100;
  for (let i = 0; i < n; i++) {
    state = nextRand(state);
    arr[i] = state % mod;
  }
  return arr;
}

export function runTsServerBenchmark(
  category: string,
  size: number,
  pattern: string,
  trials: number
): Record<string, unknown> {
  const safeTrials = Math.min(3, Math.max(1, trials));

  if (category === 'sorting') {
    const n = Math.min(size, 2000);
    const algos = Object.keys(SORT_LABELS) as SortAlgorithmType[];
    const results: ServerBenchmarkRow[] = [];

    for (const algo of algos) {
      let durationMs = 0;
      let comparisons = 0;
      let swaps = 0;
      let recursiveCalls = 0;
      let operations = 0;
      let memoryBytes = 0;

      for (let t = 0; t < safeTrials; t++) {
        const input = generateDataset(n, pattern, 42 + t * 17);
        const res = runSortTrace(input, algo);
        durationMs += res.metrics.durationMs;
        comparisons += res.metrics.comparisons;
        swaps += res.metrics.swaps;
        recursiveCalls += res.metrics.recursiveCalls;
        operations += res.metrics.operations;
        memoryBytes = res.metrics.memoryBytes;
      }

      results.push({
        algorithm: algo,
        inputSize: n,
        durationMs: Number((durationMs / safeTrials).toFixed(4)),
        comparisons: Math.round(comparisons / safeTrials),
        swaps: Math.round(swaps / safeTrials),
        recursiveCalls: Math.round(recursiveCalls / safeTrials),
        operations: Math.round(operations / safeTrials),
        memoryBytes,
      });
    }

    return {
      engine: 'TypeScript (Server Fallback)',
      category,
      pattern,
      results,
    };
  }

  if (category === 'searching') {
    const n = Math.min(size, 5000);
    const sorted = Array.from({ length: n }, (_, i) => i * 2 + 1);
    const target =
      pattern === 'best'
        ? sorted[Math.floor(n / 2)]
        : pattern === 'worst'
        ? -999
        : sorted[Math.floor((n * 3) / 4)];

    const lin = linearSearchTrace(sorted, target);
    const bin = binarySearchTrace(sorted, target);
    const med = medianSearchTrace(sorted, target, false);

    return {
      engine: 'TypeScript (Server Fallback)',
      category,
      pattern,
      results: [
        {
          algorithm: 'linear',
          inputSize: n,
          durationMs: Number(lin.durationMs.toFixed(4)),
          comparisons: lin.comparisons,
          swaps: 0,
          recursiveCalls: 0,
          operations: lin.operations,
          memoryBytes: n * 8,
        },
        {
          algorithm: 'binary',
          inputSize: n,
          durationMs: Number(bin.durationMs.toFixed(4)),
          comparisons: bin.comparisons,
          swaps: 0,
          recursiveCalls: 0,
          operations: bin.operations,
          memoryBytes: n * 8,
        },
        {
          algorithm: 'median',
          inputSize: n,
          durationMs: Number(med.durationMs.toFixed(4)),
          comparisons: med.comparisons,
          swaps: 0,
          recursiveCalls: Math.ceil(n / 5),
          operations: med.operations,
          memoryBytes: n * 16,
        },
      ],
    };
  }

  if (category === 'trees') {
    const n = Math.min(size, 1000);
    const keys = generateDataset(n, pattern, 1337);
    const results: ServerBenchmarkRow[] = [];

    const measureTree = (name: string, bytesPerNode: number, fn: () => number) => {
      const t0 = performance.now();
      const ops = fn();
      const dt = performance.now() - t0;
      results.push({
        algorithm: name,
        inputSize: n,
        durationMs: Number(dt.toFixed(4)),
        comparisons: ops,
        swaps: 0,
        recursiveCalls: 0,
        operations: ops,
        memoryBytes: n * bytesPerNode,
      });
    };

    measureTree('bst', 32, () => {
      const tree = new BinarySearchTree();
      let ops = 0;
      for (const k of keys) ops += tree.insert(k).length;
      for (const k of keys) ops += tree.search(k).trace.length;
      return ops;
    });

    measureTree('avl', 40, () => {
      const tree = new AVLTree();
      let ops = 0;
      for (const k of keys) ops += tree.insert(k).length;
      for (const k of keys) ops += tree.search(k).trace.length;
      return ops;
    });

    measureTree('redblack', 40, () => {
      const tree = new RedBlackTree();
      let ops = 0;
      for (const k of keys) ops += tree.insert(k).length;
      for (const k of keys) {
        tree.search(k);
        ops += Math.ceil(Math.log2(n + 1));
      }
      return ops;
    });

    measureTree('btree', 16, () => {
      const tree = new BTree(4);
      let ops = 0;
      for (const k of keys) ops += Math.max(1, tree.insert(k).length);
      for (const k of keys) {
        tree.search(k);
        ops += Math.max(1, Math.ceil(Math.log(n + 1) / Math.log(4)));
      }
      return ops;
    });

    return {
      engine: 'TypeScript (Server Fallback)',
      category,
      pattern,
      results,
    };
  }

  // graphs
  const v = Math.min(Math.max(5, size), 250);
  const g = new Graph(false, true);
  for (let i = 0; i < v; i++) {
    g.addVertex(`V${i}`, i, i);
  }
  let seed = 99;
  for (let i = 0; i < v - 1; i++) {
    seed = nextRand(seed);
    g.addEdge(i, i + 1, 1 + (seed % 20));
  }
  for (let i = 0; i < v * 2; i++) {
    seed = nextRand(seed);
    const a = seed % v;
    seed = nextRand(seed);
    const b = seed % v;
    seed = nextRand(seed);
    if (a !== b) g.addEdge(a, b, 1 + (seed % 25));
  }

  const measureGraph = (algorithm: string, fn: () => { ops: number; mem: number }) => {
    const t0 = performance.now();
    const { ops, mem } = fn();
    const dt = performance.now() - t0;
    return {
      algorithm,
      inputSize: v,
      durationMs: Number(dt.toFixed(4)),
      comparisons: 0,
      swaps: 0,
      recursiveCalls: 0,
      operations: ops,
      memoryBytes: mem,
    };
  };

  return {
    engine: 'TypeScript (Server Fallback)',
    category: 'graphs',
    pattern: 'sparse',
    results: [
      measureGraph('bfs', () => {
        const res = g.bfsTrace(0);
        return { ops: res.order.length * 3, mem: v * 16 };
      }),
      measureGraph('dfs', () => {
        const res = g.dfsTrace(0);
        return { ops: res.order.length * 3, mem: v * 16 };
      }),
      measureGraph('dijkstra', () => {
        g.dijkstraTrace(0);
        return { ops: v * 6, mem: v * 24 };
      }),
      measureGraph('bellman_ford', () => {
        g.bellmanFordTrace(0);
        return { ops: v * v, mem: v * 24 };
      }),
    ],
  };
}
