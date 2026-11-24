// Manual Tree & Priority Queue Implementations (All 10 required structures + snapshot exports for SVG visualizer)

export interface TreeVisualNode {
  id: string;
  label: string;
  color?: 'red' | 'black' | 'cyan' | 'amber' | 'emerald';
  meta?: string;
  children: TreeVisualNode[];
  threadToId?: string;
}

// 1. Binary Tree (Level-order complete binary tree)
export class BinaryTree<T> {
  private nodes: T[] = [];

  insert(val: T): void {
    this.nodes.push(val);
  }

  inorder(idx = 0, out: T[] = []): T[] {
    if (idx >= this.nodes.length) return out;
    this.inorder(2 * idx + 1, out);
    out.push(this.nodes[idx]);
    this.inorder(2 * idx + 2, out);
    return out;
  }

  preorder(idx = 0, out: T[] = []): T[] {
    if (idx >= this.nodes.length) return out;
    out.push(this.nodes[idx]);
    this.preorder(2 * idx + 1, out);
    this.preorder(2 * idx + 2, out);
    return out;
  }

  postorder(idx = 0, out: T[] = []): T[] {
    if (idx >= this.nodes.length) return out;
    this.postorder(2 * idx + 1, out);
    this.postorder(2 * idx + 2, out);
    out.push(this.nodes[idx]);
    return out;
  }

  levelOrder(): T[] {
    return [...this.nodes];
  }

  toVisual(idx = 0): TreeVisualNode | null {
    if (idx >= this.nodes.length) return null;
    const children: TreeVisualNode[] = [];
    const l = this.toVisual(2 * idx + 1);
    const r = this.toVisual(2 * idx + 2);
    if (l) children.push(l);
    if (r) children.push(r);
    return { id: `bt-${idx}`, label: String(this.nodes[idx]), color: 'cyan', children };
  }
}

// 2. K-ary Tree (used for wave progression & branching difficulty)
export interface KaryNode<T> {
  id: string;
  value: T;
  children: KaryNode<T>[];
}

export class KaryTree<T> {
  readonly k: number;
  root: KaryNode<T> | null = null;
  private counter = 0;

  constructor(k = 3) {
    this.k = Math.max(2, k);
  }

  insertLevelOrder(val: T): KaryNode<T> {
    const newNode: KaryNode<T> = { id: `k-${++this.counter}`, value: val, children: [] };
    if (!this.root) {
      this.root = newNode;
      return newNode;
    }
    const queue: KaryNode<T>[] = [this.root];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.children.length < this.k) {
        curr.children.push(newNode);
        return newNode;
      }
      for (const ch of curr.children) queue.push(ch);
    }
    return newNode;
  }

  levelOrder(): T[] {
    if (!this.root) return [];
    const out: T[] = [];
    const queue: KaryNode<T>[] = [this.root];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      out.push(curr.value);
      for (const ch of curr.children) queue.push(ch);
    }
    return out;
  }

  toVisual(): TreeVisualNode | null {
    const conv = (n: KaryNode<T> | null): TreeVisualNode | null => {
      if (!n) return null;
      return {
        id: n.id,
        label: String(n.value),
        color: 'cyan',
        children: n.children.map((c) => conv(c)!).filter(Boolean),
      };
    };
    return conv(this.root);
  }
}

// 3. Binary Search Tree
interface BSTNode {
  key: number;
  left: BSTNode | null;
  right: BSTNode | null;
}

export class BinarySearchTree {
  private root: BSTNode | null = null;
  private count = 0;

  insert(key: number): string[] {
    const trace: string[] = [];
    const rec = (n: BSTNode | null): BSTNode => {
      if (!n) {
        this.count++;
        trace.push(`Inserted key ${key}`);
        return { key, left: null, right: null };
      }
      if (key < n.key) {
        trace.push(`${key} < ${n.key}: descend left`);
        n.left = rec(n.left);
      } else if (key > n.key) {
        trace.push(`${key} > ${n.key}: descend right`);
        n.right = rec(n.right);
      } else {
        trace.push(`Key ${key} already exists`);
      }
      return n;
    };
    this.root = rec(this.root);
    return trace;
  }

