import { BinaryHeap } from './trees';

export interface GraphVertex {
  id: number;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  u: number;
  v: number;
  weight: number;
}

export interface GraphStep {
  visited: number[];
  frontier: number[];
  activeEdge?: [number, number];
  highlightedEdges: Array<[number, number]>;
  distances?: Record<number, number | string>;
  description: string;
}

export class DisjointSet {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array<number>(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  unite(a: number, b: number): boolean {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return false;
    if (this.rank[ra] < this.rank[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    if (this.rank[ra] === this.rank[rb]) this.rank[ra]++;
    return true;
  }
}

export class Graph {
  vertices: GraphVertex[] = [];
  edges: GraphEdge[] = [];
  directed: boolean;
  weighted: boolean;

  constructor(directed = false, weighted = true) {
    this.directed = directed;
    this.weighted = weighted;
  }

  addVertex(label: string, x: number, y: number): number {
    const id = this.vertices.length;
    this.vertices.push({ id, label, x, y });
    return id;
  }

  addEdge(u: number, v: number, weight = 1): void {
    if (u < 0 || u >= this.vertices.length || v < 0 || v >= this.vertices.length) return;
    const w = this.weighted ? weight : 1;
    this.edges.push({ u, v, weight: w });
  }

  getAdjacencyList(): Map<number, Array<{ to: number; weight: number }>> {
    const adj = new Map<number, Array<{ to: number; weight: number }>>();
    for (const vx of this.vertices) adj.set(vx.id, []);
    for (const e of this.edges) {
      adj.get(e.u)!.push({ to: e.v, weight: e.weight });
      if (!this.directed) {
        adj.get(e.v)!.push({ to: e.u, weight: e.weight });
      }
    }
    return adj;
  }

  getAdjacencyMatrix(): Array<Array<number | null>> {
    const n = this.vertices.length;
    const mat: Array<Array<number | null>> = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : null))
    );
    for (const e of this.edges) {
      mat[e.u][e.v] = e.weight;
      if (!this.directed) mat[e.v][e.u] = e.weight;
    }
    return mat;
  }

