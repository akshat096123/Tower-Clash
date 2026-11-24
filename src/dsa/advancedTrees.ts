// Advanced Tree-Based Data Structures: Interval Tree, Segment Tree, Range Tree (2D), KD Tree, Quad Tree

// 1. Interval Tree
export interface IntervalRecord {
  id: number | string;
  low: number;
  high: number;
  label?: string;
}

interface IntervalNode {
  interval: IntervalRecord;
  maxHigh: number;
  left: IntervalNode | null;
  right: IntervalNode | null;
}

export class IntervalTree {
  private root: IntervalNode | null = null;

  insert(interval: IntervalRecord): void {
    const rec = (n: IntervalNode | null): IntervalNode => {
      if (!n) return { interval, maxHigh: interval.high, left: null, right: null };
      if (interval.low < n.interval.low) n.left = rec(n.left);
      else n.right = rec(n.right);
      if (n.maxHigh < interval.high) n.maxHigh = interval.high;
      return n;
    };
    this.root = rec(this.root);
  }

  queryOverlapping(low: number, high: number): IntervalRecord[] {
    const out: IntervalRecord[] = [];
    const rec = (n: IntervalNode | null) => {
      if (!n) return;
      if (n.interval.low <= high && low <= n.interval.high) out.push(n.interval);
      if (n.left && n.left.maxHigh >= low) rec(n.left);
      rec(n.right);
    };
    rec(this.root);
    return out;
  }

  clear(): void {
    this.root = null;
  }
}

// 2. Segment Tree (Range Min, Max, Sum with dynamic updates)
export class SegmentTree {
  private n: number;
  private minTree: number[];
  private maxTree: number[];
  private sumTree: number[];

  constructor(arr: number[]) {
    this.n = arr.length;
    const sz = Math.max(4, this.n * 4 + 4);
    this.minTree = new Array<number>(sz).fill(Infinity);
    this.maxTree = new Array<number>(sz).fill(-Infinity);
    this.sumTree = new Array<number>(sz).fill(0);
    if (this.n > 0) this.build(arr, 1, 0, this.n - 1);
  }

  private build(arr: number[], node: number, start: number, end: number): void {
    if (start === end) {
      this.minTree[node] = arr[start];
      this.maxTree[node] = arr[start];
      this.sumTree[node] = arr[start];
      return;
    }
    const mid = Math.floor((start + end) / 2);
    this.build(arr, 2 * node, start, mid);
    this.build(arr, 2 * node + 1, mid + 1, end);
    this.minTree[node] = Math.min(this.minTree[2 * node], this.minTree[2 * node + 1]);
    this.maxTree[node] = Math.max(this.maxTree[2 * node], this.maxTree[2 * node + 1]);
    this.sumTree[node] = this.sumTree[2 * node] + this.sumTree[2 * node + 1];
  }

  update(idx: number, val: number): void {
    if (idx < 0 || idx >= this.n) return;
    const rec = (node: number, start: number, end: number) => {
      if (start === end) {
        this.minTree[node] = val;
        this.maxTree[node] = val;
        this.sumTree[node] = val;
        return;
      }
      const mid = Math.floor((start + end) / 2);
      if (idx <= mid) rec(2 * node, start, mid);
      else rec(2 * node + 1, mid + 1, end);
      this.minTree[node] = Math.min(this.minTree[2 * node], this.minTree[2 * node + 1]);
      this.maxTree[node] = Math.max(this.maxTree[2 * node], this.maxTree[2 * node + 1]);
      this.sumTree[node] = this.sumTree[2 * node] + this.sumTree[2 * node + 1];
    };
    rec(1, 0, this.n - 1);
  }

  queryMin(l: number, r: number): number {
    if (this.n === 0 || l > r) return 0;
    const rec = (node: number, start: number, end: number): number => {
      if (r < start || end < l) return Infinity;
      if (l <= start && end <= r) return this.minTree[node];
      const mid = Math.floor((start + end) / 2);
      return Math.min(rec(2 * node, start, mid), rec(2 * node + 1, mid + 1, end));
    };
    const v = rec(1, 0, this.n - 1);
    return v === Infinity ? 0 : v;
  }

  queryMax(l: number, r: number): number {
    if (this.n === 0 || l > r) return 0;
    const rec = (node: number, start: number, end: number): number => {
      if (r < start || end < l) return -Infinity;
      if (l <= start && end <= r) return this.maxTree[node];
      const mid = Math.floor((start + end) / 2);
      return Math.max(rec(2 * node, start, mid), rec(2 * node + 1, mid + 1, end));
    };
    const v = rec(1, 0, this.n - 1);
    return v === -Infinity ? 0 : v;
  }

  querySum(l: number, r: number): number {
    if (this.n === 0 || l > r) return 0;
    const rec = (node: number, start: number, end: number): number => {
      if (r < start || end < l) return 0;
      if (l <= start && end <= r) return this.sumTree[node];
      const mid = Math.floor((start + end) / 2);
      return rec(2 * node, start, mid) + rec(2 * node + 1, mid + 1, end);
    };
    return rec(1, 0, this.n - 1);
  }
}

