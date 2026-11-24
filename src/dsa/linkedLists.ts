// Manual Linked Lists (Singly, Doubly, Circular, Multi-Linked) and Sparse Matrix

export interface SinglyNode<T> {
  data: T;
  next: SinglyNode<T> | null;
}

export class SinglyLinkedList<T> {
  private head: SinglyNode<T> | null = null;
  private tail: SinglyNode<T> | null = null;
  private count = 0;

  pushFront(val: T): void {
    const node: SinglyNode<T> = { data: val, next: this.head };
    this.head = node;
    if (this.tail === null) this.tail = node;
    this.count++;
  }

  pushBack(val: T): void {
    const node: SinglyNode<T> = { data: val, next: null };
    if (this.tail === null) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.count++;
  }

  removeByPredicate(pred: (item: T) => boolean): boolean {
    let prev: SinglyNode<T> | null = null;
    let curr = this.head;
    while (curr !== null) {
      if (pred(curr.data)) {
        if (prev === null) this.head = curr.next;
        else prev.next = curr.next;
        if (curr === this.tail) this.tail = prev;
        this.count--;
        return true;
      }
      prev = curr;
      curr = curr.next;
    }
    return false;
  }

  toArray(): T[] {
    const out: T[] = [];
    let curr = this.head;
    while (curr !== null) {
      out.push(curr.data);
      curr = curr.next;
    }
    return out;
  }

  get size(): number {
    return this.count;
  }
}

export interface DoublyNode<T> {
  data: T;
  prev: DoublyNode<T> | null;
  next: DoublyNode<T> | null;
}

export class DoublyLinkedList<T> {
  private headNode: DoublyNode<T> | null = null;
  private tailNode: DoublyNode<T> | null = null;
  private count = 0;

  pushBack(val: T): DoublyNode<T> {
    const node: DoublyNode<T> = { data: val, prev: this.tailNode, next: null };
    if (this.tailNode === null) {
      this.headNode = this.tailNode = node;
    } else {
      this.tailNode.next = node;
      this.tailNode = node;
    }
    this.count++;
    return node;
  }

  removeNode(node: DoublyNode<T>): void {
    if (node.prev !== null) node.prev.next = node.next;
    else this.headNode = node.next;
    if (node.next !== null) node.next.prev = node.prev;
    else this.tailNode = node.prev;
    node.prev = null;
    node.next = null;
    this.count--;
  }

  removeByPredicate(pred: (item: T) => boolean): boolean {
    let curr = this.headNode;
    while (curr !== null) {
      if (pred(curr.data)) {
        this.removeNode(curr);
        return true;
      }
      curr = curr.next;
    }
    return false;
  }

  forEach(cb: (item: T, node: DoublyNode<T>) => void): void {
    let curr = this.headNode;
    while (curr !== null) {
      const next = curr.next;
      cb(curr.data, curr);
      curr = next;
    }
  }

  toArray(): T[] {
    const out: T[] = [];
    let curr = this.headNode;
    while (curr !== null) {
      out.push(curr.data);
      curr = curr.next;
    }
    return out;
  }

  clear(): void {
    this.headNode = null;
    this.tailNode = null;
    this.count = 0;
  }

  get size(): number {
    return this.count;
  }
}

export interface CircularNode<T> {
  data: T;
  next: CircularNode<T>;
}

export class CircularLinkedList<T> {
  private tail: CircularNode<T> | null = null;
  private count = 0;

  pushBack(val: T): void {
    if (this.tail === null) {
      const node = { data: val } as CircularNode<T>;
      node.next = node;
      this.tail = node;
    } else {
      const node: CircularNode<T> = { data: val, next: this.tail.next };
      this.tail.next = node;
      this.tail = node;
    }
    this.count++;
  }

  rotateNext(): T | null {
    if (this.tail === null) return null;
    this.tail = this.tail.next;
    return this.tail.data;
  }

  removeFirst(pred: (item: T) => boolean): boolean {
    if (this.tail === null) return false;
    let prev = this.tail;
    let curr = this.tail.next;
    for (let i = 0; i < this.count; i++) {
      if (pred(curr.data)) {
        if (this.count === 1) {
          this.tail = null;
        } else {
          prev.next = curr.next;
          if (curr === this.tail) this.tail = prev;
        }
        this.count--;
        return true;
      }
      prev = curr;
      curr = curr.next;
    }
    return false;
  }