  search(key: number): { found: boolean; trace: string[] } {
    const trace: string[] = [];
    let curr = this.root;
    while (curr) {
      if (key === curr.key) {
        trace.push(`Found ${key}!`);
        return { found: true, trace };
      }
      trace.push(key < curr.key ? `${key} < ${curr.key}: go left` : `${key} > ${curr.key}: go right`);
      curr = key < curr.key ? curr.left : curr.right;
    }
    trace.push(`${key} not found`);
    return { found: false, trace };
  }

  delete(key: number): boolean {
    let deleted = false;
    const minNode = (n: BSTNode): BSTNode => (n.left ? minNode(n.left) : n);
    const rec = (n: BSTNode | null, k: number): BSTNode | null => {
      if (!n) return null;
      if (k < n.key) n.left = rec(n.left, k);
      else if (k > n.key) n.right = rec(n.right, k);
      else {
        deleted = true;
        if (!n.left) { this.count--; return n.right; }
        if (!n.right) { this.count--; return n.left; }
        const succ = minNode(n.right);
        n.key = succ.key;
        n.right = rec(n.right, succ.key);
      }
      return n;
    };
    this.root = rec(this.root, key);
    return deleted;
  }

  traverse(order: 'inorder' | 'preorder' | 'postorder' | 'levelorder'): number[] {
    const out: number[] = [];
    if (order === 'levelorder') {
      if (!this.root) return out;
      const q: BSTNode[] = [this.root];
      while (q.length) {
        const cur = q.shift()!;
        out.push(cur.key);
        if (cur.left) q.push(cur.left);
        if (cur.right) q.push(cur.right);
      }
      return out;
    }
    const dfs = (n: BSTNode | null) => {
      if (!n) return;
      if (order === 'preorder') out.push(n.key);
      dfs(n.left);
      if (order === 'inorder') out.push(n.key);
      dfs(n.right);
      if (order === 'postorder') out.push(n.key);
    };
    dfs(this.root);
    return out;
  }

  toVisual(): TreeVisualNode | null {
    const conv = (n: BSTNode | null): TreeVisualNode | null => {
      if (!n) return null;
      const children: TreeVisualNode[] = [];
      const l = conv(n.left);
      const r = conv(n.right);
      if (l) children.push(l);
      if (r) children.push(r);
      return { id: `bst-${n.key}`, label: String(n.key), color: 'cyan', children };
    };
    return conv(this.root);
  }

  get size(): number { return this.count; }
}

// 4. Threaded Binary Tree
interface ThreadedNode {
  key: number;
  left: ThreadedNode | null;
  right: ThreadedNode | null;
  rightThread: boolean;
}

export class ThreadedBinaryTree {
  private root: ThreadedNode | null = null;
  private count = 0;

  insert(key: number): string[] {
    const trace: string[] = [];
    let parent: ThreadedNode | null = null;
    let curr = this.root;
    while (curr) {
      if (key === curr.key) {
        trace.push(`Key ${key} already exists`);
        return trace;
      }
      parent = curr;
      if (key < curr.key) {
        trace.push(`${key} < ${curr.key}: move left`);
        curr = curr.left;
      } else if (!curr.rightThread) {
        trace.push(`${key} > ${curr.key}: move right`);
        curr = curr.right;
      } else {
        break;
      }
    }
    const n: ThreadedNode = { key, left: null, right: null, rightThread: false };
    this.count++;
    if (!parent) {
      this.root = n;
      trace.push(`Created root ${key}`);
    } else if (key < parent.key) {
      n.right = parent;
      n.rightThread = true;
      parent.left = n;
      trace.push(`Inserted ${key} as left child of ${parent.key}; right thread -> ${parent.key}`);
    } else {
      n.right = parent.right;
      n.rightThread = parent.rightThread;
      parent.right = n;
      parent.rightThread = false;
      trace.push(`Inserted ${key} as right child of ${parent.key}${n.rightThread && n.right ? `; thread -> ${n.right.key}` : ''}`);
    }
    return trace;
  }

  inorderThreaded(): number[] {
    const out: number[] = [];
    let curr = this.root;
    while (curr && curr.left) curr = curr.left;
    while (curr) {
      out.push(curr.key);
      if (curr.rightThread) {
        curr = curr.right;
      } else {
        curr = curr.right;
        while (curr && curr.left) curr = curr.left;
      }
    }
    return out;
  }

