import { describe, expect, it } from 'vitest';
import { CircularQueue, DynamicArray, Queue, Stack } from '../dsa/linear';
import { CircularLinkedList, DoublyLinkedList, SinglyLinkedList, SparseMatrix } from '../dsa/linkedLists';
import { binarySearchTrace, linearSearchTrace, medianSearchTrace } from '../dsa/searching';
import { manualSortWithComparator, runSortTrace } from '../dsa/sorting';
import { HashTable } from '../dsa/hashing';
import {
  AVLTree,
  BPlusTree,
  BTree,
  BinaryHeap,
  BinarySearchTree,
  PriorityQueue,
  RedBlackTree,
  ThreadedBinaryTree,
} from '../dsa/trees';
import { IntervalTree, KDTree, QuadTree, RangeTree2D, SegmentTree } from '../dsa/advancedTrees';
import { DisjointSet, Graph } from '../dsa/graphs';
import { SuffixArray, SuffixTree, Trie, rabinKarpTrace } from '../dsa/strings';
import { solveNQueensTrace, solveRatInMazeTrace } from '../dsa/backtracking';
import { SortAlgorithmType } from '../types/game';

describe('Part 1: Linear Data Structures', () => {
  it('supports DynamicArray resize, insert, remove, and get/set', () => {
    const arr = new DynamicArray<number>(2);
    arr.pushBack(10);
    arr.pushBack(20);
    arr.pushBack(30); // Triggers resize
    arr.insertAt(1, 15);
    expect(arr.toArray()).toEqual([10, 15, 20, 30]);
    expect(arr.removeAt(2)).toBe(20);
    expect(arr.popBack()).toBe(30);
    expect(arr.get(1)).toBe(15);
  });

  it('supports Stack LIFO, Queue FIFO, and CircularQueue wrap-around', () => {
    const s = new Stack<string>();
    s.push('T1');
    s.push('T2');
    expect(s.peek()).toBe('T2');
    expect(s.pop()).toBe('T2');
    expect(s.pop()).toBe('T1');
    expect(s.isEmpty()).toBe(true);

    const q = new Queue<number>();
    q.enqueue(1);
    q.enqueue(2);
    expect(q.dequeue()).toBe(1);
    expect(q.front()).toBe(2);

    const cq = new CircularQueue<number>(3);
    expect(cq.enqueue(10)).toBe(true);
    expect(cq.enqueue(20)).toBe(true);
    expect(cq.enqueue(30)).toBe(true);
    expect(cq.isFull()).toBe(true);
    expect(cq.enqueue(40)).toBe(false);
    expect(cq.dequeue()).toBe(10);
    expect(cq.enqueue(40)).toBe(true);
    expect(cq.getPointers().count).toBe(3);
  });
});

describe('Part 2: Searching, Hashing & All 8 Sorting Algorithms', () => {
  it('runs Linear, Binary, and deterministic Median-of-Medians Search accurately', () => {
    const unsorted = [44, 12, 88, 3, 27, 65, 19, 91, 50];
    const sorted = [...unsorted].sort((a, b) => a - b);

    const lin = linearSearchTrace(unsorted, 27);
    expect(lin.foundIndex).toBe(4);
    expect(lin.foundValue).toBe(27);

    const bin = binarySearchTrace(sorted, 65);
    expect(bin.foundValue).toBe(65);
    expect(sorted[bin.foundIndex]).toBe(65);

    const medOnly = medianSearchTrace(unsorted, 0, true);
    expect(medOnly.foundValue).toBe(44); // Exact median of 9 numbers: [3,12,19,27,44,50,65,88,91]

    const medTarget = medianSearchTrace(unsorted, 19, false);
    expect(medTarget.foundValue).toBe(19);
  });

  it('produces identical sorted output across all 8 manual sorting algorithms', () => {
    const sample = [42, 7, 19, 0, 88, 7, 3, 55, 24, 11];
    const expected = [...sample].sort((a, b) => a - b);
    const algos: SortAlgorithmType[] = [
      'bubble',
      'selection',
      'insertion',
      'merge',
      'quick',
      'radix',
      'bucket',
      'counting',
    ];

    for (const algo of algos) {
      const res = runSortTrace(sample, algo);
      expect(res.sorted).toEqual(expected);
      expect(res.steps.length).toBeGreaterThan(0);

      const objRes = manualSortWithComparator(
        sample.map((v, i) => ({ id: i, val: v })),
        algo,
        (a, b) => a.val - b.val,
        (x) => x.val
      );
      expect(objRes.sorted.map((x) => x.val)).toEqual(expected);
    }
  });

  it('handles collisions cleanly for Separate Chaining, Linear, Quadratic, and Double Hashing', () => {
    const strategies = ['chaining', 'linear', 'quadratic', 'double'] as const;
    for (const strat of strategies) {
      const ht = new HashTable<number>(strat, 7);
      for (let i = 0; i < 15; i++) {
        ht.insert(`enemy_${i}`, i * 100);
      }
      expect(ht.get('enemy_0')).toBe(0);
      expect(ht.get('enemy_14')).toBe(1400);
      expect(ht.remove('enemy_7')).toBe(true);
      expect(ht.get('enemy_7')).toBeUndefined();
      expect(ht.entries().length).toBe(14);
    }
  });
});

