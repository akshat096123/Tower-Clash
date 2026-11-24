// Manual generic Linear Data Structures (No built-in Array stack/queue shortcuts in DSA demos)

export class DynamicArray<T> {
  private buffer: Array<T | undefined>;
  private count = 0;
  private cap: number;

  constructor(initialCapacity = 4) {
    this.cap = Math.max(2, initialCapacity);
    this.buffer = new Array<T | undefined>(this.cap);
  }

  private resize(newCap: number): void {
    const next = new Array<T | undefined>(newCap);
    for (let i = 0; i < this.count; i++) {
      next[i] = this.buffer[i];
    }
    this.buffer = next;
    this.cap = newCap;
  }

  pushBack(value: T): void {
    if (this.count === this.cap) {
      this.resize(this.cap * 2);
    }
    this.buffer[this.count++] = value;
  }

  popBack(): T {
    if (this.count === 0) throw new Error('DynamicArray is empty');
    const val = this.buffer[this.count - 1] as T;
    this.buffer[this.count - 1] = undefined;
    this.count--;
    return val;
  }

  insertAt(index: number, value: T): void {
    if (index < 0 || index > this.count) throw new Error('Index out of bounds');
    if (this.count === this.cap) this.resize(this.cap * 2);
    for (let i = this.count; i > index; i--) {
      this.buffer[i] = this.buffer[i - 1];
    }
    this.buffer[index] = value;
    this.count++;
  }

  removeAt(index: number): T {
    if (index < 0 || index >= this.count) throw new Error('Index out of bounds');
    const removed = this.buffer[index] as T;
    for (let i = index; i < this.count - 1; i++) {
      this.buffer[i] = this.buffer[i + 1];
    }
    this.buffer[this.count - 1] = undefined;
    this.count--;
    return removed;
  }

  get(index: number): T {
    if (index < 0 || index >= this.count) throw new Error('Index out of bounds');
    return this.buffer[index] as T;
  }

  set(index: number, value: T): void {
    if (index < 0 || index >= this.count) throw new Error('Index out of bounds');
    this.buffer[index] = value;
  }

  clear(): void {
    this.count = 0;
    this.buffer = new Array<T | undefined>(this.cap);
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.cap;
  }

  toArray(): T[] {
    const out: T[] = new Array<T>(this.count);
    for (let i = 0; i < this.count; i++) {
      out[i] = this.buffer[i] as T;
    }
    return out;
  }

  memoryBytes(elementBytes = 8): number {
    return 32 + this.cap * elementBytes;
  }
}

export class Stack<T> {
  private items: DynamicArray<T>;

  constructor() {
    this.items = new DynamicArray<T>(8);
  }

  push(value: T): void {
    this.items.pushBack(value);
  }

  pop(): T {
    if (this.isEmpty()) throw new Error('Stack underflow');
    return this.items.popBack();
  }

  peek(): T {
    if (this.isEmpty()) throw new Error('Stack is empty');
    return this.items.get(this.items.size - 1);
  }

  isEmpty(): boolean {
    return this.items.size === 0;
  }

  get size(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  toArray(): T[] {
    return this.items.toArray();
  }

  memoryBytes(elementBytes = 16): number {
    return this.items.memoryBytes(elementBytes);
  }
}

interface QueueNode<T> {
  value: T;
  next: QueueNode<T> | null;
}

export class Queue<T> {
  private head: QueueNode<T> | null = null;
  private tail: QueueNode<T> | null = null;
  private count = 0;

  enqueue(value: T): void {
    const node: QueueNode<T> = { value, next: null };
    if (this.tail === null) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.count++;
  }

  dequeue(): T {
    if (this.head === null) throw new Error('Queue underflow');
    const val = this.head.value;
    this.head = this.head.next;
    if (this.head === null) this.tail = null;
    this.count--;
    return val;
  }

  front(): T {
    if (this.head === null) throw new Error('Queue is empty');
    return this.head.value;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.head = null;
    this.tail = null;
    this.count = 0;
  }

  toArray(): T[] {
    const res: T[] = [];
    let curr = this.head;
    while (curr !== null) {
      res.push(curr.value);
      curr = curr.next;
    }
    return res;
  }

  memoryBytes(elementBytes = 16): number {
    return 24 + this.count * (elementBytes + 16);
  }
}

export class CircularQueue<T> {
  private buffer: Array<T | undefined>;
  private head = 0;
  private tail = 0;
  private count = 0;
  private readonly cap: number;

  constructor(capacity = 8) {
    this.cap = Math.max(2, capacity);
    this.buffer = new Array<T | undefined>(this.cap);
  }

  enqueue(value: T): boolean {
    if (this.isFull()) return false;
    this.buffer[this.tail] = value;
    this.tail = (this.tail + 1) % this.cap;
    this.count++;
    return true;
  }

  dequeue(): T {
    if (this.isEmpty()) throw new Error('CircularQueue underflow');
    const val = this.buffer[this.head] as T;
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.cap;
    this.count--;
    return val;
  }

  peek(): T {
    if (this.isEmpty()) throw new Error('CircularQueue empty');
    return this.buffer[this.head] as T;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  isFull(): boolean {
    return this.count === this.cap;
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.cap;
  }

  getPointers(): { head: number; tail: number; count: number; capacity: number; slots: Array<T | undefined> } {
    return {
      head: this.head,
      tail: this.tail,
      count: this.count,
      capacity: this.cap,
      slots: [...this.buffer],
    };
  }
}