  toVisual(): TreeVisualNode | null {
    const conv = (n: ThreadedNode | null): TreeVisualNode | null => {
      if (!n) return null;
      const children: TreeVisualNode[] = [];
      const l = conv(n.left);
      if (l) children.push(l);
      if (!n.rightThread) {
        const r = conv(n.right);
        if (r) children.push(r);
      }
      return {
        id: `tbt-${n.key}`,
        label: String(n.key),
        color: 'amber',
        meta: n.rightThread && n.right ? `thread→${n.right.key}` : undefined,
        threadToId: n.rightThread && n.right ? `tbt-${n.right.key}` : undefined,
        children,
      };
    };
    return conv(this.root);
  }
}

// 5. AVL Tree (records rotation operations!)
interface AVLNode {
  key: number;
  height: number;
  left: AVLNode | null;
  right: AVLNode | null;
}

export class AVLTree {
  private root: AVLNode | null = null;
  private count = 0;

  private h(n: AVLNode | null): number { return n ? n.height : 0; }
  private bf(n: AVLNode | null): number { return n ? this.h(n.left) - this.h(n.right) : 0; }
  private upd(n: AVLNode): void { n.height = 1 + Math.max(this.h(n.left), this.h(n.right)); }

  private rotRight(y: AVLNode, trace: string[]): AVLNode {
    trace.push(`Right Rotation at node ${y.key}`);
    const x = y.left!;
    const t2 = x.right;
    x.right = y;
    y.left = t2;
    this.upd(y);
    this.upd(x);
    return x;
  }

  private rotLeft(x: AVLNode, trace: string[]): AVLNode {
    trace.push(`Left Rotation at node ${x.key}`);
    const y = x.right!;
    const t2 = y.left;
    y.left = x;
    x.right = t2;
    this.upd(x);
    this.upd(y);
    return y;
  }

  private balance(n: AVLNode, trace: string[]): AVLNode {
    this.upd(n);
    const b = this.bf(n);
    if (b > 1) {
      if (this.bf(n.left) < 0) {
        trace.push(`LR Imbalance detected at ${n.key} (BF=${b})`);
        n.left = this.rotLeft(n.left!, trace);
      } else {
        trace.push(`LL Imbalance detected at ${n.key} (BF=${b})`);
      }
      return this.rotRight(n, trace);
    }
    if (b < -1) {
      if (this.bf(n.right) > 0) {
        trace.push(`RL Imbalance detected at ${n.key} (BF=${b})`);
        n.right = this.rotRight(n.right!, trace);
      } else {
        trace.push(`RR Imbalance detected at ${n.key} (BF=${b})`);
      }
      return this.rotLeft(n, trace);
    }
    return n;
  }

  insert(key: number): string[] {
    const trace: string[] = [];
    const rec = (n: AVLNode | null): AVLNode => {
      if (!n) {
        this.count++;
        trace.push(`Inserted ${key}`);
        return { key, height: 1, left: null, right: null };
      }
      if (key < n.key) n.left = rec(n.left);
      else if (key > n.key) n.right = rec(n.right);
      else return n;
      return this.balance(n, trace);
    };
    this.root = rec(this.root);
    return trace;
  }

  delete(key: number): string[] {
    const trace: string[] = [];
    const minNode = (n: AVLNode): AVLNode => (n.left ? minNode(n.left) : n);
    const rec = (n: AVLNode | null, k: number): AVLNode | null => {
      if (!n) return null;
      if (k < n.key) n.left = rec(n.left, k);
      else if (k > n.key) n.right = rec(n.right, k);
      else {
        if (!n.left || !n.right) {
          this.count--;
          trace.push(`Deleted ${k}`);
          return n.left || n.right;
        }
        const succ = minNode(n.right);
        n.key = succ.key;
        n.right = rec(n.right, succ.key);
      }
      return this.balance(n, trace);
    };
    this.root = rec(this.root, key);
    return trace;
  }

  search(key: number): { found: boolean; trace: string[] } {
    const trace: string[] = [];
    let cur = this.root;
    while (cur) {
      if (key === cur.key) {
        trace.push(`Found ${key} at height ${cur.height}`);
        return { found: true, trace };
      }
      trace.push(key < cur.key ? `${key} < ${cur.key}: left` : `${key} > ${cur.key}: right`);
      cur = key < cur.key ? cur.left : cur.right;
    }
    return { found: false, trace };
  }