  bfsTrace(start: number): { order: number[]; steps: GraphStep[] } {
    const adj = this.getAdjacencyList();
    const visited = new Set<number>();
    const queue: number[] = [];
    const order: number[] = [];
    const steps: GraphStep[] = [];
    const treeEdges: Array<[number, number]> = [];

    if (start < 0 || start >= this.vertices.length) return { order, steps };
    visited.add(start);
    queue.push(start);
    steps.push({
      visited: [...visited],
      frontier: [...queue],
      highlightedEdges: [],
      description: `Initialize BFS Queue with start vertex ${this.vertices[start].label}`,
    });

    while (queue.length > 0) {
      const u = queue.shift()!;
      order.push(u);
      steps.push({
        visited: [...visited],
        frontier: [...queue],
        highlightedEdges: [...treeEdges],
        description: `Dequeue ${this.vertices[u].label} and inspect neighbors`,
      });
      for (const edge of adj.get(u) ?? []) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
          treeEdges.push([u, edge.to]);
          steps.push({
            visited: [...visited],
            frontier: [...queue],
            activeEdge: [u, edge.to],
            highlightedEdges: [...treeEdges],
            description: `Visit ${this.vertices[edge.to].label} from ${this.vertices[u].label} -> Enqueue`,
          });
        }
      }
    }
    return { order, steps };
  }

  dfsTrace(start: number): { order: number[]; steps: GraphStep[] } {
    const adj = this.getAdjacencyList();
    const visited = new Set<number>();
    const order: number[] = [];
    const steps: GraphStep[] = [];
    const stack: number[] = [start];
    const treeEdges: Array<[number, number]> = [];

    const dfsRec = (u: number, parent: number | null) => {
      visited.add(u);
      order.push(u);
      if (parent !== null) treeEdges.push([parent, u]);
      steps.push({
        visited: [...visited],
        frontier: [...stack],
        activeEdge: parent !== null ? [parent, u] : undefined,
        highlightedEdges: [...treeEdges],
        description: `DFS visit ${this.vertices[u].label}`,
      });
      for (const edge of adj.get(u) ?? []) {
        if (!visited.has(edge.to)) {
          stack.push(edge.to);
          dfsRec(edge.to, u);
          stack.pop();
        }
      }
    };

    if (start >= 0 && start < this.vertices.length) dfsRec(start, null);
    return { order, steps };
  }

  dijkstraTrace(start: number): { distances: number[]; parent: Array<number | null>; steps: GraphStep[] } {
    const n = this.vertices.length;
    const adj = this.getAdjacencyList();
    const dist = new Array<number>(n).fill(Infinity);
    const parent = new Array<number | null>(n).fill(null);
    const visited = new Set<number>();
    const steps: GraphStep[] = [];

    const fmtDist = () => {
      const obj: Record<number, number | string> = {};
      for (let i = 0; i < n; i++) obj[i] = dist[i] === Infinity ? '∞' : dist[i];
      return obj;
    };

    if (start < 0 || start >= n) return { distances: dist, parent, steps };
    dist[start] = 0;
    const pq = new BinaryHeap<{ d: number; u: number }>((a, b) => a.d - b.d);
    pq.push({ d: 0, u: start });

    steps.push({
      visited: [],
      frontier: [start],
      highlightedEdges: [],
      distances: fmtDist(),
      description: `Dijkstra initialized: dist[${this.vertices[start].label}] = 0`,
    });

    const settledEdges: Array<[number, number]> = [];
    while (pq.size > 0) {
      const top = pq.pop()!;
      const u = top.u;
      if (visited.has(u)) continue;
      visited.add(u);
      if (parent[u] !== null) settledEdges.push([parent[u]!, u]);

      steps.push({
        visited: [...visited],
        frontier: [],
        highlightedEdges: [...settledEdges],
        distances: fmtDist(),
        description: `Extract min vertex ${this.vertices[u].label} (dist = ${dist[u]})`,
      });

      for (const edge of adj.get(u) ?? []) {
        if (dist[u] + edge.weight < dist[edge.to]) {
          dist[edge.to] = dist[u] + edge.weight;
          parent[edge.to] = u;
          pq.push({ d: dist[edge.to], u: edge.to });
          steps.push({
            visited: [...visited],
            frontier: [edge.to],
            activeEdge: [u, edge.to],
            highlightedEdges: [...settledEdges],
            distances: fmtDist(),
            description: `Relax edge (${this.vertices[u].label} -> ${this.vertices[edge.to].label}): new dist = ${dist[edge.to]}`,
          });
        }
      }
    }
    return { distances: dist, parent, steps };
  }

  bellmanFordTrace(start: number): { distances: number[]; hasNegativeCycle: boolean; steps: GraphStep[] } {
    const n = this.vertices.length;
    const dist = new Array<number>(n).fill(Infinity);
    const parent = new Array<number | null>(n).fill(null);
    const steps: GraphStep[] = [];
    const allEdges: GraphEdge[] = [...this.edges];
    if (!this.directed) {
      for (const e of this.edges) allEdges.push({ u: e.v, v: e.u, weight: e.weight });
    }

    const fmtDist = () => {
      const obj: Record<number, number | string> = {};
      for (let i = 0; i < n; i++) obj[i] = dist[i] === Infinity ? '∞' : dist[i];
      return obj;
    };

    if (start < 0 || start >= n) return { distances: dist, hasNegativeCycle: false, steps };
    dist[start] = 0;

    for (let i = 0; i < n - 1; i++) {
      let changed = false;
      for (const e of allEdges) {
        if (dist[e.u] !== Infinity && dist[e.u] + e.weight < dist[e.v]) {
          dist[e.v] = dist[e.u] + e.weight;
          parent[e.v] = e.u;
          changed = true;
          const tree: Array<[number, number]> = [];
          for (let v = 0; v < n; v++) if (parent[v] !== null) tree.push([parent[v]!, v]);
          steps.push({
            visited: [],
            frontier: [e.v],
            activeEdge: [e.u, e.v],
            highlightedEdges: tree,
            distances: fmtDist(),
            description: `Pass ${i + 1}: relaxed (${this.vertices[e.u].label} -> ${this.vertices[e.v].label}), dist = ${dist[e.v]}`,
          });
        }
      }
      if (!changed) break;
    }

    let hasNegativeCycle = false;
    for (const e of allEdges) {
      if (dist[e.u] !== Infinity && dist[e.u] + e.weight < dist[e.v]) {
        hasNegativeCycle = true;
        steps.push({
          visited: [],
          frontier: [e.v],
          activeEdge: [e.u, e.v],
          highlightedEdges: [],
          distances: fmtDist(),
          description: `Negative weight cycle detected on edge (${this.vertices[e.u].label} -> ${this.vertices[e.v].label})!`,
        });
        break;
      }
    }
    return { distances: dist, hasNegativeCycle, steps };
  }

  floydWarshallTrace(): { matrix: number[][]; steps: GraphStep[] } {
    const n = this.vertices.length;
    const dist: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity))
    );
    for (const e of this.edges) {
      dist[e.u][e.v] = Math.min(dist[e.u][e.v], e.weight);
      if (!this.directed) dist[e.v][e.u] = Math.min(dist[e.v][e.u], e.weight);
    }
    const steps: GraphStep[] = [];
    for (let k = 0; k < n; k++) {
      let updates = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (dist[i][k] + dist[k][j] < dist[i][j]) {
            dist[i][j] = dist[i][k] + dist[k][j];
            updates++;
          }
        }
      }
      steps.push({
        visited: [k],
        frontier: [],
        highlightedEdges: [],
        description: `Floyd-Warshall intermediate vertex k=${this.vertices[k].label}: updated ${updates} pair(s)`,
      });
    }
    return { matrix: dist, steps };
  }

  primMSTTrace(start = 0): { totalWeight: number; mstEdges: GraphEdge[]; steps: GraphStep[] } {
    const n = this.vertices.length;
    const adj = this.getAdjacencyList();
    const inMST = new Array<boolean>(n).fill(false);
    const key = new Array<number>(n).fill(Infinity);
    const parent = new Array<number>(n).fill(-1);
    const mstEdges: GraphEdge[] = [];
    const steps: GraphStep[] = [];
    if (n === 0) return { totalWeight: 0, mstEdges, steps };

    key[start] = 0;
    let totalWeight = 0;
    const visited: number[] = [];
    const highlighted: Array<[number, number]> = [];

    for (let count = 0; count < n; count++) {
      let u = -1;
      let best = Infinity;
      for (let v = 0; v < n; v++) {
        if (!inMST[v] && key[v] < best) {
          best = key[v];
          u = v;
        }
      }
      if (u === -1) break;
      inMST[u] = true;
      visited.push(u);
      totalWeight += key[u];
      if (parent[u] !== -1) {
        mstEdges.push({ u: parent[u], v: u, weight: key[u] });
        highlighted.push([parent[u], u]);
      }
      steps.push({
        visited: [...visited],
        frontier: [],
        activeEdge: parent[u] !== -1 ? [parent[u], u] : undefined,
        highlightedEdges: [...highlighted],
        description: `Prim added ${this.vertices[u].label} to MST (edge weight ${key[u]}, total=${totalWeight})`,
      });
      for (const edge of adj.get(u) ?? []) {
        if (!inMST[edge.to] && edge.weight < key[edge.to]) {
          key[edge.to] = edge.weight;
          parent[edge.to] = u;
        }
      }
    }
    return { totalWeight, mstEdges, steps };
  }

  kruskalMSTTrace(): { totalWeight: number; mstEdges: GraphEdge[]; steps: GraphStep[] } {
    const sorted = [...this.edges];
    // Manual insertion sort by weight
    for (let i = 1; i < sorted.length; i++) {
      const k = sorted[i];
      let j = i - 1;
      while (j >= 0 && sorted[j].weight > k.weight) {
        sorted[j + 1] = sorted[j];
        j--;
      }
      sorted[j + 1] = k;
    }

    const dsu = new DisjointSet(this.vertices.length);
    const mstEdges: GraphEdge[] = [];
    const highlighted: Array<[number, number]> = [];
    const steps: GraphStep[] = [];
    let totalWeight = 0;

    for (const e of sorted) {
      if (dsu.unite(e.u, e.v)) {
        mstEdges.push(e);
        highlighted.push([e.u, e.v]);
        totalWeight += e.weight;
        steps.push({
          visited: [],
          frontier: [e.u, e.v],
          activeEdge: [e.u, e.v],
          highlightedEdges: [...highlighted],
          description: `Kruskal accepted edge (${this.vertices[e.u].label}-${this.vertices[e.v].label}, w=${e.weight}) -> MST total=${totalWeight}`,
        });
      } else {
        steps.push({
          visited: [],
          frontier: [],
          activeEdge: [e.u, e.v],
          highlightedEdges: [...highlighted],
          description: `Kruskal skipped edge (${this.vertices[e.u].label}-${this.vertices[e.v].label}, w=${e.weight}) -> would form cycle`,
        });
      }
    }
    return { totalWeight, mstEdges, steps };
  }
}