describe('Part 3: Linked Lists, Multi-Linked Sparse Matrix & Backtracking', () => {
  it('supports Singly, Doubly, Circular Linked Lists and Multi-Linked Sparse Matrix', () => {
    const sll = new SinglyLinkedList<number>();
    sll.pushBack(1);
    sll.pushFront(0);
    sll.pushBack(2);
    expect(sll.toArray()).toEqual([0, 1, 2]);
    expect(sll.removeByPredicate((x) => x === 1)).toBe(true);
    expect(sll.toArray()).toEqual([0, 2]);

    const dll = new DoublyLinkedList<string>();
    const n1 = dll.pushBack('A');
    dll.pushBack('B');
    dll.removeNode(n1);
    expect(dll.toArray()).toEqual(['B']);

    const cll = new CircularLinkedList<string>();
    cll.pushBack('W1');
    cll.pushBack('W2');
    expect(cll.rotateNext()).toBe('W1');
    expect(cll.rotateNext()).toBe('W2');

    const sm = new SparseMatrix(10, 10);
    sm.set(1, 2, 5, 'Tower');
    sm.set(4, 3, 9, 'Crystal');
    sm.set(1, 7, 2, 'Slow');
    expect(sm.get(4, 3)).toBe(9);
    expect(sm.traverseRowWise().map((c) => c.value)).toEqual([5, 2, 9]);
    expect(sm.traverseColWise().map((c) => c.value)).toEqual([5, 9, 2]);
    expect(sm.remove(4, 3)).toBe(true);
    expect(sm.get(4, 3)).toBe(0);
  });

  it('solves Rat in a Maze and N-Queens via backtracking', () => {
    // 0 = open, 1 = wall
    const maze = [
      [0, 1, 0, 0],
      [0, 0, 0, 1],
      [1, 0, 1, 0],
      [0, 0, 0, 0],
    ];
    const mazeRes = solveRatInMazeTrace(maze);
    expect(mazeRes.solved).toBe(true);
    expect(mazeRes.finalPath[3][3]).toBe(1);

    const nq4 = solveNQueensTrace(4);
    expect(nq4.totalSolutions).toBe(2);
    const nq6 = solveNQueensTrace(6);
    expect(nq6.totalSolutions).toBe(4);
  });
});

describe('Part 4: Trees, Heaps & Balanced Search Structures', () => {
  it('supports BST, ThreadedBST, AVL, Red-Black, B-Tree, B+ Tree, BinaryHeap, PriorityQueue', () => {
    const keys = [30, 10, 50, 5, 20, 40, 60, 15, 25];

    const bst = new BinarySearchTree();
    keys.forEach((k) => bst.insert(k));
    expect(bst.traverse('inorder')).toEqual([...keys].sort((a, b) => a - b));
    expect(bst.search(25).found).toBe(true);
    expect(bst.delete(30)).toBe(true);
    expect(bst.search(30).found).toBe(false);

    const tbt = new ThreadedBinaryTree();
    keys.forEach((k) => tbt.insert(k));
    expect(tbt.inorderThreaded()).toEqual([...keys].sort((a, b) => a - b));

    const avl = new AVLTree();
    keys.forEach((k) => avl.insert(k));
    expect(avl.inorder()).toEqual([...keys].sort((a, b) => a - b));
    avl.delete(20);
    expect(avl.search(20).found).toBe(false);

    const rbt = new RedBlackTree();
    keys.forEach((k) => rbt.insert(k));
    expect(rbt.search(40)).toBe(true);
    expect(rbt.search(99)).toBe(false);

    const bt = new BTree(2);
    keys.forEach((k) => bt.insert(k));
    expect(bt.search(60)).toBe(true);
    expect(bt.search(99)).toBe(false);

    const bpt = new BPlusTree(3);
    keys.forEach((k) => bpt.insert(k));
    expect(bpt.rangeQuery(12, 45)).toEqual([15, 20, 25, 30, 40]);

    const heap = new BinaryHeap<number>((a, b) => a - b);
    [15, 4, 22, 8, 1].forEach((k) => heap.push(k));
    expect(heap.pop()).toBe(1);
    expect(heap.pop()).toBe(4);

    const pq = new PriorityQueue<string>(true);
    pq.enqueue('Low', 10);
    pq.enqueue('Boss', 99);
    expect(pq.dequeue()).toBe('Boss');
  });
});