  inorder(): number[] {
    const out: number[] = [];
    const dfs = (n: AVLNode | null) => {
      if (!n) return;
      dfs(n.left);
      out.push(n.key);
      dfs(n.right);
    };
    dfs(this.root);
    return out;
  }

  toVisual(): TreeVisualNode | null {
    const conv = (n: AVLNode | null): TreeVisualNode | null => {
      if (!n) return null;
      const children: TreeVisualNode[] = [];
      const l = conv(n.left);
      const r = conv(n.right);
      if (l) children.push(l);
      if (r) children.push(r);
      return {
        id: `avl-${n.key}`,
        label: String(n.key),
        meta: `h=${n.height} bf=${this.bf(n)}`,
        color: 'emerald',
        children,
      };
    };
    return conv(this.root);
  }

  get height(): number { return this.h(this.root); }
  get size(): number { return this.count; }
}

// 6. Red-Black Tree
interface RBNode {
  key: number;
  color: 'red' | 'black';
  left: RBNode | null;
  right: RBNode | null;
  parent: RBNode | null;
}

export class RedBlackTree {
  private root: RBNode | null = null;
  private count = 0;

  private rotateLeft(x: RBNode, trace: string[]): void {
    trace.push(`RB Left-Rotate(${x.key})`);
    const y = x.right!;
    x.right = y.left;
    if (y.left) y.left.parent = x;
    y.parent = x.parent;
    if (!x.parent) this.root = y;
    else if (x === x.parent.left) x.parent.left = y;
    else x.parent.right = y;
    y.left = x;
    x.parent = y;
  }

  private rotateRight(y: RBNode, trace: string[]): void {
    trace.push(`RB Right-Rotate(${y.key})`);
    const x = y.left!;
    y.left = x.right;
    if (x.right) x.right.parent = y;
    x.parent = y.parent;
    if (!y.parent) this.root = x;
    else if (y === y.parent.left) y.parent.left = x;
    else y.parent.right = x;
    x.right = y;
    y.parent = x;
  }

  insert(key: number): string[] {
    const trace: string[] = [];
    const z: RBNode = { key, color: 'red', left: null, right: null, parent: null };
    let y: RBNode | null = null;
    let x = this.root;
    while (x) {
      y = x;
      if (key < x.key) x = x.left;
      else if (key > x.key) x = x.right;
      else return [`Key ${key} already exists`];
    }
    z.parent = y;
    if (!y) this.root = z;
    else if (key < y.key) y.left = z;
    else y.right = z;
    this.count++;
    trace.push(`Inserted RED node ${key}`);

    let cur = z;
    while (cur.parent && cur.parent.color === 'red') {
      const gp = cur.parent.parent;
      if (!gp) break;
      if (cur.parent === gp.left) {
        const uncle = gp.right;
        if (uncle && uncle.color === 'red') {
          trace.push(`Recolor parent ${cur.parent.key}, uncle ${uncle.key} -> BLACK; grandparent ${gp.key} -> RED`);
          cur.parent.color = 'black';
          uncle.color = 'black';
          gp.color = 'red';
          cur = gp;
        } else {
          if (cur === cur.parent.right) {
            cur = cur.parent;
            this.rotateLeft(cur, trace);
          }
          cur.parent!.color = 'black';
          gp.color = 'red';
          this.rotateRight(gp, trace);
        }
      } else {
        const uncle = gp.left;
        if (uncle && uncle.color === 'red') {
          trace.push(`Recolor parent ${cur.parent.key}, uncle ${uncle.key} -> BLACK; grandparent ${gp.key} -> RED`);
          cur.parent.color = 'black';
          uncle.color = 'black';
          gp.color = 'red';
          cur = gp;
        } else {
          if (cur === cur.parent.left) {
            cur = cur.parent;
            this.rotateRight(cur, trace);
          }
          cur.parent!.color = 'black';
          gp.color = 'red';
          this.rotateLeft(gp, trace);
        }
      }
    }
    if (this.root) this.root.color = 'black';
    return trace;
  }

  search(key: number): boolean {
    let cur = this.root;
    while (cur) {
      if (key === cur.key) return true;
      cur = key < cur.key ? cur.left : cur.right;
    }
    return false;
  }