  toArray(): T[] {
    if (this.tail === null) return [];
    const out: T[] = [];
    let curr = this.tail.next;
    for (let i = 0; i < this.count; i++) {
      out.push(curr.data);
      curr = curr.next;
    }
    return out;
  }

  get size(): number {
    return this.count;
  }
}

// Multi-Linked List for Sparse Matrix Representation
export interface SparseCell {
  row: number;
  col: number;
  value: number;
  label?: string;
  right: SparseCell | null;
  down: SparseCell | null;
}

export class SparseMatrix {
  readonly rows: number;
  readonly cols: number;
  private rowHeads: Array<SparseCell | null>;
  private colHeads: Array<SparseCell | null>;
  private nonZero = 0;

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.rowHeads = new Array<SparseCell | null>(rows).fill(null);
    this.colHeads = new Array<SparseCell | null>(cols).fill(null);
  }

  set(r: number, c: number, value: number, label?: string): void {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
      throw new Error('SparseMatrix coordinates out of bounds');
    }
    if (value === 0) {
      this.remove(r, c);
      return;
    }

    let prevR: SparseCell | null = null;
    let currR = this.rowHeads[r];
    while (currR !== null && currR.col < c) {
      prevR = currR;
      currR = currR.right;
    }
    if (currR !== null && currR.col === c) {
      currR.value = value;
      currR.label = label;
      return;
    }

    const cell: SparseCell = { row: r, col: c, value, label, right: currR, down: null };
    if (prevR === null) this.rowHeads[r] = cell;
    else prevR.right = cell;

    let prevC: SparseCell | null = null;
    let currC = this.colHeads[c];
    while (currC !== null && currC.row < r) {
      prevC = currC;
      currC = currC.down;
    }
    cell.down = currC;
    if (prevC === null) this.colHeads[c] = cell;
    else prevC.down = cell;

    this.nonZero++;
  }

  get(r: number, c: number): number {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return 0;
    let curr = this.rowHeads[r];
    while (curr !== null && curr.col < c) curr = curr.right;
    return curr !== null && curr.col === c ? curr.value : 0;
  }

  remove(r: number, c: number): boolean {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    let prevR: SparseCell | null = null;
    let currR = this.rowHeads[r];
    while (currR !== null && currR.col < c) {
      prevR = currR;
      currR = currR.right;
    }
    if (currR === null || currR.col !== c) return false;

    if (prevR === null) this.rowHeads[r] = currR.right;
    else prevR.right = currR.right;

    let prevC: SparseCell | null = null;
    let currC = this.colHeads[c];
    while (currC !== null && currC.row < r) {
      prevC = currC;
      currC = currC.down;
    }
    if (currC === currR) {
      if (prevC === null) this.colHeads[c] = currC.down;
      else prevC.down = currC.down;
    }
    this.nonZero--;
    return true;
  }

  traverseRowWise(): Array<{ row: number; col: number; value: number; label?: string }> {
    const out: Array<{ row: number; col: number; value: number; label?: string }> = [];
    for (let r = 0; r < this.rows; r++) {
      let curr = this.rowHeads[r];
      while (curr !== null) {
        out.push({ row: curr.row, col: curr.col, value: curr.value, label: curr.label });
        curr = curr.right;
      }
    }
    return out;
  }

  traverseColWise(): Array<{ row: number; col: number; value: number; label?: string }> {
    const out: Array<{ row: number; col: number; value: number; label?: string }> = [];
    for (let c = 0; c < this.cols; c++) {
      let curr = this.colHeads[c];
      while (curr !== null) {
        out.push({ row: curr.row, col: curr.col, value: curr.value, label: curr.label });
        curr = curr.down;
      }
    }
    return out;
  }

  get nonZeroCount(): number {
    return this.nonZero;
  }

  memoryComparison(): { sparseBytes: number; denseBytes: number; savingsPercent: number } {
    const sparseBytes = (this.rows + this.cols) * 8 + this.nonZero * 40;
    const denseBytes = this.rows * this.cols * 8;
    const savingsPercent = denseBytes > 0 ? Math.max(0, Math.round(((denseBytes - sparseBytes) / denseBytes) * 1000) / 10) : 0;
    return { sparseBytes, denseBytes, savingsPercent };
  }
}