// 3. 2D Range Tree (Orthogonal Range Query over [x1..x2] x [y1..y2])
export interface RangePoint2D<T = unknown> {
  x: number;
  y: number;
  payload?: T;
}

interface RangeNode<T> {
  splitX: number;
  pointsByY: RangePoint2D<T>[];
  left: RangeNode<T> | null;
  right: RangeNode<T> | null;
}

export class RangeTree2D<T = unknown> {
  private root: RangeNode<T> | null = null;

  constructor(points: RangePoint2D<T>[]) {
    if (points.length === 0) return;
    // Manual insertion sort by x
    const sortedX = [...points];
    for (let i = 1; i < sortedX.length; i++) {
      const k = sortedX[i];
      let j = i - 1;
      while (j >= 0 && sortedX[j].x > k.x) {
        sortedX[j + 1] = sortedX[j];
        j--;
      }
      sortedX[j + 1] = k;
    }
    this.root = this.build(sortedX);
  }

  private sortByY(pts: RangePoint2D<T>[]): RangePoint2D<T>[] {
    const copy = [...pts];
    for (let i = 1; i < copy.length; i++) {
      const k = copy[i];
      let j = i - 1;
      while (j >= 0 && copy[j].y > k.y) {
        copy[j + 1] = copy[j];
        j--;
      }
      copy[j + 1] = k;
    }
    return copy;
  }

  private build(ptsX: RangePoint2D<T>[]): RangeNode<T> | null {
    if (ptsX.length === 0) return null;
    if (ptsX.length === 1) {
      return { splitX: ptsX[0].x, pointsByY: [ptsX[0]], left: null, right: null };
    }
    const mid = Math.floor(ptsX.length / 2);
    return {
      splitX: ptsX[mid - 1].x,
      pointsByY: this.sortByY(ptsX),
      left: this.build(ptsX.slice(0, mid)),
      right: this.build(ptsX.slice(mid)),
    };
  }

  query(xMin: number, xMax: number, yMin: number, yMax: number): RangePoint2D<T>[] {
    const out: RangePoint2D<T>[] = [];
    const search = (node: RangeNode<T> | null, minX: number, maxX: number) => {
      if (!node) return;
      if (!node.left && !node.right) {
        const p = node.pointsByY[0];
        if (p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax) out.push(p);
        return;
      }
      if (minX >= xMin && maxX <= xMax) {
        // Binary search yMin in pointsByY
        let lo = 0;
        let hi = node.pointsByY.length - 1;
        let start = node.pointsByY.length;
        while (lo <= hi) {
          const m = Math.floor((lo + hi) / 2);
          if (node.pointsByY[m].y >= yMin) {
            start = m;
            hi = m - 1;
          } else {
            lo = m + 1;
          }
        }
        for (let i = start; i < node.pointsByY.length && node.pointsByY[i].y <= yMax; i++) {
          out.push(node.pointsByY[i]);
        }
        return;
      }
      if (xMin <= node.splitX) search(node.left, minX, node.splitX);
      if (xMax > node.splitX) search(node.right, node.splitX, maxX);
    };
    search(this.root, -Infinity, Infinity);
    return out;
  }
}

// 4. KD-Tree (2D Spatial Nearest-Neighbor & Radius Search)
export interface SpatialEntity<T = unknown> {
  id: number;
  x: number;
  y: number;
  data: T;
}

interface KDNode<T> {
  entity: SpatialEntity<T>;
  depth: number;
  left: KDNode<T> | null;
  right: KDNode<T> | null;
}

export class KDTree<T = unknown> {
  private root: KDNode<T> | null = null;
  public lastNodesVisited = 0;

  insert(entity: SpatialEntity<T>): void {
    const rec = (n: KDNode<T> | null, depth: number): KDNode<T> => {
      if (!n) return { entity, depth, left: null, right: null };
      const cd = depth % 2;
      const goLeft = cd === 0 ? entity.x < n.entity.x : entity.y < n.entity.y;
      if (goLeft) n.left = rec(n.left, depth + 1);
      else n.right = rec(n.right, depth + 1);
      return n;
    };
    this.root = rec(this.root, 0);
  }

  queryRadius(cx: number, cy: number, radius: number): SpatialEntity<T>[] {
    const out: SpatialEntity<T>[] = [];
    const rSq = radius * radius;
    this.lastNodesVisited = 0;
    const rec = (n: KDNode<T> | null) => {
      if (!n) return;
      this.lastNodesVisited++;
      const dx = n.entity.x - cx;
      const dy = n.entity.y - cy;
      if (dx * dx + dy * dy <= rSq) out.push(n.entity);

      const cd = n.depth % 2;
      const diff = cd === 0 ? cx - n.entity.x : cy - n.entity.y;
      const near = diff < 0 ? n.left : n.right;
      const far = diff < 0 ? n.right : n.left;
      rec(near);
      if (diff * diff <= rSq) rec(far);
    };
    rec(this.root);
    return out;
  }