describe('Part 5 & 6: Graphs, Advanced Spatial Trees & String Structures', () => {
  it('executes BFS, DFS, Dijkstra, Bellman-Ford, Floyd-Warshall, Prim, Kruskal & DisjointSet', () => {
    const dsu = new DisjointSet(4);
    expect(dsu.unite(0, 1)).toBe(true);
    expect(dsu.unite(1, 2)).toBe(true);
    expect(dsu.find(0)).toBe(dsu.find(2));

    const g = new Graph(false, true);
    for (let i = 0; i < 4; i++) g.addVertex(`V${i}`, i * 50, i * 30);
    g.addEdge(0, 1, 4);
    g.addEdge(0, 2, 1);
    g.addEdge(2, 1, 2);
    g.addEdge(1, 3, 3);
    g.addEdge(2, 3, 8);

    expect(g.bfsTrace(0).order.length).toBe(4);
    expect(g.dfsTrace(0).order.length).toBe(4);
    expect(g.dijkstraTrace(0).distances).toEqual([0, 3, 1, 6]);
    expect(g.bellmanFordTrace(0).hasNegativeCycle).toBe(false);
    expect(g.bellmanFordTrace(0).distances).toEqual([0, 3, 1, 6]);
    expect(g.floydWarshallTrace().matrix[0][3]).toBe(6);
    expect(g.primMSTTrace(0).totalWeight).toBe(6);
    expect(g.kruskalMSTTrace().totalWeight).toBe(6);
  });

  it('supports IntervalTree, SegmentTree, RangeTree2D, KDTree, QuadTree', () => {
    const itree = new IntervalTree();
    itree.insert({ id: 1, low: 5, high: 15, label: 'Wave 1' });
    itree.insert({ id: 2, low: 20, high: 30, label: 'Wave 2' });
    expect(itree.queryOverlapping(10, 18).map((x) => x.id)).toEqual([1]);

    const seg = new SegmentTree([10, 30, 20, 50, 40]);
    expect(seg.queryMin(0, 4)).toBe(10);
    expect(seg.queryMax(1, 3)).toBe(50);
    expect(seg.querySum(0, 2)).toBe(60);
    seg.update(1, 5);
    expect(seg.queryMin(0, 4)).toBe(5);

    const rt = new RangeTree2D([
      { x: 10, y: 10, payload: 'A' },
      { x: 50, y: 50, payload: 'B' },
      { x: 90, y: 90, payload: 'C' },
    ]);
    expect(rt.query(0, 60, 0, 60).map((p) => p.payload)).toEqual(['A', 'B']);

    const kd = new KDTree<string>();
    kd.insert({ id: 1, x: 100, y: 100, data: 'E1' });
    kd.insert({ id: 2, x: 300, y: 300, data: 'E2' });
    expect(kd.nearest(110, 95)?.data).toBe('E1');
    expect(kd.queryRadius(100, 100, 40).length).toBe(1);

    const qt = new QuadTree<string>({ x: 0, y: 0, w: 400, h: 400 }, 1);
    qt.insert({ id: 1, x: 50, y: 50, data: 'A' });
    qt.insert({ id: 2, x: 350, y: 350, data: 'B' });
    expect(qt.queryRadius(55, 55, 25).map((e) => e.data)).toEqual(['A']);
  });

  it('supports Trie, SuffixTree, SuffixArray, and Rabin-Karp matching', () => {
    const trie = new Trie();
    trie.insert('sniper');
    trie.insert('splash');
    trie.insert('laser');
    expect(trie.search('sniper')).toBe(true);
    expect(trie.search('snipe')).toBe(false);
    expect(trie.autocomplete('sp')).toEqual(['splash']);

    const st = new SuffixTree('circuit_valley_circuit');
    expect(st.searchPattern('valley').length).toBe(1);
    expect(st.searchPattern('circuit')).toEqual([0, 15]);

    const sa = new SuffixArray('algorithmic_battlefield');
    expect(sa.searchPattern('battle')).toEqual([12]);

    const rk = rabinKarpTrace('ABABDABACDABABCABAB', 'ABABC');
    expect(rk.matches).toEqual([10]);
  });
});