  toVisual(): TreeVisualNode | null {
    const conv = (n: RBNode | null): TreeVisualNode | null => {
      if (!n) return null;
      const children: TreeVisualNode[] = [];
      const l = conv(n.left);
      const r = conv(n.right);
      if (l) children.push(l);
      if (r) children.push(r);
      return {
        id: `rb-${n.key}`,
        label: String(n.key),
        color: n.color,
        meta: n.color.toUpperCase(),
        children,
      };
    };
    return conv(this.root);
  }

  get size(): number { return this.count; }
}

// 7. B-Tree (order t)
interface BTreeNode {
  leaf: boolean;
  keys: number[];
  children: BTreeNode[];
}

export class BTree {
  private root: BTreeNode | null = null;
  readonly t: number;
  private nodeCounter = 0;

  constructor(t = 2) {
    this.t = Math.max(2, t);
  }

  private splitChild(x: BTreeNode, i: number, trace: string[]): void {
    const y = x.children[i];
    const z: BTreeNode = {
      leaf: y.leaf,
      keys: y.keys.splice(this.t),
      children: y.leaf ? [] : y.children.splice(this.t),
    };
    const mid = y.keys.pop()!;
    x.children.splice(i + 1, 0, z);
    x.keys.splice(i, 0, mid);
    trace.push(`Split child node; promoted median key ${mid}`);
  }

  private insertNonFull(x: BTreeNode, k: number, trace: string[]): void {
    let i = x.keys.length - 1;
    if (x.leaf) {
      while (i >= 0 && k < x.keys[i]) i--;
      x.keys.splice(i + 1, 0, k);
      trace.push(`Inserted ${k} into leaf [${x.keys.join(', ')}]`);
    } else {
      while (i >= 0 && k < x.keys[i]) i--;
      i++;
      if (x.children[i].keys.length === 2 * this.t - 1) {
        this.splitChild(x, i, trace);
        if (k > x.keys[i]) i++;
      }
      this.insertNonFull(x.children[i], k, trace);
    }
  }

  insert(k: number): string[] {
    const trace: string[] = [];
    if (!this.root) {
      this.root = { leaf: true, keys: [k], children: [] };
      trace.push(`Created B-Tree root [${k}]`);
      return trace;
    }
    if (this.root.keys.length === 2 * this.t - 1) {
      const s: BTreeNode = { leaf: false, keys: [], children: [this.root] };
      this.splitChild(s, 0, trace);
      const i = k > s.keys[0] ? 1 : 0;
      this.insertNonFull(s.children[i], k, trace);
      this.root = s;
    } else {
      this.insertNonFull(this.root, k, trace);
    }
    return trace;
  }

  search(k: number): boolean {
    let cur = this.root;
    while (cur) {
      let i = 0;
      while (i < cur.keys.length && k > cur.keys[i]) i++;
      if (i < cur.keys.length && k === cur.keys[i]) return true;
      if (cur.leaf) return false;
      cur = cur.children[i];
    }
    return false;
  }

  toVisual(): TreeVisualNode | null {
    this.nodeCounter = 0;
    const conv = (n: BTreeNode | null): TreeVisualNode | null => {
      if (!n) return null;
      return {
        id: `b-${++this.nodeCounter}`,
        label: `[${n.keys.join(' | ')}]`,
        color: 'amber',
        children: n.children.map((c) => conv(c)!).filter(Boolean),
      };
    };
    return conv(this.root);
  }
}

// 8. B+ Tree (leaf-linked index for performance & game history indexing)
interface BPlusNode {
  leaf: boolean;
  keys: number[];
  children: BPlusNode[];
  next: BPlusNode | null;
}

export class BPlusTree {
  private root: BPlusNode | null = null;
  readonly order: number;

  constructor(order = 3) {
    this.order = Math.max(3, order);
  }