  nearest(cx: number, cy: number): SpatialEntity<T> | null {
    let best: SpatialEntity<T> | null = null;
    let bestDistSq = Infinity;
    this.lastNodesVisited = 0;
    const rec = (n: KDNode<T> | null) => {
      if (!n) return;
      this.lastNodesVisited++;
      const dx = n.entity.x - cx;
      const dy = n.entity.y - cy;
      const d = dx * dx + dy * dy;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = n.entity;
      }
      const cd = n.depth % 2;
      const diff = cd === 0 ? cx - n.entity.x : cy - n.entity.y;
      const near = diff < 0 ? n.left : n.right;
      const far = diff < 0 ? n.right : n.left;
      rec(near);
      if (diff * diff < bestDistSq) rec(far);
    };
    rec(this.root);
    return best;
  }

  collectSplitLines(bounds: { x: number; y: number; w: number; h: number }): Array<{
    x1: number; y1: number; x2: number; y2: number; axis: 'x' | 'y';
  }> {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; axis: 'x' | 'y' }> = [];
    const rec = (n: KDNode<T> | null, minX: number, minY: number, maxX: number, maxY: number) => {
      if (!n) return;
      if (n.depth % 2 === 0) {
        lines.push({ x1: n.entity.x, y1: minY, x2: n.entity.x, y2: maxY, axis: 'x' });
        rec(n.left, minX, minY, n.entity.x, maxY);
        rec(n.right, n.entity.x, minY, maxX, maxY);
      } else {
        lines.push({ x1: minX, y1: n.entity.y, x2: maxX, y2: n.entity.y, axis: 'y' });
        rec(n.left, minX, minY, maxX, n.entity.y);
        rec(n.right, minX, n.entity.y, maxX, maxY);
      }
    };
    rec(this.root, bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h);
    return lines;
  }
}

// 5. QuadTree (2D Spatial Partitioning)
export interface QuadBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class QuadTree<T = unknown> {
  private readonly box: QuadBox;
  private readonly capacity: number;
  private entities: SpatialEntity<T>[] = [];
  private divided = false;
  private nw: QuadTree<T> | null = null;
  private ne: QuadTree<T> | null = null;
  private sw: QuadTree<T> | null = null;
  private se: QuadTree<T> | null = null;
  public lastChecks = 0;

  constructor(box: QuadBox, capacity = 4) {
    this.box = box;
    this.capacity = capacity;
  }

  private contains(px: number, py: number): boolean {
    return px >= this.box.x && px <= this.box.x + this.box.w && py >= this.box.y && py <= this.box.y + this.box.h;
  }

  private intersectsCircle(cx: number, cy: number, r: number): boolean {
    const closestX = Math.max(this.box.x, Math.min(cx, this.box.x + this.box.w));
    const closestY = Math.max(this.box.y, Math.min(cy, this.box.y + this.box.h));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  private subdivide(): void {
    const hw = this.box.w / 2;
    const hh = this.box.h / 2;
    this.nw = new QuadTree<T>({ x: this.box.x, y: this.box.y, w: hw, h: hh }, this.capacity);
    this.ne = new QuadTree<T>({ x: this.box.x + hw, y: this.box.y, w: hw, h: hh }, this.capacity);
    this.sw = new QuadTree<T>({ x: this.box.x, y: this.box.y + hh, w: hw, h: hh }, this.capacity);
    this.se = new QuadTree<T>({ x: this.box.x + hw, y: this.box.y + hh, w: hw, h: hh }, this.capacity);
    this.divided = true;
  }

  insert(entity: SpatialEntity<T>): boolean {
    if (!this.contains(entity.x, entity.y)) return false;
    if (this.entities.length < this.capacity) {
      this.entities.push(entity);
      return true;
    }
    if (!this.divided) this.subdivide();
    return (
      this.nw!.insert(entity) ||
      this.ne!.insert(entity) ||
      this.sw!.insert(entity) ||
      this.se!.insert(entity)
    );
  }

  queryRadius(cx: number, cy: number, r: number): SpatialEntity<T>[] {
    const found: SpatialEntity<T>[] = [];
    this.lastChecks = 0;
    const rec = (qt: QuadTree<T>) => {
      if (!qt.intersectsCircle(cx, cy, r)) return;
      const rSq = r * r;
      for (const e of qt.entities) {
        this.lastChecks++;
        const dx = e.x - cx;
        const dy = e.y - cy;
        if (dx * dx + dy * dy <= rSq) found.push(e);
      }
      if (qt.divided) {
        rec(qt.nw!);
        rec(qt.ne!);
        rec(qt.sw!);
        rec(qt.se!);
      }
    };
    rec(this);
    return found;
  }

  collectBoxes(): QuadBox[] {
    const out: QuadBox[] = [this.box];
    if (this.divided) {
      out.push(...this.nw!.collectBoxes());
      out.push(...this.ne!.collectBoxes());
      out.push(...this.sw!.collectBoxes());
      out.push(...this.se!.collectBoxes());
    }
    return out;
  }
}