  insert(key: number): string[] {
    const trace: string[] = [];
    if (!this.root) {
      this.root = { leaf: true, keys: [key], children: [], next: null };
      trace.push(`Created B+ root leaf [${key}]`);
      return trace;
    }

    const insertRec = (node: BPlusNode): { splitKey: number; right: BPlusNode } | null => {
      if (node.leaf) {
        let idx = 0;
        while (idx < node.keys.length && node.keys[idx] < key) idx++;
        if (node.keys[idx] === key) return null;
        node.keys.splice(idx, 0, key);
        trace.push(`Inserted ${key} into B+ leaf`);
        if (node.keys.length < this.order) return null;

        const mid = Math.floor(node.keys.length / 2);
        const right: BPlusNode = {
          leaf: true,
          keys: node.keys.splice(mid),
          children: [],
          next: node.next,
        };
        node.next = right;
        trace.push(`Split B+ leaf; copy up key ${right.keys[0]} & link leaves`);
        return { splitKey: right.keys[0], right };
      }

      let i = 0;
      while (i < node.keys.length && key >= node.keys[i]) i++;
      const res = insertRec(node.children[i]);
      if (!res) return null;

      node.keys.splice(i, 0, res.splitKey);
      node.children.splice(i + 1, 0, res.right);
      if (node.keys.length < this.order) return null;

      const mid = Math.floor(node.keys.length / 2);
      const upKey = node.keys[mid];
      const right: BPlusNode = {
        leaf: false,
        keys: node.keys.splice(mid + 1),
        children: node.children.splice(mid + 1),
        next: null,
      };
      node.keys.pop();
      trace.push(`Split B+ internal node; push up ${upKey}`);
      return { splitKey: upKey, right };
    };

    const rootSplit = insertRec(this.root);
    if (rootSplit) {
      this.root = {
        leaf: false,
        keys: [rootSplit.splitKey],
        children: [this.root, rootSplit.right],
        next: null,
      };
    }
    return trace;
  }

  rangeQuery(low: number, high: number): number[] {
    const out: number[] = [];
    if (!this.root) return out;
    let cur = this.root;
    while (!cur.leaf) {
      let i = 0;
      while (i < cur.keys.length && low >= cur.keys[i]) i++;
      cur = cur.children[i];
    }
    while (cur) {
      for (const k of cur.keys) {
        if (k >= low && k <= high) out.push(k);
        if (k > high) return out;
      }
      cur = cur.next!;
    }
    return out;
  }

  toVisual(): TreeVisualNode | null {
    let cid = 0;
    const conv = (n: BPlusNode | null): TreeVisualNode | null => {
      if (!n) return null;
      return {
        id: `bp-${++cid}`,
        label: `[${n.keys.join(' | ')}]`,
        color: n.leaf ? 'emerald' : 'cyan',
        meta: n.leaf ? 'leaf' : 'index',
        children: n.children.map((c) => conv(c)!).filter(Boolean),
      };
    };
    return conv(this.root);
  }
}

// 9 & 10. Binary Heap & Priority Queue
export class BinaryHeap<T> {
  private data: T[] = [];
  private readonly compare: (a: T, b: T) => number; // negative if a has higher priority than b

  constructor(compareFn?: (a: T, b: T) => number) {
    this.compare = compareFn ?? ((a, b) => Number(b) - Number(a)); // Max-heap by default
  }

  push(val: T): void {
    this.data.push(val);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.compare(this.data[i], this.data[p]) < 0) {
        [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
        i = p;
      } else {
        break;
      }
    }
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      let i = 0;
      const n = this.data.length;
      while (true) {
        let best = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < n && this.compare(this.data[l], this.data[best]) < 0) best = l;
        if (r < n && this.compare(this.data[r], this.data[best]) < 0) best = r;
        if (best === i) break;
        [this.data[i], this.data[best]] = [this.data[best], this.data[i]];
        i = best;
      }
    }
    return top;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  get size(): number {
    return this.data.length;
  }

  toArray(): T[] {
    return [...this.data];
  }

  toVisual(labelFn: (item: T) => string = (x) => String(x)): TreeVisualNode | null {
    const build = (idx: number): TreeVisualNode | null => {
      if (idx >= this.data.length) return null;
      const children: TreeVisualNode[] = [];
      const l = build(2 * idx + 1);
      const r = build(2 * idx + 2);
      if (l) children.push(l);
      if (r) children.push(r);
      return { id: `heap-${idx}`, label: labelFn(this.data[idx]), color: 'cyan', children };
    };
    return build(0);
  }
}

export class PriorityQueue<T> {
  private heap: BinaryHeap<{ priority: number; item: T }>;

  constructor(isMaxPriority = true) {
    this.heap = new BinaryHeap((a, b) => (isMaxPriority ? b.priority - a.priority : a.priority - b.priority));
  }

  enqueue(item: T, priority: number): void {
    this.heap.push({ item, priority });
  }

  dequeue(): T | undefined {
    return this.heap.pop()?.item;
  }

  peek(): T | undefined {
    return this.heap.peek()?.item;
  }

  get size(): number {
    return this.heap.size;
  }
}
